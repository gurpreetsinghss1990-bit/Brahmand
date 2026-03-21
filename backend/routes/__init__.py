from .auth_routes import router as auth_router
from .user_routes import router as user_router
from .community_routes import router as community_router
from .messaging_routes import router as messaging_router
from .temple_routes import router as temple_router
from .event_routes import router as event_router
from .circle_routes import router as circle_router

__all__ = [
    'auth_router',
    'user_router', 
    'community_router',
    'messaging_router',
    'temple_router',
    'event_router',
    'circle_router'
]
