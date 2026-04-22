from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pathlib import Path
import os
from .api import api_router
from .database import engine, Base

app = FastAPI(title="AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = Path("/Volumes/Seagate/workspace/code/my_ai_assistant/frontend")

app.include_router(api_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    index_path = frontend_path / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "AI Assistant Backend"}

# Static file handler
@app.get("/static/{file_path:path}")
async def serve_static(file_path: str):
    # 处理 index.html 特殊情况
    if file_path == "index.html":
        index_path = frontend_path / "index.html"
    else:
        index_path = frontend_path / "static" / file_path
    
    if index_path.exists() and index_path.is_file():
        ext = index_path.suffix.lower()
        mime_types = {
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
        }
        media_type = mime_types.get(ext, 'application/octet-stream')
        return FileResponse(str(index_path), media_type=media_type)
    return Response("Not Found", status_code=404)

@app.get("/index.html")
async def serve_index_html():
    index_path = frontend_path / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    return Response("Not Found", status_code=404)
