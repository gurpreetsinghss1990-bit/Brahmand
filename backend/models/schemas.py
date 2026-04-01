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


class KYCStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    MANUAL_REVIEW = "manual_review"
    REJECTED = "rejected"


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


class FirebaseTokenRequest(BaseModel):
    id_token: str

    @validator('id_token')
    def validate_token(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError('id_token must be a non-empty string')
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
    place_of_birth_latitude: Optional[float] = None
    place_of_birth_longitude: Optional[float] = None


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


# ================= HELP REQUEST MODELS =================

class HelpType(str, Enum):
    BLOOD = "blood"
    MEDICAL = "medical"
    FINANCIAL = "financial"
    FOOD = "food"
    OTHER = "other"


class HelpUrgency(str, Enum):
    NORMAL = "normal"
    URGENT = "urgent"
    CRITICAL = "critical"


class HelpStatus(str, Enum):
    ACTIVE = "active"
    FULFILLED = "fulfilled"


class CommunityLevel(str, Enum):
    AREA = "area"
    CITY = "city"
    STATE = "state"
    COUNTRY = "country"


class HelpRequestCreate(BaseModel):
    type: HelpType
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    community_level: CommunityLevel = CommunityLevel.AREA
    location: Optional[str] = None
    contact_number: str
    urgency: HelpUrgency = HelpUrgency.NORMAL
    # Blood specific
    blood_group: Optional[str] = None
    hospital_name: Optional[str] = None
    # Financial specific
    amount: Optional[float] = None


class HelpRequestResponse(BaseModel):
    id: str
    creator_id: str
    creator_name: str
    creator_photo: Optional[str] = None
    type: str
    title: str
    description: str
    community_level: str
    location: Optional[str] = None
    contact_number: str
    urgency: str
    status: str
    blood_group: Optional[str] = None
    hospital_name: Optional[str] = None
    amount: Optional[float] = None
    verifications: int = 0
    verified_by: List[str] = []
    created_at: datetime


# ================= VENDOR MODELS =================

class VendorCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=200)
    owner_name: str = Field(default="Vendor Owner", min_length=2, max_length=100)
    years_in_business: int = Field(default=0, ge=0, le=100)
    categories: List[str] = Field(default_factory=list, max_items=5)
    full_address: str = Field(default="", max_length=500)
    location_link: Optional[str] = None
    phone_number: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos: Optional[List[str]] = []
    business_description: Optional[str] = Field(None, max_length=2000)
    aadhar_url: Optional[str] = None
    pan_url: Optional[str] = None
    face_scan_url: Optional[str] = None
    business_gallery_images: Optional[List[str]] = Field(default_factory=list, max_items=5)
    menu_items: Optional[List[str]] = Field(default_factory=list, max_items=30)
    offers_home_delivery: Optional[bool] = False
    business_media_key: Optional[str] = None
    kyc_status: KYCStatus = KYCStatus.PENDING


class VendorUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=2, max_length=200)
    owner_name: Optional[str] = Field(None, min_length=2, max_length=100)
    years_in_business: Optional[int] = Field(None, ge=0, le=100)
    categories: Optional[List[str]] = Field(None, min_items=1, max_items=5)
    full_address: Optional[str] = Field(None, min_length=10, max_length=500)
    location_link: Optional[str] = None
    phone_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos: Optional[List[str]] = None
    business_description: Optional[str] = Field(None, max_length=2000)
    aadhar_url: Optional[str] = None
    pan_url: Optional[str] = None
    face_scan_url: Optional[str] = None
    business_gallery_images: Optional[List[str]] = Field(None, max_items=5)
    menu_items: Optional[List[str]] = Field(None, max_items=30)
    offers_home_delivery: Optional[bool] = None
    business_media_key: Optional[str] = None
    kyc_status: Optional[KYCStatus] = None


class VendorResponse(BaseModel):
    id: str
    owner_id: str
    business_name: str
    owner_name: str
    years_in_business: int
    categories: List[str]
    full_address: str
    location_link: Optional[str] = None
    phone_number: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos: List[str] = []
    business_description: Optional[str] = None
    aadhar_url: Optional[str] = None
    pan_url: Optional[str] = None
    face_scan_url: Optional[str] = None
    business_gallery_images: List[str] = []
    menu_items: List[str] = []
    offers_home_delivery: bool = False
    business_media_key: Optional[str] = None
    kyc_status: Optional[KYCStatus] = KYCStatus.PENDING
    distance: Optional[float] = None
    created_at: datetime


# ================= CULTURAL COMMUNITY MODELS =================

class CulturalCommunityUpdate(BaseModel):
    cultural_community: str = Field(..., min_length=2, max_length=100)


# ================= SOS MODELS =================

class SOSCreate(BaseModel):
    latitude: float
    longitude: float
    area: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


# ================= ASTROLOGY MODELS =================

class AstrologyProfile(BaseModel):
    date_of_birth: str  # YYYY-MM-DD
    time_of_birth: Optional[str] = None  # HH:MM
    place_of_birth: Optional[str] = None
    rashi: Optional[str] = None


# ================= COMMUNITY REQUEST MODELS =================

class RequestType(str, Enum):
    HELP = "help"
    BLOOD = "blood"
    MEDICAL = "medical"
    FINANCIAL = "financial"
    PETITION = "petition"


class RequestUrgency(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class VisibilityLevel(str, Enum):
    AREA = "area"
    CITY = "city"
    STATE = "state"
    NATIONAL = "national"


class CommunityRequestCreate(BaseModel):
    community_id: Optional[str] = None
    request_type: RequestType
    visibility_level: VisibilityLevel = VisibilityLevel.AREA
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    contact_number: str
    urgency_level: RequestUrgency = RequestUrgency.LOW
    # Blood specific
    blood_group: Optional[str] = None
    hospital_name: Optional[str] = None
    location: Optional[str] = None
    # Financial specific
    amount: Optional[float] = None
    # Petition specific
    contact_person_name: Optional[str] = None
    support_needed: Optional[str] = None
    attachments: Optional[List[str]] = None
