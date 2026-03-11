"""Authentication Routes"""
from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import OTPRequest, OTPVerify, UserCreate
from services.auth_service import AuthService
from middleware.rate_limiter import auth_rate_limit

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp")
async def send_otp(request: OTPRequest, _: bool = Depends(auth_rate_limit)):
    """Send OTP to phone (mock - always returns 123456)"""
    try:
        return await AuthService.send_otp(request.phone)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-otp")
async def verify_otp(request: OTPVerify, _: bool = Depends(auth_rate_limit)):
    """Verify OTP and check if user exists"""
    try:
        return await AuthService.verify_otp(request.phone, request.otp)
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
