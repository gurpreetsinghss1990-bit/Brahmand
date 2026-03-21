"""Firebase Messaging Service with Real-time Support"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from config.firebase_config import get_firestore
from config.firestore_db import FirestoreDB
from utils.helpers import moderate_content
from google.cloud import firestore

logger = logging.getLogger(__name__)


class FirebaseMessagingService:
    """
    Handles messaging with Firestore.
    
    Structure:
    - chats/{chat_id}/messages/{message_id}
    - Chat types: community, circle, dm (direct message)
    """
    
    # Socket.IO reference for real-time
    sio = None
    
    @classmethod
    def set_socket(cls, sio):
        cls.sio = sio
    
    @staticmethod
    async def get_db() -> FirestoreDB:
        client = await get_firestore()
        return FirestoreDB(client)
    
    @staticmethod
    def _get_chat_id(chat_type: str, id1: str, id2: str = None) -> str:
        """Generate consistent chat ID"""
        if chat_type == 'dm':
            # Sort IDs for consistent DM chat ID
            ids = sorted([id1, id2])
            return f"dm_{ids[0]}_{ids[1]}"
        elif chat_type == 'community':
            return f"community_{id1}_{id2}"  # community_id + subgroup_type
        elif chat_type == 'circle':
            return f"circle_{id1}"
        return f"{chat_type}_{id1}"
    
    @staticmethod
    async def send_community_message(
        user_id: str,
        community_id: str,
        subgroup_type: str,
        content: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """Send message to community subgroup"""
        db = await FirebaseMessagingService.get_db()
        
        # Get user
        user = await db.get_document('users', user_id)
        if not user:
            raise ValueError("User not found")
        
        # Check membership
        if community_id not in user.get('communities', []):
            raise ValueError("Not a community member")
        
        # Check verification
        if not user.get('is_verified', False):
            raise ValueError("Only verified members can post in community groups")
        
        # Moderate content
        is_ok, reason = moderate_content(content)
        if not is_ok:
            raise ValueError(reason)
        
        chat_id = FirebaseMessagingService._get_chat_id('community', community_id, subgroup_type)
        
        # Ensure chat document exists
        chat_ref = db.client.collection('chats').document(chat_id)
        chat_doc = await chat_ref.get()
        if not chat_doc.exists:
            await chat_ref.set({
                'type': 'community',
                'community_id': community_id,
                'subgroup_type': subgroup_type,
                'created_at': datetime.utcnow()
            })
        
        # Create message in subcollection
        message_data = {
            'sender_id': user_id,
            'sender_name': user['name'],
            'sender_photo': user.get('photo'),
            'sender_sl_id': user.get('sl_id'),
            'content': content,
            'message_type': message_type,
            'created_at': datetime.utcnow(),
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        
        message_id = await db.add_message_to_chat(chat_id, message_data)
        message_data['id'] = message_id
        message_data['chat_id'] = chat_id
        
        # Update chat's last message
        await chat_ref.update({
            'last_message': content,
            'last_message_at': datetime.utcnow(),
            'last_sender_id': user_id
        })
        
        # Emit via Socket.IO
        if FirebaseMessagingService.sio:
            await FirebaseMessagingService.sio.emit(
                'new_message',
                message_data,
                room=chat_id
            )
        
        logger.info(f"Message sent to {chat_id}")
        return message_data
    
    @staticmethod
    async def get_community_messages(
        community_id: str,
        subgroup_type: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get messages from community chat"""
        db = await FirebaseMessagingService.get_db()
        chat_id = FirebaseMessagingService._get_chat_id('community', community_id, subgroup_type)
        return await db.get_chat_messages(chat_id, limit)
    
    @staticmethod
    async def send_circle_message(
        user_id: str,
        circle_id: str,
        content: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """Send message to circle"""
        db = await FirebaseMessagingService.get_db()
        
        user = await db.get_document('users', user_id)
        circle = await db.get_document('circles', circle_id)
        
        if not circle or user_id not in circle.get('members', []):
            raise ValueError("Not a circle member")
        
        is_ok, reason = moderate_content(content)
        if not is_ok:
            raise ValueError(reason)
        
        chat_id = FirebaseMessagingService._get_chat_id('circle', circle_id)
        
        # Ensure chat exists
        chat_ref = db.client.collection('chats').document(chat_id)
        chat_doc = await chat_ref.get()
        if not chat_doc.exists:
            await chat_ref.set({
                'type': 'circle',
                'circle_id': circle_id,
                'created_at': datetime.utcnow()
            })
        
        message_data = {
            'sender_id': user_id,
            'sender_name': user['name'],
            'sender_photo': user.get('photo'),
            'sender_sl_id': user.get('sl_id'),
            'content': content,
            'message_type': message_type,
            'created_at': datetime.utcnow(),
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        
        message_id = await db.add_message_to_chat(chat_id, message_data)
        message_data['id'] = message_id
        message_data['chat_id'] = chat_id
        
        await chat_ref.update({
            'last_message': content,
            'last_message_at': datetime.utcnow()
        })
        
        if FirebaseMessagingService.sio:
            await FirebaseMessagingService.sio.emit('new_message', message_data, room=chat_id)
        
        return message_data
    
    @staticmethod
    async def get_circle_messages(circle_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get circle messages"""
        db = await FirebaseMessagingService.get_db()
        chat_id = FirebaseMessagingService._get_chat_id('circle', circle_id)
        return await db.get_chat_messages(chat_id, limit)
    
    @staticmethod
    async def send_direct_message(
        sender_id: str,
        recipient_sl_id: str,
        content: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """Send direct message"""
        db = await FirebaseMessagingService.get_db()
        
        sender = await db.get_document('users', sender_id)
        recipient = await db.get_user_by_sl_id(recipient_sl_id)
        
        if not recipient:
            raise ValueError("User not found")
        
        is_ok, reason = moderate_content(content)
        if not is_ok:
            raise ValueError(reason)
        
        recipient_id = recipient['id']
        chat_id = FirebaseMessagingService._get_chat_id('dm', sender_id, recipient_id)
        
        # Ensure chat exists
        chat_ref = db.client.collection('chats').document(chat_id)
        chat_doc = await chat_ref.get()
        if not chat_doc.exists:
            await chat_ref.set({
                'type': 'dm',
                'participants': sorted([sender_id, recipient_id]),
                'created_at': datetime.utcnow()
            })
        
        message_data = {
            'sender_id': sender_id,
            'sender_name': sender['name'],
            'sender_photo': sender.get('photo'),
            'sender_sl_id': sender.get('sl_id'),
            'recipient_id': recipient_id,
            'content': content,
            'message_type': message_type,
            'read': False,
            'created_at': datetime.utcnow(),
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        
        message_id = await db.add_message_to_chat(chat_id, message_data)
        message_data['id'] = message_id
        message_data['chat_id'] = chat_id
        
        await chat_ref.update({
            'last_message': content,
            'last_message_at': datetime.utcnow(),
            'last_sender_id': sender_id
        })
        
        if FirebaseMessagingService.sio:
            await FirebaseMessagingService.sio.emit('new_dm', message_data, room=chat_id)
        
        return message_data
    
    @staticmethod
    async def get_conversations(user_id: str) -> List[Dict[str, Any]]:
        """Get all DM conversations"""
        db = await FirebaseMessagingService.get_db()
        
        # Query chats where user is participant
        chats = await db.query_documents(
            'chats',
            filters=[('type', '==', 'dm'), ('participants', 'array_contains', user_id)],
            order_by='last_message_at',
            order_direction='DESCENDING',
            limit=50
        )
        
        result = []
        for chat in chats:
            other_id = [p for p in chat['participants'] if p != user_id][0]
            other_user = await db.get_document('users', other_id)
            
            if other_user:
                result.append({
                    "conversation_id": chat['id'],
                    "chat_id": chat['id'],
                    "user": {
                        "id": other_id,
                        "sl_id": other_user.get('sl_id'),
                        "name": other_user['name'],
                        "photo": other_user.get('photo')
                    },
                    "last_message": chat.get('last_message', ''),
                    "last_message_at": chat.get('last_message_at')
                })
        
        return result
    
    @staticmethod
    async def get_direct_messages(
        user_id: str,
        conversation_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get DM messages"""
        db = await FirebaseMessagingService.get_db()
        
        # Verify user is participant
        chat = await db.get_document('chats', conversation_id)
        if not chat or user_id not in chat.get('participants', []):
            raise ValueError("Not authorized")
        
        return await db.get_chat_messages(conversation_id, limit)
