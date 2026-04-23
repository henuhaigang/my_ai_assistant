import re
import json
from datetime import datetime, timezone
import openai
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import StreamingResponse, JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .. import models
from ..database import get_db
from ..auth import get_current_user
from ..redis_client import redis_client
from ..llm import generate_stream
from ..tools import tools, call_tool
from ..rag import search
from ..file_analysis import analyze_file

def clean_llm_response(text: str) -> str:
    text = re.sub(r'\[THINKING\][\s\S]*?\[/THINKING\]', '', text)
    text = text.replace('[MESSAGE]', '').replace('[/MESSAGE]', '')
    return text

router = APIRouter()

class ChatRequest(BaseModel):
    conversation_id: Optional[int] = None
    message: str
    use_knowledge_base: bool = False
    knowledge_base_id: Optional[int] = None
    system_prompt: Optional[str] = None

class ConversationCreate(BaseModel):
    title: str

class ChatResponse(BaseModel):
    conversation_id: int
    message_id: int

@router.post("/conversations")
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    conv = models.Conversation(user_id=user.id, title=data.title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv

@router.get("/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    from sqlalchemy import case
    result = await db.execute(
        select(models.Conversation)
        .where(models.Conversation.user_id == user.id)
        .order_by(
            case(
                (models.Conversation.updated_at.isnot(None), models.Conversation.updated_at),
                else_=models.Conversation.created_at
            ).desc(),
            models.Conversation.id.desc()
        )
    )
    return result.scalars().all()

@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    result = await db.execute(
        select(models.Message).where(
            models.Message.conversation_id == conv_id
        ).order_by(models.Message.created_at)
    )
    messages = result.scalars().all()
    return [{"role": m.role, "content": m.content} for m in messages]

@router.delete("/conversations/{conv_id}")
async def delete_conversation(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    conv = await db.get(models.Conversation, conv_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # 删除对话关联的消息
    result = await db.execute(
        select(models.Message).where(models.Message.conversation_id == conv_id)
    )
    msgs = result.scalars().all()
    for msg in msgs:
        await db.delete(msg)
    await db.delete(conv)
    await db.commit()
    return {"status": "ok"}

@router.post("/chat")
async def chat(
    conversation_id: Optional[str] = Form(None),
    message: str = Form(""),
    system_prompt: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    conv_id = int(conversation_id) if conversation_id else None
    
    if conv_id:
        conv = await db.get(models.Conversation, conv_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = message[:30] + ("..." if len(message) > 30 else "")
        conv = models.Conversation(user_id=user.id, title=title)
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

    # Process file content if provided
    file_content = ""
    if file:
        content = await file.read()
        file_content = content.decode('utf-8') if content else ""

    user_msg = models.Message(conversation_id=conv.id, role="user", content=message)
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    result = await db.execute(
        select(models.Message).where(
            models.Message.conversation_id == conv.id,
            models.Message.role != "system"
        ).order_by(models.Message.created_at.desc()).limit(10)
    )
    history = result.scalars().all()
    history.reverse()
    
    chat_messages: List[Dict[str, str]] = []
    for m in history:
        chat_messages.append({"role": m.role, "content": m.content})

    # 如果有文件内容，附加到当前用户消息中传给 LLM
    if file_content and chat_messages:
        last = chat_messages[-1]
        if last["role"] == "user":
            last["content"] = f"[文件：{file.filename}]\n\n{file_content}\n\n{last['content']}"

    system_content = system_prompt if system_prompt else "You are a helpful assistant."
    chat_messages = [{"role": "system", "content": system_content}] + chat_messages

    full_response = ""
    async for token in generate_stream(chat_messages):
        full_response += token

    cleaned_response = clean_llm_response(full_response)

    assistant_msg = models.Message(conversation_id=conv.id, role="assistant", content=cleaned_response)
    db.add(assistant_msg)
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"response": cleaned_response, "conversation_id": conv.id}
