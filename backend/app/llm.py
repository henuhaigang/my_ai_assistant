import openai
import httpx
from typing import List, Dict, AsyncGenerator, Tuple
from .config import settings

if settings.LLM_PROVIDER == "openai":
    openai.api_key = settings.OPENAI_API_KEY
elif settings.LLM_PROVIDER == "dashscope":
    import dashscope
    dashscope.api_key = settings.DASHSCOPE_API_KEY

async def generate_stream(messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
    try:
        if settings.LLM_PROVIDER == "openai":
            response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=messages,
                stream=True,
                temperature=0.7,
            )
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.get("content"):
                    yield chunk.choices[0].delta.content
        elif settings.LLM_PROVIDER == "dashscope":
            from dashscope import Generation
            response = await Generation.acall(
                model="qwen-turbo",
                messages=messages,
                result_format="message",
                stream=True,
                incremental_output=True,
            )
            async for chunk in response:
                if chunk.output.choices[0].message.content:
                    yield chunk.output.choices[0].message.content
        elif settings.LLM_PROVIDER == "ollama":
            async for token in generate_ollama_stream(messages):
                yield token
        else:
            yield "Unsupported LLM provider"
    except Exception as e:
        yield f"Error: {str(e)}"

async def generate_ollama_stream(messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
    base_url = settings.OLLAMA_BASE_URL.rstrip('/v1').rstrip('/')
    chat_url = f"{base_url}/api/chat"
    
    client = httpx.AsyncClient(timeout=120.0)
    try:
        async with client.stream('POST', chat_url, json={
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": True
        }) as response:
            async for line in response.aiter_lines():
                if line.strip():
                    import json
                    try:
                        data = json.loads(line)
                        if 'message' in data:
                            msg = data['message']
                            thinking = msg.get('thinking', '')
                            content = msg.get('content', '')
                            
                            if thinking:
                                yield f"[THINKING]{thinking}[/THINKING]"
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        continue
    finally:
        await client.aclose()
