"""Firebase User Service"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
import aiohttp

from config.firebase_config import get_firestore
from config.firestore_db import FirestoreDB
from utils.helpers import SUPPORTED_LANGUAGES
from utils.cache import cache_manager

logger = logging.getLogger(__name__)


class FirebaseUserService:
    """Handles user operations with Firestore"""
    
    @staticmethod
    async def get_db() -> FirestoreDB:
        client = await get_firestore()
        return FirestoreDB(client)
    
    @staticmethod
    async def get_profile(user_id: str) -> Dict[str, Any]:
        """Get user profile"""
        # Try cache first
        cached = await cache_manager.get_user(user_id)
        if cached:
            return cached
        
        db = await FirebaseUserService.get_db()
        user = await db.get_document('users', user_id)
        if not user:
            raise ValueError("User not found")
        
        # Cache the result
        await cache_manager.set_user(user_id, user)
        
        return user
    
    @staticmethod
    async def update_profile(user_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile"""
        db = await FirebaseUserService.get_db()
        
        # Filter out None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        if "language" in update_data and update_data["language"] not in SUPPORTED_LANGUAGES:
            raise ValueError("Unsupported language")
        
        if update_data:
            await db.update_document('users', user_id, update_data)
        
        # Invalidate cache
        await cache_manager.invalidate_user(user_id)
        
        return await FirebaseUserService.get_profile(user_id)
    
    @staticmethod
    async def search_by_sl_id(sl_id: str) -> Dict[str, Any]:
        """Search user by SL ID"""
        db = await FirebaseUserService.get_db()
        user = await db.get_user_by_sl_id(sl_id)
        if not user:
            raise ValueError("User not found")
        
        return {
            "sl_id": user["sl_id"],
            "name": user["name"],
            "photo": user.get("photo"),
            "badges": user.get("badges", [])
        }
    
    @staticmethod
    async def setup_location(user_id: str, location: Dict[str, str]) -> Dict[str, Any]:
        """Setup user location and join communities"""
        from services.firebase_community_service import FirebaseCommunityService
        
        db = await FirebaseUserService.get_db()
        
        # Join location-based communities
        community_ids = await FirebaseCommunityService.join_location_communities(user_id, location)
        
        # Update user
        from google.cloud import firestore
        await db.client.collection('users').document(user_id).update({
            'location': location,
            'home_location': location,
            'communities': firestore.ArrayUnion(community_ids),
            'updated_at': datetime.utcnow()
        })
        
        # Invalidate cache
        await cache_manager.invalidate_user(user_id)
        
        user = await FirebaseUserService.get_profile(user_id)
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
        """Setup dual locations"""
        from services.firebase_community_service import FirebaseCommunityService
        
        db = await FirebaseUserService.get_db()
        community_ids = []
        update_data = {'updated_at': datetime.utcnow()}
        
        if home_location:
            home_ids = await FirebaseCommunityService.join_location_communities(user_id, home_location)
            community_ids.extend(home_ids)
            update_data['home_location'] = home_location
            update_data['location'] = home_location
        
        if office_location:
            office_ids = await FirebaseCommunityService.join_location_communities(user_id, office_location)
            community_ids.extend(office_ids)
            update_data['office_location'] = office_location
        
        # Remove duplicates
        community_ids = list(set(community_ids))
        
        from google.cloud import firestore
        await db.client.collection('users').document(user_id).update({
            **update_data,
            'communities': firestore.ArrayUnion(community_ids)
        })
        
        await cache_manager.invalidate_user(user_id)
        
        user = await FirebaseUserService.get_profile(user_id)
        return {
            "message": "Locations set successfully",
            "user": user,
            "communities_joined": len(community_ids)
        }
    
    @staticmethod
    async def reverse_geocode(latitude: float, longitude: float) -> Dict[str, Any]:
        """Reverse geocode coordinates"""
        try:
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {
                "lat": latitude,
                "lon": longitude,
                "format": "json",
                "addressdetails": 1
            }
            headers = {"User-Agent": "SanatanLok/2.0"}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        address = data.get("address", {})
                        
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
                            "Unknown City"
                        )
                        if "Suburban" in city:
                            city = city.replace(" Suburban", "").strip()
                        
                        state = address.get("state") or address.get("region") or "Unknown State"
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
                            "display_name": data.get("display_name", "")
                        }
                    else:
                        raise ValueError("Geocoding service unavailable")
        except aiohttp.ClientError as e:
            logger.error(f"Geocoding error: {e}")
            raise ValueError("Failed to fetch location data")
    
    @staticmethod
    async def get_verification_status(user_id: str) -> Dict[str, Any]:
        """Get verification status"""
        user = await FirebaseUserService.get_profile(user_id)
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
        """Request verification"""
        db = await FirebaseUserService.get_db()
        
        verification_data = {
            "user_id": user_id,
            "full_name": full_name,
            "id_type": id_type,
            "id_number": id_number,
            "status": "pending"
        }
        
        await db.create_document('verifications', verification_data)
        
        # Auto-approve for demo
        from google.cloud import firestore
        await db.client.collection('users').document(user_id).update({
            'is_verified': True,
            'verification_date': datetime.utcnow(),
            'badges': firestore.ArrayUnion(['Verified Member'])
        })
        
        await cache_manager.invalidate_user(user_id)
        
        return {"message": "Verification completed successfully", "status": "approved"}
    
    @staticmethod
    async def get_profile_completion(user_id: str) -> Dict[str, Any]:
        """Get profile completion"""
        user = await FirebaseUserService.get_profile(user_id)
        
        fields = [
            "name", "photo", "language", "location", "kuldevi",
            "kuldevi_temple_area", "gotra", "date_of_birth",
            "place_of_birth", "time_of_birth"
        ]
        
        completed = sum(1 for f in fields if user.get(f))
        percentage = int((completed / len(fields)) * 100)
        
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
        """Get horoscope"""
        user = await FirebaseUserService.get_profile(user_id)
        
        birth_fields = ["date_of_birth", "place_of_birth", "time_of_birth"]
        if not all(user.get(f) for f in birth_fields):
            raise ValueError("Complete birth details to view horoscope")
        
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
