"""Background task processing using asyncio"""
import asyncio
import logging
from typing import Callable, Any, Dict, List
from datetime import datetime
from collections import deque

logger = logging.getLogger(__name__)


class TaskQueue:
    """
    Simple async task queue for background processing.
    In production, replace with Celery + Redis or similar.
    """
    
    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.queue: deque = deque()
        self.workers: List[asyncio.Task] = []
        self.running = False
        self._lock = asyncio.Lock()
    
    async def start(self):
        """Start the task queue workers"""
        if self.running:
            return
        
        self.running = True
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker(i))
            self.workers.append(worker)
        
        logger.info(f"Task queue started with {self.max_workers} workers")
    
    async def stop(self):
        """Stop the task queue workers"""
        self.running = False
        for worker in self.workers:
            worker.cancel()
        self.workers.clear()
        logger.info("Task queue stopped")
    
    async def _worker(self, worker_id: int):
        """Worker that processes tasks from the queue"""
        logger.info(f"Worker {worker_id} started")
        
        while self.running:
            try:
                async with self._lock:
                    if self.queue:
                        task = self.queue.popleft()
                    else:
                        task = None
                
                if task:
                    func, args, kwargs = task
                    try:
                        await func(*args, **kwargs)
                    except Exception as e:
                        logger.error(f"Worker {worker_id} task error: {e}")
                else:
                    await asyncio.sleep(0.1)  # Wait if queue is empty
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
        
        logger.info(f"Worker {worker_id} stopped")
    
    async def enqueue(self, func: Callable, *args, **kwargs):
        """Add a task to the queue"""
        async with self._lock:
            self.queue.append((func, args, kwargs))
        logger.debug(f"Task enqueued: {func.__name__}")
    
    def enqueue_sync(self, func: Callable, *args, **kwargs):
        """Synchronous version of enqueue for use in sync contexts"""
        self.queue.append((func, args, kwargs))
    
    @property
    def pending_count(self) -> int:
        """Get number of pending tasks"""
        return len(self.queue)


# Global task queue instance
task_queue = TaskQueue()


# Pre-defined background tasks
async def process_notification(
    user_id: str,
    title: str,
    body: str,
    notification_type: str,
    data: Dict[str, Any] = None
):
    """Background task to create and potentially send push notification"""
    from services.firebase_notification_service import FirebaseNotificationService as NotificationService
    
    await NotificationService.create_notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        data=data
    )
    logger.info(f"Notification processed for user {user_id}")


async def process_moderation_check(message_id: str, content: str, user_id: str):
    """Background task to check message content"""
    from services.moderation_service import ModerationService
    from config.database import get_database
    
    is_ok, reason = await ModerationService.auto_moderate_message(content, user_id)
    
    if not is_ok:
        # Flag the message
        db = await get_database()
        await db.messages.update_one(
            {"_id": message_id},
            {"$set": {"flagged": True, "flag_reason": reason}}
        )
        logger.warning(f"Message {message_id} flagged: {reason}")


async def cleanup_expired_otps():
    """Background task to clean up expired OTPs"""
    from config.database import get_database
    
    db = await get_database()
    result = await db.otps.delete_many({
        "expires_at": {"$lt": datetime.utcnow()}
    })
    logger.info(f"Cleaned up {result.deleted_count} expired OTPs")


async def update_community_stats():
    """Background task to update community statistics"""
    from config.database import get_database
    
    db = await get_database()
    communities = await db.communities.find().to_list(None)
    
    for community in communities:
        member_count = len(community.get("members", []))
        await db.communities.update_one(
            {"_id": community["_id"]},
            {"$set": {"member_count": member_count}}
        )
    
    logger.info(f"Updated stats for {len(communities)} communities")
