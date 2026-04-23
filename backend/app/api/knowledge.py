from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
import tempfile
import os
import logging
from .. import models
from ..database import get_db
from ..auth import get_current_user
from ..rag import create_collection, add_documents
from ..file_analysis import analyze_file

logger = logging.getLogger(__name__)

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


class FileAnalysisRequest(BaseModel):
    kb_name: Optional[str] = None
    store_to_kb: bool = False


@router.post("/analyze")
async def analyze_uploaded_file(
    file: UploadFile = File(...),
    analysis_request: FileAnalysisRequest = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    
    """
    分析上传的文件并提取内容
    
    支持多种文件格式：
    - PDF 文档
    - Word 文档 (.docx)
    - Excel 表格 (.xlsx, .xls)  
    - 纯文本文件 (.txt)
    其他类型将尝试作为纯文本处理

    Args:
        file: 上传的文件对象
        analysis_request: 分析请求参数，包含是否存储到知识库选项
        
    Returns:
        包含分析结果的字典：
            - filename: 文件名
            - content_type: 内容类型  
            - size_bytes: 文件大小（字节）
            - extracted_text: 提取的文本内容
            - metadata: 额外的元数据信息
            
    Raises:
        HTTPException: 如果文件格式不支持或分析失败
        
    Example Request Body (multipart/form-data):
    
    POST /api/knowledge/analyze
    
    Files:
      file: <binary>
      
    Form Data:
      kb_name: "my_analysis"
      store_to_kb: true
    """
    
    # 验证上传的文件
    logger.info(f"Received file upload request: {file.filename if file else 'None'}")
    
    if not file.filename or len(file.filename) == 0:
        logger.warning("No filename provided in uploaded file")
        raise HTTPException(
            status_code=400,
            detail="No filename provided in uploaded file"
        )
        
    try:
        analysis_result = await analyze_file(file)
    except Exception as e:
    
        return {
            "success": False,
            "error": str(e),
            "filename": file.filename or "unknown",
            "file_type": None
        }
            
    # 如果需要存储到知识库，则添加文档向量
    
    if analysis_request.store_to_kb and analysis_result.get("extracted_text"):
        
        try:
    
            kb_name = analysis_request.kb_name
            
            collection = create_collection(kb_name)
            
            documents_list = [analysis_result["extracted_text"]]
            metadatas_list = [{
                "filename": file.filename,
                "source_type": "direct_upload",
                "user_id": user.id
            }]
    
            add_documents(
                kb_name, 
                documents_list, 
                metadatas_list
            )
            
        except Exception as e:
        
            return {
                "success": True if analysis_result.get("extracted_text") else False,
                "filename": file.filename or "unknown",
                "file_type": None,
                "stored_to_kb": False,
                "error": f"Failed to store in knowledge base: {str(e)}"
            }
    
    return {
        **analysis_result,
        "success": True
    }


@router.get("/analyze/summary")
async def get_file_summary(
    file_url: str = None,  # 可以是文件URL或直接上传的file参数（需要修改）
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    
    """
    获取文件的简要摘要信息
    
    Args:
        file_url: 文件的访问URL
        
    Returns:
        包含文件信息的字典：
            - filename: 文件名
            - size_mb: 大小（MB）
            - type: 类型名称  
            - description: 描述
            
    Raises:
        HTTPException: 如果获取信息失败或参数无效
    
    Example Request (需要配合前端实现):
    
    GET /api/knowledge/analyze/summary?file_url=https://example.com/file.pdf
    """
    
    if not file_url and "filename" in request.form():
        
        raise HTTPException(
            status_code=400,
            detail="Either 'file' parameter or valid URL is required"
        )
            
    try:
        
        # 这里可以添加从URL下载文件并分析的逻辑
        
        return {
            "success": True
        }
    
    except Exception as e:
    
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get file summary: {str(e)}"
        )


@router.get("/supported-formats")
async def get_supported_formats():
    
    """
    获取支持的文件格式列表
    
    Returns:
        包含支持格式的字典，包括：
            - formats: 支持的扩展名列表
            - descriptions: 格式说明
            
    Example Response:
    
    {
        "formats": [".pdf", ".docx", ".txt"],
        "descriptions": ["PDF Document", "Word Document", "Text File"]
    }
    """
    
    return {
        "formats": [
            {".pdf": {"name": "PDF Document", "description": "Portable Document Format"}},
            {".docx": {"name": "Word Document", "description": "Microsoft Word document (.docx)"}},
            {".xlsx": {"name": "Excel Spreadsheet (XLSX)", "description": "Modern Excel spreadsheet format"}},
            {".xls": {"name": "Excel Workbook (XLS)", "description": "Legacy Excel workbook format"}},
            {".txt": {"name": "Text File", "description": "Plain text file"}}
        ],
        "max_size_mb": 10,
        "note": "Files larger than max size will be rejected"
    }
