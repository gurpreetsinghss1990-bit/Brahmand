"""
Sanatan Lok API - Firebase/Firestore Backend
Version 2.2.0

Full Firebase backend with Firestore database, Firebase Auth, and FCM.
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

from dotenv import load_dotenv
load_dotenv()

from config.settings import settings
from config.firebase_config import (
    firebase_manager, FIREBASE_WEB_CONFIG, get_firestore, 
    is_firebase_enabled, get_firebase_auth, get_firebase_messaging
)
from config.firestore_db import FirestoreDB
from workers.background_tasks import task_queue
from services.push_notification_service import push_service

from models.schemas import (
    OTPRequest, OTPVerify, UserCreate, UserUpdate, ProfileUpdate,
    LocationSetup, DualLocationSetup, MessageCreate, DirectMessageCreate,
    CircleCreate, CircleJoin
)
from middleware.security import verify_token, create_jwt_token
from middleware.rate_limiter import auth_rate_limit, messaging_rate_limit
from utils.helpers import (
    WISDOM_QUOTES, TITHIS, generate_sl_id, generate_circle_code,
    generate_community_code, SUBGROUPS, moderate_content
)
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
    logger.info("Starting Sanatan Lok API v2.2.0 (Firestore)...")
    
    # Initialize Firebase with Firestore
    await firebase_manager.initialize()
    
    if is_firebase_enabled():
        logger.info("✅ Firebase Admin SDK initialized with Firestore")
    else:
        logger.error("❌ Firebase/Firestore not available - check service account key")
    
    # Start task queue
    await task_queue.start()
    logger.info("Background task queue started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await task_queue.stop()
    await firebase_manager.close()
    logger.info("Cleanup complete")


# Create app
app = FastAPI(
    title=settings.APP_NAME,
    version="2.2.0",
    description="Sanatan Lok API - Full Firestore Backend",
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


# =================== HELPER FUNCTIONS ===================

async def get_db() -> FirestoreDB:
    """Get Firestore database wrapper"""
    client = await get_firestore()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return FirestoreDB(client)


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
        content={"detail": str(exc) if settings.DEBUG else "Internal server error"}
    )


# =================== API ROUTER ===================

api_router = APIRouter(prefix="/api")


# =================== CORE ENDPOINTS ===================

@api_router.get("/")
async def root():
    return {
        "message": settings.APP_NAME,
        "version": "2.2.0",
        "status": "healthy",
        "database": "Firestore",
        "firebase_project": FIREBASE_WEB_CONFIG["projectId"],
        "collections": ["users", "communities", "chats", "groups", "temples", "events", "vendors"],
        "features": [
            "Firestore Database",
            "Firebase Auth",
            "FCM Push Notifications",
            "Real-time Chat",
            "Community Groups",
            "Temple Network"
        ]
    }


@api_router.get("/health")
async def health_check():
    firestore_status = "connected" if is_firebase_enabled() else "unavailable"
    
    return {
        "status": "healthy" if is_firebase_enabled() else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.2.0",
        "services": {
            "firestore": firestore_status,
            "firebase_auth": "enabled" if is_firebase_enabled() else "disabled",
            "fcm": "enabled" if is_firebase_enabled() else "disabled",
            "cache": "healthy",
            "task_queue": "healthy" if task_queue.running else "stopped"
        },
        "firebase_project": FIREBASE_WEB_CONFIG["projectId"]
    }


@api_router.get("/firebase-config")
async def get_firebase_config():
    """Get Firebase web config for frontend SDK"""
    return FIREBASE_WEB_CONFIG


# =================== AUTH ENDPOINTS ===================

@api_router.post("/admin/reset-database")
async def reset_database(confirm: str = ""):
    """
    Reset database for beta launch - removes all test data
    Requires confirmation parameter: confirm=DELETE_ALL_DATA
    """
    if confirm != "DELETE_ALL_DATA":
        raise HTTPException(
            status_code=400, 
            detail="Confirmation required. Pass confirm=DELETE_ALL_DATA"
        )
    
    db = await get_db()
    deleted = {"users": 0, "chats": 0, "messages": 0, "communities": 0, "otps": 0}
    
    try:
        # Delete all users
        users = await db.query_documents('users', [])
        for user in users:
            await db.delete_document('users', user['id'])
            deleted["users"] += 1
        
        # Delete all chats and their messages
        chats = await db.query_documents('chats', [])
        for chat in chats:
            # Delete messages subcollection
            messages = await db.get_chat_messages(chat['id'], 1000)
            for msg in messages:
                try:
                    await db.client.collection('chats').document(chat['id']).collection('messages').document(msg['id']).delete()
                    deleted["messages"] += 1
                except:
                    pass
            await db.delete_document('chats', chat['id'])
            deleted["chats"] += 1
        
        # Delete all communities
        communities = await db.query_documents('communities', [])
        for community in communities:
            await db.delete_document('communities', community['id'])
            deleted["communities"] += 1
        
        # Delete all OTPs
        otps = await db.query_documents('otps', [])
        for otp in otps:
            await db.delete_document('otps', otp['id'])
            deleted["otps"] += 1
        
        logger.info(f"Database reset completed: {deleted}")
        return {
            "message": "Database reset successful",
            "deleted": deleted,
            "status": "ready_for_beta"
        }
    except Exception as e:
        logger.error(f"Database reset error: {e}")
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest, _: bool = Depends(auth_rate_limit)):
    """
    Send OTP via Firebase Phone Auth
    Frontend should use Firebase Auth SDK to send OTP
    This endpoint is for backend tracking only
    """
    phone = request.phone
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    db = await get_db()
    
    # Store OTP request for tracking (Firebase sends actual OTP)
    otp_data = {
        "phone": phone,
        "requested_at": datetime.utcnow().isoformat(),
        "verified": False
    }
    
    existing = await db.find_one('otps', [('phone', '==', phone)])
    if existing:
        await db.update_document('otps', existing['id'], otp_data)
    else:
        await db.create_document('otps', otp_data)
    
    logger.info(f"OTP request for {phone} - Firebase will send actual SMS")
    return {"message": "OTP sent successfully", "phone": phone}


@api_router.post("/auth/verify-firebase-token")
async def verify_firebase_token(request: dict, _: bool = Depends(auth_rate_limit)):
    """
    Verify Firebase ID token after phone auth
    Creates user document if new user
    """
    from firebase_admin import auth as firebase_auth
    
    id_token = request.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="ID token required")
    
    try:
        # Verify the Firebase ID token
        decoded_token = firebase_auth.verify_id_token(id_token)
        firebase_uid = decoded_token['uid']
        phone = decoded_token.get('phone_number', '')
        
        if not phone:
            raise HTTPException(status_code=400, detail="Phone number not found in token")
        
        db = await get_db()
        
        # Check if user exists
        user = await db.get_user_by_phone(phone)
        
        if user and user.get('sl_id'):
            # Existing user - return token
            token = create_jwt_token(user['id'], user['sl_id'])
            return {
                "message": "Login successful",
                "token": token,
                "user": user,
                "is_new_user": False
            }
        
        # New user - return for registration
        return {
            "message": "Phone verified",
            "is_new_user": True,
            "phone": phone,
            "firebase_uid": firebase_uid
        }
        
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase token expired")
    except Exception as e:
        logger.error(f"Firebase token verification error: {e}")
        raise HTTPException(status_code=500, detail="Token verification failed")


@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify, _: bool = Depends(auth_rate_limit)):
    """
    Legacy OTP verification (kept for backward compatibility)
    For production, use /auth/verify-firebase-token instead
    """
    db = await get_db()
    
    otp_record = await db.find_one('otps', [('phone', '==', request.phone)])
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found")
    
    if otp_record.get('attempts', 0) >= 5:
        raise HTTPException(status_code=400, detail="Too many attempts")
    
    # Update attempts
    await db.update_document('otps', otp_record['id'], {
        'attempts': otp_record.get('attempts', 0) + 1
    })
    
    # For development/testing, accept 123456
    if request.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Delete OTP
    await db.delete_document('otps', otp_record['id'])
    
    # Check if user exists
    user = await db.get_user_by_phone(request.phone)
    if user and user.get('sl_id'):
        token = create_jwt_token(user['id'], user['sl_id'])
        return {
            "message": "Login successful",
            "token": token,
            "user": user,
            "is_new_user": False
        }
    
    return {
        "message": "OTP verified",
        "is_new_user": True,
        "phone": request.phone
    }


@api_router.post("/auth/register")
async def register_user(user_data: UserCreate, _: bool = Depends(auth_rate_limit)):
    """Register new user"""
    from services.image_service import compress_base64_image, is_valid_image
    
    db = await get_db()
    
    # Check existing
    existing = await db.get_user_by_phone(user_data.phone)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Generate unique SL ID
    sl_id = generate_sl_id()
    while await db.get_user_by_sl_id(sl_id):
        sl_id = generate_sl_id()
    
    # Handle photo - compress and resize if provided (no size limit for users)
    photo_data = user_data.photo
    if photo_data:
        try:
            if is_valid_image(photo_data):
                # Compress to 512px max and optimize
                photo_data = compress_base64_image(photo_data, max_size=512, quality=85)
                logger.info(f"Profile photo compressed successfully")
            else:
                logger.warning("Invalid image format, skipping photo")
                photo_data = None
        except Exception as e:
            logger.warning(f"Image compression failed: {e}, skipping photo")
            photo_data = None
    
    user = {
        "phone": user_data.phone,
        "sl_id": sl_id,
        "name": user_data.name,
        "photo": photo_data,
        "language": user_data.language or "English",
        "location": None,
        "home_location": None,
        "office_location": None,
        "is_verified": False,
        "badges": ["New Member"],
        "reputation": 0,
        "communities": [],
        "circles": [],
        "fcm_tokens": [],
        "agreed_rules": [],
        "sanatan_declaration_agreed": True,  # User agreed during signup
        "kyc_status": None,  # pending/verified/rejected (only for temple/vendor/organizer roles)
        "kyc_role": None,  # temple/vendor/organizer
        "kyc_documents": None,  # Stored KYC documents
        "privacy_settings": {
            "read_receipts": True,
            "online_status": True,
            "profile_photo": "everyone"
        }
    }
    
    user_id = await db.create_user(user)
    user['id'] = user_id
    
    token = create_jwt_token(user_id, sl_id)
    
    logger.info(f"New user registered: {sl_id}")
    return {"message": "Registration successful", "token": token, "user": user}


# =================== USER ENDPOINTS ===================

@api_router.get("/user/profile")
async def get_profile(token_data: dict = Depends(verify_token)):
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@api_router.put("/user/profile")
async def update_profile(update: UserUpdate, token_data: dict = Depends(verify_token)):
    db = await get_db()
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.update_document('users', token_data["user_id"], update_data)
    return await db.get_document('users', token_data["user_id"])


@api_router.put("/user/profile/extended")
async def update_extended_profile(update: ProfileUpdate, token_data: dict = Depends(verify_token)):
    db = await get_db()
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.update_document('users', token_data["user_id"], update_data)
    return await db.get_document('users', token_data["user_id"])


@api_router.post("/user/location")
async def setup_location(location: LocationSetup, token_data: dict = Depends(verify_token)):
    """Setup user location and join communities"""
    db = await get_db()
    user_id = token_data["user_id"]
    loc = location.dict()
    
    # Create/get communities
    community_ids = []
    
    # Area Group
    area_name = f"{loc['area'].title()} Group"
    area = await db.get_community_by_name(area_name)
    if not area:
        area_id = await db.create_community({
            "name": area_name, "type": "area", "location": loc,
            "code": generate_community_code(loc['area']), "members": [], "subgroups": SUBGROUPS
        })
        logger.info(f"Created community: {area_name}")
    else:
        area_id = area['id']
    community_ids.append(area_id)
    
    # City Group
    city_name = f"{loc['city'].title()} Group"
    city = await db.get_community_by_name(city_name)
    if not city:
        city_id = await db.create_community({
            "name": city_name, "type": "city",
            "location": {"country": loc['country'], "state": loc['state'], "city": loc['city']},
            "code": generate_community_code(loc['city']), "members": [], "subgroups": SUBGROUPS
        })
        logger.info(f"Created community: {city_name}")
    else:
        city_id = city['id']
    community_ids.append(city_id)
    
    # State Group
    state_name = f"{loc['state'].title()} Group"
    state = await db.get_community_by_name(state_name)
    if not state:
        state_id = await db.create_community({
            "name": state_name, "type": "state",
            "location": {"country": loc['country'], "state": loc['state']},
            "code": generate_community_code(loc['state']), "members": [], "subgroups": SUBGROUPS
        })
        logger.info(f"Created community: {state_name}")
    else:
        state_id = state['id']
    community_ids.append(state_id)
    
    # Country Group
    country_name = f"{loc['country'].title()} Group"
    country = await db.get_community_by_name(country_name)
    if not country:
        country_id = await db.create_community({
            "name": country_name, "type": "country",
            "location": {"country": loc['country']},
            "code": generate_community_code(loc['country']), "members": [], "subgroups": SUBGROUPS
        })
        logger.info(f"Created community: {country_name}")
    else:
        country_id = country['id']
    community_ids.append(country_id)
    
    # Add user to communities
    for cid in community_ids:
        await db.add_member_to_community(cid, user_id)
    
    # Update user with location and communities
    await db.update_document('users', user_id, {
        'location': loc,
        'home_location': loc
    })
    await db.array_union_update('users', user_id, 'communities', community_ids)
    
    user = await db.get_document('users', user_id)
    return {"message": "Location set successfully", "user": user, "communities_joined": len(community_ids)}


@api_router.post("/user/dual-location")
async def setup_dual_location(locations: DualLocationSetup, token_data: dict = Depends(verify_token)):
    """Setup home and optionally office location, join communities for both"""
    db = await get_db()
    user_id = token_data["user_id"]
    update_data = {}
    all_community_ids = []
    
    async def create_communities_for_location(loc):
        """Helper to create/get communities for a location"""
        community_ids = []
        
        # Area Group
        area_name = f"{loc['area'].title()} Group"
        area = await db.get_community_by_name(area_name)
        if not area:
            area_id = await db.create_community({
                "name": area_name, "type": "area", "location": loc,
                "code": generate_community_code(loc['area']), "members": [], "subgroups": SUBGROUPS
            })
            logger.info(f"Created community: {area_name}")
        else:
            area_id = area['id']
        community_ids.append(area_id)
        
        # City Group
        city_name = f"{loc['city'].title()} Group"
        city = await db.get_community_by_name(city_name)
        if not city:
            city_id = await db.create_community({
                "name": city_name, "type": "city",
                "location": {"country": loc['country'], "state": loc['state'], "city": loc['city']},
                "code": generate_community_code(loc['city']), "members": [], "subgroups": SUBGROUPS
            })
            logger.info(f"Created community: {city_name}")
        else:
            city_id = city['id']
        community_ids.append(city_id)
        
        # State Group
        state_name = f"{loc['state'].title()} Group"
        state = await db.get_community_by_name(state_name)
        if not state:
            state_id = await db.create_community({
                "name": state_name, "type": "state",
                "location": {"country": loc['country'], "state": loc['state']},
                "code": generate_community_code(loc['state']), "members": [], "subgroups": SUBGROUPS
            })
            logger.info(f"Created community: {state_name}")
        else:
            state_id = state['id']
        community_ids.append(state_id)
        
        # Country Group
        country_name = f"{loc['country'].title()} Group"
        country = await db.get_community_by_name(country_name)
        if not country:
            country_id = await db.create_community({
                "name": country_name, "type": "country",
                "location": {"country": loc['country']},
                "code": generate_community_code(loc['country']), "members": [], "subgroups": SUBGROUPS
            })
            logger.info(f"Created community: {country_name}")
        else:
            country_id = country['id']
        community_ids.append(country_id)
        
        return community_ids
    
    # Process home location
    if locations.home_location:
        home_loc = locations.home_location
        update_data['home_location'] = home_loc
        update_data['location'] = home_loc
        home_communities = await create_communities_for_location(home_loc)
        all_community_ids.extend(home_communities)
    
    # Process office location
    if locations.office_location:
        office_loc = locations.office_location
        update_data['office_location'] = office_loc
        office_communities = await create_communities_for_location(office_loc)
        all_community_ids.extend(office_communities)
    
    # Remove duplicates
    all_community_ids = list(set(all_community_ids))
    
    # Add user to all communities
    for cid in all_community_ids:
        await db.add_member_to_community(cid, user_id)
    
    # Update user with locations and communities
    if update_data:
        await db.update_document('users', user_id, update_data)
    
    if all_community_ids:
        await db.array_union_update('users', user_id, 'communities', all_community_ids)
    
    user = await db.get_document('users', user_id)
    return {"message": "Locations updated", "user": user, "communities_joined": len(all_community_ids)}


@api_router.get("/user/search/{sl_id}")
async def search_user(sl_id: str, token_data: dict = Depends(verify_token)):
    db = await get_db()
    user = await db.get_user_by_sl_id(sl_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"sl_id": user["sl_id"], "name": user["name"], "photo": user.get("photo"), "badges": user.get("badges", [])}


@api_router.get("/user/verification-status")
async def get_verification_status(token_data: dict = Depends(verify_token)):
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    return {
        "is_verified": user.get("is_verified", False),
        "member_type": "Verified Member" if user.get("is_verified") else "Basic Member",
        "can_post_in_community": user.get("is_verified", False)
    }


@api_router.post("/user/request-verification")
async def request_verification(data: dict, token_data: dict = Depends(verify_token)):
    db = await get_db()
    
    # Auto-approve for demo
    await db.update_document('users', token_data["user_id"], {
        'is_verified': True,
        'verification_date': datetime.utcnow()
    })
    await db.array_union_update('users', token_data["user_id"], 'badges', ['Verified Member'])
    
    return {"message": "Verification completed", "status": "approved"}


@api_router.get("/user/profile-completion")
async def get_profile_completion(token_data: dict = Depends(verify_token)):
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    
    fields = ["name", "photo", "language", "location", "kuldevi", "kuldevi_temple_area", "gotra", "date_of_birth", "place_of_birth", "time_of_birth"]
    completed = sum(1 for f in fields if user.get(f))
    
    return {
        "completion_percentage": int((completed / len(fields)) * 100),
        "completed_fields": completed,
        "total_fields": len(fields),
        "horoscope_eligible": all(user.get(f) for f in ["date_of_birth", "place_of_birth", "time_of_birth"])
    }


@api_router.get("/user/horoscope")
async def get_horoscope(token_data: dict = Depends(verify_token)):
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    
    if not all(user.get(f) for f in ["date_of_birth", "place_of_birth", "time_of_birth"]):
        raise HTTPException(status_code=400, detail="Complete birth details to view horoscope")
    
    dob = user.get("date_of_birth", "2000-01-01")
    month = int(dob.split("-")[1]) if dob else 1
    zodiac_signs = ["Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"]
    
    day_of_year = datetime.utcnow().timetuple().tm_yday
    return {
        "zodiac_sign": zodiac_signs[(month - 1) % 12],
        "daily_horoscope": "Today is favorable for spiritual activities and prayers.",
        "lucky_color": ["Orange", "White", "Yellow", "Red", "Green"][day_of_year % 5],
        "lucky_number": (day_of_year % 9) + 1
    }


@api_router.post("/user/fcm-token")
async def save_fcm_token(request: dict, token_data: dict = Depends(verify_token)):
    """
    Save or update user's FCM token for push notifications
    
    Body: { "fcm_token": "your_fcm_token" }
    """
    fcm_token = request.get("fcm_token")
    if not fcm_token:
        raise HTTPException(status_code=400, detail="FCM token required")
    
    user_id = token_data["user_id"]
    
    success = await push_service.save_user_fcm_token(user_id, fcm_token)
    
    if success:
        logger.info(f"FCM token saved for user {user_id}")
        return {"message": "FCM token saved successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to save FCM token")


# =================== GEOCODE ===================

@api_router.post("/geocode/reverse")
async def reverse_geocode(request: dict):
    """Reverse geocode coordinates to location"""
    import aiohttp
    
    lat = request.get("latitude")
    lon = request.get("longitude")
    
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="latitude and longitude are required")
    
    # Mock/fallback for Mumbai coordinates for testing
    if 18.0 <= lat <= 20.0 and 72.0 <= lon <= 73.0:
        return {
            "country": "Bharat",
            "state": "Maharashtra", 
            "city": "Mumbai",
            "area": "Andheri",
            "display_name": "Andheri, Mumbai, Maharashtra, Bharat"
        }
    
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {"lat": lat, "lon": lon, "format": "json", "addressdetails": 1}
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(url, params=params, headers={"User-Agent": "SanatanLok/2.2"}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data and "address" in data:
                        addr = data.get("address", {})
                        return {
                            "country": addr.get("country", "Unknown").replace("India", "Bharat"),
                            "state": addr.get("state", "Unknown"),
                            "city": addr.get("city") or addr.get("town") or addr.get("municipality", "Unknown"),
                            "area": addr.get("suburb") or addr.get("neighbourhood", "Unknown"),
                            "display_name": data.get("display_name", "")
                        }
                else:
                    logger.warning(f"Geocoding API returned status {resp.status}")
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
    
    # Fallback response when external API fails
    return {
        "country": "Unknown",
        "state": "Unknown", 
        "city": "Unknown",
        "area": "Unknown",
        "display_name": f"Location at {lat}, {lon}"
    }


# =================== COMMUNITIES ===================

@api_router.get("/communities")
async def get_communities(token_data: dict = Depends(verify_token)):
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    if not user:
        return []
    
    communities = []
    for cid in user.get('communities', []):
        try:
            comm = await db.get_document('communities', cid)
            if comm:
                communities.append({
                    "id": comm['id'],
                    "name": comm['name'],
                    "type": comm['type'],
                    "code": comm.get('code', ''),
                    "member_count": len(comm.get('members', [])),
                    "subgroups": comm.get('subgroups', [])
                })
        except:
            pass
    return communities


@api_router.get("/communities/discover")
async def discover_communities(token_data: dict = Depends(verify_token)):
    db = await get_db()
    communities = await db.query_documents('communities', limit=20)
    return [{"id": c['id'], "name": c['name'], "type": c['type'], "member_count": len(c.get('members', []))} for c in communities]


@api_router.get("/communities/{community_id}")
async def get_community(community_id: str, token_data: dict = Depends(verify_token)):
    db = await get_db()
    comm = await db.get_document('communities', community_id)
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found")
    return comm


@api_router.post("/communities/{community_id}/agree-rules")
async def agree_rules(community_id: str, data: dict, token_data: dict = Depends(verify_token)):
    db = await get_db()
    await db.array_union_update('users', token_data["user_id"], 'agreed_rules', [f"{community_id}_{data.get('subgroup_type')}"])
    return {"message": "Rules agreed"}


@api_router.get("/communities/{community_id}/stats")
async def get_community_stats(community_id: str, token_data: dict = Depends(verify_token)):
    db = await get_db()
    comm = await db.get_document('communities', community_id)
    return {
        "community_id": community_id,
        "name": comm['name'] if comm else "Unknown",
        "member_count": len(comm.get('members', [])) if comm else 0,
        "new_messages": 0
    }


# =================== MESSAGING (Chats with Messages subcollection) ===================

@api_router.post("/messages/community/{community_id}/{subgroup_type}")
async def send_community_message(
    community_id: str, subgroup_type: str, message: MessageCreate,
    token_data: dict = Depends(verify_token), _: bool = Depends(messaging_rate_limit)
):
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    
    if not user.get('is_verified'):
        raise HTTPException(status_code=403, detail="Only verified members can post")
    
    is_ok, reason = moderate_content(message.content)
    if not is_ok:
        raise HTTPException(status_code=400, detail=reason)
    
    chat_id = f"community_{community_id}_{subgroup_type}"
    
    # Ensure chat exists
    chat = await db.get_document('chats', chat_id)
    if not chat:
        await db.set_document('chats', chat_id, {
            'type': 'community', 'community_id': community_id, 'subgroup_type': subgroup_type
        })
    
    # Add message to subcollection
    msg_data = {
        'sender_id': user['id'],
        'sender_name': user['name'],
        'sender_photo': user.get('photo'),
        'sender_sl_id': user.get('sl_id'),
        'content': message.content,
        'message_type': message.message_type.value,
        'created_at': datetime.utcnow().isoformat()
    }
    
    msg_id = await db.add_message_to_chat(chat_id, msg_data.copy())
    
    # Create clean response data
    response_data = {
        'id': msg_id,
        'sender_id': user['id'],
        'sender_name': user['name'],
        'sender_photo': user.get('photo'),
        'sender_sl_id': user.get('sl_id'),
        'content': message.content,
        'message_type': message.message_type.value,
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Emit via Socket.IO
    await sio.emit('new_message', response_data, room=chat_id)
    
    return response_data


@api_router.get("/messages/community/{community_id}/{subgroup_type}")
async def get_community_messages(community_id: str, subgroup_type: str, limit: int = 50, token_data: dict = Depends(verify_token)):
    db = await get_db()
    chat_id = f"community_{community_id}_{subgroup_type}"
    return await db.get_chat_messages(chat_id, limit)


@api_router.post("/dm")
async def send_dm(message: DirectMessageCreate, token_data: dict = Depends(verify_token)):
    """
    Send a direct message. Creates private chat if it doesn't exist.
    
    Logic:
    1. Check if chat exists between the two users (members array contains both)
    2. If exists -> send message to that chat
    3. If not exists -> create new chat document with chat_type: "private"
    """
    db = await get_db()
    sender = await db.get_document('users', token_data["user_id"])
    recipient = await db.get_user_by_sl_id(message.recipient_sl_id)
    
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    
    sender_id = sender['id']
    recipient_id = recipient['id']
    
    # Create deterministic chat_id from sorted user IDs
    sorted_members = sorted([sender_id, recipient_id])
    chat_id = f"private_{'_'.join(sorted_members)}"
    
    # Check if chat exists
    chat = await db.get_document('chats', chat_id)
    
    if not chat:
        # Create new private chat document
        chat_data = {
            'chat_type': 'private',
            'members': sorted_members,
            'created_at': datetime.utcnow(),
            'last_message': message.content[:100],  # Preview of last message
            'updated_at': datetime.utcnow()
        }
        await db.set_document('chats', chat_id, chat_data)
        logger.info(f"Created new private chat: {chat_id}")
    else:
        # Update chat with last message
        await db.update_document('chats', chat_id, {
            'last_message': message.content[:100],
            'updated_at': datetime.utcnow()
        })
    
    # Create message in messages subcollection
    now = datetime.utcnow()
    msg_data = {
        'sender_id': sender_id,
        'sender_name': sender['name'],
        'sender_photo': sender.get('photo'),
        'text': message.content,
        'content': message.content,  # Keep for compatibility
        'status': 'delivered',  # delivered = single tick, read = double tick
        'read_by': [],  # List of user IDs who have read the message
    }
    
    msg_id = await db.add_message_to_chat(chat_id, msg_data)
    
    # Response data (with proper timestamps for JSON)
    response_msg = {
        'id': msg_id,
        'sender_id': sender_id,
        'sender_name': sender['name'],
        'sender_photo': sender.get('photo'),
        'text': message.content,
        'content': message.content,
        'status': 'delivered',
        'created_at': now.isoformat(),
        'timestamp': now.isoformat()
    }
    
    # Emit via socket
    await sio.emit('new_dm', response_msg, room=chat_id)
    
    # Send push notification to recipient
    try:
        await push_service.notify_new_dm(
            recipient_id=recipient_id,
            sender_name=sender['name'],
            message_preview=message.content,
            chat_id=chat_id
        )
    except Exception as e:
        logger.warning(f"Failed to send push notification: {e}")
    
    return {
        "message": response_msg,
        "chat_id": chat_id,
        "recipient": {
            "id": recipient_id,
            "name": recipient['name'],
            "sl_id": recipient.get('sl_id'),
            "photo": recipient.get('photo')
        }
    }


@api_router.get("/dm/conversations")
async def get_dm_conversations(token_data: dict = Depends(verify_token)):
    """Get all private chat conversations for the current user"""
    db = await get_db()
    user_id = token_data["user_id"]
    
    # Query all private chats
    chats = await db.query_documents('chats', filters=[('chat_type', '==', 'private')])
    
    result = []
    for chat in chats:
        members = chat.get('members', [])
        
        # Check if user is a member of this chat
        if user_id in members:
            # Get the other user
            other_id = [m for m in members if m != user_id][0]
            other = await db.get_document('users', other_id)
            
            if other:
                # Get the last message to determine status and sender
                last_messages = await db.get_chat_messages(chat['id'], 1)
                last_msg = last_messages[0] if last_messages else None
                
                # Determine status to show (only for messages sent by current user)
                last_message_status = None
                last_message_sender_id = None
                
                if last_msg:
                    last_message_sender_id = last_msg.get('sender_id')
                    # Only show status indicator if the current user sent the message
                    if last_message_sender_id == user_id:
                        last_message_status = last_msg.get('status', 'delivered')
                
                result.append({
                    "conversation_id": chat['id'],
                    "chat_id": chat['id'],
                    "user": {
                        "id": other_id,
                        "name": other.get('name', 'Unknown'),
                        "sl_id": other.get('sl_id', ''),
                        "photo": other.get('photo')
                    },
                    "last_message": chat.get('last_message', ''),
                    "last_message_at": chat.get('updated_at', chat.get('created_at')),
                    "last_message_status": last_message_status,
                    "last_message_sender_id": last_message_sender_id,
                    "created_at": chat.get('created_at')
                })
    
    # Sort by last_message_at (most recent first)
    result.sort(key=lambda x: x.get('last_message_at') or datetime.min, reverse=True)
    
    return result


@api_router.get("/dm/{chat_id}")
async def get_dm_messages(chat_id: str, limit: int = 50, token_data: dict = Depends(verify_token)):
    """Get messages from a private chat"""
    db = await get_db()
    user_id = token_data["user_id"]
    
    # Verify user is part of this chat
    chat = await db.get_document('chats', chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if user_id not in chat.get('members', []):
        raise HTTPException(status_code=403, detail="Not authorized to view this chat")
    
    messages = await db.get_chat_messages(chat_id, limit)
    return messages


@api_router.post("/dm/{chat_id}/read")
async def mark_messages_read(chat_id: str, token_data: dict = Depends(verify_token)):
    """Mark all messages in a chat as read by the current user"""
    db = await get_db()
    user_id = token_data["user_id"]
    
    # Verify user is part of this chat
    chat = await db.get_document('chats', chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if user_id not in chat.get('members', []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if user has read receipts enabled
    user = await db.get_document('users', user_id)
    if not user.get('privacy_settings', {}).get('read_receipts', True):
        # User has disabled read receipts, don't update
        return {"message": "Read receipts disabled"}
    
    # Get all messages and mark them as read
    messages = await db.get_chat_messages(chat_id, 100)
    updated_count = 0
    
    for msg in messages:
        # Only mark messages from other users as read
        if msg.get('sender_id') != user_id:
            read_by = msg.get('read_by', [])
            if user_id not in read_by:
                read_by.append(user_id)
                await db.update_chat_message(chat_id, msg['id'], {
                    'read_by': read_by,
                    'status': 'read'
                })
                updated_count += 1
    
    return {"message": f"Marked {updated_count} messages as read"}


@api_router.get("/user/privacy-settings")
async def get_privacy_settings(token_data: dict = Depends(verify_token)):
    """Get user's privacy settings"""
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    
    # Default privacy settings
    default_settings = {
        'read_receipts': True,  # Show double tick when messages are read
        'online_status': True,  # Show online/last seen status
        'profile_photo': 'everyone',  # Who can see profile photo
    }
    
    return user.get('privacy_settings', default_settings)


@api_router.put("/user/privacy-settings")
async def update_privacy_settings(settings: dict, token_data: dict = Depends(verify_token)):
    """Update user's privacy settings"""
    db = await get_db()
    user_id = token_data["user_id"]
    
    # Validate settings
    allowed_keys = {'read_receipts', 'online_status', 'profile_photo'}
    filtered_settings = {k: v for k, v in settings.items() if k in allowed_keys}
    
    await db.update_document('users', user_id, {'privacy_settings': filtered_settings})
    
    return {"message": "Privacy settings updated", "settings": filtered_settings}


# =================== CIRCLES ===================

@api_router.get("/circles")
async def get_circles(token_data: dict = Depends(verify_token)):
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    circles = []
    for cid in user.get('circles', []):
        circle = await db.get_document('circles', cid)
        if circle:
            circles.append(circle)
    return circles


@api_router.post("/circles")
async def create_circle(data: CircleCreate, token_data: dict = Depends(verify_token)):
    db = await get_db()
    user_id = token_data["user_id"]
    
    code = generate_circle_code(data.name)
    circle_data = {
        "name": data.name,
        "code": code,
        "admin_id": user_id,
        "members": [user_id]
    }
    
    circle_id = await db.create_document('circles', circle_data)
    await db.array_union_update('users', user_id, 'circles', [circle_id])
    
    circle_data['id'] = circle_id
    return circle_data


# =================== TEMPLES ===================

@api_router.get("/temples")
async def get_temples(token_data: dict = Depends(verify_token)):
    db = await get_db()
    return await db.query_documents('temples', limit=20)


@api_router.get("/temples/nearby")
async def get_nearby_temples(lat: float = None, lng: float = None, token_data: dict = Depends(verify_token)):
    """Get temples, optionally filtered by location"""
    db = await get_db()
    temples = await db.query_documents('temples', limit=20)
    
    # Add is_following status for each temple
    user_id = token_data["user_id"]
    for temple in temples:
        followers = temple.get('followers', [])
        temple['is_following'] = user_id in followers
        temple['follower_count'] = len(followers)
    
    return temples


@api_router.get("/temples/{temple_id}")
async def get_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    """Get temple details"""
    db = await get_db()
    temple = await db.get_document('temples', temple_id)
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    
    # Add is_following status
    user_id = token_data["user_id"]
    followers = temple.get('followers', [])
    temple['is_following'] = user_id in followers
    temple['follower_count'] = len(followers)
    
    return temple


@api_router.post("/temples")
async def create_temple(data: dict, token_data: dict = Depends(verify_token)):
    """Create a new temple page (KYC required)"""
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    
    # Check KYC verification for temple role
    if user.get('kyc_status') != 'verified' or user.get('kyc_role') != 'temple':
        raise HTTPException(status_code=403, detail="Only verified temple admins can create temple pages")
    
    temple_id = f"temple_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{token_data['user_id'][:8]}"
    
    temple_data = {
        'temple_id': temple_id,
        'name': data.get('name'),
        'location': data.get('location', {}),
        'description': data.get('description', ''),
        'deity': data.get('deity', ''),
        'aarti_timings': data.get('aarti_timings', {}),
        'admin_id': token_data['user_id'],
        'admin_name': user['name'],
        'followers': [],
        'is_verified': True,  # Created by verified temple admin
        'community_type': 'temple_channel',  # Temple announcement channel
        'created_at': datetime.utcnow()
    }
    
    doc_id = await db.create_document('temples', temple_data)
    temple_data['id'] = doc_id
    
    logger.info(f"Temple created: {data.get('name')} by {user['name']}")
    return temple_data


@api_router.post("/temples/{temple_id}/follow")
async def follow_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    db = await get_db()
    await db.array_union_update('temples', temple_id, 'followers', [token_data["user_id"]])
    return {"message": "Now following temple"}


@api_router.post("/temples/{temple_id}/unfollow")
async def unfollow_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    db = await get_db()
    await db.array_remove_update('temples', temple_id, 'followers', [token_data["user_id"]])
    return {"message": "Unfollowed temple"}


@api_router.get("/temples/{temple_id}/posts")
async def get_temple_posts(temple_id: str, token_data: dict = Depends(verify_token)):
    """Get temple announcement posts"""
    db = await get_db()
    chat_id = f"temple_{temple_id}"
    return await db.get_chat_messages(chat_id, 50)


@api_router.post("/temples/{temple_id}/posts")
async def create_temple_post(temple_id: str, data: dict, token_data: dict = Depends(verify_token)):
    """Create a temple announcement (temple admin only)"""
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    
    # Verify temple and admin status
    temple = await db.get_document('temples', temple_id)
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    
    if temple.get('admin_id') != token_data['user_id']:
        raise HTTPException(status_code=403, detail="Only temple admin can post announcements")
    
    chat_id = f"temple_{temple_id}"
    
    # Ensure chat exists
    chat = await db.get_document('chats', chat_id)
    if not chat:
        await db.set_document('chats', chat_id, {
            'type': 'temple_channel',
            'temple_id': temple_id,
            'temple_name': temple.get('name'),
            'admin_id': token_data['user_id']
        })
    
    # Create announcement post
    post_data = {
        'sender_id': user['id'],
        'sender_name': user['name'],
        'sender_photo': user.get('photo'),
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'post_type': data.get('post_type', 'announcement'),
        'created_at': datetime.utcnow().isoformat()
    }
    
    msg_id = await db.add_message_to_chat(chat_id, post_data)
    post_data['id'] = msg_id
    
    logger.info(f"Temple announcement created: {data.get('title')} at {temple.get('name')}")
    return post_data


# =================== KYC SYSTEM ===================

@api_router.get("/kyc/status")
async def get_kyc_status(token_data: dict = Depends(verify_token)):
    """Get user's KYC status"""
    db = await get_db()
    user = await db.get_document('users', token_data["user_id"])
    
    return {
        "kyc_status": user.get('kyc_status'),  # pending/verified/rejected
        "kyc_role": user.get('kyc_role'),  # temple/vendor/organizer
        "submitted_at": user.get('kyc_submitted_at'),
        "verified_at": user.get('kyc_verified_at'),
        "rejection_reason": user.get('kyc_rejection_reason')
    }


@api_router.post("/kyc/submit")
async def submit_kyc(data: dict, token_data: dict = Depends(verify_token)):
    """
    Submit KYC documents for verification
    Required for: temple admins, vendors, event organizers
    
    Accepts:
    - kyc_role: temple/vendor/organizer
    - id_type: aadhaar or pan
    - id_number: ID number
    - selfie_photo: Base64 encoded selfie (for PAN verification)
    - id_photo: Base64 encoded ID document
    """
    from services.image_service import compress_base64_image, is_valid_image
    
    db = await get_db()
    user_id = token_data["user_id"]
    
    kyc_role = data.get('kyc_role')
    if kyc_role not in ['temple', 'vendor', 'organizer']:
        raise HTTPException(status_code=400, detail="Invalid KYC role. Must be: temple, vendor, or organizer")
    
    id_type = data.get('id_type')
    if id_type not in ['aadhaar', 'pan']:
        raise HTTPException(status_code=400, detail="Invalid ID type. Must be: aadhaar or pan")
    
    id_number = data.get('id_number', '').strip()
    if not id_number:
        raise HTTPException(status_code=400, detail="ID number is required")
    
    # Validate ID format
    if id_type == 'aadhaar' and len(id_number) != 12:
        raise HTTPException(status_code=400, detail="Aadhaar must be 12 digits")
    if id_type == 'pan' and len(id_number) != 10:
        raise HTTPException(status_code=400, detail="PAN must be 10 characters")
    
    # Compress photos if provided
    id_photo = data.get('id_photo')
    if id_photo and is_valid_image(id_photo):
        id_photo = compress_base64_image(id_photo, max_size=800, quality=80)
    
    selfie_photo = data.get('selfie_photo')
    if selfie_photo and is_valid_image(selfie_photo):
        selfie_photo = compress_base64_image(selfie_photo, max_size=512, quality=80)
    
    # Store KYC documents (for admin review)
    kyc_data = {
        'kyc_status': 'pending',
        'kyc_role': kyc_role,
        'kyc_id_type': id_type,
        'kyc_id_number': id_number,
        'kyc_id_photo': id_photo,
        'kyc_selfie_photo': selfie_photo if id_type == 'pan' else None,
        'kyc_submitted_at': datetime.utcnow().isoformat()
    }
    
    await db.update_document('users', user_id, kyc_data)
    
    logger.info(f"KYC submitted for {token_data.get('sl_id')} - role: {kyc_role}")
    return {"message": "KYC submitted successfully", "status": "pending"}


@api_router.post("/admin/kyc/verify/{user_id}")
async def verify_kyc(user_id: str, data: dict, token_data: dict = Depends(verify_token)):
    """
    Admin endpoint to verify or reject KYC
    data: { action: 'verify' | 'reject', rejection_reason?: string }
    """
    db = await get_db()
    
    # Check if current user is admin (simple check - in production use proper admin role)
    admin_user = await db.get_document('users', token_data["user_id"])
    if 'Admin' not in admin_user.get('badges', []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.get_document('users', user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get('kyc_status') != 'pending':
        raise HTTPException(status_code=400, detail="No pending KYC for this user")
    
    action = data.get('action')
    if action == 'verify':
        kyc_role = target_user.get('kyc_role')
        badge_map = {
            'temple': 'Verified Temple',
            'vendor': 'Verified Vendor',
            'organizer': 'Verified Organizer'
        }
        
        update_data = {
            'kyc_status': 'verified',
            'kyc_verified_at': datetime.utcnow().isoformat(),
            'is_verified': True
        }
        await db.update_document('users', user_id, update_data)
        
        # Add verified badge
        if kyc_role in badge_map:
            await db.array_union_update('users', user_id, 'badges', [badge_map[kyc_role]])
        
        logger.info(f"KYC verified for user {user_id}")
        return {"message": "KYC verified", "badge_added": badge_map.get(kyc_role)}
    
    elif action == 'reject':
        update_data = {
            'kyc_status': 'rejected',
            'kyc_rejection_reason': data.get('rejection_reason', 'Documents not acceptable')
        }
        await db.update_document('users', user_id, update_data)
        
        logger.info(f"KYC rejected for user {user_id}")
        return {"message": "KYC rejected"}
    
    raise HTTPException(status_code=400, detail="Invalid action")


@api_router.get("/admin/kyc/pending")
async def get_pending_kyc(token_data: dict = Depends(verify_token)):
    """Get all users with pending KYC (admin only)"""
    db = await get_db()
    
    # Check admin
    admin_user = await db.get_document('users', token_data["user_id"])
    if 'Admin' not in admin_user.get('badges', []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pending = await db.query_documents('users', filters=[('kyc_status', '==', 'pending')])
    
    # Return only necessary fields
    return [{
        'id': u['id'],
        'name': u.get('name'),
        'sl_id': u.get('sl_id'),
        'kyc_role': u.get('kyc_role'),
        'kyc_id_type': u.get('kyc_id_type'),
        'kyc_submitted_at': u.get('kyc_submitted_at')
    } for u in pending]


# =================== REPORT SYSTEM ===================

@api_router.post("/report")
async def report_content(data: dict, token_data: dict = Depends(verify_token)):
    """
    Report a message or content for moderation
    
    data:
    - content_type: message/user/temple/post
    - content_id: ID of the content being reported
    - chat_id: Chat ID (for messages)
    - category: religious_attack/disrespectful/spam/abuse
    - description: Optional description
    """
    db = await get_db()
    user_id = token_data["user_id"]
    
    content_type = data.get('content_type')
    if content_type not in ['message', 'user', 'temple', 'post']:
        raise HTTPException(status_code=400, detail="Invalid content type")
    
    category = data.get('category')
    valid_categories = ['religious_attack', 'disrespectful', 'spam', 'abuse', 'other']
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {valid_categories}")
    
    report_data = {
        'reporter_id': user_id,
        'content_type': content_type,
        'content_id': data.get('content_id'),
        'chat_id': data.get('chat_id'),
        'category': category,
        'description': data.get('description', ''),
        'status': 'pending',  # pending/reviewed/resolved/dismissed
        'created_at': datetime.utcnow()
    }
    
    report_id = await db.create_document('reports', report_data)
    
    logger.info(f"Report submitted: {content_type} - {category} by {user_id}")
    return {"message": "Report submitted", "report_id": report_id}


@api_router.get("/admin/reports")
async def get_reports(status: str = 'pending', token_data: dict = Depends(verify_token)):
    """Get all reports (admin only)"""
    db = await get_db()
    
    # Check admin
    admin_user = await db.get_document('users', token_data["user_id"])
    if 'Admin' not in admin_user.get('badges', []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    filters = [('status', '==', status)] if status else []
    reports = await db.query_documents('reports', filters=filters, limit=50)
    
    return reports


@api_router.post("/admin/reports/{report_id}/resolve")
async def resolve_report(report_id: str, data: dict, token_data: dict = Depends(verify_token)):
    """Resolve a report (admin only)"""
    db = await get_db()
    
    # Check admin
    admin_user = await db.get_document('users', token_data["user_id"])
    if 'Admin' not in admin_user.get('badges', []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    action = data.get('action')  # resolved/dismissed
    if action not in ['resolved', 'dismissed']:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.update_document('reports', report_id, {
        'status': action,
        'resolved_by': token_data["user_id"],
        'resolved_at': datetime.utcnow().isoformat(),
        'resolution_note': data.get('note', '')
    })
    
    return {"message": f"Report {action}"}


# =================== SAMPLE DATA INITIALIZATION ===================

@api_router.post("/admin/init-sample-temples")
async def init_sample_temples(token_data: dict = Depends(verify_token)):
    """Initialize sample temple data for beta testing"""
    db = await get_db()
    
    sample_temples = [
        {
            'temple_id': 'siddhivinayak_mumbai',
            'name': 'Shree Siddhivinayak Temple',
            'location': {'city': 'Mumbai', 'area': 'Prabhadevi', 'state': 'Maharashtra', 'country': 'India'},
            'description': 'One of the most famous Ganpati temples in Mumbai, known for wish fulfillment.',
            'deity': 'Lord Ganesha',
            'aarti_timings': {'morning': '5:30 AM', 'afternoon': '12:00 PM', 'evening': '8:00 PM'},
            'is_verified': True,
            'community_type': 'temple_channel',
            'followers': [],
            'created_at': datetime.utcnow()
        },
        {
            'temple_id': 'iskcon_mumbai',
            'name': 'ISKCON Temple Mumbai',
            'location': {'city': 'Mumbai', 'area': 'Juhu', 'state': 'Maharashtra', 'country': 'India'},
            'description': 'Beautiful temple dedicated to Lord Krishna with daily bhajans and prasadam.',
            'deity': 'Lord Krishna',
            'aarti_timings': {'morning': '4:30 AM', 'afternoon': '1:00 PM', 'evening': '7:00 PM'},
            'is_verified': True,
            'community_type': 'temple_channel',
            'followers': [],
            'created_at': datetime.utcnow()
        },
        {
            'temple_id': 'mahalaxmi_mumbai',
            'name': 'Mahalaxmi Temple',
            'location': {'city': 'Mumbai', 'area': 'Mahalaxmi', 'state': 'Maharashtra', 'country': 'India'},
            'description': 'Ancient temple dedicated to Goddess Mahalaxmi, Mahakali and Mahasaraswati.',
            'deity': 'Goddess Mahalaxmi',
            'aarti_timings': {'morning': '6:00 AM', 'evening': '8:30 PM'},
            'is_verified': True,
            'community_type': 'temple_channel',
            'followers': [],
            'created_at': datetime.utcnow()
        },
        {
            'temple_id': 'shirdi_sai',
            'name': 'Shirdi Sai Baba Temple',
            'location': {'city': 'Shirdi', 'area': 'Shirdi', 'state': 'Maharashtra', 'country': 'India'},
            'description': 'The holy shrine of Sai Baba, visited by millions of devotees annually.',
            'deity': 'Sai Baba',
            'aarti_timings': {'kakad': '4:30 AM', 'madhyan': '12:00 PM', 'dhoop': '6:00 PM', 'shej': '10:30 PM'},
            'is_verified': True,
            'community_type': 'temple_channel',
            'followers': [],
            'created_at': datetime.utcnow()
        },
        {
            'temple_id': 'tirupati',
            'name': 'Tirumala Venkateswara Temple',
            'location': {'city': 'Tirupati', 'area': 'Tirumala', 'state': 'Andhra Pradesh', 'country': 'India'},
            'description': 'The richest and most visited temple in the world, dedicated to Lord Venkateswara.',
            'deity': 'Lord Venkateswara',
            'aarti_timings': {'suprabhatam': '3:00 AM', 'thomala': '2:00 PM', 'ekantha': '1:00 AM'},
            'is_verified': True,
            'community_type': 'temple_channel',
            'followers': [],
            'created_at': datetime.utcnow()
        }
    ]
    
    created = 0
    for temple in sample_temples:
        existing = await db.find_one('temples', [('temple_id', '==', temple['temple_id'])])
        if not existing:
            await db.create_document('temples', temple)
            created += 1
    
    logger.info(f"Initialized {created} sample temples")
    return {"message": f"Created {created} sample temples", "total": len(sample_temples)}


# =================== EVENTS ===================

@api_router.get("/events")
async def get_events(token_data: dict = Depends(verify_token)):
    db = await get_db()
    return await db.query_documents('events', limit=20)


@api_router.get("/events/nearby")
async def get_nearby_events(token_data: dict = Depends(verify_token)):
    db = await get_db()
    return await db.query_documents('events', limit=10)


# =================== NOTIFICATIONS ===================

@api_router.get("/notifications")
async def get_notifications(token_data: dict = Depends(verify_token)):
    db = await get_db()
    return await db.query_documents('notifications', filters=[('user_id', '==', token_data["user_id"])], limit=50)


@api_router.get("/notifications/unread-count")
async def get_unread_count(token_data: dict = Depends(verify_token)):
    db = await get_db()
    count = await db.count_documents('notifications', filters=[('user_id', '==', token_data["user_id"]), ('is_read', '==', False)])
    return {"unread_count": count}


# =================== WISDOM & PANCHANG ===================

@api_router.get("/wisdom/today")
async def get_wisdom():
    day = datetime.utcnow().timetuple().tm_yday
    return WISDOM_QUOTES[day % len(WISDOM_QUOTES)]


@api_router.get("/panchang/today")
async def get_panchang():
    now = datetime.utcnow()
    tithi_index = (now.day - 1) % 15
    vrat = None
    if tithi_index == 10:
        vrat = "Ekadashi Vrat"
    elif now.weekday() == 0:
        vrat = "Somvar Vrat"
    
    return {
        "date": now.strftime("%Y-%m-%d"),
        "tithi": TITHIS[tithi_index],
        "paksha": "Shukla Paksha" if now.day <= 15 else "Krishna Paksha",
        "sunrise": "6:22 AM",
        "sunset": "6:41 PM",
        "vrat": vrat,
        "nakshatra": "Rohini",
        "yoga": "Siddhi"
    }


# Include router
app.include_router(api_router)


# =================== SOCKET.IO ===================

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
        return {"status": "joined", "room": room}


@sio.event
async def leave_room(sid, data):
    room = data.get('room')
    if room:
        await sio.leave_room(sid, room)
        return {"status": "left", "room": room}


app.mount("/socket.io", socket_app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
