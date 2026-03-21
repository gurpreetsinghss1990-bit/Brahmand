"""Rate limiting middleware"""
import time
import logging
from typing import Dict, Optional
from fastapi import Request, HTTPException
from collections import defaultdict
import asyncio

from config.settings import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """In-memory rate limiter with Redis fallback support"""
    
    def __init__(self):
        self._requests: Dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    async def _cleanup_old_requests(self, key: str, window: int):
        """Remove requests outside the current window"""
        current_time = time.time()
        self._requests[key] = [
            req_time for req_time in self._requests[key]
            if current_time - req_time < window
        ]
    
    async def check_rate_limit(
        self, 
        request: Request, 
        limit: int = None,
        window: int = 60,
        key_prefix: str = "default"
    ) -> bool:
        """Check if request is within rate limit"""
        if limit is None:
            limit = settings.RATE_LIMIT_PER_MINUTE
        
        client_ip = self._get_client_ip(request)
        key = f"{key_prefix}:{client_ip}"
        
        async with self._lock:
            await self._cleanup_old_requests(key, window)
            
            if len(self._requests[key]) >= limit:
                logger.warning(f"Rate limit exceeded for {client_ip} on {key_prefix}")
                return False
            
            self._requests[key].append(time.time())
            return True
    
    async def get_remaining_requests(
        self, 
        request: Request,
        limit: int = None,
        key_prefix: str = "default"
    ) -> int:
        """Get remaining requests in current window"""
        if limit is None:
            limit = settings.RATE_LIMIT_PER_MINUTE
        
        client_ip = self._get_client_ip(request)
        key = f"{key_prefix}:{client_ip}"
        
        async with self._lock:
            await self._cleanup_old_requests(key, 60)
            return max(0, limit - len(self._requests[key]))


# Global rate limiter instance
limiter = RateLimiter()


def get_rate_limit_key(request: Request, endpoint: str = "") -> str:
    """Generate rate limit key for request"""
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
    return f"{endpoint}:{client_ip}"


async def rate_limit_dependency(
    request: Request,
    limit: int = None,
    key_prefix: str = "api"
):
    """FastAPI dependency for rate limiting"""
    allowed = await limiter.check_rate_limit(request, limit, key_prefix=key_prefix)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )
    return True


# Specific rate limiters for different endpoints
async def auth_rate_limit(request: Request):
    """Rate limit for authentication endpoints (stricter)"""
    return await rate_limit_dependency(request, settings.RATE_LIMIT_AUTH, "auth")


async def messaging_rate_limit(request: Request):
    """Rate limit for messaging endpoints"""
    return await rate_limit_dependency(request, settings.RATE_LIMIT_MESSAGING, "messaging")
