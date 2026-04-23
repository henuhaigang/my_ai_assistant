import os
import uuid
import re
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import UploadedFile, User
from ..auth import get_current_user

router = APIRouter()

def clean_llm_response(text: str) -> str:
    text = re.sub(r'\[THINKING\][\s\S]*?\[/THINKING\]', '', text)
    text = text.replace('[MESSAGE]', '').replace('[/MESSAGE]', '')
    return text

# 存储文件信息（进程内存）
session_files = {}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """上传文件并提取内容"""
    
    # 生成唯一文件名
    unique_filename = f"{uuid.uuid4().hex}{os.path.splitext(file.filename)[1]}"
    
    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    file_content = await file.read()
    
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # 提取文本生成摘要
    summary = ""
    try:
        if file.filename.endswith('.txt') or file.filename.endswith('.md'):
            summary = file_content.decode('utf-8', errors='ignore')
        elif file.filename.endswith('.pdf'):
            try:
                import PyPDF2
                with open(file_path, 'rb') as pdf_file:
                    reader = PyPDF2.PdfReader(pdf_file)
                    for page in reader.pages:
                        summary += page.extract_text() or ""
            except: pass
        elif file.filename.endswith('.docx'):
            try:
                from docx import Document
                doc = Document(file_path)
                for para in doc.paragraphs:
                    summary += para.text + "\n"
            except: pass
    except Exception as e:
        summary = f"提取内容失败：{str(e)}"
    
    summary = summary[:3000] if len(summary) > 3000 else summary
    
    # 保存到数据库
    db_file = UploadedFile(
        user_id=current_user.id,
        filename=file.filename,
        file_path=unique_filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(file_content),
        file_metadata={"extracted_length": len(summary)},
        summary=summary
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)
    
    session_files[unique_filename] = {
        "id": db_file.id,
        "file_path": file_path,
        "filename": file.filename,
        "summary": summary
    }
    
    return {
        "id": db_file.id,
        "filename": file.filename,
        "file_path": unique_filename,
        "size_bytes": len(file_content),
        "summary": summary
    }


@router.post("/chat")
async def chat_with_file(
    message: str = Form(...),
    file_path: str = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """基于文件进行问答 - 精确文件名匹配"""
    
    summary = ""
    target_filename = None
    
    # 1. 如果直接提供了 file_path，使用该文件
    if file_path:
        if file_path in session_files:
            summary = session_files[file_path].get("summary", "")
            target_filename = session_files[file_path].get("filename", "")
        else:
            from sqlalchemy import select
            result = await db.execute(select(UploadedFile).where(UploadedFile.file_path == file_path))
            db_file = result.scalar_one_or_none()
            if db_file:
                summary = db_file.summary or ""
                target_filename = db_file.filename
    
    # 2. 如果没有指定文件，匹配文件名
    if not summary:
        from sqlalchemy import select
        result = await db.execute(
            select(UploadedFile).order_by(UploadedFile.created_at.desc()).limit(50)
        )
        uploaded_files = result.scalars().all()
        
        # 精确匹配
        message_lower = message.lower()
        
        for db_file in uploaded_files:
            if db_file.filename:
                filename_lower = db_file.filename.lower()
                
                # 精确匹配完整文件名
                if filename_lower in message_lower:
                    summary = db_file.summary or ""
                    target_filename = db_file.filename
                    break
                
                # 部分匹配：去掉扩展名
                if '.' in db_file.filename:
                    base_name = db_file.filename.rsplit('.', 1)[0].lower()
                    msg_cleaned = message_lower.replace(' ', '').replace('_', '')
                    if base_name in msg_cleaned:
                        if any(k in message_lower for k in ['总结', '分析', '内容', '说明', '文档', '这个']):
                            summary = db_file.summary or ""
                            target_filename = db_file.filename
                            break
    
    # 3. 如果没匹配，返回文件列表
    if not summary:
        from sqlalchemy import select
        result = await db.execute(
            select(UploadedFile.filename)
            .order_by(UploadedFile.created_at.desc())
            .limit(10)
        )
        files = result.scalars().all()
        # 去重保持顺序
        unique_files = list(dict.fromkeys(files))
        
        if unique_files:
            file_list = "\n".join([f"- {f}" for f in unique_files])
            response_text = f'未在消息中找到匹配的文件名。\n\n请说「总结 XXX.后缀」来指定文件，例如：\n{file_list}'
        else:
            response_text = "您还没有上传任何文件，请先上传文档。"
        
        return {
            "response": response_text,
            "files": unique_files,
            "matched": False
        }
    
    # 4. 调用 AI
    try:
        from ..llm import generate_response
        response = await generate_response(message, summary)
    except Exception as e:
        response = f"处理失败：{str(e)}"

    cleaned = clean_llm_response(response)
    return {"response": cleaned, "file": target_filename, "matched": True}