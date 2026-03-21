"""User Routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from models.schemas import (
    UserUpdate, ProfileUpdate, LocationSetup, 
    DualLocationSetup, ReverseGeocodeRequest
)
from services.firebase_user_service import FirebaseUserService as UserService
from middleware.security import verify_token

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/profile")
async def get_profile(token_data: dict = Depends(verify_token)):
    """Get current user profile"""
    try:
        return await UserService.get_profile(token_data["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/profile")
async def update_profile(
    update: UserUpdate, 
    token_data: dict = Depends(verify_token)
):
    """Update user profile"""
    try:
        return await UserService.update_profile(
            token_data["user_id"],
            update.dict(exclude_none=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/profile/extended")
async def update_extended_profile(
    update: ProfileUpdate,
    token_data: dict = Depends(verify_token)
):
    """Update extended profile fields"""
    try:
        return await UserService.update_extended_profile(
            token_data["user_id"],
            update.dict(exclude_none=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/location")
async def setup_location(
    location: LocationSetup,
    token_data: dict = Depends(verify_token)
):
    """Setup user location and join communities (legacy)"""
    try:
        return await UserService.setup_location(
            token_data["user_id"],
            location.dict()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dual-location")
async def setup_dual_location(
    locations: DualLocationSetup,
    token_data: dict = Depends(verify_token)
):
    """Setup user's home and office locations"""
    try:
        return await UserService.setup_dual_location(
            token_data["user_id"],
            locations.home_location,
            locations.office_location
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search/{sl_id}")
async def search_user_by_sl_id(
    sl_id: str,
    token_data: dict = Depends(verify_token)
):
    """Search for a user by their Sanatan Lok ID"""
    try:
        return await UserService.search_by_sl_id(sl_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/verification-status")
async def get_verification_status(token_data: dict = Depends(verify_token)):
    """Get user's verification status"""
    return await UserService.get_verification_status(token_data["user_id"])


@router.post("/request-verification")
async def request_verification(
    data: Dict[str, Any],
    token_data: dict = Depends(verify_token)
):
    """Request account verification (KYC)"""
    try:
        return await UserService.request_verification(
            token_data["user_id"],
            data.get("full_name"),
            data.get("id_type"),
            data.get("id_number")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/profile-completion")
async def get_profile_completion(token_data: dict = Depends(verify_token)):
    """Get profile completion percentage"""
    return await UserService.get_profile_completion(token_data["user_id"])


@router.get("/horoscope")
async def get_horoscope(token_data: dict = Depends(verify_token)):
    """Get user's horoscope (if birth details are complete)"""
    try:
        return await UserService.get_horoscope(token_data["user_id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
