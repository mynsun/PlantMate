import os
import json
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ValidationError, Field
from typing import List, Optional
from dotenv import load_dotenv
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
import requests
from urllib.parse import unquote
from io import BytesIO
from datetime import datetime, timedelta
from fastapi import Query
import logging
import pymysql
import math
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from googleapiclient.discovery import build

load_dotenv()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")  # 토큰 엔드포인트 경로
SECRET_KEY = os.getenv("JWT_SECRET_KEY")  # .env에 설정해둔 비밀키 사용

app = FastAPI(
    title="식물 추천 서비스",
    description="사용자의 환경 정보를 받아 OpenAI로 식물을 추천하는 기능"
)

origins = [
    "http://localhost",
    "http://localhost:3000", 
    "http://localhost:3002", 
    "http://15.168.150.125",     
    "http://15.168.150.125:3000", 
    "http://15.168.150.125:3002",
    "https://plantmate.site"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
if not KAKAO_REST_API_KEY:
    raise RuntimeError("KAKAO_REST_API_KEY가 .env에 설정되어 있지 않습니다.")

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
if not OPENWEATHER_API_KEY:
    raise RuntimeError("OPENWEATHER_API_KEY 환경 변수가 설정되지 않았습니다.")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일을 확인해 주세요.")

openai_client = OpenAI(api_key=OPENAI_API_KEY)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
if not GOOGLE_API_KEY or not GOOGLE_CSE_ID:
    raise RuntimeError("GOOGLE_API_KEY 또는 GOOGLE_CSE_ID 환경 변수가 설정되지 않았습니다. .env 파일을 확인해 주세요.")

google_search_service = build("customsearch", "v1", developerKey=GOOGLE_API_KEY)

DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST"),
    "user": os.getenv("MYSQL_USER"),
    "password": os.getenv("MYSQL_PASSWORD"),
    "database": os.getenv("MYSQL_DB"),
    "cursorclass": pymysql.cursors.DictCursor,
}

class EnvironmentInput(BaseModel):
    has_south_sun: bool = False
    has_north_sun: bool = False
    has_east_sun: bool = False
    has_west_sun: bool = False
    plant_location: str
    has_blinds_curtains: bool
    water_frequency: int

class RecommendedPlant(BaseModel):
    name: str
    description: str
    image_url: Optional[str] = None 

class PlantRecommendationResponse(BaseModel):
    recommendations: List[RecommendedPlant]

def get_current_user_id(token: str = Depends(oauth2_scheme)) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = int(payload.get("sub"))
        return user_id
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")

def get_env_description(
    has_south_sun: bool,
    has_north_sun: bool,
    has_east_sun: bool,
    has_west_sun: bool,
    plant_location: str,
    has_blinds_curtains: bool,
    water_frequency: int
) -> str:
    sun_directions = []
    if has_south_sun: sun_directions.append("남향 (햇빛이 강하게 들 수 있음)")
    if has_north_sun: sun_directions.append("북향 (햇빛이 거의 없거나 간접광만 있음)")
    if has_east_sun: sun_directions.append("동향 (오전에 햇빛이 들고 오후에 간접광)")
    if has_west_sun: sun_directions.append("서향 (오후에 햇빛이 강하게 들 수 있음)")

    if not sun_directions:
        sun_direction_str = "햇빛 방향 정보가 명확하지 않습니다 (선택된 방향 없음)."
    elif len(sun_directions) == 1:
        sun_direction_str = sun_directions[0]
    else:
        sun_direction_str = f"여러 방향의 햇빛이 들어옵니다: {', '.join(sun_directions)}"

    location_map = {
        "Indoor": "창가에서 1m 이상 떨어진 실내",
        "Window": "창가 바로 옆 (직사광선 가능성이 있음)",
        "Balcony": "베란다/발코니 (야외와 유사한 환경)"
    }

    water_map = {
        1: "흙이 마르면 바로 물을 주는 것을 선호합니다 (물을 자주 주는 편)",
        2: "흙 표면이 마르면 물을 주는 것을 선호합니다 (주 1~2회 정도)",
        3: "흙 속까지 완전히 마르면 물을 주는 것을 선호합니다 (주 1회 미만 또는 더 긴 간격)",
        4: "한 달 이상 간격으로 물을 주는 것을 선호합니다 (물을 매우 드물게 주는 편)"
    }

    blinds_status = "블라인드/커튼이 있습니다." if has_blinds_curtains else "블라인드/커튼이 없습니다.";

    return (
        f"화분을 놓을 곳의 햇빛 환경: {sun_direction_str}\n"
        f"식물 위치: {location_map.get(plant_location, '알 수 없음')}\n"
        f"블라인드/커튼 유무: {blinds_status}\n"
        f"물주기 빈도: {water_map.get(water_frequency, '알 수 없음')}"
    )

async def search_plant_image(plant_name: str) -> Optional[str]:
    """
    Google Custom Search API를 사용하여 식물 이미지를 검색하고 첫 번째 이미지 URL을 반환합니다. 글자가 있는 사진은 제외해주세요.
    """
    try:
        res = google_search_service.cse().list(
            q=f"{plant_name} 식물",
            cx=GOOGLE_CSE_ID,
            searchType="image", 
            num=1 
        ).execute()

        if 'items' in res and len(res['items']) > 0:
            print(f"Google Search: Found image for '{plant_name}': {res['items'][0].get('link')}")
            return res['items'][0].get('link')
        print(f"Google Search: No image found for '{plant_name}'.")
        return None
    except Exception as e:
        print(f"Google Image Search 오류 ({plant_name}): {e}")
        return None

def get_coords(address: str):
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": address}

    try:
        res = requests.get(url, headers=headers, params=params)
        res.raise_for_status()
        data = res.json()
        if data["documents"]:
            y = float(data["documents"][0]["y"])
            x = float(data["documents"][0]["x"])
            return y, x
    except Exception as e:
        print(f"[DEBUG] 주소 변환 실패: {e}")
    return None, None

def get_lat_lon_from_address(address: str):
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": address}
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    result = response.json()
    if result["documents"]:
        first = result["documents"][0]
        return float(first["y"]), float(first["x"])
    raise ValueError("주소로부터 위도/경도를 찾을 수 없습니다.")

def get_weather_info(lat: float, lon: float):
    url = (
        f"https://api.openweathermap.org/data/2.5/weather?"
        f"lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang=kr"
    )
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()
    return {
        "temperature": data["main"]["temp"],
        "feels_like": data["main"]["feels_like"],
        "humidity": data["main"]["humidity"],
        "weather": data["weather"][0]["description"],
        "wind": data["wind"]["speed"],
        "rain": data.get("rain", {}).get("1h", 0),
    }

def get_user_plants_with_address(user_id: int):
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT address FROM users WHERE user_id = %s", (user_id,))
            user = cursor.fetchone()
            if not user or not user["address"]:
                raise ValueError("해당 유저의 주소를 찾을 수 없습니다.")
            address = user["address"]

            cursor.execute("""
                SELECT p.plant_name FROM user_plants up
                JOIN plants p ON up.plant_id = p.plant_id
                WHERE up.user_id = %s
            """, (user_id,))
            result = cursor.fetchall()
            plant_names = [row["plant_name"] for row in result]

            return address, plant_names
    finally:
        conn.close()

def generate_care_advice(plant_name: str, weather_info: dict) -> str:
    prompt = f"""
    식물 '{plant_name}'의 오늘 날씨는 다음과 같습니다:
    - 현재 기온: {weather_info['temperature']}°C
    - 날씨 상태: {weather_info['weather']}

    위 정보를 바탕으로, 식물을 오늘 날씨에 맞게 어떻게 관리해야 할지 한국어로 알려주세요.
    내용은 200자 이내로 알려주세요.
    """
    response = openai_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content


@app.post("/recommend/", response_model=PlantRecommendationResponse)
async def recommend_plants(env_input: EnvironmentInput):
    env_description = get_env_description(
        env_input.has_south_sun,
        env_input.has_north_sun,
        env_input.has_east_sun,
        env_input.has_west_sun,
        env_input.plant_location,
        env_input.has_blinds_curtains,
        env_input.water_frequency
    )

    tools = [
        {
            "type": "function",
            "function": {
                "name": "recommend_plants",
                "description": "사용자의 환경 조건에 맞는 식물을 추천합니다.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "recommendations": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string", "description": "식물 이름"},
                                    "description": {"type": "string", "description": "식물에 대한 간략한 설명과 왜 이 환경에 적합한지 (햇빛, 물주기, 통풍, 기타 환경 요인 위주로)"},
                                },
                                "required": ["name", "description"] 
                            },
                            "minItems": 3,
                            "maxItems": 3
                        }
                    },
                    "required": ["recommendations"]
                }
            },
        }
    ]

    prompt_content = f"""
    당신은 식물 추천 전문가입니다. 사용자로부터 다음과 같은 거주 환경 정보를 받았습니다:

    {env_description}

    이러한 환경 조건에 가장 적합하도록 한국에서 키우기 쉬운 실내 식물 3가지를 다양하게 추천해주세요.
    각 식물에 대해 이름과 자세한 설명을 포함해야 합니다.
    설명은 200자 이내로 자세하게 작성해주세요.
    """

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful plant recommendation expert. Provide plant recommendations in the specified JSON format using the `recommend_plants` tool."},
                {"role": "user", "content": prompt_content}
            ],
            tool_choice={"type": "function", "function": {"name": "recommend_plants"}},
            tools=tools,
            temperature=0.7, 
            max_tokens=500
        )
        
        tool_calls = response.choices[0].message.tool_calls
        if not tool_calls or tool_calls[0].function.name != "recommend_plants":
            raise ValueError("OpenAI가 `recommend_plants` 함수 호출을 반환하지 않았습니다. 다른 답변을 시도한 것 같습니다.")

        recommended_data_str = tool_calls[0].function.arguments
        print(f"OpenAI Raw Response (tool_calls.arguments): {recommended_data_str}")

        parsed_response_dict = json.loads(recommended_data_str)
        
        final_recommendations_list = parsed_response_dict.get("recommendations", [])
        
        if not final_recommendations_list:
            raise ValueError("OpenAI가 추천 식물 리스트를 비워 두거나 'recommendations' 키를 찾을 수 없습니다.")

        updated_recommendations = []
        for item in final_recommendations_list:
            plant_name = item.get("name")
            if plant_name:
                image_url = await search_plant_image(plant_name) 
                item["image_url"] = image_url 
            updated_recommendations.append(item)

        validated_recommendations = [RecommendedPlant(**item) for item in updated_recommendations]
        
        return PlantRecommendationResponse(recommendations=validated_recommendations)

    except json.JSONDecodeError as e:
        print(f"JSON 파싱 오류 발생: {e}")
        original_data = recommended_data_str if 'recommended_data_str' in locals() else "데이터 없음"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"OpenAI 응답 파싱 오류: {e}. 원본 응답: {original_data[:200]}...")
    except ValueError as e:
        print(f"값 오류 발생: {e}")
        original_data = recommended_data_str if 'recommended_data_str' in locals() else "데이터 없음"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"OpenAI 응답 형식 오류: {e}. 원본 응답: {original_data[:200]}...")
    except ValidationError as e:
        print(f"Pydantic 유효성 검사 오류: {e}")
        failed_data = final_recommendations_list if 'final_recommendations_list' in locals() else "파싱된 데이터 없음"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"OpenAI 응답 형식 오류: {e}. 유효성 검사 실패 데이터: {str(failed_data)[:200]}...")
    except OpenAI.APIError as e:
        print(f"OpenAI API 오류 (APIError): {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"OpenAI API 호출 중 오류 발생: {e.args[0] if e.args else str(e)}")
    except OpenAI.APIConnectionError as e:
        print(f"OpenAI API 오류 (APIConnectionError): {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"OpenAI API 연결 중 오류 발생: {e.args[0] if e.args else str(e)}")
    except OpenAI.RateLimitError as e: 
        print(f"OpenAI API 오류 (RateLimitError): {e}")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"OpenAI API 호출 제한 초과: {e.args[0] if e.args else str(e)}")
    except Exception as e: 
        print(f"알 수 없는 오류 발생: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"서버 오류: {e}")


@app.get("/proxy-image")
async def proxy_image(url: str):
    try:
        decoded_url = unquote(url)
        headers = {"User-Agent": "Mozilla/5.0"} 
        response = requests.get(decoded_url, headers=headers, timeout=10)
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "image/jpeg")
        img_stream = BytesIO(response.content)

        stream_response = StreamingResponse(img_stream, media_type=content_type)
        stream_response.headers["Access-Control-Allow-Origin"] = "*" 
        stream_response.headers["Cache-Control"] = "no-store"         
        return stream_response

    except Exception as e:
        print(f"[Proxy Error] {e}")
        raise HTTPException(status_code=500, detail="이미지를 불러오는 데 실패했습니다.")


@app.get("/weather")
def get_weather(address: str = Query(...)):
    try:
        lat, lon = get_lat_lon_from_address(address)
        print(f"[DEBUG] 변환된 위도: {lat}, 경도: {lon}")

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang=kr"
        print("[DEBUG] 요청 URL:", url)

        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        rain_1h = data.get("rain", {}).get("1h", 0.0)
        rain_3h = data.get("rain", {}).get("3h", 0.0)

        weather = {
            "위치": data.get("name", "알 수 없음"),
            "날씨": data["weather"][0]["description"],
            "기온(°C)": data["main"]["temp"],
            "습도(%)": data["main"]["humidity"],
            "바람속도(m/s)": data["wind"]["speed"],
            "바람방향(°)": data["wind"]["deg"],
            "구름량(%)": data["clouds"]["all"],
            "강수량(mm, 1시간)": weather["rain_1h"],
        }

        return {
            "address": address,
            "lat": lat,
            "lon": lon,
            "url": url,
            "weather": weather
        }

    except Exception as e:
        return {"error": str(e)}


@app.get("/plant-care")
async def get_plant_care_advice(user_id: int = Depends(get_current_user_id)):
    try:
        address, plant_names = get_user_plants_with_address(user_id)

        if not plant_names:
            return {"message": "해당 사용자의 식물이 없습니다."}

        lat, lon = get_lat_lon_from_address(address)

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang=kr"
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        rain_1h = data.get("rain", {}).get("1h", 0.0)
        rain_3h = data.get("rain", {}).get("3h", 0.0)

        weather_info = {
            "기온(°C)": data["main"]["temp"],
            "습도(%)": data["main"]["humidity"],
            "바람속도(m/s)": data["wind"]["speed"],
            "날씨": data["weather"][0]["description"],
            "강수량(mm, 1시간)": rain_1h,
        }

        advices = []
        for plant in plant_names:
            advice = await generate_care_advice(plant, {
                "temperature": data["main"]["temp"],
                "weather": data["weather"][0]["description"]
            })
            advices.append({"plant": plant, "advice": advice})

        return {
            "address": address,
            "weather": weather_info,
            "care_advice": advices,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 오류: {str(e)}")

