"""Event Routes"""
from fastapi import APIRouter, HTTPException, Depends
from models.schemas import EventCreate
from services.event_service import EventService
from middleware.security import verify_token

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("")
async def create_event(
    event_data: EventCreate,
    token_data: dict = Depends(verify_token)
):
    """Create a new event"""
    try:
        return await EventService.create_event(
            organizer_id=token_data["user_id"],
            name=event_data.name,
            description=event_data.description,
            event_type=event_data.event_type,
            location=event_data.location,
            date=event_data.date,
            time=event_data.time,
            organizer_name=event_data.organizer_name
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("")
async def get_events(token_data: dict = Depends(verify_token)):
    """Get upcoming events"""
    return await EventService.get_events()


@router.get("/nearby")
async def get_nearby_events(token_data: dict = Depends(verify_token)):
    """Get events near user's location"""
    return await EventService.get_nearby_events(token_data["user_id"])


@router.get("/{event_id}")
async def get_event(
    event_id: str,
    token_data: dict = Depends(verify_token)
):
    """Get event details"""
    try:
        return await EventService.get_event(event_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{event_id}/attend")
async def attend_event(
    event_id: str,
    token_data: dict = Depends(verify_token)
):
    """Mark attendance for an event"""
    return await EventService.attend_event(token_data["user_id"], event_id)


@router.post("/{event_id}/cancel-attendance")
async def cancel_attendance(
    event_id: str,
    token_data: dict = Depends(verify_token)
):
    """Cancel attendance for an event"""
    return await EventService.cancel_attendance(token_data["user_id"], event_id)
