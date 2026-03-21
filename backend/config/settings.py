"""Application Settings and Configuration"""
import os
from pathlib import Path
from dotenv import load_dotenv
from functools import lru_cache

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')


class Settings:
    """Application settings with environment variable support"""
    
    # Application
    APP_NAME: str = "Sanatan Lok API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'
    
    # Database
    MONGO_URL: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME: str = os.environ.get('DB_NAME', 'sanatan_lok')
    
    # Redis (for caching)
    REDIS_URL: str = os.environ.get('REDIS_URL', 'redis://localhost:6379')
    CACHE_TTL: int = int(os.environ.get('CACHE_TTL', 300))  # 5 minutes default
    
    # JWT Configuration
    JWT_SECRET: str = os.environ.get('JWT_SECRET', 'sanatan-lok-secret-key-2025-v2')
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 720  # 30 days
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.environ.get('RATE_LIMIT', 60))
    RATE_LIMIT_AUTH: int = 10  # Auth endpoints
    RATE_LIMIT_MESSAGING: int = 30  # Message sending
    
    # Security
    ENCRYPTION_KEY: str = os.environ.get('ENCRYPTION_KEY', 'sanatan-lok-encryption-key')
    
    # Performance
    MAX_CONNECTIONS: int = int(os.environ.get('MAX_CONNECTIONS', 100))
    WORKER_COUNT: int = int(os.environ.get('WORKER_COUNT', 4))
    
    # WebSocket
    WS_PING_INTERVAL: int = 25
    WS_PING_TIMEOUT: int = 20
    
    # Logging
    LOG_LEVEL: str = os.environ.get('LOG_LEVEL', 'INFO')


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
