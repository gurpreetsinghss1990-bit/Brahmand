"""User Service"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
import aiohttp

from config.database import get_database, get_redis
from utils.helpers import serialize_doc, SUPPORTED_LANGUAGES
from utils.cache import cache_manager
from services.community_service import CommunityService

logger = logging.getLogger(__name__)


class UserService:
    """Handles user-related operations"""
    
    @staticmethod
    async def get_profile(user_id: str) -> Dict[str, Any]:
        """Get user profile with caching"""
        # Try cache first
        cached = await cache_manager.get_user(user_id)
        if cached:
            return cached
        
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise ValueError("User not found")
        
        user_data = serialize_doc(user)
        
        # Cache the result
        await cache_manager.set_user(user_id, user_data)
        
        return user_data
    
    @staticmethod
    async def update_profile(
        user_id: str,
        update_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update user profile"""
        db = await get_database()
        
        # Filter out None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        # Validate language if provided
        if "language" in update_data and update_data["language"] not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language")
        
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
        
        # Invalidate cache
        await cache_manager.invalidate_user(user_id)
        
        # Return updated user
        return await UserService.get_profile(user_id)
    
    @staticmethod
    async def update_extended_profile(
        user_id: str,
        update_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update extended profile fields"""
        return await UserService.update_profile(user_id, update_data)
    
    @staticmethod
    async def search_by_sl_id(sl_id: str) -> Dict[str, Any]:
        """Search for a user by Sanatan Lok ID"""
        db = await get_database()
        user = await db.users.find_one({"sl_id": sl_id.upper()})
        if not user:
            raise ValueError("User not found")
        
        # Return limited public info
        return {
            "sl_id": user["sl_id"],
            "name": user["name"],
            "photo": user.get("photo"),
            "badges": user.get("badges", [])
        }
    
    @staticmethod
    async def setup_location(
        user_id: str,
        location: Dict[str, str]
    ) -> Dict[str, Any]:
        """Setup user location and join communities (legacy single location)"""
        db = await get_database()
        community_service = CommunityService()
        
        # Add user to location-based communities
        community_ids = await community_service.join_location_communities(
            user_id, location
        )
        
        # Update user with location
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "location": location,
                    "home_location": location,
                    "updated_at": datetime.utcnow()
                },
                "$addToSet": {"communities": {"$each": community_ids}}
            }
        )
        
        # Invalidate cache
        await cache_manager.invalidate_user(user_id)
        
        user = await UserService.get_profile(user_id)
        return {
            "message": "Location set successfully",
            "user": user,
            "communities_joined": len(community_ids)
        }
    
    @staticmethod
    async def setup_dual_location(
        user_id: str,
        home_location: Optional[Dict[str, Any]],
        office_location: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Setup user's home and office locations"""
        db = await get_database()
        community_service = CommunityService()
        community_ids = []
        update_data = {"updated_at": datetime.utcnow()}
        
        # Process home location
        if home_location:
            home_ids = await community_service.join_location_communities(
                user_id, home_location
            )
            community_ids.extend(home_ids)
            update_data["home_location"] = home_location
            update_data["location"] = home_location  # Primary location
        
        # Process office location
        if office_location:
            office_ids = await community_service.join_location_communities(
                user_id, office_location
            )
            community_ids.extend(office_ids)
            update_data["office_location"] = office_location
        
        # Remove duplicates
        community_ids = list(set(community_ids))
        
        # Update user
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": update_data,
                "$addToSet": {"communities": {"$each": community_ids}}
            }
        )
        
        # Invalidate cache
        await cache_manager.invalidate_user(user_id)
        await cache_manager.invalidate_user_communities(user_id)
        
        user = await UserService.get_profile(user_id)
        return {
            "message": "Locations set successfully",
            "user": user,
            "communities_joined": len(community_ids)
        }
    
    @staticmethod
    async def reverse_geocode(latitude: float, longitude: float) -> Dict[str, Any]:
        """Reverse geocode coordinates to get location details"""
        try:
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {
                "lat": latitude,
                "lon": longitude,
                "format": "json",
                "addressdetails": 1
            }
            headers = {
                "User-Agent": "SanatanLok/2.0"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        address = data.get("address", {})
                        
                        # Extract location components
                        area = (
                            address.get("suburb") or 
                            address.get("neighbourhood") or 
                            address.get("village") or 
                            address.get("town") or
                            address.get("city_district") or
                            "Unknown Area"
                        )
                        
                        city = (
                            address.get("city") or 
                            address.get("town") or 
                            address.get("municipality") or
                            address.get("state_district", "").replace(" District", "") or
                            address.get("county") or
                            "Unknown City"
                        )
                        if "Suburban" in city:
                            city = city.replace(" Suburban", "").strip()
                        
                        state = (
                            address.get("state") or 
                            address.get("region") or
                            "Unknown State"
                        )
                        
                        country = address.get("country", "Bharat")
                        if country == "India":
                            country = "Bharat"
                        
                        return {
                            "country": country,
                            "state": state,
                            "city": city,
                            "area": area,
                            "latitude": latitude,
                            "longitude": longitude,
                            "display_name": data.get("display_name", ""),
                            "raw_address": address
                        }
                    else:
                        raise ValueError("Geocoding service unavailable")
        except aiohttp.ClientError as e:
            logger.error(f"Geocoding error: {e}")
            raise ValueError("Failed to fetch location data")
    
    @staticmethod
    async def get_verification_status(user_id: str) -> Dict[str, Any]:
        """Get user's verification status"""
        user = await UserService.get_profile(user_id)
        
        return {
            "is_verified": user.get("is_verified", False),
            "verification_date": user.get("verification_date"),
            "member_type": "Verified Member" if user.get("is_verified") else "Basic Member",
            "can_post_in_community": user.get("is_verified", False)
        }
    
    @staticmethod
    async def request_verification(
        user_id: str,
        full_name: str,
        id_type: str,
        id_number: str
    ) -> Dict[str, Any]:
        """Request account verification (KYC)"""
        db = await get_database()
        
        # Store verification request
        verification = {
            "user_id": user_id,
            "full_name": full_name,
            "id_type": id_type,
            "id_number": id_number,
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        
        await db.verifications.update_one(
            {"user_id": user_id},
            {"$set": verification},
            upsert=True
        )
        
        # For demo, auto-approve
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "is_verified": True,
                    "verification_date": datetime.utcnow()
                },
                "$addToSet": {"badges": "Verified Member"}
            }
        )
        
        # Invalidate cache
        await cache_manager.invalidate_user(user_id)
        
        return {"message": "Verification completed successfully", "status": "approved"}
    
    @staticmethod
    async def get_profile_completion(user_id: str) -> Dict[str, Any]:
        """Get profile completion percentage"""
        user = await UserService.get_profile(user_id)
        
        fields = [
            "name", "photo", "language", "location", "kuldevi", 
            "kuldevi_temple_area", "gotra", "date_of_birth", 
            "place_of_birth", "time_of_birth"
        ]
        
        completed = sum(1 for f in fields if user.get(f))
        percentage = int((completed / len(fields)) * 100)
        
        # Check if birth details are complete for horoscope
        birth_fields = ["date_of_birth", "place_of_birth", "time_of_birth"]
        birth_complete = all(user.get(f) for f in birth_fields)
        
        return {
            "completion_percentage": percentage,
            "completed_fields": completed,
            "total_fields": len(fields),
            "horoscope_eligible": birth_complete,
            "missing_fields": [f for f in fields if not user.get(f)]
        }
    
    @staticmethod
    async def get_horoscope(user_id: str) -> Dict[str, Any]:
        """Get user's horoscope (if birth details are complete)"""
        user = await UserService.get_profile(user_id)
        
        # Check if birth details are complete
        birth_fields = ["date_of_birth", "place_of_birth", "time_of_birth"]
        if not all(user.get(f) for f in birth_fields):
            raise ValueError("Complete birth details to view horoscope")
        
        # Generate simple horoscope based on DOB
        dob = user.get("date_of_birth", "2000-01-01")
        month = int(dob.split("-")[1]) if dob else 1
        
        zodiac_signs = [
            "Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini",
            "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"
        ]
        zodiac = zodiac_signs[(month - 1) % 12]
        
        daily_insights = [
            "Today is favorable for spiritual activities and prayers.",
            "Financial matters will improve. Focus on savings.",
            "Health needs attention. Practice yoga and meditation.",
            "Relationships will strengthen. Spend time with family.",
            "Career growth is indicated. Take on new responsibilities.",
            "Travel may bring new opportunities. Stay positive."
        ]
        
        day_of_year = datetime.utcnow().timetuple().tm_yday
        
        return {
            "zodiac_sign": zodiac,
            "rashi": zodiac,
            "daily_horoscope": daily_insights[day_of_year % len(daily_insights)],
            "lucky_color": ["Orange", "White", "Yellow", "Red", "Green"][day_of_year % 5],
            "lucky_number": (day_of_year % 9) + 1,
            "auspicious_time": "10:30 AM - 12:00 PM"
        }
