import os
import json
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel, ValidationError, Field
from openai import AsyncOpenAI, APIError, APIConnectionError, RateLimitError
from googleapiclient.discovery import build
import pymysql
import requests
from urllib.parse import unquote, quote, urlparse
from io import BytesIO
import hashlib
import mimetypes
import base64

load_dotenv()

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
    "https://plantmate.site",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
if not KAKAO_REST_API_KEY:
    raise RuntimeError("KAKAO_REST_API_KEY가 .env에 설정되어 있지 않습니다.")

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
if not OPENWEATHER_API_KEY:
    raise RuntimeError("OPENWEATHER_API_KEY 환경 변수가 설정되지 않았습니다.")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일을 확인해 주세요.")
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

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


class AddressUpdate(BaseModel):
    address: str = Field(..., min_length=2, max_length=200)

def get_user_id_optional(
    request: Request,
    user_id: Optional[int] = Query(None)
) -> int:
    if user_id is not None:
        return int(user_id)
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        sub = payload.get("sub")
        return int(sub)
    except (JWTError, ValueError) as e:
        raise HTTPException(status_code=401, detail=f"유효하지 않은 토큰입니다: {e}")

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
    if has_south_sun:
        sun_directions.append("남향 (햇빛이 강하게 들 수 있음)")
    if has_north_sun:
        sun_directions.append("북향 (햇빛이 거의 없거나 간접광만 있음)")
    if has_east_sun:
        sun_directions.append("동향 (오전에 햇빛이 들고 오후에 간접광)")
    if has_west_sun:
        sun_directions.append("서향 (오후에 햇빛이 강하게 들 수 있음)")

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

    blinds_status = "블라인드/커튼이 있습니다." if has_blinds_curtains else "블라인드/커튼이 없습니다."

    return (
        f"화분을 놓을 곳의 햇빛 환경: {sun_direction_str}\n"
        f"식물 위치: {location_map.get(plant_location, '알 수 없음')}\n"
        f"블라인드/커튼 유무: {blinds_status}\n"
        f"물주기 빈도: {water_map.get(water_frequency, '알 수 없음')}"
    )


async def search_plant_image(plant_name: str) -> Optional[str]:
    try:
        res = google_search_service.cse().list(
            q=f"{plant_name} 식물",
            cx=GOOGLE_CSE_ID,
            searchType="image",
            num=1
        ).execute()
        if 'items' in res and len(res['items']) > 0:
            return res['items'][0].get('link')
        return None
    except Exception:
        return None


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

def get_user_plants_from_reports(user_id: int) -> List[str]:
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT plant_name
                FROM user_plant_growth_reports
                WHERE user_id = %s
                  AND plant_name IS NOT NULL
                  AND plant_name <> ''
                ORDER BY plant_name
            """, (user_id,))
            rows = cursor.fetchall()
            return [r["plant_name"] for r in rows]
    finally:
        conn.close()


def list_my_plants(user_id: int) -> List[str]:
    names = get_user_plants_from_reports(user_id)
    if names:
        return names
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as c:
            c.execute("""
                SELECT p.plant_name
                FROM user_plants up
                JOIN plants p ON up.plant_id = p.plant_id
                WHERE up.user_id = %s
                ORDER BY p.plant_name
            """, (user_id,))
            rows = c.fetchall()
            return [r["plant_name"] for r in rows]
    finally:
        conn.close()


def get_user_plants(user_id: int) -> List[str]:
    return list_my_plants(user_id)


def get_user_plants_with_address(user_id: int):
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT address FROM users WHERE user_id = %s", (user_id,))
            user = cursor.fetchone()
            if not user or not user["address"]:
                raise ValueError("해당 유저의 주소를 찾을 수 없습니다.")
            address = user["address"]
            plants = list_my_plants(user_id)
            return address, plants
    finally:
        conn.close()

async def generate_batch_care_advice(plant_names: List[str], weather_info: dict) -> List[dict]:
    plant_names_str = ", ".join(plant_names)
    prompt = f"""
    당신은 식물 관리 전문가입니다.
    오늘 날씨는 다음과 같습니다:
    - 현재 기온: {weather_info['temperature']}°C
    - 날씨 상태: {weather_info['weather']}
    이 날씨 정보에 맞춰 다음 식물들 '{plant_names_str}'의 오늘 관리 방법을 300자 이내로 자세하게 알려주세요.
    관리 방법은 문장으로 알려주세요.
    응답은 반드시 아래와 같은 JSON 객체 형식으로만 반환해야 합니다.
    예시: {{"care_advice": [{{"plant": "식물 이름 1", "advice": "관리 조언 1"}}, {{"plant": "식물 이름 2", "advice": "관리 조언 2"}}]}}
    """
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        advice_content = response.choices[0].message.content
        advice_json_object = json.loads(advice_content)
        if "care_advice" not in advice_json_object:
            raise ValueError("OpenAI 응답에 'care_advice' 키가 없습니다.")
        return advice_json_object["care_advice"]
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="OpenAI 응답 형식 오류가 발생했습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"식물 관리 조언 생성 중 오류가 발생했습니다: {e}")

@app.post("/precommend/recommend", response_model=PlantRecommendationResponse)
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

    tools = [{
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
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                            },
                            "required": ["name", "description"]
                        },
                        "minItems": 3,
                        "maxItems": 3
                    }
                },
                "required": ["recommendations"]
            }
        }
    }]

    prompt_content = f"""
    당신은 식물 추천 전문가입니다.
    사용자로부터 다음과 같은 거주 환경 정보를 받았습니다:
    {env_description}
    이러한 환경 조건에 가장 적합하도록 한국에서 키우기 쉬운 실내 식물 3가지를 다양하게 추천해주세요.
    각 식물에 대해 이름과 자세한 설명을 포함해야 합니다.
    설명은 200자 이내로 자세하게 작성해주세요.
    """

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful plant recommendation expert. Provide plant recommendations in the specified JSON format using the recommend_plants tool."},
                {"role": "user", "content": prompt_content}
            ],
            tool_choice={"type": "function", "function": {"name": "recommend_plants"}},
            tools=tools,
            temperature=0.7,
            max_tokens=500
        )

        tool_calls = response.choices[0].message.tool_calls
        if not tool_calls or tool_calls[0].function.name != "recommend_plants":
            raise ValueError("OpenAI가 recommend_plants 함수 호출을 반환하지 않았습니다.")

        recommended_data_str = tool_calls[0].function.arguments
        parsed_response_dict = json.loads(recommended_data_str)
        final_recommendations_list = parsed_response_dict.get("recommendations", [])
        if not final_recommendations_list:
            raise ValueError("추천 결과가 비었습니다.")

        updated = []
        for item in final_recommendations_list:
            plant_name = item.get("name")
            if plant_name:
                image_url = await search_plant_image(plant_name)
                if image_url:
                    item["image_url"] = f"/precommend/proxy-image?url={quote(image_url, safe='')}"
                else:
                    item["image_url"] = None
            updated.append(item)

        validated = [RecommendedPlant(**it) for it in updated]
        return PlantRecommendationResponse(recommendations=validated)

    except (json.JSONDecodeError, ValueError, ValidationError) as e:
        raise HTTPException(status_code=500, detail=f"OpenAI 응답 형식 오류: {e}")
    except APIError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI API 오류: {e}")
    except APIConnectionError as e:
        raise HTTPException(status_code=503, detail=f"OpenAI 연결 오류: {e}")
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=f"OpenAI 호출 제한: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버  오류: {e}")

_TRANSPARENT_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMA"
    "ASsJTYQAAAAASUVORK5CYII="
)
_TRANSPARENT_PNG = base64.b64decode(_TRANSPARENT_PNG_B64)

_FORCE_REFERERS = {
    "namu.wiki": "https://namu.wiki/",
    "i.namu.wiki": "https://namu.wiki/",
    "i.pinimg.com": "https://www.pinterest.com/",
    "pbs.twimg.com": "https://twitter.com/",
    "live.staticflickr.com": "https://www.flickr.com/",
}

def _guess_mime_from_path(path: str) -> str:
    guessed = mimetypes.guess_type(path)[0] or ""
    if guessed.startswith("image/"):
        return guessed
    if path.lower().endswith(".webp"):
        return "image/webp"
    return "image/jpeg"

def _ok_response(content_bytes: bytes, content_type: str) -> StreamingResponse:
    etag = hashlib.sha1(content_bytes).hexdigest()
    stream = BytesIO(content_bytes)
    r = StreamingResponse(stream, media_type=content_type)
    r.headers["Access-Control-Allow-Origin"] = "*"
    r.headers["Cache-Control"] = "public, max-age=86400, immutable"
    r.headers["ETag"] = etag
    r.headers["Content-Length"] = str(len(content_bytes))
    r.headers["Accept-Ranges"] = "bytes"
    return r

@app.get("/proxy-image")
async def proxy_image(url: str):
    try:
        decoded_url = unquote(url)
        parsed = urlparse(decoded_url)

        req_headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
            "Accept-Language": "ko,en;q=0.9",
        }
        host = parsed.hostname or ""
        for k, v in _FORCE_REFERERS.items():
            if host == k or host.endswith("." + k):
                req_headers["Referer"] = v
                break

        resp = requests.get(decoded_url, headers=req_headers, timeout=15, allow_redirects=True)
        resp.raise_for_status()

        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].lower().strip()
        if not content_type.startswith("image/"):
            content_type = _guess_mime_from_path(parsed.path)

        return _ok_response(resp.content, content_type)

    except Exception as e:
        print(f"[Proxy Error] {e} - Fallback transparent PNG")
        return _ok_response(_TRANSPARENT_PNG, "image/png")

@app.get("/precommend/proxy-image")
async def proxy_image_alias(url: str):
    return await proxy_image(url)

@app.get("/weather")
def get_weather(address: str = Query(...)):
    try:
        lat, lon = get_lat_lon_from_address(address)
        url = (
            f"https://api.openweathermap.org/data/2.5/weather?"
            f"lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang=kr"
        )
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        rain_1h = data.get("rain", {}).get("1h", 0.0)
        weather = {
            "위치": data.get("name", "알 수 없음"),
            "날씨": data["weather"][0]["description"],
            "기온(°C)": data["main"]["temp"],
            "습도(%)": data["main"]["humidity"],
            "바람속도(m/s)": data["wind"]["speed"],
            "바람방향(°)": data["wind"]["deg"],
            "구름량(%)": data["clouds"]["all"],
            "강수량(mm, 1시간)": rain_1h,
        }
        return {"address": address, "lat": lat, "lon": lon, "url": url, "weather": weather}
    except Exception as e:
        return {"error": str(e)}

@app.get("/precommend/my-plants")
def get_my_plants(user_id: int = Depends(get_user_id_optional)):
    plants = list_my_plants(user_id)
    return {"plants": plants}

async def _care_handler(user_id: int, address: Optional[str], plant_name: Optional[str] = None):
    try:
        if address:
            address_to_use = address
            all_plants = get_user_plants(user_id)
        else:
            address_to_use, all_plants = get_user_plants_with_address(user_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not address_to_use:
        raise HTTPException(status_code=422, detail="주소가 필요합니다. (users.address가 비어있음)")

    if not all_plants:
        return {
            "message": "해당 사용자의 식물이 없습니다.",
            "address": address_to_use,
            "care_advice": [],
            "need_plant_identification": True
        }

    target_plants = [plant_name] if (plant_name and plant_name in all_plants) else all_plants

    try:
        lat, lon = get_lat_lon_from_address(address_to_use)
        weather_info = get_weather_info(lat, lon)
        advices = await generate_batch_care_advice(
            target_plants,
            {"temperature": weather_info["temperature"], "weather": weather_info["weather"]}
        )
        return {
            "address": address_to_use,
            "weather": {
                "기온(°C)": weather_info["temperature"],
                "습도(%)": weather_info["humidity"],
                "바람속도(m/s)": weather_info["wind"],
                "날씨": weather_info["weather"],
                "강수량(mm, 1시간)": weather_info.get("rain", 0),
            },
            "care_advice": advices,
        }
    except requests.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"날씨 API 호출 실패: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")

@app.get("/precommend/plant-care")
async def get_plant_care_advice_pre(
    user_id: int = Depends(get_user_id_optional),
    address: Optional[str] = None,
    plant_name: Optional[str] = Query(None)
):
    return await _care_handler(user_id, address, plant_name)

@app.get("/api/plant-care")
async def get_plant_care_advice_api(
    request: Request,
    user_id: Optional[int] = Query(None),
    address: Optional[str] = None,
    plant_name: Optional[str] = Query(None)
):
    uid = get_user_id_optional(request, user_id)
    return await _care_handler(uid, address, plant_name)

def _update_address(user_id: int, addr: str):
    addr = addr.strip()
    if not addr:
        raise HTTPException(status_code=422, detail="주소가 비어 있습니다.")
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE users SET address = %s WHERE user_id = %s", (addr, user_id))
            conn.commit()
    finally:
        conn.close()
    return {"message": "주소가 저장되었습니다.", "address": addr}

@app.patch("/precommend/users/me/address")
def update_my_address_pre(
    payload: AddressUpdate,
    user_id: int = Depends(get_user_id_optional),
):
    return _update_address(user_id, payload.address)

@app.patch("/api/users/me/address")
def update_my_address_api(
    request: Request,
    payload: AddressUpdate,
    user_id: Optional[int] = Query(None),
):
    uid = get_user_id_optional(request, user_id)
    return _update_address(uid, payload.address)

@app.patch("/users/me/address")
def update_my_address_root(
    request: Request,
    payload: AddressUpdate,
    user_id: Optional[int] = Query(None),
):
    uid = get_user_id_optional(request, user_id)
    return _update_address(uid, payload.address)
