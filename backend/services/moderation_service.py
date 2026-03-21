"""Moderation Service"""
import logging
import re
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

from config.database import get_database
from utils.helpers import serialize_doc

logger = logging.getLogger(__name__)


class ModerationService:
    """Handles content moderation operations"""
    
    # Blocked keywords and patterns
    BLOCKED_KEYWORDS = [
        "spam", "scam", "fraud", "abuse", "hack", "porn", "xxx",
        "casino", "gambling", "betting", "lottery"
    ]
    
    BLOCKED_PATTERNS = [
        r'\b(\+?\d{10,})\b',  # Phone numbers (suspicious)
        r'https?://(?!.*(?:youtube|youtu\.be|twitter|instagram|facebook))\S+',  # Suspicious URLs
    ]
    
    # Moderation actions
    ACTION_WARN = "warn"
    ACTION_DELETE = "delete"
    ACTION_MUTE = "mute"
    ACTION_BAN = "ban"
    
    @staticmethod
    def check_content(content: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Check content for violations.
        Returns: (is_allowed, reason, severity)
        """
        content_lower = content.lower()
        
        # Check blocked keywords
        for keyword in ModerationService.BLOCKED_KEYWORDS:
            if keyword in content_lower:
                return False, f"Content contains inappropriate language", "high"
        
        # Check blocked patterns
        for pattern in ModerationService.BLOCKED_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                return False, "Content contains suspicious patterns", "medium"
        
        # Check for excessive caps (shouting)
        if len(content) > 20:
            caps_ratio = sum(1 for c in content if c.isupper()) / len(content)
            if caps_ratio > 0.7:
                return True, "Consider using less caps", "low"  # Allow but warn
        
        return True, None, None
    
    @staticmethod
    async def report_content(
        reporter_id: str,
        content_type: str,  # message, user, community
        content_id: str,
        reason: str,
        additional_info: Optional[str] = None
    ) -> Dict[str, Any]:
        """Report content for moderation review"""
        db = await get_database()
        
        report = {
            "reporter_id": reporter_id,
            "content_type": content_type,
            "content_id": content_id,
            "reason": reason,
            "additional_info": additional_info,
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        
        result = await db.reports.insert_one(report)
        report["_id"] = result.inserted_id
        
        logger.info(f"Content reported: {content_type}/{content_id} by {reporter_id}")
        return serialize_doc(report)
    
    @staticmethod
    async def get_pending_reports(limit: int = 50) -> List[Dict[str, Any]]:
        """Get pending moderation reports (admin only)"""
        db = await get_database()
        reports = await db.reports.find({
            "status": "pending"
        }).sort("created_at", -1).limit(limit).to_list(limit)
        
        return [serialize_doc(r) for r in reports]
    
    @staticmethod
    async def resolve_report(
        report_id: str,
        moderator_id: str,
        action: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Resolve a moderation report"""
        db = await get_database()
        
        await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {
                "$set": {
                    "status": "resolved",
                    "moderator_id": moderator_id,
                    "action_taken": action,
                    "notes": notes,
                    "resolved_at": datetime.utcnow()
                }
            }
        )
        
        # Take action based on resolution
        report = await db.reports.find_one({"_id": ObjectId(report_id)})
        if report and action in [ModerationService.ACTION_DELETE, ModerationService.ACTION_BAN]:
            await ModerationService._execute_action(
                report["content_type"],
                report["content_id"],
                action
            )
        
        return {"message": f"Report resolved with action: {action}"}
    
    @staticmethod
    async def _execute_action(content_type: str, content_id: str, action: str):
        """Execute moderation action"""
        db = await get_database()
        
        if action == ModerationService.ACTION_DELETE:
            if content_type == "message":
                await db.messages.update_one(
                    {"_id": ObjectId(content_id)},
                    {"$set": {"deleted": True, "content": "[Content removed by moderator]"}}
                )
            elif content_type == "direct_message":
                await db.direct_messages.update_one(
                    {"_id": ObjectId(content_id)},
                    {"$set": {"deleted": True, "content": "[Content removed by moderator]"}}
                )
        
        elif action == ModerationService.ACTION_BAN:
            if content_type == "user":
                await db.users.update_one(
                    {"_id": ObjectId(content_id)},
                    {"$set": {"is_banned": True, "banned_at": datetime.utcnow()}}
                )
    
    @staticmethod
    async def get_user_violations(user_id: str) -> List[Dict[str, Any]]:
        """Get violation history for a user"""
        db = await get_database()
        
        # Get reports against user
        reports = await db.reports.find({
            "content_type": "user",
            "content_id": user_id,
            "status": "resolved"
        }).sort("resolved_at", -1).to_list(50)
        
        return [serialize_doc(r) for r in reports]
    
    @staticmethod
    async def auto_moderate_message(content: str, user_id: str) -> Tuple[bool, Optional[str]]:
        """
        Automatically moderate a message before posting.
        Returns: (is_allowed, reason)
        """
        is_allowed, reason, severity = ModerationService.check_content(content)
        
        if not is_allowed:
            db = await get_database()
            # Log the violation
            await db.moderation_logs.insert_one({
                "user_id": user_id,
                "content_preview": content[:100],
                "reason": reason,
                "severity": severity,
                "action": "blocked",
                "created_at": datetime.utcnow()
            })
        
        return is_allowed, reason
