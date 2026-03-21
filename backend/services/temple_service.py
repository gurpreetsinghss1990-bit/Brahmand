"""Temple Service"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from config.database import get_database
from utils.helpers import serialize_doc, generate_temple_id
from utils.cache import cache_manager

logger = logging.getLogger(__name__)


class TempleService:
    """Handles temple-related operations"""
    
    @staticmethod
    async def create_temple(
        admin_id: str,
        name: str,
        location: Dict[str, str],
        description: Optional[str] = None,
        deity: Optional[str] = None,
        aarti_timings: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Create a new temple"""
        db = await get_database()
        
        # Generate unique temple ID
        temple_id = generate_temple_id()
        while await db.temples.find_one({"temple_id": temple_id}):
            temple_id = generate_temple_id()
        
        temple = {
            "temple_id": temple_id,
            "name": name,
            "location": location,
            "description": description,
            "deity": deity,
            "aarti_timings": aarti_timings or {},
            "admin_id": admin_id,
            "admins": [admin_id],
            "followers": [],
            "follower_count": 0,
            "posts": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.temples.insert_one(temple)
        temple["_id"] = result.inserted_id
        
        # Invalidate temples cache
        await cache_manager.invalidate_temples()
        
        logger.info(f"Temple created: {name} ({temple_id})")
        return serialize_doc(temple)
    
    @staticmethod
    async def get_temples(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all temples with caching"""
        # Try cache first (if no user-specific data needed)
        if not user_id:
            cached = await cache_manager.get_temples()
            if cached:
                return cached
        
        db = await get_database()
        temples = await db.temples.find().sort("follower_count", -1).limit(50).to_list(50)
        
        result = []
        for t in temples:
            temple_data = serialize_doc(t)
            if user_id:
                temple_data["is_following"] = user_id in t.get("followers", [])
            result.append(temple_data)
        
        # Cache if no user-specific data
        if not user_id:
            await cache_manager.set_temples(result)
        
        return result
    
    @staticmethod
    async def get_nearby_temples(
        lat: float = 19.0760,
        lng: float = 72.8777,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get temples near user's location"""
        db = await get_database()
        # For demo, return all temples - in production use geo queries
        temples = await db.temples.find().limit(20).to_list(20)
        
        result = []
        for t in temples:
            temple_data = serialize_doc(t)
            if user_id:
                temple_data["is_following"] = user_id in t.get("followers", [])
            temple_data["distance"] = "2.5 km"  # Placeholder
            result.append(temple_data)
        
        return result
    
    @staticmethod
    async def get_temple(temple_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get temple details"""
        db = await get_database()
        
        temple = await db.temples.find_one({"temple_id": temple_id})
        if not temple:
            temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
        if not temple:
            raise ValueError("Temple not found")
        
        temple_data = serialize_doc(temple)
        if user_id:
            temple_data["is_following"] = user_id in temple.get("followers", [])
        
        return temple_data
    
    @staticmethod
    async def follow_temple(user_id: str, temple_id: str) -> Dict[str, Any]:
        """Follow a temple"""
        db = await get_database()
        
        temple = await db.temples.find_one({"temple_id": temple_id})
        if not temple:
            temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
        if not temple:
            raise ValueError("Temple not found")
        
        # Add user to followers
        await db.temples.update_one(
            {"_id": temple["_id"]},
            {
                "$addToSet": {"followers": user_id},
                "$inc": {"follower_count": 1}
            }
        )
        
        # Add temple to user's followed temples
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$addToSet": {"temple_passbook.temples_followed": str(temple["_id"])}}
        )
        
        # Invalidate caches
        await cache_manager.invalidate_temples()
        await cache_manager.invalidate_user(user_id)
        
        return {"message": f"Now following {temple['name']}"}
    
    @staticmethod
    async def unfollow_temple(user_id: str, temple_id: str) -> Dict[str, Any]:
        """Unfollow a temple"""
        db = await get_database()
        
        temple = await db.temples.find_one({"temple_id": temple_id})
        if not temple:
            temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
        if not temple:
            raise ValueError("Temple not found")
        
        await db.temples.update_one(
            {"_id": temple["_id"]},
            {
                "$pull": {"followers": user_id},
                "$inc": {"follower_count": -1}
            }
        )
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$pull": {"temple_passbook.temples_followed": str(temple["_id"])}}
        )
        
        # Invalidate caches
        await cache_manager.invalidate_temples()
        await cache_manager.invalidate_user(user_id)
        
        return {"message": f"Unfollowed {temple['name']}"}
    
    @staticmethod
    async def create_post(
        user_id: str,
        temple_id: str,
        title: str,
        content: str,
        post_type: str = "announcement"
    ) -> Dict[str, Any]:
        """Create a temple post (admin only)"""
        db = await get_database()
        
        temple = await db.temples.find_one({"temple_id": temple_id})
        if not temple:
            temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
        if not temple:
            raise ValueError("Temple not found")
        
        if user_id not in temple.get("admins", []):
            raise ValueError("Only temple admins can post")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        new_post = {
            "id": str(ObjectId()),
            "title": title,
            "content": content,
            "post_type": post_type,
            "author_id": user_id,
            "author_name": user["name"],
            "reactions": [],
            "created_at": datetime.utcnow()
        }
        
        await db.temples.update_one(
            {"_id": temple["_id"]},
            {"$push": {"posts": {"$each": [new_post], "$position": 0}}}
        )
        
        return new_post
    
    @staticmethod
    async def get_posts(temple_id: str) -> List[Dict[str, Any]]:
        """Get temple posts"""
        db = await get_database()
        
        temple = await db.temples.find_one({"temple_id": temple_id})
        if not temple:
            temple = await db.temples.find_one({"_id": ObjectId(temple_id)})
        if not temple:
            raise ValueError("Temple not found")
        
        return temple.get("posts", [])[:20]
    
    @staticmethod
    async def react_to_post(
        user_id: str,
        temple_id: str,
        post_id: str,
        reaction: str = "namaste"
    ) -> Dict[str, Any]:
        """React to a temple post"""
        db = await get_database()
        
        await db.temples.update_one(
            {"temple_id": temple_id, "posts.id": post_id},
            {"$addToSet": {"posts.$.reactions": {"user_id": user_id, "reaction": reaction}}}
        )
        
        return {"message": "Reaction added"}
