"""Firestore Database Operations Layer using Sync Client"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
import asyncio
from functools import partial

logger = logging.getLogger(__name__)


class FirestoreDB:
    """
    Firestore database operations wrapper using sync client.
    Uses run_in_executor for async operations.
    
    Collections:
    - users
    - communities  
    - chats (with subcollection: messages)
    - groups / circles
    - temples
    - events
    - vendors
    - otps
    - notifications
    """
    
    def __init__(self, client):
        self.client = client
        self._loop = None
    
    def _get_loop(self):
        if self._loop is None:
            self._loop = asyncio.get_event_loop()
        return self._loop
    
    async def _run_sync(self, func, *args, **kwargs):
        """Run sync function in executor"""
        loop = self._get_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))
    
    # =================== GENERIC OPERATIONS ===================
    
    async def create_document(self, collection: str, data: Dict[str, Any], doc_id: str = None) -> str:
        """Create a document in a collection"""
        data['created_at'] = datetime.utcnow()
        data['updated_at'] = datetime.utcnow()
        
        def _create():
            coll = self.client.collection(collection)
            if doc_id:
                coll.document(doc_id).set(data)
                return doc_id
            else:
                _, doc_ref = coll.add(data)
                return doc_ref.id
        
        return await self._run_sync(_create)
    
    async def get_document(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get a document by ID"""
        def _get():
            doc = self.client.collection(collection).document(doc_id).get()
            if doc.exists:
                data = doc.to_dict()
                data['id'] = doc.id
                return data
            return None
        
        return await self._run_sync(_get)
    
    async def update_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """Update a document"""
        data['updated_at'] = datetime.utcnow()
        
        def _update():
            self.client.collection(collection).document(doc_id).update(data)
            return True
        
        return await self._run_sync(_update)
    
    async def delete_document(self, collection: str, doc_id: str) -> bool:
        """Delete a document"""
        def _delete():
            self.client.collection(collection).document(doc_id).delete()
            return True
        
        return await self._run_sync(_delete)
    
    async def query_documents(
        self, 
        collection: str, 
        filters: List[tuple] = None,
        order_by: str = None,
        order_direction: str = 'ASCENDING',
        limit: int = None
    ) -> List[Dict[str, Any]]:
        """Query documents with filters"""
        def _query():
            from google.cloud.firestore_v1.base_query import FieldFilter
            from google.cloud import firestore
            
            query = self.client.collection(collection)
            
            if filters:
                for field, op, value in filters:
                    query = query.where(filter=FieldFilter(field, op, value))
            
            if order_by:
                direction = firestore.Query.DESCENDING if order_direction == 'DESCENDING' else firestore.Query.ASCENDING
                query = query.order_by(order_by, direction=direction)
            
            if limit:
                query = query.limit(limit)
            
            docs = query.stream()
            
            result = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                result.append(data)
            
            return result
        
        return await self._run_sync(_query)
    
    async def find_one(self, collection: str, filters: List[tuple]) -> Optional[Dict[str, Any]]:
        """Find a single document matching filters"""
        results = await self.query_documents(collection, filters, limit=1)
        return results[0] if results else None
    
    async def count_documents(self, collection: str, filters: List[tuple] = None) -> int:
        """Count documents matching filters"""
        def _count():
            from google.cloud.firestore_v1.base_query import FieldFilter
            
            query = self.client.collection(collection)
            
            if filters:
                for field, op, value in filters:
                    query = query.where(filter=FieldFilter(field, op, value))
            
            # Stream and count
            return sum(1 for _ in query.stream())
        
        return await self._run_sync(_count)
    
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
        def _add():
            from google.cloud import firestore
            self.client.collection('communities').document(community_id).update({
                'members': firestore.ArrayUnion([user_id])
            })
        
        await self._run_sync(_add)
    
    async def array_union_update(self, collection: str, doc_id: str, field: str, values: list):
        """Update a document field with ArrayUnion"""
        def _update():
            from google.cloud import firestore
            self.client.collection(collection).document(doc_id).update({
                field: firestore.ArrayUnion(values)
            })
        
        await self._run_sync(_update)
    
    async def set_document(self, collection: str, doc_id: str, data: Dict[str, Any]):
        """Set a document with specific ID"""
        data['created_at'] = datetime.utcnow()
        data['updated_at'] = datetime.utcnow()
        
        def _set():
            self.client.collection(collection).document(doc_id).set(data)
        
        await self._run_sync(_set)
    
    # =================== CHAT OPERATIONS ===================
    
    async def create_chat(self, chat_data: Dict[str, Any], chat_id: str = None) -> str:
        """Create a new chat"""
        if chat_id:
            def _create():
                self.client.collection('chats').document(chat_id).set(chat_data)
                return chat_id
            return await self._run_sync(_create)
        return await self.create_document('chats', chat_data)
    
    async def add_message_to_chat(self, chat_id: str, message_data: Dict[str, Any]) -> str:
        """Add a message to chat's messages subcollection"""
        from google.cloud import firestore
        
        message_data['created_at'] = datetime.utcnow()
        message_data['timestamp'] = firestore.SERVER_TIMESTAMP
        
        def _add():
            _, doc_ref = self.client.collection('chats').document(chat_id).collection('messages').add(message_data)
            return doc_ref.id
        
        return await self._run_sync(_add)
    
    async def get_chat_messages(
        self, 
        chat_id: str, 
        limit: int = 50,
        before_timestamp: datetime = None
    ) -> List[Dict[str, Any]]:
        """Get messages from a chat with pagination"""
        def _get():
            from google.cloud import firestore
            from google.cloud.firestore_v1.base_query import FieldFilter
            
            query = self.client.collection('chats').document(chat_id).collection('messages')
            query = query.order_by('created_at', direction=firestore.Query.DESCENDING)
            
            if before_timestamp:
                query = query.where(filter=FieldFilter('created_at', '<', before_timestamp))
            
            query = query.limit(limit)
            
            messages = []
            for doc in query.stream():
                data = doc.to_dict()
                data['id'] = doc.id
                messages.append(data)
            
            return list(reversed(messages))  # Chronological order
        
        return await self._run_sync(_get)
