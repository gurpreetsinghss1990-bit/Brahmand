"""Firebase Configuration and Initialization"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Firebase Web Config (for frontend)
FIREBASE_WEB_CONFIG = {
    "apiKey": "AIzaSyAfMGn2Njs6Wdp8ZTpBS0jDS4KD7B7cTp4",
    "authDomain": "sanatan-lok.firebaseapp.com",
    "projectId": "sanatan-lok",
    "storageBucket": "sanatan-lok.firebasestorage.app",
    "messagingSenderId": "103222994071",
    "appId": "1:103222994071:web:bf5b9aa1775e0c84e8f5d2",
    "measurementId": "G-X7VBBCHKXG"
}


class FirebaseManager:
    """
    Manages Firebase connections.
    
    Note: Full Firebase Admin SDK requires a service account key.
    Without it, we provide the web config for frontend Firebase SDK use.
    """
    
    def __init__(self):
        self.app = None
        self.db = None
        self._initialized = False
        self.project_id = FIREBASE_WEB_CONFIG["projectId"]
        self._firebase_available = False
    
    async def initialize(self):
        """Initialize Firebase if credentials available"""
        if self._initialized:
            return
        
        private_key = os.environ.get('FIREBASE_PRIVATE_KEY', '').strip()
        
        if private_key:
            try:
                import firebase_admin
                from firebase_admin import credentials, firestore
                
                service_account = {
                    "type": "service_account",
                    "project_id": self.project_id,
                    "private_key": private_key.replace('\\n', '\n'),
                    "client_email": f"firebase-adminsdk@{self.project_id}.iam.gserviceaccount.com",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
                
                cred = credentials.Certificate(service_account)
                self.app = firebase_admin.initialize_app(cred)
                self.db = firestore.AsyncClient(project=self.project_id)
                self._firebase_available = True
                logger.info("Firebase Admin SDK initialized with Firestore")
                
            except Exception as e:
                logger.warning(f"Firebase Admin SDK init failed: {e}")
                logger.info("Using MongoDB backend with Firebase web config for frontend")
                self._firebase_available = False
        else:
            logger.info("No Firebase service account key - using MongoDB backend")
            logger.info("Firebase web config available for frontend SDK")
            self._firebase_available = False
        
        self._initialized = True
    
    @property
    def is_firebase_available(self):
        return self._firebase_available
    
    def get_firestore(self):
        return self.db
    
    def get_auth(self):
        if self._firebase_available:
            from firebase_admin import auth
            return auth
        return None
    
    def get_messaging(self):
        if self._firebase_available:
            from firebase_admin import messaging
            return messaging
        return None
    
    async def close(self):
        if self.db:
            self.db.close()
        self._initialized = False
        logger.info("Firebase connections closed")


# Global instance
firebase_manager = FirebaseManager()


async def get_firestore():
    """Get Firestore client (or None if not available)"""
    if not firebase_manager._initialized:
        await firebase_manager.initialize()
    return firebase_manager.get_firestore()


def get_firebase_auth():
    return firebase_manager.get_auth()


def get_firebase_messaging():
    return firebase_manager.get_messaging()


def is_firebase_enabled():
    return firebase_manager.is_firebase_available
