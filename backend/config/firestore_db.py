"""Firestore Database Operations Layer"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from google.cloud.firestore_v1 import AsyncClient, FieldFilter, Query
from google.cloud import firestore

logger = logging.getLogger(__name__)


class FirestoreDB:
    """
    Firestore database operations wrapper.
    Provides MongoDB-like interface for easier migration.
    
    Collections:
    - users
    - communities  
    - chats (with subcollection: messages)
    - groups
    - temples
    - events
    - vendors
    """
    
    def __init__(self, client: AsyncClient):
        self.client = client
    
    # =================== COLLECTION REFERENCES ===================
    
    def users(self):
        return self.client.collection('users')
    
    def communities(self):
        return self.client.collection('communities')
    
    def chats(self):
        return self.client.collection('chats')
    
    def groups(self):
        return self.client.collection('groups')
    
    def temples(self):
        return self.client.collection('temples')
    
    def events(self):
        return self.client.collection('events')
    
    def vendors(self):
        return self.client.collection('vendors')
    
    def otps(self):
        return self.client.collection('otps')
    
    def circles(self):
        return self.client.collection('circles')
    
    def notifications(self):
        return self.client.collection('notifications')
    
    def verifications(self):
        return self.client.collection('verifications')
    
    # =================== CHAT MESSAGES (Subcollection) ===================
    
    def chat_messages(self, chat_id: str):
        """Get messages subcollection for a chat"""
        return self.client.collection('chats').document(chat_id).collection('messages')
    
    # =================== GENERIC OPERATIONS ===================
    
    async def create_document(self, collection: str, data: Dict[str, Any], doc_id: str = None) -> str:
        """Create a document in a collection"""
        data['created_at'] = datetime.utcnow()
        data['updated_at'] = datetime.utcnow()
        
        collection_ref = self.client.collection(collection)
        
        if doc_id:
            await collection_ref.document(doc_id).set(data)
            return doc_id
        else:
            doc_ref = await collection_ref.add(data)
            return doc_ref[1].id
    
    async def get_document(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get a document by ID"""
        doc = await self.client.collection(collection).document(doc_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None
    
    async def update_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """Update a document"""
        data['updated_at'] = datetime.utcnow()
        await self.client.collection(collection).document(doc_id).update(data)
        return True
    
    async def delete_document(self, collection: str, doc_id: str) -> bool:
        """Delete a document"""
        await self.client.collection(collection).document(doc_id).delete()
        return True
    
    async def query_documents(
        self, 
        collection: str, 
        filters: List[tuple] = None,
        order_by: str = None,
        order_direction: str = 'ASCENDING',
        limit: int = None
    ) -> List[Dict[str, Any]]:
        """Query documents with filters"""
        query = self.client.collection(collection)
        
        if filters:
            for field, op, value in filters:
                query = query.where(filter=FieldFilter(field, op, value))
        
        if order_by:
            direction = Query.DESCENDING if order_direction == 'DESCENDING' else Query.ASCENDING
            query = query.order_by(order_by, direction=direction)
        
        if limit:
            query = query.limit(limit)
        
        docs = await query.get()
        
        result = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            result.append(data)
        
        return result
    
    async def find_one(self, collection: str, filters: List[tuple]) -> Optional[Dict[str, Any]]:
        """Find a single document matching filters"""
        results = await self.query_documents(collection, filters, limit=1)
        return results[0] if results else None
    
    async def count_documents(self, collection: str, filters: List[tuple] = None) -> int:
        """Count documents matching filters"""
        query = self.client.collection(collection)
        
        if filters:
            for field, op, value in filters:
                query = query.where(filter=FieldFilter(field, op, value))
        
        # Use aggregation for counting
        count_query = query.count()
        result = await count_query.get()
        return result[0][0].value
    
    # =================== USER OPERATIONS ===================
    
    async def create_user(self, user_data: Dict[str, Any]) -> str:
        """Create a new user"""
        return await self.create_document('users', user_data)
    
    async def get_user_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        """Get user by phone number"""
        return await self.find_one('users', [('phone', '==', phone)])
    
    async def get_user_by_sl_id(self, sl_id: str) -> Optional[Dict[str, Any]]:
        """Get user by Sanatan Lok ID"""
        return await self.find_one('users', [('sl_id', '==', sl_id.upper())])
    
    async def update_user(self, user_id: str, data: Dict[str, Any]) -> bool:
        """Update user data"""
        return await self.update_document('users', user_id, data)
    
    # =================== COMMUNITY OPERATIONS ===================
    
    async def get_community_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get community by name"""
        return await self.find_one('communities', [('name', '==', name)])
    
    async def create_community(self, data: Dict[str, Any]) -> str:
        """Create a new community"""
        return await self.create_document('communities', data)
    
    async def add_member_to_community(self, community_id: str, user_id: str):
        """Add a member to community"""
        await self.client.collection('communities').document(community_id).update({
            'members': firestore.ArrayUnion([user_id])
        })
    
    # =================== CHAT OPERATIONS ===================
    
    async def create_chat(self, chat_data: Dict[str, Any]) -> str:
        """Create a new chat"""
        return await self.create_document('chats', chat_data)
    
    async def add_message_to_chat(self, chat_id: str, message_data: Dict[str, Any]) -> str:
        """Add a message to chat's messages subcollection"""
        message_data['created_at'] = datetime.utcnow()
        message_data['timestamp'] = firestore.SERVER_TIMESTAMP
        
        doc_ref = await self.chat_messages(chat_id).add(message_data)
        return doc_ref[1].id
    
    async def get_chat_messages(
        self, 
        chat_id: str, 
        limit: int = 50,
        before_timestamp: datetime = None
    ) -> List[Dict[str, Any]]:
        """Get messages from a chat with pagination"""
        query = self.chat_messages(chat_id).order_by(
            'created_at', direction=Query.DESCENDING
        )
        
        if before_timestamp:
            query = query.where(filter=FieldFilter('created_at', '<', before_timestamp))
        
        query = query.limit(limit)
        
        docs = await query.get()
        
        messages = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            messages.append(data)
        
        return list(reversed(messages))  # Return in chronological order
    
    # =================== REAL-TIME LISTENERS ===================
    
    def on_chat_messages(self, chat_id: str, callback):
        """
        Subscribe to real-time updates for chat messages.
        Returns unsubscribe function.
        """
        def on_snapshot(docs, changes, read_time):
            for change in changes:
                if change.type.name == 'ADDED':
                    data = change.document.to_dict()
                    data['id'] = change.document.id
                    callback('added', data)
                elif change.type.name == 'MODIFIED':
                    data = change.document.to_dict()
                    data['id'] = change.document.id
                    callback('modified', data)
                elif change.type.name == 'REMOVED':
                    callback('removed', {'id': change.document.id})
        
        query = self.chat_messages(chat_id).order_by('created_at')
        return query.on_snapshot(on_snapshot)
