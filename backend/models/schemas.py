"""Pydantic models for request/response validation"""
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ================= ENUMS =================

class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    VOICE = "voice"
    DOCUMENT = "document"
    LOCATION = "location"


class CommunityType(str, Enum):
    AREA = "area"
    CITY = "city"
    STATE = "state"
    COUNTRY = "country"


class EventType(str, Enum):
    BHAJAN = "bhajan"
    GARBA = "garba"
    SATSANG = "satsang"
    KATHA = "katha"
    WORKSHOP = "workshop"
    ANNADAN = "annadan"


class PostType(str, Enum):
    ANNOUNCEMENT = "announcement"
    EVENT = "event"
    DONATION = "donation"
    AARTI = "aarti"


class IDType(str, Enum):
    AADHAAR = "aadhaar"
    PAN = "pan"
    VOTER_ID = "voter_id"


# ================= AUTH MODELS =================

class OTPRequest(BaseModel):
    phone: str
    
    @validator('phone')
    def validate_phone(cls, v):
        if len(v) < 10:
            raise ValueError('Phone number must be at least 10 digits')
        return v


class OTPVerify(BaseModel):
    phone: str
    otp: str
    
    @validator('otp')
    def validate_otp(cls, v):
        if len(v) != 6:
            raise ValueError('OTP must be 6 digits')
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ================= USER MODELS =================

class UserCreate(BaseModel):
    phone: str
    name: str = Field(..., min_length=2, max_length=100)
    photo: Optional[str] = None
    language: str = "English"


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    photo: Optional[str] = None
    language: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    photo: Optional[str] = None
    language: Optional[str] = None
    kuldevi: Optional[str] = None
    kuldevi_temple_area: Optional[str] = None
    gotra: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    time_of_birth: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    sl_id: str
    name: str
    photo: Optional[str] = None
    language: str
    location: Optional[Dict[str, str]] = None
    badges: List[str] = []
    reputation: int = 0
    is_verified: bool = False
    created_at: datetime


class UserPublicInfo(BaseModel):
    sl_id: str
    name: str
    photo: Optional[str] = None
    badges: List[str] = []


# ================= LOCATION MODELS =================

class LocationSetup(BaseModel):
    country: str
    state: str
    city: str
    area: str


class DualLocationSetup(BaseModel):
    home_location: Optional[Dict[str, Any]] = None
    office_location: Optional[Dict[str, Any]] = None


class ReverseGeocodeRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ReverseGeocodeResponse(BaseModel):
    country: str
    state: str
    city: str
    area: str
    latitude: float
    longitude: float
    display_name: str


# ================= COMMUNITY MODELS =================

class CommunityResponse(BaseModel):
    id: str
    name: str
    type: str
    code: str
    member_count: int
    subgroups: List[Dict[str, Any]] = []


class CommunityJoin(BaseModel):
    code: str


class CommunityStats(BaseModel):
    community_id: str
    name: str
    new_messages: int
    member_count: int


# ================= CIRCLE MODELS =================

class CirclePrivacy(str, Enum):
    PRIVATE = "private"  # Join requests require admin approval
    INVITE_CODE = "invite_code"  # Anyone with code can join directly


class CircleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    privacy: CirclePrivacy = CirclePrivacy.PRIVATE


class CircleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    privacy: Optional[CirclePrivacy] = None


class CircleJoin(BaseModel):
    code: str


class CircleInvite(BaseModel):
    sl_id: str


class CircleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    code: str
    privacy: str
    creator_id: str
    admin_id: str
    members: List[str] = []
    member_count: int
    is_admin: bool = False
    created_at: datetime


# ================= MESSAGE MODELS =================

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    message_type: MessageType = MessageType.TEXT


class DirectMessageCreate(BaseModel):
    recipient_sl_id: str
    content: str = Field(..., min_length=1, max_length=5000)
    message_type: MessageType = MessageType.TEXT


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_photo: Optional[str] = None
    content: str
    message_type: str
    created_at: datetime


# ================= TEMPLE MODELS =================

class TempleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    location: Dict[str, str]
    description: Optional[str] = None
    deity: Optional[str] = None
    aarti_timings: Optional[Dict[str, str]] = None


class TemplePost(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=1, max_length=5000)
    post_type: PostType = PostType.ANNOUNCEMENT


class TempleResponse(BaseModel):
    id: str
    temple_id: str
    name: str
    location: Dict[str, str]
    deity: Optional[str] = None
    follower_count: int = 0
    is_following: bool = False


# ================= EVENT MODELS =================

class EventCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    event_type: str
    location: Dict[str, Any]
    date: str
    time: str
    organizer_name: Optional[str] = None


class EventResponse(BaseModel):
    id: str
    name: str
    description: str
    event_type: str
    location: Dict[str, Any]
    date: str
    time: str
    organizer_name: str
    attendee_count: int = 0
    distance: Optional[str] = None


# ================= VERIFICATION MODELS =================

class VerificationRequest(BaseModel):
    full_name: str
    id_type: IDType
    id_number: str


class VerificationStatus(BaseModel):
    is_verified: bool
    verification_date: Optional[datetime] = None
    member_type: str
    can_post_in_community: bool


# ================= WISDOM & PANCHANG MODELS =================

class WisdomResponse(BaseModel):
    quote: str
    source: str


class PanchangResponse(BaseModel):
    date: str
    tithi: str
    paksha: str
    sunrise: str
    sunset: str
    vrat: Optional[str] = None
    nakshatra: str
    yoga: str


# ================= NOTIFICATION MODELS =================

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    body: str
    notification_type: str
    data: Optional[Dict[str, Any]] = None


class NotificationResponse(BaseModel):
    id: str
    title: str
    body: str
    notification_type: str
    is_read: bool = False
    created_at: datetime
