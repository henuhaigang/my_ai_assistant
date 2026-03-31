import openai
from typing import List, Dict, AsyncGenerator
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
        else:
            yield "Unsupported LLM provider"
    except Exception as e:
        yield f"Error: {str(e)}"
