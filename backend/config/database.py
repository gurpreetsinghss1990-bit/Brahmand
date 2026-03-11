"""Database connections and pooling"""
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import asyncio

from .settings import settings

logger = logging.getLogger(__name__)

# Global database client
_mongo_client: Optional[AsyncIOMotorClient] = None
_redis_client = None


class DatabaseManager:
    """Manages database connections with pooling"""
    
    def __init__(self):
        self.mongo_client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self.redis = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize database connections"""
        if self._initialized:
            return
        
        # MongoDB connection with connection pooling
        self.mongo_client = AsyncIOMotorClient(
            settings.MONGO_URL,
            maxPoolSize=settings.MAX_CONNECTIONS,
            minPoolSize=10,
            maxIdleTimeMS=30000,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
        )
        self.db = self.mongo_client[settings.DB_NAME]
        
        # Initialize Redis (optional - graceful fallback)
        try:
            import redis.asyncio as aioredis
            self.redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding='utf-8',
                decode_responses=True,
                max_connections=20
            )
            # Test connection
            await self.redis.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis not available, using in-memory cache: {e}")
            self.redis = InMemoryCache()
        
        # Create indexes for better performance
        await self._create_indexes()
        
        self._initialized = True
        logger.info("Database connections initialized")
    
    async def _create_indexes(self):
        """Create database indexes for optimized queries"""
        try:
            # Users collection indexes
            await self.db.users.create_index("phone", unique=True)
            await self.db.users.create_index("sl_id", unique=True)
            await self.db.users.create_index("communities")
            await self.db.users.create_index("circles")
            
            # Messages collection indexes
            await self.db.messages.create_index([
                ("community_id", 1),
                ("subgroup_type", 1),
                ("created_at", -1)
            ])
            await self.db.messages.create_index("created_at")
            
            # Circle messages
            await self.db.circle_messages.create_index([
                ("circle_id", 1),
                ("created_at", -1)
            ])
            
            # Direct messages
            await self.db.direct_messages.create_index([
                ("conversation_id", 1),
                ("created_at", -1)
            ])
            
            # Communities
            await self.db.communities.create_index("name", unique=True)
            await self.db.communities.create_index("code")
            await self.db.communities.create_index("type")
            
            # Circles
            await self.db.circles.create_index("code", unique=True)
            await self.db.circles.create_index("admin_id")
            
            # Temples
            await self.db.temples.create_index("temple_id", unique=True)
            await self.db.temples.create_index("follower_count")
            await self.db.temples.create_index([("location.city", 1)])
            
            # Events
            await self.db.events.create_index("date")
            await self.db.events.create_index([("location.city", 1)])
            await self.db.events.create_index("event_type")
            
            # OTPs (with TTL)
            await self.db.otps.create_index("phone")
            await self.db.otps.create_index(
                "expires_at",
                expireAfterSeconds=0
            )
            
            logger.info("Database indexes created successfully")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")
    
    async def close(self):
        """Close database connections"""
        if self.mongo_client:
            self.mongo_client.close()
        if self.redis and hasattr(self.redis, 'close'):
            await self.redis.close()
        self._initialized = False
        logger.info("Database connections closed")


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
