"""
Community Request Service
Business logic for community help request operations.

This service provides functions for:
- Creating requests (with one-active-per-user validation)
- Fetching community requests
- Marking requests as fulfilled
- Verifying requests

Integrates with Firestore database via the existing db module.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Valid request types
VALID_REQUEST_TYPES = ["help", "blood", "medical", "financial", "petition"]


class RequestServiceError(Exception):
    """Custom exception for request service errors"""
    pass


class ActiveRequestExistsError(RequestServiceError):
    """Raised when user already has an active request"""
    pass


class RequestNotFoundError(RequestServiceError):
    """Raised when request is not found"""
    pass


class UnauthorizedError(RequestServiceError):
    """Raised when user is not authorized for the action"""
    pass


async def create_request(
    db,
    user_id: str,
    user_info: Dict[str, Any],
    request_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create a new community request.
    
    Rules:
    1. User can only have ONE active request at a time
    2. Request type must be valid (help, blood, medical, financial, petition)
    3. Status is set to 'active' automatically
    
    Args:
        db: Database instance
        user_id: ID of the requesting user
        user_info: User document with name, phone, sl_id
        request_data: Request details
    
    Returns:
        Created request document
    
    Raises:
        ActiveRequestExistsError: If user already has an active request
        ValueError: If request_type is invalid
    """
    # Validate request type
    request_type = request_data.get('request_type', '').lower()
    if request_type not in VALID_REQUEST_TYPES:
        raise ValueError(f"Invalid request type. Must be one of: {VALID_REQUEST_TYPES}")
    
    # Check for existing active request
    existing_active = await db.find_one('community_requests', [
        ('user_id', '==', user_id),
        ('status', '==', 'active')
    ])
    
    if existing_active:
        raise ActiveRequestExistsError(
            "You already have an active request. Please mark it as fulfilled before creating a new one."
        )
    
    # Prepare request document
    request_doc = {
        'user_id': user_id,
        'user_name': user_info.get('name', 'Anonymous'),
        'user_phone': user_info.get('phone'),
        'user_sl_id': user_info.get('sl_id'),
        'community_id': request_data.get('community_id'),
        'request_type': request_type,
        'title': request_data.get('title', f'{request_type.capitalize()} Request'),
        'description': request_data.get('description', ''),
        'contact_number': request_data.get('contact_number'),
        'urgency_level': request_data.get('urgency_level', 'low'),
        'visibility_level': request_data.get('visibility_level', 'area'),
        'status': 'active',
        'created_at': datetime.utcnow().isoformat(),
        'fulfilled_at': None,
        'verified_by': [],
        # Type-specific fields
        'blood_group': request_data.get('blood_group'),
        'hospital_name': request_data.get('hospital_name'),
        'location': request_data.get('location'),
        'amount': request_data.get('amount'),
        'support_needed': request_data.get('support_needed'),
        'contact_person_name': request_data.get('contact_person_name'),
    }
    
    # Create document in database
    request_id = await db.create_document('community_requests', request_doc)
    request_doc['id'] = request_id
    
    logger.info(f"Community request created by {user_id}: {request_type} - {request_doc['title']}")
    
    return request_doc


async def get_community_requests(
    db,
    community_id: Optional[str] = None,
    request_type: Optional[str] = None,
    status: str = "active",
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Fetch community requests with filters.
    
    Args:
        db: Database instance
        community_id: Optional community filter
        request_type: Optional type filter (help, blood, etc.)
        status: Status filter (default: active)
        limit: Maximum results to return
    
    Returns:
        List of request documents sorted by created_at DESC
    """
    filters = []
    
    if community_id:
        filters.append(('community_id', '==', community_id))
    
    if request_type and request_type in VALID_REQUEST_TYPES:
        filters.append(('request_type', '==', request_type))
    
    if status:
        filters.append(('status', '==', status))
    
    requests = await db.query_documents(
        'community_requests',
        filters=filters,
        limit=limit
    )
    
    # Sort by created_at DESC
    requests.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return requests


async def get_user_requests(
    db,
    user_id: str,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get all requests created by a specific user.
    
    Args:
        db: Database instance
        user_id: User ID
        status: Optional status filter
    
    Returns:
        List of user's requests
    """
    filters = [('user_id', '==', user_id)]
    
    if status:
        filters.append(('status', '==', status))
    
    return await db.query_documents('community_requests', filters=filters)


async def mark_request_fulfilled(
    db,
    request_id: str,
    user_id: str
) -> Dict[str, Any]:
    """
    Mark a request as fulfilled.
    
    Rules:
    1. Only the creator can mark their request as fulfilled
    2. Updates status to 'fulfilled' and sets fulfilled_at timestamp
    
    Args:
        db: Database instance
        request_id: ID of the request to fulfill
        user_id: ID of the user making the request
    
    Returns:
        Updated request document
    
    Raises:
        RequestNotFoundError: If request doesn't exist
        UnauthorizedError: If user is not the creator
    """
    # Get the request
    request = await db.get_document('community_requests', request_id)
    
    if not request:
        raise RequestNotFoundError(f"Request {request_id} not found")
    
    # Verify ownership
    if request.get('user_id') != user_id:
        raise UnauthorizedError("Only the request creator can mark it as fulfilled")
    
    # Update status
    update_data = {
        'status': 'fulfilled',
        'fulfilled_at': datetime.utcnow().isoformat()
    }
    
    await db.update_document('community_requests', request_id, update_data)
    
    logger.info(f"Request {request_id} marked as fulfilled by {user_id}")
    
    request.update(update_data)
    return request


async def verify_request(
    db,
    request_id: str,
    verifier_user_id: str
) -> Dict[str, Any]:
    """
    Add a verification to a request.
    
    Appends the verifier's user ID to the verified_by array.
    
    Args:
        db: Database instance
        request_id: ID of the request to verify
        verifier_user_id: ID of the verifying user
    
    Returns:
        Updated request document
    
    Raises:
        RequestNotFoundError: If request doesn't exist
    """
    # Get the request
    request = await db.get_document('community_requests', request_id)
    
    if not request:
        raise RequestNotFoundError(f"Request {request_id} not found")
    
    # Get current verifiers
    verified_by = request.get('verified_by', [])
    
    # Add verifier if not already present
    if verifier_user_id not in verified_by:
        verified_by.append(verifier_user_id)
        await db.update_document('community_requests', request_id, {'verified_by': verified_by})
        logger.info(f"Request {request_id} verified by {verifier_user_id}")
    
    request['verified_by'] = verified_by
    return request


async def delete_request(
    db,
    request_id: str,
    user_id: str
) -> bool:
    """
    Delete a request.
    
    Only the creator can delete their request.
    
    Args:
        db: Database instance
        request_id: ID of the request to delete
        user_id: ID of the user making the request
    
    Returns:
        True if deleted successfully
    
    Raises:
        RequestNotFoundError: If request doesn't exist
        UnauthorizedError: If user is not the creator
    """
    request = await db.get_document('community_requests', request_id)
    
    if not request:
        raise RequestNotFoundError(f"Request {request_id} not found")
    
    if request.get('user_id') != user_id:
        raise UnauthorizedError("Only the request creator can delete it")
    
    await db.delete_document('community_requests', request_id)
    logger.info(f"Request {request_id} deleted by {user_id}")
    
    return True
