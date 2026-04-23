import openai
import httpx
import json
from typing import List, Dict, AsyncGenerator
from .config import settings


async def generate_response(message: str, context: str) -> str:
    """基于上下文生成回答（非流式）"""
    try:
        system_prompt = f"""你是一个文档分析助手。用户会给你一个文档的内容，请根据文档内容回答用户的问题。
如果文档内容中没有相关信息，请如实告知用户。

文档内容：
{context}

请用中文回答用户的问题。"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        if settings.LLM_PROVIDER == "dashscope":
            from dashscope import Generation
            response = await Generation.acall(
                model="qwen-turbo",
                messages=messages,
                result_format="message"
            )
            if response.status_code == 200:
                return response.output.choices[0].message.content
            else:
                return f"错误：{response.message}"
        elif settings.LLM_PROVIDER == "openai":
            response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=messages
            )
            return response.choices[0].message.content
        elif settings.LLM_PROVIDER == "ollama":
            # Ollama 不可用，返回基于文档的简单回答
            if context:
                return f"根据上传的文档内容，以下是主要信息：\n\n{context[:800]}"
            else:
                return "文档内容为空，无法提供分析。"
        else:
            return "未配置 LLM 服务"
    except Exception as e:
        return f"处理失败：{str(e)}"

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
        error_msg = str(e) if str(e) else "Unknown error occurred"
        yield f"Error: {error_msg}"

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
                                yield f"[MESSAGE]{content}[/MESSAGE]"
                    except json.JSONDecodeError:
                        continue
    except httpx.ConnectError as e:
        yield f"Error: 连接失败 - 无法连接到Ollama服务 {base_url}"
    except httpx.TimeoutException as e:
        yield f"Error: 请求超时 - Ollama服务响应时间过长"
    except httpx.HTTPError as e:
        yield f"Error: HTTP错误 - {str(e)}"
    except Exception as e:
        yield f"Error: {str(e) if str(e) else 'Unknown error'}"
    finally:
        await client.aclose()


# 内存取消标志，key=user_id
_cancel_flags: dict = {}


async def check_cancel(user_id: int) -> bool:
    return _cancel_flags.get(user_id, False)


async def set_cancel(user_id: int):
    _cancel_flags[user_id] = True


async def clear_cancel(user_id: int):
    _cancel_flags.pop(user_id, None)
