from fastapi import FastAPI
from pydantic import BaseModel
from typing import Literal
import openai
import os

# OpenAI API 키 설정
openai.api_key = "YOUR_OPENAI_API_KEY"

app = FastAPI()

class UserEnvInput(BaseModel):
    sunlight: Literal['①', '②', '③', '④']
    watering_freq: Literal['①', '②', '③']
    wind: Literal['①', '②', '③']

# 선택지 설명 매핑 (프롬프트에 자연어로 전달)
sunlight_map = {
    '①': '하루 종일 직사광선이 내리쬐는 곳 (6시간 이상)',
    '②': '하루 중 절반 정도 직사광선이 드는 곳 (3~5시간)',
    '③': '직사광선 없이 밝은 빛만 드는 곳 (간접광)',
    '④': '빛이 거의 들지 않는 어두운 곳'
}
watering_map = {
    '①': '흙이 마르면 바로 물을 줄 수 있음',
    '②': '흙 표면이 마르면 물을 줄 수 있음 (주 1~2회 정도)',
    '③': '흙 속까지 완전히 마르면 물을 줄 수 있음 (주 1회 미만 또는 그보다 더 긴 간격)'
}
wind_map = {
    '①': '매우 잘 통풍되는 곳',
    '②': '적당히 통풍되는 곳',
    '③': '통풍이 잘 안 되는 곳'
}

@app.post("/recommend")
def recommend_plant(user_env: UserEnvInput):
    # 선택값을 설명으로 변환
    prompt = (
        f"내 환경 조건은 다음과 같아.\n"
        f"- 햇빛(광량): {sunlight_map[user_env.sunlight]}\n"
        f"- 물주기 빈도: {watering_map[user_env.watering_freq]}\n"
        f"- 통풍: {wind_map[user_env.wind]}\n"
        "이 조건에 가장 적합한 식물 2~3가지를 추천해주고, 각 식물의 특징과 관리법도 간단히 안내해줘."
    )

    response = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "너는 식물 추천 및 관리법 전문가야."},
            {"role": "user", "content": prompt}
        ]
    )
    result = response.choices[0].message.content
    return {"recommendation": result}
    