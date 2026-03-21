"""Notification Service"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from config.database import get_database
from utils.helpers import serialize_doc

logger = logging.getLogger(__name__)


class NotificationService:
    """Handles notification operations"""
    
    # Notification types
    TYPE_MESSAGE = "message"
    TYPE_COMMUNITY = "community"
    TYPE_TEMPLE = "temple"
    TYPE_EVENT = "event"
    TYPE_VERIFICATION = "verification"
    TYPE_SYSTEM = "system"
    
    @staticmethod
    async def create_notification(
        user_id: str,
        title: str,
        body: str,
        notification_type: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a notification for user"""
        db = await get_database()
        
        notification = {
            "user_id": user_id,
            "title": title,
            "body": body,
            "notification_type": notification_type,
            "data": data or {},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        
        result = await db.notifications.insert_one(notification)
        notification["_id"] = result.inserted_id
        
        logger.info(f"Notification created for user {user_id}: {title}")
        return serialize_doc(notification)
    
    @staticmethod
    async def get_user_notifications(
        user_id: str,
        limit: int = 50,
        unread_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get notifications for user"""
        db = await get_database()
        
        query = {"user_id": user_id}
        if unread_only:
            query["is_read"] = False
        
        notifications = await db.notifications.find(query).sort(
            "created_at", -1
        ).limit(limit).to_list(limit)
        
        return [serialize_doc(n) for n in notifications]
    
    @staticmethod
    async def mark_as_read(user_id: str, notification_id: str) -> Dict[str, Any]:
        """Mark notification as read"""
        db = await get_database()
        
        await db.notifications.update_one(
            {"_id": ObjectId(notification_id), "user_id": user_id},
            {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
        )
        
        return {"message": "Notification marked as read"}
    
    @staticmethod
    async def mark_all_as_read(user_id: str) -> Dict[str, Any]:
        """Mark all notifications as read"""
        db = await get_database()
        
        await db.notifications.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
        )
        
        return {"message": "All notifications marked as read"}
    
    @staticmethod
    async def get_unread_count(user_id: str) -> int:
        """Get unread notification count"""
        db = await get_database()
        return await db.notifications.count_documents({
            "user_id": user_id,
            "is_read": False
        })
    
    @staticmethod
    async def delete_notification(user_id: str, notification_id: str) -> Dict[str, Any]:
        """Delete a notification"""
        db = await get_database()
        
        await db.notifications.delete_one({
            "_id": ObjectId(notification_id),
            "user_id": user_id
        })
        
        return {"message": "Notification deleted"}
    
    # Convenience methods for creating specific notifications
    @staticmethod
    async def notify_new_message(
        user_id: str,
        sender_name: str,
        message_preview: str,
        chat_id: str,
        chat_type: str
    ):
        """Create notification for new message"""
        return await NotificationService.create_notification(
            user_id=user_id,
            title=f"New message from {sender_name}",
            body=message_preview[:100],
            notification_type=NotificationService.TYPE_MESSAGE,
            data={"chat_id": chat_id, "chat_type": chat_type}
        )
    
    @staticmethod
    async def notify_temple_update(
        user_id: str,
        temple_name: str,
        update_title: str,
        temple_id: str
    ):
        """Create notification for temple update"""
        return await NotificationService.create_notification(
            user_id=user_id,
            title=f"Update from {temple_name}",
            body=update_title,
            notification_type=NotificationService.TYPE_TEMPLE,
            data={"temple_id": temple_id}
        )
    
    @staticmethod
    async def notify_event_reminder(
        user_id: str,
        event_name: str,
        event_date: str,
        event_id: str
    ):
        """Create notification for event reminder"""
        return await NotificationService.create_notification(
            user_id=user_id,
            title="Event Reminder",
            body=f"{event_name} is coming up on {event_date}",
            notification_type=NotificationService.TYPE_EVENT,
            data={"event_id": event_id}
        )
