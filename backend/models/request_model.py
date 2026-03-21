"""
Community Request Model
Defines the data structure for community help requests.

This module provides Pydantic models for request validation
without modifying the existing main.py implementation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RequestType(str, Enum):
    """Valid request types for community help requests"""
    HELP = "help"
    BLOOD = "blood"
    MEDICAL = "medical"
    FINANCIAL = "financial"
    PETITION = "petition"


class RequestStatus(str, Enum):
    """Status values for community requests"""
    ACTIVE = "active"
    FULFILLED = "fulfilled"
    RESOLVED = "resolved"


class UrgencyLevel(str, Enum):
    """Urgency levels for requests"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CommunityRequestModel(BaseModel):
    """
    MongoDB document structure for community_requests collection
    
    Collection: community_requests
    """
    id: Optional[str] = None
    community_id: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    user_sl_id: Optional[str] = None
    
    request_type: RequestType
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    contact_number: str
    
    urgency_level: UrgencyLevel = UrgencyLevel.LOW
    status: RequestStatus = RequestStatus.ACTIVE
    
    # Type-specific fields
    blood_group: Optional[str] = None  # For blood requests
    hospital_name: Optional[str] = None  # For blood/medical
    location: Optional[str] = None
    amount: Optional[float] = None  # For financial requests
    support_needed: Optional[str] = None  # For petitions
    contact_person_name: Optional[str] = None  # For petitions
    
    # Metadata
    visibility_level: str = "area"  # area, city, state, national
    created_at: datetime = Field(default_factory=datetime.utcnow)
    fulfilled_at: Optional[datetime] = None
    verified_by: List[str] = Field(default_factory=list)
    
    class Config:
        use_enum_values = True


class CreateRequestInput(BaseModel):
    """Input model for creating a new request"""
    community_id: Optional[str] = None
    request_type: RequestType
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    contact_number: str
    urgency_level: UrgencyLevel = UrgencyLevel.LOW
    visibility_level: str = "area"
    
    # Optional type-specific fields
    blood_group: Optional[str] = None
    hospital_name: Optional[str] = None
    location: Optional[str] = None
    amount: Optional[float] = None
    support_needed: Optional[str] = None
    contact_person_name: Optional[str] = None


class FulfillRequestInput(BaseModel):
    """Input model for marking request as fulfilled"""
    request_id: str


class VerifyRequestInput(BaseModel):
    """Input model for verifying a request"""
    request_id: str
