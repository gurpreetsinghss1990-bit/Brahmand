"""Firebase Authentication Service"""
import os
import logging
import random
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from twilio.rest import Client as TwilioClient

from config.firebase_config import get_firestore, get_firebase_auth, firebase_manager
from config.firestore_db import FirestoreDB
from middleware.security import create_jwt_token
from utils.helpers import generate_sl_id, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)


class FirebaseAuthService:
    """Handles authentication with Firebase"""
    
    OTP_EXPIRY_MINUTES = 10
    MOCK_OTP = "123456"  # Default development OTP
    
    @staticmethod
    async def get_db() -> FirestoreDB:
        """Get Firestore database instance"""
        client = await get_firestore()
        return FirestoreDB(client)
    
    @staticmethod
    async def send_otp(phone: str) -> Dict[str, Any]:
        """Send OTP to phone number. Uses Twilio when `USE_MOCK_OTP` is not truthy.

        Required env vars for real SMS:
            TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
        """
        if len(phone) < 10:
            raise ValueError("Invalid phone number")

        logger.info(f"send_otp called for phone: {phone}")

        db = await FirebaseAuthService.get_db()
        logger.info(f"Firestore client obtained for send_otp")

        # Determine whether to use mock OTP (development) or send real SMS
        use_mock = os.getenv("USE_MOCK_OTP", "true").lower() in ("1", "true", "yes")
        logger.info(f"USE_MOCK_OTP={use_mock}")

        if use_mock:
            otp = FirebaseAuthService.MOCK_OTP
        else:
            otp = f"{random.randint(100000, 999999)}"

        # Store OTP in Firestore
        otp_data = {
            "phone": phone,
            "otp": otp,
            "expires_at": datetime.utcnow() + timedelta(minutes=FirebaseAuthService.OTP_EXPIRY_MINUTES),
            "attempts": 0
        }

        try:
            # Check if OTP doc exists for this phone
            existing = await db.find_one('otps', [('phone', '==', phone)])
            if existing:
                await db.update_document('otps', existing['id'], otp_data)
                logger.info(f"Updated existing OTP doc for {phone} (id={existing['id']})")
            else:
                created = await db.create_document('otps', otp_data)
                logger.info(f"Created new OTP doc for {phone} (id={created.get('id') if isinstance(created, dict) else 'unknown'})")
        except Exception as e:
            logger.exception(f"Firestore error while storing OTP for {phone}")
            raise

        # If not mock, send the SMS via Twilio
        if not use_mock:
            sid = os.getenv('TWILIO_ACCOUNT_SID')
            token = os.getenv('TWILIO_AUTH_TOKEN')
            from_number = os.getenv('TWILIO_FROM_NUMBER')

            if not (sid and token and from_number):
                logger.error('Twilio credentials missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER')
                raise ValueError('SMS provider not configured. Contact admin.')

            try:
                client = TwilioClient(sid, token)
                body = f"Your Sanatan Lok verification code is {otp}. It expires in {FirebaseAuthService.OTP_EXPIRY_MINUTES} minutes."
                # Twilio client is synchronous; run in thread to avoid blocking
                await asyncio.to_thread(client.messages.create, body=body, from_=from_number, to=phone)
                logger.info(f"OTP sent to {phone} via Twilio")
            except Exception as e:
                logger.error(f"Failed to send SMS via Twilio: {e}")
                raise ValueError("Failed to send SMS. Please try again later.")
        else:
            logger.info(f"OTP stored for {phone} (mock): {otp}")

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
