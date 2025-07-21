import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ValidationError
from typing import List
from dotenv import load_dotenv
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(
    title="식물 추천 서비스 (FastAPI 백엔드)",
    description="사용자의 환경 정보를 받아 OpenAI로 식물을 추천하는 핵심 로직."
)

origins = [
    "http://localhost",
    "http://localhost:3001", # Node.js 서버가 실행될 포트
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일을 확인해 주세요.")
openai_client = OpenAI(api_key=OPENAI_API_KEY)


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

class PlantRecommendationResponse(BaseModel):
    recommendations: List[RecommendedPlant]


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
        3: "흙 속까지 완전히 마르면 물을 주는 것을 선호합니다 (주 1회 미만 또는 더 긴 간격)"
    }

    blinds_status = "블라인드/커튼이 있습니다." if has_blinds_curtains else "블라인드/커튼이 없습니다.";

    return (
        f"화분을 놓을 곳의 햇빛 환경: {sun_direction_str}\n"
        f"식물 위치: {location_map.get(plant_location, '알 수 없음')}\n"
        f"블라인드/커튼 유무: {blinds_status}\n"
        f"물주기 빈도: {water_map.get(water_frequency, '알 수 없음')}"
    )


@app.post("/recommend/", response_model=PlantRecommendationResponse)
async def recommend_plants_openai(env_input: EnvironmentInput):
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
                                    "description": {"type": "string", "description": "식물에 대한 간략한 설명과 왜 이 환경에 적합한지 (햇빛, 물주기, 통풍, 기타 환경 요인 위주로)"}
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

    이러한 환경 조건에 가장 적합한 실내 식물 3가지를 추천해 주세요.
    각 식물에 대해 이름과 간략한 설명을 포함해야 합니다.
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

        validated_recommendations = [RecommendedPlant(**item) for item in final_recommendations_list]
        
        return PlantRecommendationResponse(recommendations=validated_recommendations)

    except json.JSONDecodeError as e:
        print(f"JSON 파싱 오류 발생: {e}")
        original_data = recommended_data_str if 'recommended_data_str' in locals() else "데이터 없음"
        raise HTTPException(status_code=500, detail=f"OpenAI 응답 파싱 오류: {e}. 원본 응답: {original_data[:200]}...")
    except ValueError as e:
        print(f"값 오류 발생: {e}")
        original_data = recommended_data_str if 'recommended_data_str' in locals() else "데이터 없음"
        raise HTTPException(status_code=500, detail=f"OpenAI 응답 형식 오류: {e}. 원본 응답: {original_data[:200]}...")
    except ValidationError as e:
        print(f"Pydantic 유효성 검사 오류: {e}")
        failed_data = final_recommendations_list if 'final_recommendations_list' in locals() else "파싱된 데이터 없음"
        raise HTTPException(status_code=500, detail=f"OpenAI 응답 형식 오류: {e}. 유효성 검사 실패 데이터: {str(failed_data)[:200]}...")
    except Exception as e:
        print(f"알 수 없는 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=f"OpenAI API 호출 중 알 수 없는 오류 발생: {e}")