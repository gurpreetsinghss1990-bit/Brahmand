"""Messaging Service with real-time support"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from config.database import get_database
from utils.helpers import serialize_doc, moderate_content
from utils.cache import cache_manager

logger = logging.getLogger(__name__)


class MessagingService:
    """Handles all messaging operations"""
    
    # Socket.IO reference (set by main app)
    sio = None
    
    @classmethod
    def set_socket(cls, sio):
        """Set Socket.IO instance"""
        cls.sio = sio
    
    @staticmethod
    async def send_community_message(
        user_id: str,
        community_id: str,
        subgroup_type: str,
        content: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """Send message to community subgroup"""
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        # Check membership
        if community_id not in user.get("communities", []):
            raise ValueError("Not a community member")
        
        # Check verification for posting
        if not user.get("is_verified", False):
            raise ValueError("Only verified members can post in community groups")
        
        # Content moderation
        is_ok, reason = moderate_content(content)
        if not is_ok:
            raise ValueError(reason)
        
        msg = {
            "community_id": community_id,
            "subgroup_type": subgroup_type,
            "sender_id": user_id,
            "sender_name": user["name"],
            "sender_photo": user.get("photo"),
            "sender_sl_id": user.get("sl_id"),
            "content": content,
            "message_type": message_type,
            "created_at": datetime.utcnow()
        }
        
        result = await db.messages.insert_one(msg)
        msg["_id"] = result.inserted_id
        
        # Emit to socket room
        if MessagingService.sio:
            room = f"community_{community_id}_{subgroup_type}"
            await MessagingService.sio.emit('new_message', serialize_doc(msg), room=room)
        
        logger.info(f"Message sent to community {community_id}/{subgroup_type}")
        return serialize_doc(msg)
    
    @staticmethod
    async def get_community_messages(
        community_id: str,
        subgroup_type: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get messages from community subgroup"""
        db = await get_database()
        messages = await db.messages.find({
            "community_id": community_id,
            "subgroup_type": subgroup_type
        }).sort("created_at", -1).limit(limit).to_list(limit)
        
        return [serialize_doc(msg) for msg in reversed(messages)]
    
    @staticmethod
    async def send_circle_message(
        user_id: str,
        circle_id: str,
        content: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """Send message to circle"""
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        # Check membership
        circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
        if not circle or user_id not in circle.get("members", []):
            raise ValueError("Not a circle member")
        
        # Content moderation
        is_ok, reason = moderate_content(content)
        if not is_ok:
            raise ValueError(reason)
        
        msg = {
            "circle_id": circle_id,
            "sender_id": user_id,
            "sender_name": user["name"],
            "sender_photo": user.get("photo"),
            "sender_sl_id": user.get("sl_id"),
            "content": content,
            "message_type": message_type,
            "created_at": datetime.utcnow()
        }
        
        result = await db.circle_messages.insert_one(msg)
        msg["_id"] = result.inserted_id
        
        # Emit to socket room
        if MessagingService.sio:
            room = f"circle_{circle_id}"
            await MessagingService.sio.emit('new_message', serialize_doc(msg), room=room)
        
        return serialize_doc(msg)
    
    @staticmethod
    async def get_circle_messages(
        circle_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get messages from circle"""
        db = await get_database()
        messages = await db.circle_messages.find({
            "circle_id": circle_id
        }).sort("created_at", -1).limit(limit).to_list(limit)
        
        return [serialize_doc(msg) for msg in reversed(messages)]
    
    @staticmethod
    async def send_direct_message(
        sender_id: str,
        recipient_sl_id: str,
        content: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """Send direct message to user by SL ID"""
        db = await get_database()
        sender = await db.users.find_one({"_id": ObjectId(sender_id)})
        
        # Find recipient by SL ID
        recipient = await db.users.find_one({"sl_id": recipient_sl_id.upper()})
        if not recipient:
            raise ValueError("User not found")
        
        recipient_id = str(recipient["_id"])
        
        # Content moderation
        is_ok, reason = moderate_content(content)
        if not is_ok:
            raise ValueError(reason)
        
        # Create conversation ID (sorted to ensure same ID for both directions)
        participants = sorted([sender_id, recipient_id])
        conversation_id = f"{participants[0]}_{participants[1]}"
        
        msg = {
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "sender_name": sender["name"],
            "sender_photo": sender.get("photo"),
            "sender_sl_id": sender.get("sl_id"),
            "recipient_id": recipient_id,
            "content": content,
            "message_type": message_type,
            "read": False,
            "created_at": datetime.utcnow()
        }
        
        result = await db.direct_messages.insert_one(msg)
        msg["_id"] = result.inserted_id
        
        # Update conversations list
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {
                "conversation_id": conversation_id,
                "participants": [sender_id, recipient_id],
                "last_message": content,
                "last_message_at": datetime.utcnow(),
                "last_sender_id": sender_id
            }},
            upsert=True
        )
        
        # Emit to socket room
        if MessagingService.sio:
            room = f"dm_{conversation_id}"
            await MessagingService.sio.emit('new_dm', serialize_doc(msg), room=room)
        
        return serialize_doc(msg)
    
    @staticmethod
    async def get_conversations(user_id: str) -> List[Dict[str, Any]]:
        """Get all DM conversations for user"""
        db = await get_database()
        
        conversations = await db.conversations.find({
            "participants": user_id
        }).sort("last_message_at", -1).to_list(100)
        
        result = []
        for conv in conversations:
            # Get the other participant
            other_id = [p for p in conv["participants"] if p != user_id][0]
            other_user = await db.users.find_one({"_id": ObjectId(other_id)})
            
            if other_user:
                # Count unread messages
                unread_count = await db.direct_messages.count_documents({
                    "conversation_id": conv["conversation_id"],
                    "recipient_id": user_id,
                    "read": False
                })
                
                result.append({
                    "conversation_id": conv["conversation_id"],
                    "user": {
                        "id": other_id,
                        "sl_id": other_user["sl_id"],
                        "name": other_user["name"],
                        "photo": other_user.get("photo")
                    },
                    "last_message": conv.get("last_message", ""),
                    "last_message_at": conv.get("last_message_at"),
                    "unread_count": unread_count
                })
        
        return result
    
    @staticmethod
    async def get_direct_messages(
        user_id: str,
        conversation_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get messages from a DM conversation"""
        # Verify user is part of conversation
        if user_id not in conversation_id.split("_"):
            raise ValueError("Not authorized")
        
        db = await get_database()
        messages = await db.direct_messages.find({
            "conversation_id": conversation_id
        }).sort("created_at", -1).limit(limit).to_list(limit)
        
        # Mark messages as read
        await db.direct_messages.update_many(
            {
                "conversation_id": conversation_id,
                "recipient_id": user_id,
                "read": False
            },
            {"$set": {"read": True}}
        )
        
        return [serialize_doc(msg) for msg in reversed(messages)]
