"""Firebase Push Notification Service using FCM"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from config.firebase_config import get_firestore, get_firebase_messaging
from config.firestore_db import FirestoreDB

logger = logging.getLogger(__name__)


class FirebaseNotificationService:
    """Handles push notifications with Firebase Cloud Messaging"""
    
    # Notification types
    TYPE_MESSAGE = "message"
    TYPE_COMMUNITY = "community"
    TYPE_TEMPLE = "temple"
    TYPE_EVENT = "event"
    TYPE_VERIFICATION = "verification"
    TYPE_SYSTEM = "system"
    
    @staticmethod
    async def get_db() -> FirestoreDB:
        client = await get_firestore()
        return FirestoreDB(client)
    
    @staticmethod
    async def create_notification(
        user_id: str,
        title: str,
        body: str,
        notification_type: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create and store notification"""
        db = await FirebaseNotificationService.get_db()
        
        notification_data = {
            "user_id": user_id,
            "title": title,
            "body": body,
            "notification_type": notification_type,
            "data": data or {},
            "is_read": False
        }
        
        notification_id = await db.create_document('notifications', notification_data)
        notification_data['id'] = notification_id
        
        logger.info(f"Notification created for user {user_id}")
        return notification_data
    
    @staticmethod
    async def send_push_notification(
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to user via FCM.
        Sends to all registered FCM tokens for the user.
        """
        db = await FirebaseNotificationService.get_db()
        user = await db.get_document('users', user_id)
        
        if not user:
            raise ValueError("User not found")
        
        fcm_tokens = user.get('fcm_tokens', [])
        if not fcm_tokens:
            logger.info(f"No FCM tokens for user {user_id}")
            return {"message": "No FCM tokens registered", "sent": 0}
        
        try:
            messaging = get_firebase_messaging()
            
            # Create message
            from firebase_admin import messaging as fcm
            
            notification = fcm.Notification(
                title=title,
                body=body
            )
            
            # Send to each token
            success_count = 0
            failed_tokens = []
            
            for token in fcm_tokens:
                try:
                    message = fcm.Message(
                        notification=notification,
                        data=data or {},
                        token=token
                    )
                    messaging.send(message)
                    success_count += 1
                except Exception as e:
                    logger.warning(f"Failed to send to token: {e}")
                    failed_tokens.append(token)
            
            # Remove failed tokens
            if failed_tokens:
                from google.cloud import firestore
                await db.client.collection('users').document(user_id).update({
                    'fcm_tokens': firestore.ArrayRemove(failed_tokens)
                })
            
            return {
                "message": "Notifications sent",
                "sent": success_count,
                "failed": len(failed_tokens)
            }
            
        except Exception as e:
            logger.error(f"FCM send error: {e}")
            return {"message": f"FCM error: {str(e)}", "sent": 0}
    
    @staticmethod
    async def send_multicast(
        user_ids: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send push notification to multiple users"""
        db = await FirebaseNotificationService.get_db()
        
        all_tokens = []
        for user_id in user_ids:
            user = await db.get_document('users', user_id)
            if user and user.get('fcm_tokens'):
                all_tokens.extend(user['fcm_tokens'])
        
        if not all_tokens:
            return {"message": "No tokens found", "sent": 0}
        
        try:
            from firebase_admin import messaging as fcm
            
            # FCM allows max 500 tokens per multicast
            chunks = [all_tokens[i:i+500] for i in range(0, len(all_tokens), 500)]
            total_success = 0
            
            for chunk in chunks:
                message = fcm.MulticastMessage(
                    notification=fcm.Notification(title=title, body=body),
                    data=data or {},
                    tokens=chunk
                )
                response = fcm.send_multicast(message)
                total_success += response.success_count
            
            return {"message": "Multicast sent", "sent": total_success}
            
        except Exception as e:
            logger.error(f"Multicast error: {e}")
            return {"message": f"Error: {str(e)}", "sent": 0}
    
    @staticmethod
    async def get_user_notifications(
        user_id: str,
        limit: int = 50,
        unread_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get user notifications"""
        db = await FirebaseNotificationService.get_db()
        
        filters = [('user_id', '==', user_id)]
        if unread_only:
            filters.append(('is_read', '==', False))
        
        return await db.query_documents(
            'notifications',
            filters=filters,
            order_by='created_at',
            order_direction='DESCENDING',
            limit=limit
        )
    
    @staticmethod
    async def mark_as_read(user_id: str, notification_id: str) -> Dict[str, Any]:
        """Mark notification as read"""
        db = await FirebaseNotificationService.get_db()
        
        notification = await db.get_document('notifications', notification_id)
        if not notification or notification.get('user_id') != user_id:
            raise ValueError("Notification not found")
        
        await db.update_document('notifications', notification_id, {
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        
        return {"message": "Marked as read"}
    
    @staticmethod
    async def mark_all_as_read(user_id: str) -> Dict[str, Any]:
        """Mark all notifications as read"""
        db = await FirebaseNotificationService.get_db()
        
        notifications = await db.query_documents(
            'notifications',
            filters=[('user_id', '==', user_id), ('is_read', '==', False)]
        )
        
        for notif in notifications:
            await db.update_document('notifications', notif['id'], {
                'is_read': True,
                'read_at': datetime.utcnow()
            })
        
        return {"message": f"Marked {len(notifications)} as read"}
    
    @staticmethod
    async def get_unread_count(user_id: str) -> int:
        """Get unread count"""
        db = await FirebaseNotificationService.get_db()
        return await db.count_documents(
            'notifications',
            filters=[('user_id', '==', user_id), ('is_read', '==', False)]
        )
    
    # Convenience methods
    @staticmethod
    async def notify_new_message(
        user_id: str,
        sender_name: str,
        message_preview: str,
        chat_id: str,
        chat_type: str
    ):
        """Notify user of new message"""
        await FirebaseNotificationService.create_notification(
            user_id=user_id,
            title=f"New message from {sender_name}",
            body=message_preview[:100],
            notification_type=FirebaseNotificationService.TYPE_MESSAGE,
            data={"chat_id": chat_id, "chat_type": chat_type}
        )
        
        # Send push
        await FirebaseNotificationService.send_push_notification(
            user_id=user_id,
            title=f"New message from {sender_name}",
            body=message_preview[:100],
            data={"chat_id": chat_id, "type": "message"}
        )
    
    @staticmethod
    async def notify_temple_update(
        user_ids: List[str],
        temple_name: str,
        update_title: str,
        temple_id: str
    ):
        """Notify temple followers of update"""
        for user_id in user_ids:
            await FirebaseNotificationService.create_notification(
                user_id=user_id,
                title=f"Update from {temple_name}",
                body=update_title,
                notification_type=FirebaseNotificationService.TYPE_TEMPLE,
                data={"temple_id": temple_id}
            )
        
        await FirebaseNotificationService.send_multicast(
            user_ids=user_ids,
            title=f"Update from {temple_name}",
            body=update_title,
            data={"temple_id": temple_id, "type": "temple"}
        )
