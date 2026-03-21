"""Authentication Service"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from config.database import get_database, get_redis
from middleware.security import create_jwt_token
from utils.helpers import generate_sl_id, SUPPORTED_LANGUAGES
from utils.cache import cache_manager

logger = logging.getLogger(__name__)


class AuthService:
    """Handles authentication operations"""
    
    OTP_EXPIRY_MINUTES = 10
    MOCK_OTP = "123456"  # For development - replace with real SMS service
    
    @staticmethod
    async def send_otp(phone: str) -> Dict[str, Any]:
        """Send OTP to phone number"""
        if len(phone) < 10:
            raise ValueError("Invalid phone number")
        
        db = await get_database()
        
        # Store OTP (mock: always 123456)
        otp_data = {
            "phone": phone,
            "otp": AuthService.MOCK_OTP,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=AuthService.OTP_EXPIRY_MINUTES),
            "attempts": 0
        }
        
        await db.otps.update_one(
            {"phone": phone},
            {"$set": otp_data},
            upsert=True
        )
        
        logger.info(f"OTP sent to {phone}: {AuthService.MOCK_OTP} (mock)")
        return {"message": "OTP sent successfully", "phone": phone}
    
    @staticmethod
    async def verify_otp(phone: str, otp: str) -> Dict[str, Any]:
        """Verify OTP and check if user exists"""
        db = await get_database()
        
        # Check OTP
        otp_record = await db.otps.find_one({"phone": phone})
        if not otp_record:
            raise ValueError("OTP not found. Please request a new OTP.")
        
        # Check attempts (rate limiting)
        if otp_record.get("attempts", 0) >= 5:
            raise ValueError("Too many attempts. Please request a new OTP.")
        
        # Increment attempts
        await db.otps.update_one(
            {"phone": phone},
            {"$inc": {"attempts": 1}}
        )
        
        if otp_record["otp"] != otp:
            raise ValueError("Invalid OTP")
        
        if datetime.utcnow() > otp_record["expires_at"]:
            raise ValueError("OTP expired")
        
        # Clear OTP after successful verification
        await db.otps.delete_one({"phone": phone})
        
        # Check if user exists
        user = await db.users.find_one({"phone": phone})
        if user:
            # User exists, return token
            token = create_jwt_token(str(user["_id"]), user["sl_id"])
            user_data = AuthService._serialize_user(user)
            
            return {
                "message": "Login successful",
                "token": token,
                "user": user_data,
                "is_new_user": False
            }
        
        # New user, return flag
        return {
            "message": "OTP verified",
            "is_new_user": True,
            "phone": phone
        }
    
    @staticmethod
    async def register_user(
        phone: str,
        name: str,
        photo: Optional[str] = None,
        language: str = "English"
    ) -> Dict[str, Any]:
        """Register new user after OTP verification"""
        db = await get_database()
        
        # Check if user already exists
        existing = await db.users.find_one({"phone": phone})
        if existing:
            raise ValueError("User already exists")
        
        # Validate language
        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language. Choose from: {SUPPORTED_LANGUAGES}")
        
        # Generate unique SL ID
        sl_id = generate_sl_id()
        while await db.users.find_one({"sl_id": sl_id}):
            sl_id = generate_sl_id()
        
        # Create user
        user = {
            "phone": phone,
            "sl_id": sl_id,
            "name": name,
            "photo": photo,
            "language": language,
            "location": None,
            "home_location": None,
            "office_location": None,
            "is_verified": False,
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
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.users.insert_one(user)
        user["_id"] = result.inserted_id
        
        # Generate token
        token = create_jwt_token(str(result.inserted_id), sl_id)
        
        logger.info(f"New user registered: {sl_id}")
        
        return {
            "message": "Registration successful",
            "token": token,
            "user": AuthService._serialize_user(user)
        }
    
    @staticmethod
    def _serialize_user(user: dict) -> dict:
        """Serialize user document"""
        if user is None:
            return None
        user = dict(user)
        if '_id' in user:
            user['id'] = str(user['_id'])
            del user['_id']
        return user
