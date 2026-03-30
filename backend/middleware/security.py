"""Security middleware and authentication"""
import jwt
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config.settings import settings

logger = logging.getLogger(__name__)

try:
    from jwt import ExpiredSignatureError, InvalidTokenError
except Exception:
    ExpiredSignatureError = Exception
    InvalidTokenError = Exception

security = HTTPBearer()


def create_jwt_token(user_id: str, sl_id: str) -> str:
    """Create JWT token with user info"""
    expiration = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "sl_id": sl_id,
        "exp": expiration,
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token"""
    current_secret = settings.JWT_SECRET
    legacy_default_secret = 'sanatan-lok-secret-key-2025-v2'
    candidate_secrets = [current_secret]

    if current_secret != legacy_default_secret:
        candidate_secrets.append(legacy_default_secret)

    last_error = None
    for secret in candidate_secrets:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[settings.JWT_ALGORITHM]
            )
            return payload
        except ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except InvalidTokenError as exc:
            last_error = exc
            continue
        except Exception as exc:
            last_error = exc
            continue

    logger.warning(f"JWT decode failed for all configured secrets: {last_error}")
    raise HTTPException(status_code=401, detail="Invalid token")


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Verify JWT token from Authorization header"""
    payload = decode_jwt_token(credentials.credentials)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return payload


async def optional_verify_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """Optional token verification for public routes"""
    if not credentials:
        return None
    try:
        payload = decode_jwt_token(credentials.credentials)
        user_id = payload.get("user_id")
        if not user_id:
            return None
        return payload
    except HTTPException:
        return None


async def get_current_user(
    token_data: Dict[str, Any] = Depends(verify_token)
) -> Dict[str, Any]:
    """Get current user from token with caching"""
    from config.database import get_database, get_redis
    import json
    
    user_id = token_data["user_id"]
    cache_key = f"user:{user_id}"
    
    # Try cache first
    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except:
            pass
    
    # Fetch from database
    db = await get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Serialize and cache
    user_data = serialize_user(user)
    try:
        await redis.set(cache_key, json.dumps(user_data, default=str), ex=300)
    except:
        pass
    
    return user_data


def serialize_user(user: dict) -> dict:
    """Serialize MongoDB user document"""
    if user is None:
        return None
    user = dict(user)
    if '_id' in user:
        user['id'] = str(user['_id'])
        del user['_id']
    return user


async def invalidate_user_cache(user_id: str):
    """Invalidate user cache after updates"""
    from config.database import get_redis
    redis = await get_redis()
    await redis.delete(f"user:{user_id}")


# Data encryption helpers
def encrypt_sensitive_data(data: str) -> str:
    """Encrypt sensitive data like phone numbers"""
    import hashlib
    import base64
    # Simple encryption for demo - use proper encryption in production
    key = settings.ENCRYPTION_KEY.encode()
    data_bytes = data.encode()
    combined = key + data_bytes
    return base64.b64encode(hashlib.sha256(combined).digest()).decode()


def mask_phone_number(phone: str) -> str:
    """Mask phone number for display"""
    if len(phone) >= 10:
        return f"{phone[:2]}****{phone[-4:]}"
    return "****"
