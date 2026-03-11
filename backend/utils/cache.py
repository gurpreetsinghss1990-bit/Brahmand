"""Caching utilities with Redis or in-memory fallback"""
import json
import logging
from typing import Optional, Any, List
from functools import wraps
from datetime import datetime

from config.settings import settings

logger = logging.getLogger(__name__)


class CacheManager:
    """Centralized cache management"""
    
    # Cache key prefixes
    USER_PREFIX = "user"
    COMMUNITY_PREFIX = "community"
    TEMPLE_PREFIX = "temple"
    PANCHANG_PREFIX = "panchang"
    WISDOM_PREFIX = "wisdom"
    STATS_PREFIX = "stats"
    
    def __init__(self):
        self._redis = None
    
    async def _get_redis(self):
        """Lazy load Redis connection"""
        if self._redis is None:
            from config.database import get_redis
            self._redis = await get_redis()
        return self._redis
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            redis = await self._get_redis()
            value = await redis.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.debug(f"Cache get error for {key}: {e}")
        return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: int = None
    ):
        """Set value in cache with optional TTL"""
        if ttl is None:
            ttl = settings.CACHE_TTL
        
        try:
            redis = await self._get_redis()
            serialized = json.dumps(value, default=str)
            await redis.set(key, serialized, ex=ttl)
        except Exception as e:
            logger.debug(f"Cache set error for {key}: {e}")
    
    async def delete(self, key: str):
        """Delete value from cache"""
        try:
            redis = await self._get_redis()
            await redis.delete(key)
        except Exception as e:
            logger.debug(f"Cache delete error for {key}: {e}")
    
    async def delete_pattern(self, pattern: str):
        """Delete all keys matching pattern"""
        try:
            redis = await self._get_redis()
            if hasattr(redis, 'keys'):
                keys = await redis.keys(pattern)
                if keys:
                    await redis.delete(*keys)
        except Exception as e:
            logger.debug(f"Cache delete pattern error for {pattern}: {e}")
    
    # User caching
    async def get_user(self, user_id: str) -> Optional[dict]:
        return await self.get(f"{self.USER_PREFIX}:{user_id}")
    
    async def set_user(self, user_id: str, user_data: dict):
        await self.set(f"{self.USER_PREFIX}:{user_id}", user_data, ttl=300)
    
    async def invalidate_user(self, user_id: str):
        await self.delete(f"{self.USER_PREFIX}:{user_id}")
    
    # Community caching
    async def get_communities(self, user_id: str) -> Optional[List[dict]]:
        return await self.get(f"{self.COMMUNITY_PREFIX}:user:{user_id}")
    
    async def set_communities(self, user_id: str, communities: List[dict]):
        await self.set(f"{self.COMMUNITY_PREFIX}:user:{user_id}", communities, ttl=180)
    
    async def invalidate_user_communities(self, user_id: str):
        await self.delete(f"{self.COMMUNITY_PREFIX}:user:{user_id}")
    
    # Temple caching
    async def get_temples(self) -> Optional[List[dict]]:
        return await self.get(f"{self.TEMPLE_PREFIX}:all")
    
    async def set_temples(self, temples: List[dict]):
        await self.set(f"{self.TEMPLE_PREFIX}:all", temples, ttl=600)
    
    async def invalidate_temples(self):
        await self.delete(f"{self.TEMPLE_PREFIX}:all")
    
    # Panchang caching (cache for whole day)
    async def get_panchang(self) -> Optional[dict]:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        return await self.get(f"{self.PANCHANG_PREFIX}:{today}")
    
    async def set_panchang(self, panchang: dict):
        today = datetime.utcnow().strftime("%Y-%m-%d")
        # Cache until midnight (max 24 hours)
        await self.set(f"{self.PANCHANG_PREFIX}:{today}", panchang, ttl=86400)
    
    # Wisdom caching
    async def get_wisdom(self) -> Optional[dict]:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        return await self.get(f"{self.WISDOM_PREFIX}:{today}")
    
    async def set_wisdom(self, wisdom: dict):
        today = datetime.utcnow().strftime("%Y-%m-%d")
        await self.set(f"{self.WISDOM_PREFIX}:{today}", wisdom, ttl=86400)
    
    # Stats caching
    async def get_community_stats(self, community_id: str) -> Optional[dict]:
        return await self.get(f"{self.STATS_PREFIX}:community:{community_id}")
    
    async def set_community_stats(self, community_id: str, stats: dict):
        await self.set(f"{self.STATS_PREFIX}:community:{community_id}", stats, ttl=60)


# Global cache manager instance
cache_manager = CacheManager()


def cached(key_func, ttl: int = None):
    """Decorator for caching async function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = key_func(*args, **kwargs)
            
            # Try to get from cache
            cached_value = await cache_manager.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache_manager.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator
