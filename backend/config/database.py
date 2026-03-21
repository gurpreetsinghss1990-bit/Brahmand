"""Database connections and pooling configured for Firestore"""
import logging
import os
import time
from typing import Optional
from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore

from .settings import settings

logger = logging.getLogger(__name__)

class InMemoryCache:
    """In-memory cache fallback when Redis is not available"""
    
    def __init__(self):
        self._cache = {}
        self._expiry = {}
    
    async def get(self, key: str) -> Optional[str]:
        import time
        if key in self._cache:
            if key in self._expiry and time.time() > self._expiry[key]:
                del self._cache[key]
                del self._expiry[key]
                return None
            return self._cache[key]
        return None
    
    async def set(self, key: str, value: str, ex: int = None):
        import time
        self._cache[key] = value
        if ex:
            self._expiry[key] = time.time() + ex
    
    async def delete(self, key: str):
        if key in self._cache:
            del self._cache[key]
        if key in self._expiry:
            del self._expiry[key]
    
    async def ping(self):
        return True
    
    async def flushdb(self):
        self._cache.clear()
        self._expiry.clear()

class DatabaseManager:
    """Manages database connections"""
    
    def __init__(self):
        self.db = None
        self.redis = InMemoryCache()
        self._initialized = False
    
    async def initialize(self):
        """Initialize Firestore database connections"""
        if self._initialized:
            return
            
        try:
            firebase_admin.get_app()
        except ValueError:
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./firebase.json")
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                logger.warning(f"Using default credentials. Could not find: {cred_path}")
                firebase_admin.initialize_app()
                
        self.db = admin_firestore.client()
        
        self._initialized = True
        logger.info("Firestore connection initialized")
    
    async def close(self):
        """Close database connections"""
        self._initialized = False
        logger.info("Database connections logically closed (Firestore relies on grpc channels)")

# Singleton instance
db_manager = DatabaseManager()

async def get_database():
    """Get database instance"""
    if not db_manager._initialized:
        await db_manager.initialize()
    return db_manager.db

async def get_redis():
    """Get Redis/cache instance"""
    if not db_manager._initialized:
        await db_manager.initialize()
    return db_manager.redis

def get_db_manager():
    """Get database manager instance"""
    return db_manager
