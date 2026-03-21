"""Circle Routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from datetime import datetime

from models.schemas import CircleCreate, CircleJoin, CircleInvite
from middleware.security import verify_token
from config.database import get_database
from utils.helpers import generate_circle_code, serialize_doc

router = APIRouter(prefix="/circles", tags=["Circles"])


@router.post("")
async def create_circle(
    circle_data: CircleCreate,
    token_data: dict = Depends(verify_token)
):
    """Create a new circle (private group)"""
    db = await get_database()
    user_id = token_data["user_id"]
    
    code = generate_circle_code(circle_data.name)
    while await db.circles.find_one({"code": code}):
        code = generate_circle_code(circle_data.name)
    
    circle = {
        "name": circle_data.name,
        "code": code,
        "admin_id": user_id,
        "members": [user_id],
        "created_at": datetime.utcnow()
    }
    
    result = await db.circles.insert_one(circle)
    circle_id = str(result.inserted_id)
    
    # Add circle to user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"circles": circle_id}}
    )
    
    return {
        "id": circle_id,
        "name": circle["name"],
        "code": circle["code"],
        "admin_id": user_id,
        "member_count": 1,
        "created_at": circle["created_at"]
    }


@router.get("")
async def get_user_circles(token_data: dict = Depends(verify_token)):
    """Get all circles user belongs to"""
    db = await get_database()
    user = await db.users.find_one({"_id": ObjectId(token_data["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    circle_ids = user.get("circles", [])
    circles = []
    
    for cid in circle_ids:
        try:
            circle = await db.circles.find_one({"_id": ObjectId(cid)})
            if circle:
                circles.append({
                    "id": str(circle["_id"]),
                    "name": circle["name"],
                    "code": circle["code"],
                    "admin_id": circle["admin_id"],
                    "member_count": len(circle.get("members", [])),
                    "created_at": circle["created_at"]
                })
        except Exception:
            pass
    
    return circles


@router.post("/join")
async def join_circle(
    data: CircleJoin,
    token_data: dict = Depends(verify_token)
):
    """Request to join a circle using code"""
    db = await get_database()
    code = data.code.upper()
    circle = await db.circles.find_one({"code": code})
    if not circle:
        raise HTTPException(status_code=404, detail="Invalid circle code")
    
    user_id = token_data["user_id"]
    circle_id = str(circle["_id"])
    
    # Check if already member
    if user_id in circle.get("members", []):
        raise HTTPException(status_code=400, detail="Already a member")
    
    # Add join request
    await db.circle_requests.update_one(
        {"circle_id": circle_id, "user_id": user_id},
        {"$set": {
            "circle_id": circle_id,
            "user_id": user_id,
            "status": "pending",
            "created_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    return {"message": "Join request sent", "circle": circle["name"]}


@router.get("/{circle_id}/requests")
async def get_circle_requests(
    circle_id: str,
    token_data: dict = Depends(verify_token)
):
    """Get pending join requests (admin only)"""
    db = await get_database()
    circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    
    if circle["admin_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can view requests")
    
    requests = await db.circle_requests.find({
        "circle_id": circle_id,
        "status": "pending"
    }).to_list(100)
    
    result = []
    for req in requests:
        user = await db.users.find_one({"_id": ObjectId(req["user_id"])})
        if user:
            result.append({
                "request_id": str(req["_id"]),
                "user_id": req["user_id"],
                "user_name": user["name"],
                "user_sl_id": user["sl_id"],
                "created_at": req["created_at"]
            })
    
    return result


@router.post("/{circle_id}/approve")
async def approve_circle_request(
    circle_id: str,
    data: Dict[str, Any],
    token_data: dict = Depends(verify_token)
):
    """Approve a join request (admin only)"""
    db = await get_database()
    circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    
    if circle["admin_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can approve")
    
    user_id = data.get("user_id")
    
    # Add member
    await db.circles.update_one(
        {"_id": ObjectId(circle_id)},
        {"$addToSet": {"members": user_id}}
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"circles": circle_id}}
    )
    
    # Update request status
    await db.circle_requests.update_one(
        {"circle_id": circle_id, "user_id": user_id},
        {"$set": {"status": "approved"}}
    )
    
    return {"message": "Member approved"}


@router.post("/{circle_id}/invite")
async def invite_to_circle(
    circle_id: str,
    data: CircleInvite,
    token_data: dict = Depends(verify_token)
):
    """Invite user to circle by SL ID (admin only)"""
    db = await get_database()
    circle = await db.circles.find_one({"_id": ObjectId(circle_id)})
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    
    if circle["admin_id"] != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Only admin can invite")
    
    # Find user by SL ID
    user = await db.users.find_one({"sl_id": data.sl_id.upper()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    # Add directly
    await db.circles.update_one(
        {"_id": ObjectId(circle_id)},
        {"$addToSet": {"members": user_id}}
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"circles": circle_id}}
    )
    
    return {"message": f"Invited {user['name']} to circle"}
