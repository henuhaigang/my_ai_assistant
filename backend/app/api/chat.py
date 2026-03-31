import json
import openai
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
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

class ConversationCreate(BaseModel):
    title: str

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

    result = await db.execute(
        select(models.Message).where(models.Message.conversation_id == conv.id).order_by(models.Message.created_at).limit(20)
    )
    history = result.scalars().all()
    messages = [{"role": m.role, "content": m.content} for m in history]

    if req.use_knowledge_base and req.knowledge_base_id:
        kb = await db.get(models.KnowledgeBase, req.knowledge_base_id)
        if kb and kb.user_id == user.id:
            retrieved = search(kb.name, req.message, top_k=3)
            if retrieved:
                context = "\n\n".join(retrieved)
                messages.insert(0, {"role": "system", "content": f"参考以下知识：\n{context}"})

    messages = [{"role": "system", "content": "You are a helpful assistant."}] + messages

    async def event_generator():
        full_response = ""
        async for token in generate_stream(messages):
            full_response += token
            yield {"data": token}
        assistant_msg = models.Message(conversation_id=conv.id, role="assistant", content=full_response)
        db.add(assistant_msg)
        await db.commit()

    return EventSourceResponse(event_generator())
