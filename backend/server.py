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
    """Setup user location and join communities"""
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
        f"{location.area} Sanatan Lok",
        "area",
        location_data
    )
    community_ids.append(str(area_community["_id"]))
    
    # City Community
    city_community = await get_or_create_community(
        f"{location.city} Sanatan Lok",
        "city",
        {"country": location.country, "state": location.state, "city": location.city}
    )
    community_ids.append(str(city_community["_id"]))
    
    # State Community
    state_community = await get_or_create_community(
        f"{location.state} Sanatan Lok",
        "state",
        {"country": location.country, "state": location.state}
    )
    community_ids.append(str(state_community["_id"]))
    
    # Country Community
    country_community = await get_or_create_community(
        f"{location.country} Sanatan Lok",
        "country",
        {"country": location.country}
    )
    community_ids.append(str(country_community["_id"]))
    
    # Update user with location and communities
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {"location": location_data},
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
