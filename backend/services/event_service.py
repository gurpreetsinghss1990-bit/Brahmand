"""Event Service"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from bson import ObjectId

from config.database import get_database
from utils.helpers import serialize_doc

logger = logging.getLogger(__name__)


class EventService:
    """Handles event-related operations"""
    
    @staticmethod
    async def create_event(
        organizer_id: str,
        name: str,
        description: str,
        event_type: str,
        location: Dict[str, Any],
        date: str,
        time: str,
        organizer_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new event"""
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(organizer_id)})
        
        # Check if user is verified
        if not user.get("is_verified", False):
            raise ValueError("Only verified members can create events")
        
        event = {
            "name": name,
            "description": description,
            "event_type": event_type,
            "location": location,
            "date": date,
            "time": time,
            "organizer_id": organizer_id,
            "organizer_name": organizer_name or user["name"],
            "attendees": [organizer_id],
            "attendee_count": 1,
            "status": "upcoming",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.events.insert_one(event)
        event["_id"] = result.inserted_id
        
        logger.info(f"Event created: {name}")
        return serialize_doc(event)
    
    @staticmethod
    async def get_events() -> List[Dict[str, Any]]:
        """Get upcoming events"""
        db = await get_database()
        today = datetime.utcnow().strftime("%Y-%m-%d")
        events = await db.events.find({"date": {"$gte": today}}).sort("date", 1).limit(20).to_list(20)
        return [serialize_doc(e) for e in events]
    
    @staticmethod
    async def get_nearby_events(user_id: str) -> List[Dict[str, Any]]:
        """Get events near user's location"""
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        user_location = user.get("location", {})
        
        # Get events in user's city
        today = datetime.utcnow().strftime("%Y-%m-%d")
        query = {"date": {"$gte": today}}
        
        if user_location.get("city"):
            query["location.city"] = user_location["city"]
        
        events = await db.events.find(query).sort("date", 1).limit(20).to_list(20)
        
        # Add distance info (simplified)
        result = []
        for e in events:
            event = serialize_doc(e)
            event["distance"] = "2.5 km"  # Placeholder - calculate actual distance
            result.append(event)
        
        return result
    
    @staticmethod
    async def get_event(event_id: str) -> Dict[str, Any]:
        """Get event details"""
        db = await get_database()
        event = await db.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        return serialize_doc(event)
    
    @staticmethod
    async def attend_event(user_id: str, event_id: str) -> Dict[str, Any]:
        """Mark attendance for an event"""
        db = await get_database()
        
        await db.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$addToSet": {"attendees": user_id},
                "$inc": {"attendee_count": 1}
            }
        )
        
        return {"message": "You're attending this event"}
    
    @staticmethod
    async def cancel_attendance(user_id: str, event_id: str) -> Dict[str, Any]:
        """Cancel attendance for an event"""
        db = await get_database()
        
        await db.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$pull": {"attendees": user_id},
                "$inc": {"attendee_count": -1}
            }
        )
        
        return {"message": "Attendance cancelled"}
