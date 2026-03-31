from fastapi import APIRouter
from .auth import router as auth_router
from .chat import router as chat_router
from .knowledge import router as knowledge_router
from .user import router as user_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(knowledge_router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(user_router, prefix="/user", tags=["user"])
