"""Authentication Routes"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import OTPRequest, OTPVerify, UserCreate, FirebaseTokenRequest
from services.firebase_auth_service import FirebaseAuthService as AuthService
from middleware.rate_limiter import auth_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp")
async def send_otp(request: OTPRequest, _: bool = Depends(auth_rate_limit)):
    """Send OTP to phone (mock - always returns 123456)"""
    logger.info(f"/auth/send-otp called with phone={request.phone}")
    try:
        return await AuthService.send_otp(request.phone)
    except ValueError as e:
        logger.warning(f"/auth/send-otp failed for phone={request.phone}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error in /auth/send-otp for phone={request.phone}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/verify-otp")
async def verify_otp(request: OTPVerify, _: bool = Depends(auth_rate_limit)):
    """Verify OTP and check if user exists"""
    logger.info(f"/auth/verify-otp called with phone={request.phone}")
    try:
        return await AuthService.verify_otp(request.phone, request.otp)
    except ValueError as e:
        logger.warning(f"/auth/verify-otp failed for phone={request.phone}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error in /auth/verify-otp for phone={request.phone}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/verify-firebase-token")
async def verify_firebase_token(request: FirebaseTokenRequest, _: bool = Depends(auth_rate_limit)):
    """Verify Firebase ID token from client after Firebase Phone Auth flow."""
    try:
        return await AuthService.verify_firebase_token(request.id_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/register")
async def register_user(user_data: UserCreate, _: bool = Depends(auth_rate_limit)):
    """Register new user after OTP verification"""
    try:
        return await AuthService.register_user(
            phone=user_data.phone,
            name=user_data.name,
            photo=user_data.photo,
            language=user_data.language
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
