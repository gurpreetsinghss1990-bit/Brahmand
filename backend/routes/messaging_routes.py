"""Messaging Routes"""
from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import MessageCreate, DirectMessageCreate
from services.firebase_messaging_service import FirebaseMessagingService as MessagingService
from middleware.security import verify_token
from middleware.rate_limiter import messaging_rate_limit

router = APIRouter(prefix="/messages", tags=["Messaging"])


# Community Messages
@router.post("/community/{community_id}/{subgroup_type}")
async def send_community_message(
    community_id: str,
    subgroup_type: str,
    message: MessageCreate,
    token_data: dict = Depends(verify_token),
    _: bool = Depends(messaging_rate_limit)
):
    """Send message to community subgroup"""
    try:
        return await MessagingService.send_community_message(
            user_id=token_data["user_id"],
            community_id=community_id,
            subgroup_type=subgroup_type,
            content=message.content,
            message_type=message.message_type.value
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/community/{community_id}/{subgroup_type}")
async def get_community_messages(
    community_id: str,
    subgroup_type: str,
    limit: int = 50,
    token_data: dict = Depends(verify_token)
):
    """Get messages from community subgroup"""
    return await MessagingService.get_community_messages(
        community_id, subgroup_type, limit
    )


# Circle Messages
@router.post("/circle/{circle_id}")
async def send_circle_message(
    circle_id: str,
    message: MessageCreate,
    token_data: dict = Depends(verify_token),
    _: bool = Depends(messaging_rate_limit)
):
    """Send message to circle"""
    try:
        return await MessagingService.send_circle_message(
            user_id=token_data["user_id"],
            circle_id=circle_id,
            content=message.content,
            message_type=message.message_type.value
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/circle/{circle_id}")
async def get_circle_messages(
    circle_id: str,
    limit: int = 50,
    token_data: dict = Depends(verify_token)
):
    """Get messages from circle"""
    return await MessagingService.get_circle_messages(circle_id, limit)


# Direct Messages
@router.post("/dm")
async def send_direct_message(
    message: DirectMessageCreate,
    token_data: dict = Depends(verify_token),
    _: bool = Depends(messaging_rate_limit)
):
    """Send direct message to user by SL ID"""
    try:
        return await MessagingService.send_direct_message(
            sender_id=token_data["user_id"],
            recipient_sl_id=message.recipient_sl_id,
            content=message.content,
            message_type=message.message_type.value
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/dm/conversations")
async def get_conversations(token_data: dict = Depends(verify_token)):
    """Get all DM conversations for user"""
    return await MessagingService.get_conversations(token_data["user_id"])


@router.get("/dm/{conversation_id}")
async def get_direct_messages(
    conversation_id: str,
    limit: int = 50,
    token_data: dict = Depends(verify_token)
):
    """Get messages from a DM conversation"""
    try:
        return await MessagingService.get_direct_messages(
            token_data["user_id"],
            conversation_id,
            limit
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
