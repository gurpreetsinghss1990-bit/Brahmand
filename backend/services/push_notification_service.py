"""
Firebase Cloud Messaging (FCM) Push Notification Service

Sends push notifications to users when they receive new messages.
Uses Firebase Admin SDK to send notifications via FCM.
"""

import logging
from typing import Optional, List, Dict, Any
from firebase_admin import messaging

logger = logging.getLogger(__name__)

# Lazy import to avoid circular dependencies
_db_instance = None

async def _get_db():
    """Lazy get database instance"""
    global _db_instance
    if _db_instance is None:
        from config.firestore_db import FirestoreDB
        from config.firebase_config import get_firestore
        client = await get_firestore()
        if not client:
            raise Exception("Firestore client not available")
        _db_instance = FirestoreDB(client)
    return _db_instance


class PushNotificationService:
    """Service for sending push notifications via FCM"""
    
    @staticmethod
    async def get_user_fcm_token(user_id: str) -> Optional[str]:
        """Get the FCM token for a user from Firestore"""
        db = await _get_db()
        user = await db.get_document('users', user_id)
        if user:
            return user.get('fcm_token')
        return None
    
    @staticmethod
    async def save_user_fcm_token(user_id: str, fcm_token: str) -> bool:
        """Save or update a user's FCM token in Firestore"""
        try:
            db = await _get_db()
            await db.update_document('users', user_id, {'fcm_token': fcm_token})
            logger.info(f"FCM token saved for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving FCM token: {e}")
            return False
    
    @staticmethod
    def send_notification(
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
        channel_id: str = 'messages'
    ) -> Optional[str]:
        """
        Send a push notification to a single device
        
        Args:
            token: FCM device token
            title: Notification title
            body: Notification body
            data: Optional data payload
            image_url: Optional image URL for rich notification
            channel_id: Android notification channel ID
            
        Returns:
            Message ID if successful, None otherwise
        """
        try:
            # Build the notification
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            # Android specific configuration
            android_config = messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    channel_id=channel_id,
                    icon='notification_icon',
                    color='#FF6B35',
                    sound='default',
                    click_action='FLUTTER_NOTIFICATION_CLICK'
                )
            )
            
            # iOS specific configuration
            apns_config = messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1,
                        content_available=True
                    )
                )
            )
            
            # Build the message
            message = messaging.Message(
                notification=notification,
                data=data or {},
                token=token,
                android=android_config,
                apns=apns_config
            )
            
            # Send the message
            response = messaging.send(message)
            logger.info(f"Push notification sent successfully: {response}")
            return response
            
        except messaging.UnregisteredError:
            logger.warning(f"FCM token is unregistered/invalid: {token[:20]}...")
            return None
        except Exception as e:
            logger.error(f"Error sending push notification: {e}")
            return None
    
    @staticmethod
    def send_multicast(
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to multiple devices
        
        Args:
            tokens: List of FCM device tokens
            title: Notification title
            body: Notification body
            data: Optional data payload
            
        Returns:
            Dict with success_count and failure_count
        """
        if not tokens:
            return {'success_count': 0, 'failure_count': 0}
            
        try:
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            message = messaging.MulticastMessage(
                notification=notification,
                data=data or {},
                tokens=tokens
            )
            
            response = messaging.send_multicast(message)
            
            logger.info(
                f"Multicast sent: {response.success_count} success, "
                f"{response.failure_count} failures"
            )
            
            return {
                'success_count': response.success_count,
                'failure_count': response.failure_count
            }
            
        except Exception as e:
            logger.error(f"Error sending multicast notification: {e}")
            return {'success_count': 0, 'failure_count': len(tokens)}
    
    @classmethod
    async def notify_new_dm(
        cls,
        recipient_id: str,
        sender_name: str,
        message_preview: str,
        chat_id: str
    ) -> bool:
        """
        Send notification for a new direct message
        
        Args:
            recipient_id: User ID of the message recipient
            sender_name: Name of the message sender
            message_preview: Preview of the message content
            chat_id: Chat ID for deep linking
            
        Returns:
            True if notification sent successfully
        """
        token = await cls.get_user_fcm_token(recipient_id)
        
        if not token:
            logger.info(f"No FCM token for user {recipient_id}")
            return False
        
        # Truncate message preview
        preview = message_preview[:100] + '...' if len(message_preview) > 100 else message_preview
        
        result = cls.send_notification(
            token=token,
            title=f"New message from {sender_name}",
            body=preview,
            data={
                'type': 'dm',
                'chat_id': chat_id,
                'sender_name': sender_name
            },
            channel_id='messages'
        )
        
        return result is not None
    
    @classmethod
    async def notify_community_message(
        cls,
        community_id: str,
        community_name: str,
        sender_name: str,
        message_preview: str,
        exclude_user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send notification to all community members for a new message
        
        Args:
            community_id: Community ID
            community_name: Name of the community
            sender_name: Name of the message sender
            message_preview: Preview of the message content
            exclude_user_id: User ID to exclude (the sender)
            
        Returns:
            Dict with success and failure counts
        """
        db = await _get_db()
        
        # Get community members
        community = await db.get_document('communities', community_id)
        if not community:
            return {'success_count': 0, 'failure_count': 0}
        
        member_ids = community.get('members', [])
        
        # Exclude the sender
        if exclude_user_id:
            member_ids = [m for m in member_ids if m != exclude_user_id]
        
        if not member_ids:
            return {'success_count': 0, 'failure_count': 0}
        
        # Get FCM tokens for all members
        tokens = []
        for member_id in member_ids:
            token = await cls.get_user_fcm_token(member_id)
            if token:
                tokens.append(token)
        
        if not tokens:
            return {'success_count': 0, 'failure_count': 0}
        
        # Truncate message preview
        preview = message_preview[:100] + '...' if len(message_preview) > 100 else message_preview
        
        return cls.send_multicast(
            tokens=tokens,
            title=f"{sender_name} in {community_name}",
            body=preview,
            data={
                'type': 'community',
                'community_id': community_id,
                'community_name': community_name
            }
        )


# Singleton instance
push_service = PushNotificationService()
