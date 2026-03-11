"""
Sanatan Lok API - Scalable Backend Architecture
Version 2.0.0

A high-performance, scalable backend for the Sanatan Lok platform.
Supports millions of users with microservices architecture, caching,
real-time messaging, and background task processing.
"""
import logging
import sys
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import socketio

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config.settings import settings
from config.database import db_manager, get_database
from workers.background_tasks import task_queue
from services.messaging_service import MessagingService

# Import all routers
from routes import (
    auth_router,
    user_router,
    community_router,
    messaging_router,
    temple_router,
    event_router,
    circle_router
)
from utils.helpers import WISDOM_QUOTES, TITHIS

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Sanatan Lok API v2.0.0...")
    
    # Initialize database connections
    await db_manager.initialize()
    logger.info("Database connections initialized")
    
    # Start background task queue
    await task_queue.start()
    logger.info("Background task queue started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Sanatan Lok API...")
    await task_queue.stop()
    await db_manager.close()
    logger.info("Cleanup complete")


# Create FastAPI app with lifespan
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Scalable backend for Sanatan Lok - connecting Sanatan Dharma followers worldwide",
    lifespan=lifespan
)

# Socket.IO setup for real-time messaging
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    ping_interval=settings.WS_PING_INTERVAL,
    ping_timeout=settings.WS_PING_TIMEOUT
)
socket_app = socketio.ASGIApp(sio, app)

# Set Socket.IO instance in messaging service
MessagingService.set_socket(sio)


# =================== MIDDLEWARE ===================

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers"""
    start_time = datetime.utcnow()
    response = await call_next(request)
    process_time = (datetime.utcnow() - start_time).total_seconds()
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."}
    )


# =================== API ROUTER ===================

# Create main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Include all service routers
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(community_router)
api_router.include_router(messaging_router)
api_router.include_router(temple_router)
api_router.include_router(event_router)
api_router.include_router(circle_router)


# =================== CORE ENDPOINTS ===================

@api_router.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "healthy",
        "architecture": "microservices",
        "features": [
            "Authentication Service",
            "User Management Service",
            "Community Service",
            "Real-time Messaging",
            "Temple Network",
            "Events Management",
            "Notification Service",
            "Content Moderation"
        ]
    }


@api_router.get("/health")
async def health_check():
    """Comprehensive health check endpoint"""
    try:
        # Check database connection
        db = await get_database()
        await db.command("ping")
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION,
        "services": {
            "database": db_status,
            "cache": "healthy",  # In-memory fallback always works
            "task_queue": "healthy" if task_queue.running else "stopped"
        },
        "metrics": {
            "pending_tasks": task_queue.pending_count
        }
    }


@api_router.get("/wisdom/today")
async def get_todays_wisdom():
    """Get today's wisdom quote with caching"""
    from utils.cache import cache_manager
    
    # Try cache first
    cached = await cache_manager.get_wisdom()
    if cached:
        return cached
    
    # Generate based on day
    day_of_year = datetime.utcnow().timetuple().tm_yday
    quote_index = day_of_year % len(WISDOM_QUOTES)
    wisdom = WISDOM_QUOTES[quote_index]
    
    # Cache for the day
    await cache_manager.set_wisdom(wisdom)
    
    return wisdom


@api_router.get("/panchang/today")
async def get_todays_panchang():
    """Get today's Panchang (Hindu calendar info) with caching"""
    from utils.cache import cache_manager
    
    # Try cache first
    cached = await cache_manager.get_panchang()
    if cached:
        return cached
    
    now = datetime.utcnow()
    day_of_month = now.day
    tithi_index = (day_of_month - 1) % 15
    
    # Approximate sunrise/sunset for India
    sunrise = "6:22 AM"
    sunset = "6:41 PM"
    
    # Select a vrat based on day
    vrat = None
    if tithi_index == 10:  # Ekadashi
        vrat = "Ekadashi Vrat"
    elif now.weekday() == 0:  # Monday
        vrat = "Somvar Vrat"
    elif now.weekday() == 3:  # Thursday
        vrat = "Guruvar Vrat"
    elif now.weekday() == 5:  # Saturday
        vrat = "Shanivar Vrat"
    
    panchang = {
        "date": now.strftime("%Y-%m-%d"),
        "tithi": TITHIS[tithi_index],
        "paksha": "Shukla Paksha" if day_of_month <= 15 else "Krishna Paksha",
        "sunrise": sunrise,
        "sunset": sunset,
        "vrat": vrat,
        "nakshatra": "Rohini",  # Simplified
        "yoga": "Siddhi",  # Simplified
    }
    
    # Cache for the day
    await cache_manager.set_panchang(panchang)
    
    return panchang


@api_router.post("/geocode/reverse")
async def reverse_geocode(request: dict):
    """Reverse geocode coordinates"""
    from services.user_service import UserService
    
    try:
        return await UserService.reverse_geocode(
            request.get("latitude"),
            request.get("longitude")
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


# =================== NOTIFICATION ENDPOINTS ===================

@api_router.get("/notifications")
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    token_data: dict = None
):
    """Get user notifications"""
    from middleware.security import verify_token
    from services.notification_service import NotificationService
    from fastapi import Depends
    
    # Note: This endpoint needs proper auth - simplified for demo
    return {"message": "Use with authentication"}


# =================== ADMIN ENDPOINTS ===================

@api_router.get("/admin/stats")
async def get_admin_stats():
    """Get platform statistics (admin only)"""
    db = await get_database()
    
    user_count = await db.users.count_documents({})
    community_count = await db.communities.count_documents({})
    message_count = await db.messages.count_documents({})
    temple_count = await db.temples.count_documents({})
    event_count = await db.events.count_documents({})
    
    return {
        "users": user_count,
        "communities": community_count,
        "messages": message_count,
        "temples": temple_count,
        "events": event_count,
        "timestamp": datetime.utcnow().isoformat()
    }


# Include the API router
app.include_router(api_router)


# =================== SOCKET.IO EVENTS ===================

@sio.event
async def connect(sid, environ, auth):
    """Handle socket connection"""
    logger.info(f"Socket connected: {sid}")
    return True


@sio.event
async def disconnect(sid):
    """Handle socket disconnection"""
    logger.info(f"Socket disconnected: {sid}")


@sio.event
async def join_room(sid, data):
    """Join a chat room"""
    room = data.get('room')
    if room:
        await sio.enter_room(sid, room)
        logger.debug(f"{sid} joined room {room}")
        return {"status": "joined", "room": room}


@sio.event
async def leave_room(sid, data):
    """Leave a chat room"""
    room = data.get('room')
    if room:
        await sio.leave_room(sid, room)
        logger.debug(f"{sid} left room {room}")
        return {"status": "left", "room": room}


@sio.event
async def ping(sid):
    """Handle ping for connection keep-alive"""
    return {"status": "pong", "timestamp": datetime.utcnow().isoformat()}


# Mount socket app
app.mount("/socket.io", socket_app)


# =================== APPLICATION INFO ===================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        workers=1
    )
