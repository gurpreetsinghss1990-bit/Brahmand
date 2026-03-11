"""
Sanatan Lok API - Hybrid Backend
Version 2.1.0

Backend with MongoDB + Firebase configuration for frontend.
When Firebase service account is provided, can use Firestore.
"""
import logging
import sys
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import socketio

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config.settings import settings
from config.firebase_config import firebase_manager, FIREBASE_WEB_CONFIG, is_firebase_enabled
from config.database import db_manager, get_database
from workers.background_tasks import task_queue

# Import MongoDB-based services
from services.auth_service import AuthService
from services.user_service import UserService
from services.community_service import CommunityService
from services.messaging_service import MessagingService
from services.temple_service import TempleService
from services.event_service import EventService
from services.notification_service import NotificationService

from models.schemas import (
    OTPRequest, OTPVerify, UserCreate, UserUpdate, ProfileUpdate,
    LocationSetup, DualLocationSetup, MessageCreate, DirectMessageCreate,
    CircleCreate, CircleJoin, TempleCreate, TemplePost, EventCreate
)
from middleware.security import verify_token, create_jwt_token
from middleware.rate_limiter import auth_rate_limit, messaging_rate_limit
from utils.helpers import WISDOM_QUOTES, TITHIS
from utils.cache import cache_manager

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan"""
    logger.info("Starting Sanatan Lok API v2.1.0...")
    
    # Initialize MongoDB
    await db_manager.initialize()
    logger.info("MongoDB initialized")
    
    # Initialize Firebase (for frontend config)
    await firebase_manager.initialize()
    if is_firebase_enabled():
        logger.info("Firebase Admin SDK available")
    else:
        logger.info("Firebase web config available for frontend")
    
    # Start task queue
    await task_queue.start()
    logger.info("Background task queue started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await task_queue.stop()
    await db_manager.close()
    await firebase_manager.close()
    logger.info("Cleanup complete")


# Create app
app = FastAPI(
    title=settings.APP_NAME,
    version="2.1.0",
    description="Sanatan Lok API - MongoDB backend with Firebase frontend support",
    lifespan=lifespan
)

# Socket.IO for real-time
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    ping_interval=settings.WS_PING_INTERVAL,
    ping_timeout=settings.WS_PING_TIMEOUT
)
socket_app = socketio.ASGIApp(sio, app)

# Set socket in messaging service
MessagingService.set_socket(sio)


# =================== MIDDLEWARE ===================

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = datetime.utcnow()
    response = await call_next(request)
    process_time = (datetime.utcnow() - start_time).total_seconds()
    response.headers["X-Process-Time"] = str(process_time)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# =================== API ROUTER ===================

api_router = APIRouter(prefix="/api")


# =================== CORE ENDPOINTS ===================

@api_router.get("/")
async def root():
    return {
        "message": settings.APP_NAME,
        "version": "2.1.0",
        "status": "healthy",
        "database": "MongoDB",
        "firebase_project": FIREBASE_WEB_CONFIG["projectId"],
        "features": [
            "User Authentication",
            "Community Groups",
            "Real-time Messaging",
            "Temple Network",
            "Events",
            "Push Notifications (FCM ready)",
            "Firebase Auth (frontend)"
        ]
    }


@api_router.get("/health")
async def health_check():
    db_status = "healthy"
    try:
        db = await get_database()
        await db.command("ping")
    except:
        db_status = "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.1.0",
        "services": {
            "database": db_status,
            "firebase_admin": "enabled" if is_firebase_enabled() else "config_only",
            "cache": "healthy",
            "task_queue": "healthy" if task_queue.running else "stopped"
        },
        "firebase_project": FIREBASE_WEB_CONFIG["projectId"]
    }


@api_router.get("/firebase-config")
async def get_firebase_config():
    """Get Firebase web config for frontend SDK initialization"""
    return FIREBASE_WEB_CONFIG


# =================== AUTH ENDPOINTS ===================

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest, _: bool = Depends(auth_rate_limit)):
    try:
        return await AuthService.send_otp(request.phone)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify, _: bool = Depends(auth_rate_limit)):
    try:
        return await AuthService.verify_otp(request.phone, request.otp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/auth/register")
async def register_user(user_data: UserCreate, _: bool = Depends(auth_rate_limit)):
    try:
        return await AuthService.register_user(
            phone=user_data.phone,
            name=user_data.name,
            photo=user_data.photo,
            language=user_data.language
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =================== USER ENDPOINTS ===================

@api_router.get("/user/profile")
async def get_profile(token_data: dict = Depends(verify_token)):
    try:
        return await UserService.get_profile(token_data["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.put("/user/profile")
async def update_profile(update: UserUpdate, token_data: dict = Depends(verify_token)):
    try:
        return await UserService.update_profile(
            token_data["user_id"],
            update.dict(exclude_none=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.put("/user/profile/extended")
async def update_extended_profile(update: ProfileUpdate, token_data: dict = Depends(verify_token)):
    try:
        return await UserService.update_extended_profile(
            token_data["user_id"],
            update.dict(exclude_none=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/user/location")
async def setup_location(location: LocationSetup, token_data: dict = Depends(verify_token)):
    try:
        return await UserService.setup_location(
            token_data["user_id"],
            location.dict()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/user/dual-location")
async def setup_dual_location(locations: DualLocationSetup, token_data: dict = Depends(verify_token)):
    try:
        return await UserService.setup_dual_location(
            token_data["user_id"],
            locations.home_location,
            locations.office_location
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/user/search/{sl_id}")
async def search_user(sl_id: str, token_data: dict = Depends(verify_token)):
    try:
        return await UserService.search_by_sl_id(sl_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.get("/user/verification-status")
async def get_verification_status(token_data: dict = Depends(verify_token)):
    return await UserService.get_verification_status(token_data["user_id"])


@api_router.post("/user/request-verification")
async def request_verification(data: dict, token_data: dict = Depends(verify_token)):
    try:
        return await UserService.request_verification(
            token_data["user_id"],
            data.get("full_name"),
            data.get("id_type"),
            data.get("id_number")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/user/profile-completion")
async def get_profile_completion(token_data: dict = Depends(verify_token)):
    return await UserService.get_profile_completion(token_data["user_id"])


@api_router.get("/user/horoscope")
async def get_horoscope(token_data: dict = Depends(verify_token)):
    try:
        return await UserService.get_horoscope(token_data["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =================== GEOCODE ENDPOINT ===================

@api_router.post("/geocode/reverse")
async def reverse_geocode(request: dict):
    try:
        return await UserService.reverse_geocode(
            request.get("latitude"),
            request.get("longitude")
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


# =================== COMMUNITY ENDPOINTS ===================

@api_router.get("/communities")
async def get_user_communities(token_data: dict = Depends(verify_token)):
    try:
        return await CommunityService.get_user_communities(token_data["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.get("/communities/discover")
async def discover_communities(token_data: dict = Depends(verify_token)):
    return await CommunityService.discover_communities()


@api_router.get("/communities/{community_id}")
async def get_community(community_id: str, token_data: dict = Depends(verify_token)):
    try:
        return await CommunityService.get_community(community_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.post("/communities/join")
async def join_community(data: dict, token_data: dict = Depends(verify_token)):
    try:
        return await CommunityService.join_by_code(
            token_data["user_id"],
            data.get("code", "")
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.post("/communities/{community_id}/agree-rules")
async def agree_to_rules(community_id: str, data: dict, token_data: dict = Depends(verify_token)):
    return await CommunityService.agree_to_rules(
        token_data["user_id"],
        community_id,
        data.get("subgroup_type")
    )


@api_router.get("/communities/{community_id}/stats")
async def get_community_stats(community_id: str, token_data: dict = Depends(verify_token)):
    return await CommunityService.get_community_stats(community_id)


# =================== MESSAGING ENDPOINTS ===================

@api_router.post("/messages/community/{community_id}/{subgroup_type}")
async def send_community_message(
    community_id: str,
    subgroup_type: str,
    message: MessageCreate,
    token_data: dict = Depends(verify_token),
    _: bool = Depends(messaging_rate_limit)
):
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


@api_router.get("/messages/community/{community_id}/{subgroup_type}")
async def get_community_messages(
    community_id: str,
    subgroup_type: str,
    limit: int = 50,
    token_data: dict = Depends(verify_token)
):
    return await MessagingService.get_community_messages(
        community_id, subgroup_type, limit
    )


@api_router.post("/messages/circle/{circle_id}")
async def send_circle_message(
    circle_id: str,
    message: MessageCreate,
    token_data: dict = Depends(verify_token),
    _: bool = Depends(messaging_rate_limit)
):
    try:
        return await MessagingService.send_circle_message(
            user_id=token_data["user_id"],
            circle_id=circle_id,
            content=message.content,
            message_type=message.message_type.value
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@api_router.get("/messages/circle/{circle_id}")
async def get_circle_messages(circle_id: str, limit: int = 50, token_data: dict = Depends(verify_token)):
    return await MessagingService.get_circle_messages(circle_id, limit)


@api_router.post("/messages/dm")
async def send_direct_message(
    message: DirectMessageCreate,
    token_data: dict = Depends(verify_token),
    _: bool = Depends(messaging_rate_limit)
):
    try:
        return await MessagingService.send_direct_message(
            sender_id=token_data["user_id"],
            recipient_sl_id=message.recipient_sl_id,
            content=message.content,
            message_type=message.message_type.value
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.get("/messages/dm/conversations")
async def get_conversations(token_data: dict = Depends(verify_token)):
    return await MessagingService.get_conversations(token_data["user_id"])


@api_router.get("/messages/dm/{conversation_id}")
async def get_direct_messages(
    conversation_id: str,
    limit: int = 50,
    token_data: dict = Depends(verify_token)
):
    try:
        return await MessagingService.get_direct_messages(
            token_data["user_id"],
            conversation_id,
            limit
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


# =================== NOTIFICATION ENDPOINTS ===================

@api_router.get("/notifications")
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    token_data: dict = Depends(verify_token)
):
    return await NotificationService.get_user_notifications(
        token_data["user_id"], limit, unread_only
    )


@api_router.get("/notifications/unread-count")
async def get_unread_count(token_data: dict = Depends(verify_token)):
    count = await NotificationService.get_unread_count(token_data["user_id"])
    return {"unread_count": count}


@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, token_data: dict = Depends(verify_token)):
    try:
        return await NotificationService.mark_as_read(
            token_data["user_id"], notification_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.post("/notifications/read-all")
async def mark_all_read(token_data: dict = Depends(verify_token)):
    return await NotificationService.mark_all_as_read(token_data["user_id"])


# =================== WISDOM & PANCHANG ===================

@api_router.get("/wisdom/today")
async def get_todays_wisdom():
    cached = await cache_manager.get_wisdom()
    if cached:
        return cached
    
    day_of_year = datetime.utcnow().timetuple().tm_yday
    quote_index = day_of_year % len(WISDOM_QUOTES)
    wisdom = WISDOM_QUOTES[quote_index]
    
    await cache_manager.set_wisdom(wisdom)
    return wisdom


@api_router.get("/panchang/today")
async def get_todays_panchang():
    cached = await cache_manager.get_panchang()
    if cached:
        return cached
    
    now = datetime.utcnow()
    day_of_month = now.day
    tithi_index = (day_of_month - 1) % 15
    
    vrat = None
    if tithi_index == 10:
        vrat = "Ekadashi Vrat"
    elif now.weekday() == 0:
        vrat = "Somvar Vrat"
    elif now.weekday() == 3:
        vrat = "Guruvar Vrat"
    elif now.weekday() == 5:
        vrat = "Shanivar Vrat"
    
    panchang = {
        "date": now.strftime("%Y-%m-%d"),
        "tithi": TITHIS[tithi_index],
        "paksha": "Shukla Paksha" if day_of_month <= 15 else "Krishna Paksha",
        "sunrise": "6:22 AM",
        "sunset": "6:41 PM",
        "vrat": vrat,
        "nakshatra": "Rohini",
        "yoga": "Siddhi",
    }
    
    await cache_manager.set_panchang(panchang)
    return panchang


# =================== TEMPLES ===================

@api_router.get("/temples")
async def get_temples(token_data: dict = Depends(verify_token)):
    return await TempleService.get_temples(token_data["user_id"])


@api_router.get("/temples/{temple_id}")
async def get_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    try:
        return await TempleService.get_temple(temple_id, token_data["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.post("/temples/{temple_id}/follow")
async def follow_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    try:
        return await TempleService.follow_temple(token_data["user_id"], temple_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@api_router.post("/temples/{temple_id}/unfollow")
async def unfollow_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    try:
        return await TempleService.unfollow_temple(token_data["user_id"], temple_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =================== EVENTS ===================

@api_router.get("/events")
async def get_events(token_data: dict = Depends(verify_token)):
    return await EventService.get_events()


@api_router.get("/events/nearby")
async def get_nearby_events(token_data: dict = Depends(verify_token)):
    return await EventService.get_nearby_events(token_data["user_id"])


# =================== CIRCLES ===================

@api_router.get("/circles")
async def get_circles(token_data: dict = Depends(verify_token)):
    from bson import ObjectId
    db = await get_database()
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    if not user:
        return []
    
    circle_ids = user.get("circles", [])
    circles = []
    
    for cid in circle_ids:
        try:
            circle = await db.circles.find_one({"_id": ObjectId(cid)})
            if circle:
                circles.append({
                    "id": str(circle["_id"]),
                    "name": circle["name"],
                    "code": circle["code"],
                    "admin_id": circle["admin_id"],
                    "member_count": len(circle.get("members", [])),
                    "created_at": circle["created_at"]
                })
        except:
            pass
    
    return circles


# Include router
app.include_router(api_router)


# =================== SOCKET.IO EVENTS ===================

@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Socket connected: {sid}")
    return True


@sio.event
async def disconnect(sid):
    logger.info(f"Socket disconnected: {sid}")


@sio.event
async def join_room(sid, data):
    room = data.get('room')
    if room:
        await sio.enter_room(sid, room)
        logger.debug(f"{sid} joined room {room}")
        return {"status": "joined", "room": room}


@sio.event
async def leave_room(sid, data):
    room = data.get('room')
    if room:
        await sio.leave_room(sid, room)
        return {"status": "left", "room": room}


# Mount socket app
app.mount("/socket.io", socket_app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
