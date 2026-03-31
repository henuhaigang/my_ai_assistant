import httpx
from typing import Dict, Any
from .config import settings

async def get_weather(city: str) -> str:
    if not settings.WEATHER_API_KEY:
        return "天气功能未配置"
    async with httpx.AsyncClient() as client:
        url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={settings.WEATHER_API_KEY}&units=metric&lang=zh_cn"
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            weather = data['weather'][0]['description']
            temp = data['main']['temp']
            return f"{city} 当前天气：{weather}，温度 {temp}°C"
        else:
            return f"获取天气失败：{resp.status_code}"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，例如：北京"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

async def call_tool(tool_call) -> str:
    if tool_call.function.name == "get_weather":
        import json
        args = json.loads(tool_call.function.arguments)
        return await get_weather(args["city"])
    return "未知工具"
