from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List
import tempfile
import os
from .. import models
from ..database import get_db
from ..auth import get_current_user
from ..rag import create_collection, add_documents
import PyPDF2

router = APIRouter()

class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str = ""

@router.post("/create")
async def create_kb(
    data: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    result = await db.execute(select(models.KnowledgeBase).where(
        models.KnowledgeBase.user_id == user.id,
        models.KnowledgeBase.name == data.name
    ))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Knowledge base name already exists")
    kb = models.KnowledgeBase(user_id=user.id, name=data.name, description=data.description)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    create_collection(kb.name)
    return kb

@router.post("/{kb_id}/upload")
async def upload_document(
    kb_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    kb = await db.get(models.KnowledgeBase, kb_id)
    if not kb or kb.user_id != user.id:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    content = ""
    if file.filename.endswith('.pdf'):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        with open(tmp_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                content += page.extract_text() + "\n"
        os.unlink(tmp_path)
    else:
        content = (await file.read()).decode('utf-8')
    add_documents(kb.name, [content], [{"filename": file.filename}])
    return {"status": "success", "filename": file.filename}

@router.get("/list")
async def list_kb(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    result = await db.execute(select(models.KnowledgeBase).where(models.KnowledgeBase.user_id == user.id))
    return result.scalars().all()
