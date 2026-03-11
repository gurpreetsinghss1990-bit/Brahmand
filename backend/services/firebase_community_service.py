"""Firebase Community Service"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from config.firebase_config import get_firestore
from config.firestore_db import FirestoreDB
from utils.helpers import generate_community_code, SUBGROUPS
from utils.cache import cache_manager

logger = logging.getLogger(__name__)


class FirebaseCommunityService:
    """Handles community operations with Firestore"""
    
    @staticmethod
    async def get_db() -> FirestoreDB:
        client = await get_firestore()
        return FirestoreDB(client)
    
    @staticmethod
    async def get_or_create_community(
        name: str,
        community_type: str,
        location: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get existing community or create new one"""
        db = await FirebaseCommunityService.get_db()
        
        community = await db.get_community_by_name(name)
        if community:
            return community
        
        # Create new community
        community_data = {
            "name": name,
            "type": community_type,
            "location": location,
            "code": generate_community_code(name.split()[0]),
            "members": [],
            "member_count": 0,
            "subgroups": SUBGROUPS.copy()
        }
        
        community_id = await db.create_community(community_data)
        community_data['id'] = community_id
        
        logger.info(f"Created community: {name}")
        return community_data
    
    @staticmethod
    async def join_location_communities(
        user_id: str,
        location: Dict[str, Any]
    ) -> List[str]:
        """Join all communities for a location"""
        db = await FirebaseCommunityService.get_db()
        community_ids = []
        
        # Area Community
        area_community = await FirebaseCommunityService.get_or_create_community(
            f"{location['area'].title()} Group",
            "area",
            location
        )
        community_ids.append(area_community['id'])
        
        # City Community
        city_community = await FirebaseCommunityService.get_or_create_community(
            f"{location['city'].title()} Group",
            "city",
            {"country": location['country'], "state": location['state'], "city": location['city']}
        )
        community_ids.append(city_community['id'])
        
        # State Community
        state_community = await FirebaseCommunityService.get_or_create_community(
            f"{location['state'].title()} Group",
            "state",
            {"country": location['country'], "state": location['state']}
        )
        community_ids.append(state_community['id'])
        
        # Country Community
        country_community = await FirebaseCommunityService.get_or_create_community(
            f"{location['country'].title()} Group",
            "country",
            {"country": location['country']}
        )
        community_ids.append(country_community['id'])
        
        # Add user to each community
        for cid in community_ids:
            await db.add_member_to_community(cid, user_id)
        
        return community_ids
    
    @staticmethod
    async def get_user_communities(user_id: str) -> List[Dict[str, Any]]:
        """Get all communities user belongs to"""
        # Try cache
        cached = await cache_manager.get_communities(user_id)
        if cached:
            return cached
        
        db = await FirebaseCommunityService.get_db()
        user = await db.get_document('users', user_id)
        if not user:
            raise ValueError("User not found")
        
        community_ids = user.get("communities", [])
        communities = []
        
        for cid in community_ids:
            try:
                community = await db.get_document('communities', cid)
                if community:
                    communities.append({
                        "id": community['id'],
                        "name": community['name'],
                        "type": community['type'],
                        "code": community.get('code', ''),
                        "member_count": len(community.get('members', [])),
                        "subgroups": community.get('subgroups', [])
                    })
            except Exception as e:
                logger.error(f"Error fetching community {cid}: {e}")
        
        await cache_manager.set_communities(user_id, communities)
        return communities
    
    @staticmethod
    async def get_community(community_id: str) -> Dict[str, Any]:
        """Get community details"""
        db = await FirebaseCommunityService.get_db()
        community = await db.get_document('communities', community_id)
        if not community:
            raise ValueError("Community not found")
        
        return {
            "id": community['id'],
            "name": community['name'],
            "type": community['type'],
            "location": community.get('location', {}),
            "code": community.get('code', ''),
            "member_count": len(community.get('members', [])),
            "subgroups": community.get('subgroups', [])
        }
    
    @staticmethod
    async def join_by_code(user_id: str, code: str) -> Dict[str, Any]:
        """Join community by code"""
        db = await FirebaseCommunityService.get_db()
        community = await db.find_one('communities', [('code', '==', code.upper())])
        if not community:
            raise ValueError("Invalid community code")
        
        from google.cloud import firestore
        
        # Add user to community
        await db.client.collection('communities').document(community['id']).update({
            'members': firestore.ArrayUnion([user_id])
        })
        
        # Add community to user
        await db.client.collection('users').document(user_id).update({
            'communities': firestore.ArrayUnion([community['id']])
        })
        
        await cache_manager.invalidate_user_communities(user_id)
        
        return {"message": "Joined community successfully", "community": community['name']}
    
    @staticmethod
    async def agree_to_rules(user_id: str, community_id: str, subgroup_type: str) -> Dict[str, Any]:
        """Agree to rules"""
        db = await FirebaseCommunityService.get_db()
        
        from google.cloud import firestore
        await db.client.collection('users').document(user_id).update({
            'agreed_rules': firestore.ArrayUnion([f"{community_id}_{subgroup_type}"])
        })
        
        await cache_manager.invalidate_user(user_id)
        return {"message": "Rules agreed"}
    
    @staticmethod
    async def discover_communities() -> List[Dict[str, Any]]:
        """Discover popular communities"""
        db = await FirebaseCommunityService.get_db()
        communities = await db.query_documents(
            'communities',
            order_by='member_count',
            order_direction='DESCENDING',
            limit=20
        )
        
        return [{
            "id": c['id'],
            "name": c['name'],
            "type": c['type'],
            "code": c.get('code', ''),
            "member_count": len(c.get('members', []))
        } for c in communities]
    
    @staticmethod
    async def get_community_stats(community_id: str) -> Dict[str, Any]:
        """Get community stats"""
        cached = await cache_manager.get_community_stats(community_id)
        if cached:
            return cached
        
        db = await FirebaseCommunityService.get_db()
        community = await db.get_document('communities', community_id)
        
        # Count recent messages
        yesterday = datetime.utcnow() - timedelta(hours=24)
        
        stats = {
            "community_id": community_id,
            "name": community['name'] if community else "Unknown",
            "new_messages": 0,  # Would count from chats collection
            "member_count": len(community.get('members', [])) if community else 0
        }
        
        await cache_manager.set_community_stats(community_id, stats)
        return stats
