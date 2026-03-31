from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..auth import get_current_user
from .. import models

router = APIRouter()

@router.get("/me")
async def get_current_user_info(user=Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "email": user.email}
