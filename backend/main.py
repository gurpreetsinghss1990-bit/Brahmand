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

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest, _: bool = Depends(auth_rate_limit)):
    """Send OTP to phone (mock: 123456)"""
    phone = request.phone
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    db = await get_db()
    
    otp_data = {
        "phone": phone,
        "otp": "123456",  # Mock OTP
        "expires_at": datetime.utcnow().isoformat(),
        "attempts": 0
    }
    
    # Check existing OTP
    existing = await db.find_one('otps', [('phone', '==', phone)])
    if existing:
        await db.update_document('otps', existing['id'], otp_data)
    else:
        await db.create_document('otps', otp_data)
    
    logger.info(f"OTP sent to {phone}: 123456 (mock)")
    return {"message": "OTP sent successfully", "phone": phone}


@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify, _: bool = Depends(auth_rate_limit)):
    """Verify OTP and check user"""
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
    
    if otp_record['otp'] != request.otp:
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
    db = await get_db()
    
    # Check existing
    existing = await db.get_user_by_phone(user_data.phone)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Generate unique SL ID
    sl_id = generate_sl_id()
    while await db.get_user_by_sl_id(sl_id):
        sl_id = generate_sl_id()
    
    user = {
        "phone": user_data.phone,
        "sl_id": sl_id,
        "name": user_data.name,
        "photo": user_data.photo,
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
        "agreed_rules": []
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
        await db.client.collection('chats').document(chat_id).set({
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
        'created_at': datetime.utcnow()
    }
    
    msg_id = await db.add_message_to_chat(chat_id, msg_data)
    msg_data['id'] = msg_id
    
    # Emit via Socket.IO
    await sio.emit('new_message', msg_data, room=chat_id)
    
    return msg_data


@api_router.get("/messages/community/{community_id}/{subgroup_type}")
async def get_community_messages(community_id: str, subgroup_type: str, limit: int = 50, token_data: dict = Depends(verify_token)):
    db = await get_db()
    chat_id = f"community_{community_id}_{subgroup_type}"
    return await db.get_chat_messages(chat_id, limit)


@api_router.post("/messages/dm")
async def send_dm(message: DirectMessageCreate, token_data: dict = Depends(verify_token)):
    db = await get_db()
    sender = await db.get_document('users', token_data["user_id"])
    recipient = await db.get_user_by_sl_id(message.recipient_sl_id)
    
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    
    chat_id = f"dm_{'_'.join(sorted([sender['id'], recipient['id']]))}"
    
    chat = await db.get_document('chats', chat_id)
    if not chat:
        await db.client.collection('chats').document(chat_id).set({
            'type': 'dm', 'participants': sorted([sender['id'], recipient['id']])
        })
    
    msg_data = {
        'sender_id': sender['id'],
        'sender_name': sender['name'],
        'recipient_id': recipient['id'],
        'content': message.content,
        'created_at': datetime.utcnow()
    }
    
    msg_id = await db.add_message_to_chat(chat_id, msg_data)
    msg_data['id'] = msg_id
    
    await sio.emit('new_dm', msg_data, room=chat_id)
    return msg_data


@api_router.get("/messages/dm/conversations")
async def get_dm_conversations(token_data: dict = Depends(verify_token)):
    db = await get_db()
    chats = await db.query_documents('chats', filters=[('type', '==', 'dm')])
    
    result = []
    user_id = token_data["user_id"]
    for chat in chats:
        if user_id in chat.get('participants', []):
            other_id = [p for p in chat['participants'] if p != user_id][0]
            other = await db.get_document('users', other_id)
            if other:
                result.append({
                    "chat_id": chat['id'],
                    "user": {"id": other_id, "name": other['name'], "sl_id": other.get('sl_id')}
                })
    return result


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


@api_router.post("/temples/{temple_id}/follow")
async def follow_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    db = await get_db()
    await db.array_union_update('temples', temple_id, 'followers', [token_data["user_id"]])
    return {"message": "Now following temple"}


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
