from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import random
import string
import socketio
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'sanatan_lok')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'sanatan-lok-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 720  # 30 days

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Sanatan Lok API")

# Create a router with /api prefix
api_router = APIRouter(prefix="/api")

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# ================= MODELS =================

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class UserCreate(BaseModel):
    phone: str
    name: str
    photo: Optional[str] = None  # Base64 encoded
    language: str = "English"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    photo: Optional[str] = None
    language: Optional[str] = None

class LocationSetup(BaseModel):
    country: str
    state: str
    city: str
    area: str

class DualLocationSetup(BaseModel):
    home_location: Optional[Dict[str, Any]] = None  # {country, state, city, area, lat, lng}
    office_location: Optional[Dict[str, Any]] = None  # {country, state, city, area, lat, lng}

class ReverseGeocodeRequest(BaseModel):
    latitude: float
    longitude: float

class CircleCreate(BaseModel):
    name: str

class CircleJoin(BaseModel):
    code: str

class CircleInvite(BaseModel):
    circle_id: str
    sl_id: str

class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"  # text, image, video, voice, document, location

class DirectMessageCreate(BaseModel):
    recipient_sl_id: str
    content: str
    message_type: str = "text"

# New Models for Updates
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    photo: Optional[str] = None
    language: Optional[str] = None
    kuldevi: Optional[str] = None
    kuldevi_temple_area: Optional[str] = None
    gotra: Optional[str] = None
    date_of_birth: Optional[str] = None  # YYYY-MM-DD
    place_of_birth: Optional[str] = None
    time_of_birth: Optional[str] = None  # HH:MM

class TempleCreate(BaseModel):
    name: str
    location: Dict[str, str]  # {area, city, state, country}
    description: Optional[str] = None
    deity: Optional[str] = None
    aarti_timings: Optional[Dict[str, str]] = None

class TemplePost(BaseModel):
    title: str
    content: str
    post_type: str = "announcement"  # announcement, event, donation, aarti

class EventCreate(BaseModel):
    name: str
    description: str
    event_type: str  # bhajan, garba, satsang, katha, workshop, annadan
    location: Dict[str, Any]
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    organizer_name: Optional[str] = None

# Response Models
class UserResponse(BaseModel):
    id: str
    sl_id: str
    name: str
    photo: Optional[str] = None
    language: str
    location: Optional[Dict[str, str]] = None
    badges: List[str] = []
    reputation: int = 0
    created_at: datetime

class CommunityResponse(BaseModel):
    id: str
    name: str
    type: str
    location: Dict[str, str]
    code: str
    member_count: int
    subgroups: List[Dict[str, Any]]

class CircleResponse(BaseModel):
    id: str
    name: str
    code: str
    admin_id: str
    member_count: int
    created_at: datetime

class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_photo: Optional[str] = None
    content: str
    message_type: str
    created_at: datetime

# ================= HELPER FUNCTIONS =================

def generate_sl_id():
    """Generate unique Sanatan Lok ID"""
    return f"SL-{random.randint(100000, 999999)}"

def generate_circle_code(name: str):
    """Generate circle code from name"""
    clean_name = ''.join(c for c in name.upper() if c.isalnum())[:6]
    random_suffix = ''.join(random.choices(string.digits, k=3))
    return f"{clean_name}{random_suffix}"

def generate_community_code(name: str):
    """Generate community code"""
    clean_name = ''.join(c for c in name.upper() if c.isalnum())[:8]
    return f"{clean_name}108"

def generate_temple_id():
    """Generate unique Temple ID"""
    return f"TPL-{random.randint(1000, 9999)}"

# Daily Wisdom Quotes
WISDOM_QUOTES = [
    {"quote": "You have the right to perform your duty, but not the fruits of action.", "source": "Bhagavad Gita 2.47"},
    {"quote": "The soul is neither born, nor does it ever die. It is unborn, eternal, and primeval.", "source": "Bhagavad Gita 2.20"},
    {"quote": "Set thy heart upon thy work, but never on its reward.", "source": "Bhagavad Gita"},
    {"quote": "When meditation is mastered, the mind is unwavering like the flame of a candle in a windless place.", "source": "Bhagavad Gita 6.19"},
    {"quote": "One who sees inaction in action, and action in inaction, is intelligent among men.", "source": "Bhagavad Gita 4.18"},
    {"quote": "The mind is restless and difficult to restrain, but it is subdued by practice.", "source": "Bhagavad Gita 6.35"},
    {"quote": "Whatever happened, happened for the good. Whatever is happening, is happening for the good.", "source": "Bhagavad Gita"},
    {"quote": "He who has no attachments can really love others, for his love is pure and divine.", "source": "Bhagavad Gita"},
    {"quote": "A person can rise through the efforts of his own mind; he can also degrade himself.", "source": "Bhagavad Gita 6.5"},
    {"quote": "The wise see knowledge and action as one; they see truly.", "source": "Bhagavad Gita 5.4"},
    {"quote": "Perform your obligatory duty, because action is indeed better than inaction.", "source": "Bhagavad Gita 3.8"},
    {"quote": "Reshape yourself through the power of your will. Those who have conquered themselves live in peace.", "source": "Bhagavad Gita"},
]

# Hindu Calendar Tithis
TITHIS = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", 
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima/Amavasya"
]

# Common Vrats
VRATS = [
    "Ekadashi Vrat", "Pradosh Vrat", "Satyanarayan Vrat", "Somvar Vrat",
    "Mangalvar Vrat", "Guruvar Vrat", "Shanivar Vrat", "Shukravar Vrat",
    "Purnima Vrat", "Amavasya Vrat", "Nirjala Ekadashi", "Karwa Chauth"
]

def create_jwt_token(user_id: str, sl_id: str):
    """Create JWT token"""
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "sl_id": sl_id,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_doc(doc):
    """Convert MongoDB document to serializable dict"""
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

# Community subgroups template
SUBGROUPS = [
    {"name": "Community Chat", "type": "chat", "rules": "No promotions. No political discussions. Respectful communication."},
    {"name": "Political Discussion", "type": "political", "rules": "Respectful debate only. No abusive language."},
    {"name": "Local Vendors", "type": "marketplace", "rules": "Marketplace for local Hindu businesses. Promotions allowed."},
    {"name": "Festival Marketplace", "type": "festival", "rules": "Vendors related to festivals only."},
    {"name": "Temple Events", "type": "events", "rules": "Religious and temple events only."},
    {"name": "Community Volunteers", "type": "volunteers", "rules": "Volunteer for events, seva activities, and community work."},
    {"name": "Community Invitations", "type": "invitations", "rules": "Invitations to personal or public events."},
    {"name": "Community Help", "type": "help", "rules": "Emergency support. Blood donation, hospital help, urgent assistance."}
]

# Supported languages
SUPPORTED_LANGUAGES = ["English", "Hindi", "Gujarati", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali"]

# Keyword-based moderation (basic)
BLOCKED_KEYWORDS = ["spam", "scam", "fraud", "abuse"]

def moderate_content(content: str) -> tuple:
    """Basic keyword-based content moderation"""
    content_lower = content.lower()
    for keyword in BLOCKED_KEYWORDS:
        if keyword in content_lower:
            return False, f"Content contains blocked keyword: {keyword}"
    return True, None

# ================= AUTH ENDPOINTS =================

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest):
    """Send OTP to phone (mock - always returns 123456)"""
    phone = request.phone
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # Store OTP (mock: always 123456)
    otp_data = {
        "phone": phone,
        "otp": "123456",
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=10)
    }
    await db.otps.update_one(
        {"phone": phone},
        {"$set": otp_data},
        upsert=True
    )
    
    logger.info(f"OTP sent to {phone}: 123456 (mock)")
    return {"message": "OTP sent successfully", "phone": phone}

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify):
    """Verify OTP and check if user exists"""
    phone = request.phone
    otp = request.otp
    
    # Check OTP
    otp_record = await db.otps.find_one({"phone": phone})
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new OTP.")
    
    if otp_record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.utcnow() > otp_record["expires_at"]:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Check if user exists
    user = await db.users.find_one({"phone": phone})
    if user:
        # User exists, return token
        token = create_jwt_token(str(user["_id"]), user["sl_id"])
        return {
            "message": "Login successful",
            "token": token,
            "user": serialize_doc(user),
            "is_new_user": False
        }
    
    # New user, return flag
    return {
        "message": "OTP verified",
        "is_new_user": True,
        "phone": phone
    }

@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    """Register new user after OTP verification"""
    phone = user_data.phone
    
    # Check if user already exists
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Validate language
    if user_data.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language. Choose from: {SUPPORTED_LANGUAGES}")
    
    # Generate unique SL ID
    sl_id = generate_sl_id()
    while await db.users.find_one({"sl_id": sl_id}):
        sl_id = generate_sl_id()
    
    # Create user
    user = {
        "phone": phone,
        "sl_id": sl_id,
        "name": user_data.name,
        "photo": user_data.photo,
        "language": user_data.language,
        "location": None,
        "badges": ["New Member"],
        "reputation": 0,
        "temple_passbook": {
            "temples_followed": [],
            "seva_participation": [],
            "donation_participation": [],
            "festival_participation": []
        },
        "communities": [],
        "circles": [],
        "agreed_rules": [],
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    
    # Generate token
    token = create_jwt_token(str(result.inserted_id), sl_id)
    
    return {
        "message": "Registration successful",
        "token": token,
        "user": serialize_doc(user)
    }

# ================= USER ENDPOINTS =================

@api_router.get("/user/profile")
async def get_profile(token_data: dict = Depends(verify_token)):
    """Get current user profile"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_doc(user)

@api_router.put("/user/profile")
async def update_profile(update: UserUpdate, token_data: dict = Depends(verify_token)):
    """Update user profile"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if "language" in update_data and update_data["language"] not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language")
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(token_data["user_id"])},
            {"$set": update_data}
        )
    
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    return serialize_doc(user)

@api_router.post("/user/location")
async def setup_location(location: LocationSetup, token_data: dict = Depends(verify_token)):
    """Setup user location and join communities (legacy single location)"""
    user_id = token_data["user_id"]
    
    location_data = {
        "country": location.country,
        "state": location.state,
        "city": location.city,
        "area": location.area
    }
    
    # Create or get communities for each level
    community_ids = []
    
    # Area Community
    area_community = await get_or_create_community(
        f"{location.area.title()} Area Group",
        "area",
        location_data
    )
    community_ids.append(str(area_community["_id"]))
    
    # City Community
    city_community = await get_or_create_community(
        f"{location.city.title()} City Group",
        "city",
        {"country": location.country, "state": location.state, "city": location.city}
    )
    community_ids.append(str(city_community["_id"]))
    
    # State Community
    state_community = await get_or_create_community(
        f"{location.state.title()} State Group",
        "state",
        {"country": location.country, "state": location.state}
    )
    community_ids.append(str(state_community["_id"]))
    
    # Country Community
    country_community = await get_or_create_community(
        f"{location.country.title()} Country Group",
        "country",
        {"country": location.country}
    )
    community_ids.append(str(country_community["_id"]))
    
    # Update user with location and communities
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {"location": location_data, "home_location": location_data},
            "$addToSet": {"communities": {"$each": community_ids}}
        }
    )
    
    # Add user to community members
    for cid in community_ids:
        await db.communities.update_one(
            {"_id": ObjectId(cid)},
            {"$addToSet": {"members": user_id}}
        )
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return {
        "message": "Location set successfully",
        "user": serialize_doc(user),
        "communities_joined": len(community_ids)
    }

@api_router.post("/user/dual-location")
async def setup_dual_location(locations: DualLocationSetup, token_data: dict = Depends(verify_token)):
    """Setup user's home and office locations and join communities for both"""
    user_id = token_data["user_id"]
    community_ids = []
    
    async def add_location_communities(loc_data: dict, loc_type: str):
        """Add communities for a location"""
        ids = []
        
        # Area Community
        area_community = await get_or_create_community(
            f"{loc_data['area'].title()} Area Group",
            "area",
            loc_data
        )
        ids.append(str(area_community["_id"]))
        
        # City Community
        city_community = await get_or_create_community(
            f"{loc_data['city'].title()} City Group",
            "city",
            {"country": loc_data['country'], "state": loc_data['state'], "city": loc_data['city']}
        )
        ids.append(str(city_community["_id"]))
        
        # State Community
        state_community = await get_or_create_community(
            f"{loc_data['state'].title()} State Group",
            "state",
            {"country": loc_data['country'], "state": loc_data['state']}
        )
        ids.append(str(state_community["_id"]))
        
        # Country Community
        country_community = await get_or_create_community(
            f"{loc_data['country'].title()} Country Group",
            "country",
            {"country": loc_data['country']}
        )
        ids.append(str(country_community["_id"]))
        
        return ids
    
    update_data = {}
    
    # Process home location
    if locations.home_location:
        home_ids = await add_location_communities(locations.home_location, "home")
        community_ids.extend(home_ids)
        update_data["home_location"] = locations.home_location
        update_data["location"] = locations.home_location  # Primary location
    
    # Process office location
    if locations.office_location:
        office_ids = await add_location_communities(locations.office_location, "office")
        community_ids.extend(office_ids)
        update_data["office_location"] = locations.office_location
    
    # Remove duplicates
    community_ids = list(set(community_ids))
    
    # Update user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": update_data,
            "$addToSet": {"communities": {"$each": community_ids}}
        }
    )
    
    # Add user to community members
    for cid in community_ids:
        await db.communities.update_one(
            {"_id": ObjectId(cid)},
            {"$addToSet": {"members": user_id}}
        )
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return {
        "message": "Locations set successfully",
        "user": serialize_doc(user),
        "communities_joined": len(community_ids)
    }

@api_router.post("/geocode/reverse")
async def reverse_geocode(request: ReverseGeocodeRequest):
    """Reverse geocode coordinates to get location details using OpenStreetMap Nominatim"""
    import aiohttp
    
    try:
        url = f"https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": request.latitude,
            "lon": request.longitude,
            "format": "json",
            "addressdetails": 1
        }
        headers = {
            "User-Agent": "SanatanLok/1.0"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    address = data.get("address", {})
                    
                    # Extract location components
                    area = (
                        address.get("suburb") or 
                        address.get("neighbourhood") or 
                        address.get("village") or 
                        address.get("town") or
                        address.get("city_district") or
                        "Unknown Area"
                    )
                    
                    # For Indian cities, check state_district for city name
                    city = (
                        address.get("city") or 
                        address.get("town") or 
                        address.get("municipality") or
                        address.get("state_district", "").replace(" District", "") or
                        address.get("county") or
                        "Unknown City"
                    )
                    # Clean up city name
                    if "Suburban" in city:
                        city = city.replace(" Suburban", "").strip()
                    
                    state = (
                        address.get("state") or 
                        address.get("region") or
                        "Unknown State"
                    )
                    
                    country = address.get("country", "Bharat")
                    if country == "India":
                        country = "Bharat"
                    
                    return {
                        "country": country,
                        "state": state,
                        "city": city,
                        "area": area,
                        "latitude": request.latitude,
                        "longitude": request.longitude,
                        "display_name": data.get("display_name", ""),
                        "raw_address": address
                    }
                else:
                    raise HTTPException(status_code=500, detail="Geocoding service unavailable")
    except aiohttp.ClientError as e:
        logger.error(f"Geocoding error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch location data")

@api_router.get("/user/search/{sl_id}")
async def search_user_by_sl_id(sl_id: str, token_data: dict = Depends(verify_token)):
    """Search for a user by their Sanatan Lok ID"""
    user = await db.users.find_one({"sl_id": sl_id.upper()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return limited public info
    return {
        "sl_id": user["sl_id"],
        "name": user["name"],
        "photo": user.get("photo"),
        "badges": user.get("badges", [])
    }

async def get_or_create_community(name: str, type: str, location: dict):
    """Get existing community or create new one"""
    community = await db.communities.find_one({"name": name})
    if community:
        return community
    
    # Create new community
    community = {
        "name": name,
        "type": type,
        "location": location,
        "code": generate_community_code(name.split()[0]),
        "members": [],
        "subgroups": SUBGROUPS.copy(),
        "created_at": datetime.utcnow()
    }
    result = await db.communities.insert_one(community)
    community["_id"] = result.inserted_id
    return community

# ================= COMMUNITY ENDPOINTS =================

@api_router.get("/communities")
async def get_user_communities(token_data: dict = Depends(verify_token)):
    """Get all communities user belongs to"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    community_ids = user.get("communities", [])
    communities = []
    
    for cid in community_ids:
        try:
            community = await db.communities.find_one({"_id": ObjectId(cid)})
            if community:
                communities.append({
                    "id": str(community["_id"]),
                    "name": community["name"],
                    "type": community["type"],
                    "code": community["code"],
                    "member_count": len(community.get("members", [])),
                    "subgroups": community.get("subgroups", [])
                })
        except Exception as e:
            logger.error(f"Error fetching community {cid}: {e}")
    
    return communities

@api_router.get("/communities/{community_id}")
async def get_community(community_id: str, token_data: dict = Depends(verify_token)):
    """Get community details"""
    community = await db.communities.find_one({"_id": ObjectId(community_id)})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    return {
        "id": str(community["_id"]),
        "name": community["name"],
        "type": community["type"],
        "location": community.get("location", {}),
        "code": community["code"],
        "member_count": len(community.get("members", [])),
        "subgroups": community.get("subgroups", [])
    }

@api_router.post("/communities/join")
async def join_community_by_code(data: dict, token_data: dict = Depends(verify_token)):
    """Join a community using invite code"""
    code = data.get("code", "").upper()
    community = await db.communities.find_one({"code": code})
    if not community:
        raise HTTPException(status_code=404, detail="Invalid community code")
    
    user_id = token_data["user_id"]
    community_id = str(community["_id"])
    
    # Add user to community
    await db.communities.update_one(
        {"_id": community["_id"]},
        {"$addToSet": {"members": user_id}}
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"communities": community_id}}
    )
    
    return {"message": "Joined community successfully", "community": community["name"]}

@api_router.post("/communities/{community_id}/agree-rules")
async def agree_to_rules(community_id: str, data: dict, token_data: dict = Depends(verify_token)):
    """Agree to subgroup rules"""
    subgroup_type = data.get("subgroup_type")
    
    await db.users.update_one(
        {"_id": ObjectId(token_data["user_id"])},
        {"$addToSet": {"agreed_rules": f"{community_id}_{subgroup_type}"}}
    )
    
    return {"message": "Rules agreed"}

# ================= CIRCLE ENDPOINTS =================

@api_router.post("/circles")
async def create_circle(circle_data: CircleCreate, token_data: dict = Depends(verify_token)):
    """Create a new circle (private group)"""
    user_id = token_data["user_id"]
    
    code = generate_circle_code(circle_data.name)
    while await db.circles.find_one({"code": code}):
        code = generate_circle_code(circle_data.name)
    
    circle = {
        "name": circle_data.name,
        "code": code,
        "admin_id": user_id,
        "members": [user_id],
        "created_at": datetime.utcnow()
    }
    
    result = await db.circles.insert_one(circle)
    circle_id = str(result.inserted_id)
    
    # Add circle to user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"circles": circle_id}}
    )
    
    return {
        "id": circle_id,
        "name": circle["name"],
        "code": circle["code"],
        "admin_id": user_id,
        "member_count": 1,
        "created_at": circle["created_at"]
    }

@api_router.get("/circles")
async def get_user_circles(token_data: dict = Depends(verify_token)):
    """Get all circles user belongs to"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
        except Exception as e:
            logger.error(f"Error fetching circle {cid}: {e}")
    
    return circles

@api_router.post("/circles/join")
async def join_circle(data: CircleJoin, token_data: dict = Depends(verify_token)):
    """Request to join a circle using code"""
    code = data.code.upper()
    circle = await db.circles.find_one({"code": code})
    if not circle:
        raise HTTPException(status_code=404, detail="Invalid circle code")
    
    user_id = token_data["user_id"]
    circle_id = str(circle["_id"])
    
    # Check if already member
    if user_id in circle.get("members", []):
        raise HTTPException(status_code=400, detail="Already a member")
    
    # Add join request
    await db.circle_requests.update_one(
        {"circle_id": circle_id, "user_id": user_id},
        {"$set": {
            "circle_id": circle_id,
            "user_id": user_id,
            "status": "pending",
            "created_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    return {"message": "Join request sent", "circle": circle["name"]}

@api_router.get("/circles/{circle_id}/requests")
async def get_circle_requests(circle_id: str, token_data: dict = Depends(verify_token)):
    """Get pending join requests (admin only)"""
    circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    
    if circle["admin_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can view requests")
    
    requests = await db.circle_requests.find({
        "circle_id": circle_id,
        "status": "pending"
    }).to_list(100)
    
    result = []
    for req in requests:
        user = await db.users.find_one({"_id": ObjectId(req["user_id"])})
        if user:
            result.append({
                "request_id": str(req["_id"]),
                "user_id": req["user_id"],
                "user_name": user["name"],
                "user_sl_id": user["sl_id"],
                "created_at": req["created_at"]
            })
    
    return result

@api_router.post("/circles/{circle_id}/approve")
async def approve_circle_request(circle_id: str, data: dict, token_data: dict = Depends(verify_token)):
    """Approve a join request (admin only)"""
    circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    
    if circle["admin_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can approve")
    
    user_id = data.get("user_id")
    
    # Add member
    await db.circles.update_one(
        {"_id": ObjectId(circle_id)},
        {"$addToSet": {"members": user_id}}
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"circles": circle_id}}
    )
    
    # Update request status
    await db.circle_requests.update_one(
        {"circle_id": circle_id, "user_id": user_id},
        {"$set": {"status": "approved"}}
    )
    
    return {"message": "Member approved"}

@api_router.post("/circles/{circle_id}/invite")
async def invite_to_circle(circle_id: str, data: CircleInvite, token_data: dict = Depends(verify_token)):
    """Invite user to circle by SL ID (admin only)"""
    circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    
    if circle["admin_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can invite")
    
    # Find user by SL ID
    user = await db.users.find_one({"sl_id": data.sl_id.upper()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    # Add directly
    await db.circles.update_one(
        {"_id": ObjectId(circle_id)},
        {"$addToSet": {"members": user_id}}
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"circles": circle_id}}
    )
    
    return {"message": f"Invited {user['name']} to circle"}

# ================= MESSAGE ENDPOINTS =================

@api_router.post("/messages/community/{community_id}/{subgroup_type}")
async def send_community_message(
    community_id: str, 
    subgroup_type: str, 
    message: MessageCreate, 
    token_data: dict = Depends(verify_token)
):
    """Send message to community subgroup"""
    user_id = token_data["user_id"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    # Check membership
    if community_id not in user.get("communities", []):
        raise HTTPException(status_code=403, detail="Not a community member")
    
    # Basic content moderation
    is_ok, reason = moderate_content(message.content)
    if not is_ok:
        raise HTTPException(status_code=400, detail=reason)
    
    msg = {
        "community_id": community_id,
        "subgroup_type": subgroup_type,
        "sender_id": user_id,
        "sender_name": user["name"],
        "sender_photo": user.get("photo"),
        "content": message.content,
        "message_type": message.message_type,
        "created_at": datetime.utcnow()
    }
    
    result = await db.messages.insert_one(msg)
    msg["_id"] = result.inserted_id
    
    # Emit to socket room
    room = f"community_{community_id}_{subgroup_type}"
    await sio.emit('new_message', serialize_doc(msg), room=room)
    
    return serialize_doc(msg)

@api_router.get("/messages/community/{community_id}/{subgroup_type}")
async def get_community_messages(
    community_id: str, 
    subgroup_type: str, 
    limit: int = 50,
    token_data: dict = Depends(verify_token)
):
    """Get messages from community subgroup"""
    messages = await db.messages.find({
        "community_id": community_id,
        "subgroup_type": subgroup_type
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(msg) for msg in reversed(messages)]

@api_router.post("/messages/circle/{circle_id}")
async def send_circle_message(
    circle_id: str, 
    message: MessageCreate, 
    token_data: dict = Depends(verify_token)
):
    """Send message to circle"""
    user_id = token_data["user_id"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    # Check membership
    circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
    if not circle or user_id not in circle.get("members", []):
        raise HTTPException(status_code=403, detail="Not a circle member")
    
    # Basic content moderation
    is_ok, reason = moderate_content(message.content)
    if not is_ok:
        raise HTTPException(status_code=400, detail=reason)
    
    msg = {
        "circle_id": circle_id,
        "sender_id": user_id,
        "sender_name": user["name"],
        "sender_photo": user.get("photo"),
        "content": message.content,
        "message_type": message.message_type,
        "created_at": datetime.utcnow()
    }
    
    result = await db.circle_messages.insert_one(msg)
    msg["_id"] = result.inserted_id
    
    # Emit to socket room
    room = f"circle_{circle_id}"
    await sio.emit('new_message', serialize_doc(msg), room=room)
    
    return serialize_doc(msg)

@api_router.get("/messages/circle/{circle_id}")
async def get_circle_messages(
    circle_id: str, 
    limit: int = 50,
    token_data: dict = Depends(verify_token)
):
    """Get messages from circle"""
    messages = await db.circle_messages.find({
        "circle_id": circle_id
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(msg) for msg in reversed(messages)]

# ================= DIRECT MESSAGE ENDPOINTS =================

@api_router.post("/dm")
async def send_direct_message(message: DirectMessageCreate, token_data: dict = Depends(verify_token)):
    """Send direct message to user by SL ID"""
    sender_id = token_data["user_id"]
    sender = await db.users.find_one({"_id": ObjectId(sender_id)})
    
    # Find recipient by SL ID
    recipient = await db.users.find_one({"sl_id": message.recipient_sl_id.upper()})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    
    recipient_id = str(recipient["_id"])
    
    # Basic content moderation
    is_ok, reason = moderate_content(message.content)
    if not is_ok:
        raise HTTPException(status_code=400, detail=reason)
    
    # Create conversation ID (sorted to ensure same ID for both directions)
    participants = sorted([sender_id, recipient_id])
    conversation_id = f"{participants[0]}_{participants[1]}"
    
    msg = {
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "sender_name": sender["name"],
        "sender_photo": sender.get("photo"),
        "recipient_id": recipient_id,
        "content": message.content,
        "message_type": message.message_type,
        "created_at": datetime.utcnow()
    }
    
    result = await db.direct_messages.insert_one(msg)
    msg["_id"] = result.inserted_id
    
    # Update conversations list for both users
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {
            "conversation_id": conversation_id,
            "participants": [sender_id, recipient_id],
            "last_message": message.content,
            "last_message_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    # Emit to socket room
    room = f"dm_{conversation_id}"
    await sio.emit('new_dm', serialize_doc(msg), room=room)
    
    return serialize_doc(msg)

@api_router.get("/dm/conversations")
async def get_conversations(token_data: dict = Depends(verify_token)):
    """Get all DM conversations for user"""
    user_id = token_data["user_id"]
    
    conversations = await db.conversations.find({
        "participants": user_id
    }).sort("last_message_at", -1).to_list(100)
    
    result = []
    for conv in conversations:
        # Get the other participant
        other_id = [p for p in conv["participants"] if p != user_id][0]
        other_user = await db.users.find_one({"_id": ObjectId(other_id)})
        
        if other_user:
            result.append({
                "conversation_id": conv["conversation_id"],
                "user": {
                    "id": other_id,
                    "sl_id": other_user["sl_id"],
                    "name": other_user["name"],
                    "photo": other_user.get("photo")
                },
                "last_message": conv.get("last_message", ""),
                "last_message_at": conv.get("last_message_at")
            })
    
    return result

@api_router.get("/dm/{conversation_id}")
async def get_direct_messages(conversation_id: str, limit: int = 50, token_data: dict = Depends(verify_token)):
    """Get messages from a DM conversation"""
    user_id = token_data["user_id"]
    
    # Verify user is part of conversation
    if user_id not in conversation_id.split("_"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await db.direct_messages.find({
        "conversation_id": conversation_id
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    return [serialize_doc(msg) for msg in reversed(messages)]

# ================= DISCOVER ENDPOINTS =================

@api_router.get("/discover/communities")
async def discover_communities(token_data: dict = Depends(verify_token)):
    """Discover popular communities"""
    communities = await db.communities.find().sort("member_count", -1).limit(20).to_list(20)
    
    return [{
        "id": str(c["_id"]),
        "name": c["name"],
        "type": c["type"],
        "code": c["code"],
        "member_count": len(c.get("members", []))
    } for c in communities]

# ================= WISDOM & PANCHANG ENDPOINTS =================

@api_router.get("/wisdom/today")
async def get_todays_wisdom():
    """Get today's wisdom quote"""
    # Use day of year to cycle through quotes
    day_of_year = datetime.utcnow().timetuple().tm_yday
    quote_index = day_of_year % len(WISDOM_QUOTES)
    return WISDOM_QUOTES[quote_index]

@api_router.get("/panchang/today")
async def get_todays_panchang():
    """Get today's Panchang (Hindu calendar info)"""
    now = datetime.utcnow()
    
    # Simple calculation for demo - in production use proper Hindu calendar API
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
    
    return {
        "date": now.strftime("%Y-%m-%d"),
        "tithi": TITHIS[tithi_index],
        "paksha": "Shukla Paksha" if day_of_month <= 15 else "Krishna Paksha",
        "sunrise": sunrise,
        "sunset": sunset,
        "vrat": vrat,
        "nakshatra": "Rohini",  # Simplified
        "yoga": "Siddhi",  # Simplified
    }

# ================= TEMPLE ENDPOINTS =================

@api_router.post("/temples")
async def create_temple(temple_data: TempleCreate, token_data: dict = Depends(verify_token)):
    """Create a new temple (admin feature)"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    
    # Generate unique temple ID
    temple_id = generate_temple_id()
    while await db.temples.find_one({"temple_id": temple_id}):
        temple_id = generate_temple_id()
    
    temple = {
        "temple_id": temple_id,
        "name": temple_data.name,
        "location": temple_data.location,
        "description": temple_data.description,
        "deity": temple_data.deity,
        "aarti_timings": temple_data.aarti_timings or {},
        "admin_id": token_data["user_id"],
        "admins": [token_data["user_id"]],
        "followers": [],
        "follower_count": 0,
        "posts": [],
        "created_at": datetime.utcnow()
    }
    
    result = await db.temples.insert_one(temple)
    temple["_id"] = result.inserted_id
    
    return serialize_doc(temple)

@api_router.get("/temples")
async def get_temples(token_data: dict = Depends(verify_token)):
    """Get all temples"""
    temples = await db.temples.find().sort("follower_count", -1).limit(50).to_list(50)
    return [serialize_doc(t) for t in temples]

@api_router.get("/temples/nearby")
async def get_nearby_temples(lat: float = 19.0760, lng: float = 72.8777, token_data: dict = Depends(verify_token)):
    """Get temples near user's location"""
    # For demo, return all temples - in production use geo queries
    temples = await db.temples.find().limit(20).to_list(20)
    return [serialize_doc(t) for t in temples]

@api_router.get("/temples/{temple_id}")
async def get_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    """Get temple details"""
    temple = await db.temples.find_one({"temple_id": temple_id})
    if not temple:
        temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    
    return serialize_doc(temple)

@api_router.post("/temples/{temple_id}/follow")
async def follow_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    """Follow a temple"""
    user_id = token_data["user_id"]
    
    temple = await db.temples.find_one({"temple_id": temple_id})
    if not temple:
        temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    
    # Add user to followers
    await db.temples.update_one(
        {"_id": temple["_id"]},
        {
            "$addToSet": {"followers": user_id},
            "$inc": {"follower_count": 1}
        }
    )
    
    # Add temple to user's followed temples
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"temple_passbook.temples_followed": str(temple["_id"])}}
    )
    
    return {"message": f"Now following {temple['name']}"}

@api_router.post("/temples/{temple_id}/unfollow")
async def unfollow_temple(temple_id: str, token_data: dict = Depends(verify_token)):
    """Unfollow a temple"""
    user_id = token_data["user_id"]
    
    temple = await db.temples.find_one({"temple_id": temple_id})
    if not temple:
        temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    
    await db.temples.update_one(
        {"_id": temple["_id"]},
        {
            "$pull": {"followers": user_id},
            "$inc": {"follower_count": -1}
        }
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$pull": {"temple_passbook.temples_followed": str(temple["_id"])}}
    )
    
    return {"message": f"Unfollowed {temple['name']}"}

@api_router.post("/temples/{temple_id}/posts")
async def create_temple_post(temple_id: str, post: TemplePost, token_data: dict = Depends(verify_token)):
    """Create a temple post (admin only)"""
    user_id = token_data["user_id"]
    
    temple = await db.temples.find_one({"temple_id": temple_id})
    if not temple:
        temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    
    if user_id not in temple.get("admins", []):
        raise HTTPException(status_code=403, detail="Only temple admins can post")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    new_post = {
        "id": str(ObjectId()),
        "title": post.title,
        "content": post.content,
        "post_type": post.post_type,
        "author_id": user_id,
        "author_name": user["name"],
        "reactions": [],
        "created_at": datetime.utcnow()
    }
    
    await db.temples.update_one(
        {"_id": temple["_id"]},
        {"$push": {"posts": {"$each": [new_post], "$position": 0}}}
    )
    
    return new_post

@api_router.get("/temples/{temple_id}/posts")
async def get_temple_posts(temple_id: str, token_data: dict = Depends(verify_token)):
    """Get temple posts"""
    temple = await db.temples.find_one({"temple_id": temple_id})
    if not temple:
        temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    
    return temple.get("posts", [])[:20]

@api_router.post("/temples/{temple_id}/posts/{post_id}/react")
async def react_to_temple_post(temple_id: str, post_id: str, data: dict, token_data: dict = Depends(verify_token)):
    """React to a temple post"""
    user_id = token_data["user_id"]
    reaction = data.get("reaction", "namaste")  # namaste, om, jai
    
    # Update the post's reactions
    await db.temples.update_one(
        {"temple_id": temple_id, "posts.id": post_id},
        {"$addToSet": {"posts.$.reactions": {"user_id": user_id, "reaction": reaction}}}
    )
    
    return {"message": "Reaction added"}

# ================= EVENTS ENDPOINTS =================

@api_router.post("/events")
async def create_event(event_data: EventCreate, token_data: dict = Depends(verify_token)):
    """Create a new event"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    
    # Check if user is verified
    if not user.get("is_verified", False):
        raise HTTPException(status_code=403, detail="Only verified members can create events")
    
    event = {
        "name": event_data.name,
        "description": event_data.description,
        "event_type": event_data.event_type,
        "location": event_data.location,
        "date": event_data.date,
        "time": event_data.time,
        "organizer_id": token_data["user_id"],
        "organizer_name": event_data.organizer_name or user["name"],
        "attendees": [token_data["user_id"]],
        "attendee_count": 1,
        "created_at": datetime.utcnow()
    }
    
    result = await db.events.insert_one(event)
    event["_id"] = result.inserted_id
    
    return serialize_doc(event)

@api_router.get("/events")
async def get_events(token_data: dict = Depends(verify_token)):
    """Get upcoming events"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    events = await db.events.find({"date": {"$gte": today}}).sort("date", 1).limit(20).to_list(20)
    return [serialize_doc(e) for e in events]

@api_router.get("/events/nearby")
async def get_nearby_events(token_data: dict = Depends(verify_token)):
    """Get events near user's location"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    user_location = user.get("location", {})
    
    # Get events in user's city
    today = datetime.utcnow().strftime("%Y-%m-%d")
    query = {"date": {"$gte": today}}
    
    if user_location.get("city"):
        query["location.city"] = user_location["city"]
    
    events = await db.events.find(query).sort("date", 1).limit(20).to_list(20)
    
    # Add distance info (simplified)
    result = []
    for e in events:
        event = serialize_doc(e)
        event["distance"] = "2.5 km"  # Placeholder - calculate actual distance in production
        result.append(event)
    
    return result

@api_router.post("/events/{event_id}/attend")
async def attend_event(event_id: str, token_data: dict = Depends(verify_token)):
    """Mark attendance for an event"""
    user_id = token_data["user_id"]
    
    await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$addToSet": {"attendees": user_id},
            "$inc": {"attendee_count": 1}
        }
    )
    
    return {"message": "You're attending this event"}

# ================= VERIFICATION ENDPOINTS =================

@api_router.get("/user/verification-status")
async def get_verification_status(token_data: dict = Depends(verify_token)):
    """Get user's verification status"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    
    return {
        "is_verified": user.get("is_verified", False),
        "verification_date": user.get("verification_date"),
        "member_type": "Verified Member" if user.get("is_verified") else "Basic Member",
        "can_post_in_community": user.get("is_verified", False)
    }

@api_router.post("/user/request-verification")
async def request_verification(data: dict, token_data: dict = Depends(verify_token)):
    """Request account verification (KYC)"""
    user_id = token_data["user_id"]
    
    # Store verification request
    verification = {
        "user_id": user_id,
        "full_name": data.get("full_name"),
        "id_type": data.get("id_type"),  # aadhaar, pan, voter_id
        "id_number": data.get("id_number"),
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    await db.verifications.update_one(
        {"user_id": user_id},
        {"$set": verification},
        upsert=True
    )
    
    # For demo, auto-approve
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "is_verified": True,
                "verification_date": datetime.utcnow()
            },
            "$addToSet": {"badges": "Verified Member"}
        }
    )
    
    return {"message": "Verification completed successfully", "status": "approved"}

# ================= PROFILE UPDATE ENDPOINTS =================

@api_router.put("/user/profile/extended")
async def update_extended_profile(update: ProfileUpdate, token_data: dict = Depends(verify_token)):
    """Update extended profile fields"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(token_data["user_id"])},
            {"$set": update_data}
        )
    
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    return serialize_doc(user)

@api_router.get("/user/profile-completion")
async def get_profile_completion(token_data: dict = Depends(verify_token)):
    """Get profile completion percentage"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    
    fields = ["name", "photo", "language", "location", "kuldevi", "kuldevi_temple_area", 
              "gotra", "date_of_birth", "place_of_birth", "time_of_birth"]
    
    completed = sum(1 for f in fields if user.get(f))
    percentage = int((completed / len(fields)) * 100)
    
    # Check if birth details are complete for horoscope
    birth_fields = ["date_of_birth", "place_of_birth", "time_of_birth"]
    birth_complete = all(user.get(f) for f in birth_fields)
    
    return {
        "completion_percentage": percentage,
        "completed_fields": completed,
        "total_fields": len(fields),
        "horoscope_eligible": birth_complete,
        "missing_fields": [f for f in fields if not user.get(f)]
    }

@api_router.get("/user/horoscope")
async def get_horoscope(token_data: dict = Depends(verify_token)):
    """Get user's horoscope (if birth details are complete)"""
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    
    # Check if birth details are complete
    birth_fields = ["date_of_birth", "place_of_birth", "time_of_birth"]
    if not all(user.get(f) for f in birth_fields):
        raise HTTPException(status_code=400, detail="Complete birth details to view horoscope")
    
    # Generate simple horoscope based on DOB
    dob = user.get("date_of_birth", "2000-01-01")
    month = int(dob.split("-")[1]) if dob else 1
    
    # Simple zodiac mapping
    zodiac_signs = [
        "Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini",
        "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"
    ]
    zodiac = zodiac_signs[(month - 1) % 12]
    
    daily_insights = [
        "Today is favorable for spiritual activities and prayers.",
        "Financial matters will improve. Focus on savings.",
        "Health needs attention. Practice yoga and meditation.",
        "Relationships will strengthen. Spend time with family.",
        "Career growth is indicated. Take on new responsibilities.",
        "Travel may bring new opportunities. Stay positive."
    ]
    
    day_of_year = datetime.utcnow().timetuple().tm_yday
    
    return {
        "zodiac_sign": zodiac,
        "rashi": zodiac,  # Simplified - should be calculated from actual kundli
        "daily_horoscope": daily_insights[day_of_year % len(daily_insights)],
        "lucky_color": ["Orange", "White", "Yellow", "Red", "Green"][day_of_year % 5],
        "lucky_number": (day_of_year % 9) + 1,
        "auspicious_time": "10:30 AM - 12:00 PM"
    }

# ================= COMMUNITY STATS ENDPOINTS =================

@api_router.get("/communities/{community_id}/stats")
async def get_community_stats(community_id: str, token_data: dict = Depends(verify_token)):
    """Get community activity stats for home screen"""
    # Count messages in last 24 hours
    yesterday = datetime.utcnow() - timedelta(hours=24)
    
    message_count = await db.messages.count_documents({
        "community_id": community_id,
        "created_at": {"$gte": yesterday}
    })
    
    community = await db.communities.find_one({"_id": ObjectId(community_id)})
    
    return {
        "community_id": community_id,
        "name": community["name"] if community else "Unknown",
        "new_messages": message_count,
        "member_count": len(community.get("members", [])) if community else 0
    }

# ================= SOCKET.IO EVENTS =================

@sio.event
async def connect(sid, environ, auth):
    """Handle socket connection"""
    logger.info(f"Socket connected: {sid}")

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
        logger.info(f"{sid} joined room {room}")

@sio.event
async def leave_room(sid, data):
    """Leave a chat room"""
    room = data.get('room')
    if room:
        await sio.leave_room(sid, room)
        logger.info(f"{sid} left room {room}")

# ================= HEALTH CHECK =================

@api_router.get("/")
async def root():
    return {"message": "Sanatan Lok API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount socket app
app.mount("/socket.io", socket_app)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
