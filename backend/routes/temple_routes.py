"""Temple Routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from models.schemas import TempleCreate, TemplePost
from services.temple_service import TempleService
from middleware.security import verify_token

router = APIRouter(prefix="/temples", tags=["Temples"])


@router.post("")
async def create_temple(
    temple_data: TempleCreate,
    token_data: dict = Depends(verify_token)
):
    """Create a new temple (admin feature)"""
    return await TempleService.create_temple(
        admin_id=token_data["user_id"],
        name=temple_data.name,
        location=temple_data.location,
        description=temple_data.description,
        deity=temple_data.deity,
        aarti_timings=temple_data.aarti_timings
    )


@router.get("")
async def get_temples(token_data: dict = Depends(verify_token)):
    """Get all temples"""
    return await TempleService.get_temples(token_data["user_id"])


@router.get("/nearby")
async def get_nearby_temples(
    lat: float = 19.0760,
    lng: float = 72.8777,
    token_data: dict = Depends(verify_token)
):
    """Get temples near user's location"""
    return await TempleService.get_nearby_temples(lat, lng, token_data["user_id"])


@router.get("/{temple_id}")
async def get_temple(
    temple_id: str,
    token_data: dict = Depends(verify_token)
):
    """Get temple details"""
    try:
        return await TempleService.get_temple(temple_id, token_data["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{temple_id}/follow")
async def follow_temple(
    temple_id: str,
    token_data: dict = Depends(verify_token)
):
    """Follow a temple"""
    try:
        return await TempleService.follow_temple(token_data["user_id"], temple_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{temple_id}/unfollow")
async def unfollow_temple(
    temple_id: str,
    token_data: dict = Depends(verify_token)
):
    """Unfollow a temple"""
    try:
        return await TempleService.unfollow_temple(token_data["user_id"], temple_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{temple_id}/posts")
async def create_temple_post(
    temple_id: str,
    post: TemplePost,
    token_data: dict = Depends(verify_token)
):
    """Create a temple post (admin only)"""
    try:
        return await TempleService.create_post(
            user_id=token_data["user_id"],
            temple_id=temple_id,
            title=post.title,
            content=post.content,
            post_type=post.post_type.value
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/{temple_id}/posts")
async def get_temple_posts(
    temple_id: str,
    token_data: dict = Depends(verify_token)
):
    """Get temple posts"""
    try:
        return await TempleService.get_posts(temple_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{temple_id}/posts/{post_id}/react")
async def react_to_temple_post(
    temple_id: str,
    post_id: str,
    data: Dict[str, Any],
    token_data: dict = Depends(verify_token)
):
    """React to a temple post"""
    return await TempleService.react_to_post(
        token_data["user_id"],
        temple_id,
        post_id,
        data.get("reaction", "namaste")
    )
