"""Firebase Authentication Service"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from config.firebase_config import get_firestore, get_firebase_auth, firebase_manager
from config.firestore_db import FirestoreDB
from middleware.security import create_jwt_token
from utils.helpers import generate_sl_id, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)


class FirebaseAuthService:
    """Handles authentication with Firebase"""
    
    OTP_EXPIRY_MINUTES = 10
    MOCK_OTP = "123456"  # For development
    
    @staticmethod
    async def get_db() -> FirestoreDB:
        """Get Firestore database instance"""
        client = await get_firestore()
        return FirestoreDB(client)
    
    @staticmethod
    async def send_otp(phone: str) -> Dict[str, Any]:
        """Send OTP to phone number"""
        if len(phone) < 10:
            raise ValueError("Invalid phone number")
        
        db = await FirebaseAuthService.get_db()
        
        # Store OTP in Firestore
        otp_data = {
            "phone": phone,
            "otp": FirebaseAuthService.MOCK_OTP,
            "expires_at": datetime.utcnow() + timedelta(minutes=FirebaseAuthService.OTP_EXPIRY_MINUTES),
            "attempts": 0
        }
        
        # Check if OTP doc exists for this phone
        existing = await db.find_one('otps', [('phone', '==', phone)])
        if existing:
            await db.update_document('otps', existing['id'], otp_data)
        else:
            await db.create_document('otps', otp_data)
        
        logger.info(f"OTP sent to {phone}: {FirebaseAuthService.MOCK_OTP} (mock)")
        return {"message": "OTP sent successfully", "phone": phone}
    
    @staticmethod
    async def verify_otp(phone: str, otp: str) -> Dict[str, Any]:
        """Verify OTP and check if user exists"""
        db = await FirebaseAuthService.get_db()
        
        # Get OTP record
        otp_record = await db.find_one('otps', [('phone', '==', phone)])
        if not otp_record:
            raise ValueError("OTP not found. Please request a new OTP.")
        
        # Check attempts
        if otp_record.get("attempts", 0) >= 5:
            raise ValueError("Too many attempts. Please request a new OTP.")
        
        # Increment attempts
        await db.update_document('otps', otp_record['id'], {
            'attempts': otp_record.get('attempts', 0) + 1
        })
        
        if otp_record["otp"] != otp:
            raise ValueError("Invalid OTP")
        
        if datetime.utcnow() > otp_record["expires_at"]:
            raise ValueError("OTP expired")
        
        # Delete OTP after successful verification
        await db.delete_document('otps', otp_record['id'])
        
        # Check if user exists
        user = await db.get_user_by_phone(phone)
        if user:
            # User exists, return token
            token = create_jwt_token(user['id'], user['sl_id'])
            return {
                "message": "Login successful",
                "token": token,
                "user": user,
                "is_new_user": False
            }
        
        # New user
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
        """Register new user"""
        db = await FirebaseAuthService.get_db()
        
        # Check if user already exists
        existing = await db.get_user_by_phone(phone)
        if existing:
            raise ValueError("User already exists")
        
        # Validate language
        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language. Choose from: {SUPPORTED_LANGUAGES}")
        
        # Generate unique SL ID
        sl_id = generate_sl_id()
        while await db.get_user_by_sl_id(sl_id):
            sl_id = generate_sl_id()
        
        # Create user document
        user_data = {
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
            "fcm_tokens": [],  # For push notifications
            "agreed_rules": []
        }
        
        user_id = await db.create_user(user_data)
        user_data['id'] = user_id
        
        # Generate token
        token = create_jwt_token(user_id, sl_id)
        
        logger.info(f"New user registered: {sl_id}")
        
        return {
            "message": "Registration successful",
            "token": token,
            "user": user_data
        }
    
    @staticmethod
    async def verify_firebase_token(id_token: str) -> Dict[str, Any]:
        """
        Verify Firebase ID token (for mobile app using Firebase Auth directly).
        Returns user info if valid.
        """
        try:
            auth = get_firebase_auth()
            decoded_token = auth.verify_id_token(id_token)
            
            uid = decoded_token['uid']
            phone = decoded_token.get('phone_number')
            
            if not phone:
                raise ValueError("Phone number not found in token")
            
            db = await FirebaseAuthService.get_db()
            user = await db.get_user_by_phone(phone)
            
            if user:
                # Existing user
                token = create_jwt_token(user['id'], user['sl_id'])
                return {
                    "message": "Login successful",
                    "token": token,
                    "user": user,
                    "is_new_user": False
                }
            
            # New user - return phone for registration
            return {
                "message": "User not registered",
                "is_new_user": True,
                "phone": phone,
                "firebase_uid": uid
            }
            
        except Exception as e:
            logger.error(f"Firebase token verification failed: {e}")
            raise ValueError(f"Invalid Firebase token: {str(e)}")
    
    @staticmethod
    async def update_fcm_token(user_id: str, fcm_token: str) -> Dict[str, Any]:
        """Update user's FCM token for push notifications"""
        db = await FirebaseAuthService.get_db()
        
        from google.cloud import firestore
        await db.client.collection('users').document(user_id).update({
            'fcm_tokens': firestore.ArrayUnion([fcm_token])
        })
        
        return {"message": "FCM token updated"}
    
    @staticmethod
    async def remove_fcm_token(user_id: str, fcm_token: str) -> Dict[str, Any]:
        """Remove FCM token (on logout)"""
        db = await FirebaseAuthService.get_db()
        
        from google.cloud import firestore
        await db.client.collection('users').document(user_id).update({
            'fcm_tokens': firestore.ArrayRemove([fcm_token])
        })
        
        return {"message": "FCM token removed"}
