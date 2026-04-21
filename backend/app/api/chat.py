import json
import openai
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from sse_starlette.sse import EventSourceResponse
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
    result = await db.execute(
        select(models.Conversation).where(models.Conversation.user_id == user.id).order_by(models.Conversation.updated_at.desc())
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

@router.post("/chat")
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    if req.conversation_id:
        conv = await db.get(models.Conversation, req.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = req.message[:30] + ("..." if len(req.message) > 30 else "")
        conv = models.Conversation(user_id=user.id, title=title)
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

    user_msg = models.Message(conversation_id=conv.id, role="user", content=req.message)
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

    if req.use_knowledge_base and req.knowledge_base_id:
        kb = await db.get(models.KnowledgeBase, req.knowledge_base_id)
        if kb and kb.user_id == user.id:
            retrieved = search(kb.name, req.message, top_k=3)
            if retrieved:
                context = "\n\n".join(retrieved)
                chat_messages.insert(0, {"role": "system", "content": f"参考以下知识：\n{context}"})

    system_content = req.system_prompt if req.system_prompt else "You are a helpful assistant."
    chat_messages = [{"role": "system", "content": system_content}] + chat_messages

    async def event_generator():
        full_response = ""
        async for token in generate_stream(chat_messages):
            full_response += token
            yield {"data": token}
        
        assistant_msg = models.Message(conversation_id=conv.id, role="assistant", content=full_response)
        db.add(assistant_msg)
        await db.commit()

    return EventSourceResponse(event_generator(), media_type="text/event-stream")
