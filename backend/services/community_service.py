"""Community Service"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from bson import ObjectId

from config.database import get_database
from utils.helpers import serialize_doc, generate_community_code, SUBGROUPS
from utils.cache import cache_manager

logger = logging.getLogger(__name__)


class CommunityService:
    """Handles community-related operations"""
    
    @staticmethod
    async def get_or_create_community(
        name: str, 
        community_type: str, 
        location: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get existing community or create new one"""
        db = await get_database()
        
        community = await db.communities.find_one({"name": name})
        if community:
            return community
        
        # Create new community
        community = {
            "name": name,
            "type": community_type,
            "location": location,
            "code": generate_community_code(name.split()[0]),
            "members": [],
            "subgroups": SUBGROUPS.copy(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await db.communities.insert_one(community)
        community["_id"] = result.inserted_id
        
        logger.info(f"Created community: {name}")
        return community
    
    @staticmethod
    async def join_location_communities(
        user_id: str,
        location: Dict[str, Any]
    ) -> List[str]:
        """Join all communities for a location (area, city, state, country)"""
        db = await get_database()
        community_ids = []
        
        # Area Community
        area_community = await CommunityService.get_or_create_community(
            f"{location['area'].title()} Group",
            "area",
            location
        )
        community_ids.append(str(area_community["_id"]))
        
        # City Community
        city_community = await CommunityService.get_or_create_community(
            f"{location['city'].title()} Group",
            "city",
            {"country": location['country'], "state": location['state'], "city": location['city']}
        )
        community_ids.append(str(city_community["_id"]))
        
        # State Community
        state_community = await CommunityService.get_or_create_community(
            f"{location['state'].title()} Group",
            "state",
            {"country": location['country'], "state": location['state']}
        )
        community_ids.append(str(state_community["_id"]))
        
        # Country Community
        country_community = await CommunityService.get_or_create_community(
            f"{location['country'].title()} Group",
            "country",
            {"country": location['country']}
        )
        community_ids.append(str(country_community["_id"]))
        
        # Add user to community members
        for cid in community_ids:
            await db.communities.update_one(
                {"_id": ObjectId(cid)},
                {"$addToSet": {"members": user_id}}
            )
        
        return community_ids
    
    @staticmethod
    async def get_user_communities(user_id: str) -> List[Dict[str, Any]]:
        """Get all communities user belongs to with caching"""
        # Try cache first
        cached = await cache_manager.get_communities(user_id)
        if cached:
            return cached
        
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise ValueError("User not found")
        
        community_ids = user.get("communities", [])
        communities = []
        
        for cid in community_ids:
            try:
                community = await db.communities.find_one({"_id": ObjectId(cid)})
                if community:
                    communities.append({
                        "id": str(community["_id"]),
                        "name": community["name"],
                        "type": community["type"],
                        "code": community["code"],
                        "member_count": len(community.get("members", [])),
                        "subgroups": community.get("subgroups", [])
                    })
            except Exception as e:
                logger.error(f"Error fetching community {cid}: {e}")
        
        # Cache the result
        await cache_manager.set_communities(user_id, communities)
        
        return communities
    
    @staticmethod
    async def get_community(community_id: str) -> Dict[str, Any]:
        """Get community details"""
        db = await get_database()
        community = await db.communities.find_one({"_id": ObjectId(community_id)})
        if not community:
            raise ValueError("Community not found")
        
        return {
            "id": str(community["_id"]),
            "name": community["name"],
            "type": community["type"],
            "location": community.get("location", {}),
            "code": community["code"],
            "member_count": len(community.get("members", [])),
            "subgroups": community.get("subgroups", [])
        }
    
    @staticmethod
    async def join_by_code(user_id: str, code: str) -> Dict[str, Any]:
        """Join a community using invite code"""
        db = await get_database()
        community = await db.communities.find_one({"code": code.upper()})
        if not community:
            raise ValueError("Invalid community code")
        
        community_id = str(community["_id"])
        
        # Add user to community
        await db.communities.update_one(
            {"_id": community["_id"]},
            {"$addToSet": {"members": user_id}}
        )
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$addToSet": {"communities": community_id}}
        )
        
        # Invalidate cache
        await cache_manager.invalidate_user_communities(user_id)
        
        return {"message": "Joined community successfully", "community": community["name"]}
    
    @staticmethod
    async def agree_to_rules(
        user_id: str,
        community_id: str,
        subgroup_type: str
    ) -> Dict[str, Any]:
        """Agree to subgroup rules"""
        db = await get_database()
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$addToSet": {"agreed_rules": f"{community_id}_{subgroup_type}"}}
        )
        
        # Invalidate cache
        await cache_manager.invalidate_user(user_id)
        
        return {"message": "Rules agreed"}
    
    @staticmethod
    async def discover_communities() -> List[Dict[str, Any]]:
        """Discover popular communities"""
        db = await get_database()
        communities = await db.communities.find().sort("member_count", -1).limit(20).to_list(20)
        
        return [{
            "id": str(c["_id"]),
            "name": c["name"],
            "type": c["type"],
            "code": c["code"],
            "member_count": len(c.get("members", []))
        } for c in communities]
    
    @staticmethod
    async def get_community_stats(community_id: str) -> Dict[str, Any]:
        """Get community activity stats"""
        from datetime import timedelta
        
        # Try cache first
        cached = await cache_manager.get_community_stats(community_id)
        if cached:
            return cached
        
        db = await get_database()
        
        # Count messages in last 24 hours
        yesterday = datetime.utcnow() - timedelta(hours=24)
        
        message_count = await db.messages.count_documents({
            "community_id": community_id,
            "created_at": {"$gte": yesterday}
        })
        
        community = await db.communities.find_one({"_id": ObjectId(community_id)})
        
        stats = {
            "community_id": community_id,
            "name": community["name"] if community else "Unknown",
            "new_messages": message_count,
            "member_count": len(community.get("members", [])) if community else 0
        }
        
        # Cache stats
        await cache_manager.set_community_stats(community_id, stats)
        
        return stats
