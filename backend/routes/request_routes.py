"""
Community Request Routes
API endpoints for community help request operations.

These routes are supplementary to the existing endpoints in main.py.
They can be used for alternative URL patterns or future expansion.

Existing endpoints in main.py:
- POST /api/community-requests
- GET /api/community-requests
- GET /api/community-requests/my
- POST /api/community-requests/{request_id}/resolve
- DELETE /api/community-requests/{request_id}
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import logging

# Import from parent package
import sys
sys.path.append('/app/backend')

from models.request_model import (
    CreateRequestInput,
    RequestType,
    RequestStatus
)
from services.request_service import (
    create_request,
    get_community_requests,
    get_user_requests,
    mark_request_fulfilled,
    verify_request,
    delete_request,
    ActiveRequestExistsError,
    RequestNotFoundError,
    UnauthorizedError
)

logger = logging.getLogger(__name__)

# Create router for community-specific request endpoints
request_router = APIRouter(prefix="/communities", tags=["community-requests"])


# Note: These routes require integration with main.py's verify_token and get_db
# They are provided as a modular alternative to the existing endpoints

"""
To integrate these routes, add to main.py:

from routes.request_routes import request_router
api_router.include_router(request_router)

Endpoints provided:

POST /communities/{community_id}/requests
    Create a new request in a specific community

GET /communities/{community_id}/requests
    List all active requests in a community

PATCH /requests/{request_id}/fulfilled
    Mark a request as fulfilled

POST /requests/{request_id}/verify
    Verify a request
"""


# Socket event emitters (to be called when socket service is available)
async def emit_new_request(socket_manager, community_id: str, request: dict):
    """
    Emit real-time event when new request is created.
    
    Event: community:new_request
    Payload: { community_id, request }
    """
    if socket_manager:
        await socket_manager.emit(
            'community:new_request',
            {
                'community_id': community_id,
                'request': request
            },
            room=f'community_{community_id}'
        )


async def emit_request_fulfilled(socket_manager, request_id: str):
    """
    Emit real-time event when request is fulfilled.
    
    Event: community:request_fulfilled
    Payload: { request_id }
    """
    if socket_manager:
        await socket_manager.emit(
            'community:request_fulfilled',
            {'request_id': request_id}
        )


# Route definitions (require dependency injection from main.py)
"""
Example route implementation:

@request_router.post("/{community_id}/requests")
async def create_community_request(
    community_id: str,
    data: CreateRequestInput,
    db = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    try:
        user_id = token_data["user_id"]
        user = await db.get_document('users', user_id)
        
        request_data = data.dict()
        request_data['community_id'] = community_id
        
        result = await create_request(db, user_id, user, request_data)
        
        # Emit real-time event
        await emit_new_request(socket_manager, community_id, result)
        
        return result
        
    except ActiveRequestExistsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating request: {e}")
        raise HTTPException(status_code=500, detail="Failed to create request")


@request_router.get("/{community_id}/requests")
async def list_community_requests(
    community_id: str,
    request_type: Optional[str] = None,
    limit: int = 50,
    db = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    return await get_community_requests(
        db,
        community_id=community_id,
        request_type=request_type,
        status="active",
        limit=limit
    )
"""

print("Request routes module loaded. Routes are available for integration with main.py")
