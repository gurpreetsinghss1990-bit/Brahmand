"""Firebase Configuration with Service Account"""
import os
import logging
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

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
    """Manages Firebase Admin SDK with Firestore"""
    
    def __init__(self):
        self.app = None
        self.db = None
        self._initialized = False
        self.project_id = "sanatan-lok"
        self._firebase_available = False
    
    async def initialize(self):
        """Initialize Firebase Admin SDK with service account"""
        if self._initialized:
            return
        
        private_key = os.environ.get('FIREBASE_PRIVATE_KEY', '').strip()
        
        if private_key and '-----BEGIN PRIVATE KEY-----' in private_key:
            try:
                import firebase_admin
                from firebase_admin import credentials, firestore
                
                # Build service account dict
                service_account = {
                    "type": "service_account",
                    "project_id": "sanatan-lok",
                    "private_key_id": "94034ab81b830de80520b8e604b91f77d2cc3179",
                    "private_key": private_key.replace('\\n', '\n'),
                    "client_email": "firebase-adminsdk-fbsvc@sanatan-lok.iam.gserviceaccount.com",
                    "client_id": "108982418961258761853",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40sanatan-lok.iam.gserviceaccount.com",
                    "universe_domain": "googleapis.com"
                }
                
                # Check if already initialized
                try:
                    self.app = firebase_admin.get_app()
                    logger.info("Firebase app already exists")
                except ValueError:
                    # Not initialized, create new app with explicit credentials
                    cred = credentials.Certificate(service_account)
                    self.app = firebase_admin.initialize_app(cred, {
                        'projectId': self.project_id
                    })
                    logger.info("Firebase app created with service account credentials")
                
                # Get Firestore client using firebase_admin (sync client)
                # We'll use the sync client with async wrappers
                self.db = firestore.client()
                self._firebase_available = True
                
                logger.info(f"✅ Firebase Admin SDK initialized with Firestore for project: {self.project_id}")
                
            except Exception as e:
                logger.error(f"Firebase initialization error: {e}")
                import traceback
                traceback.print_exc()
                self._firebase_available = False
        else:
            logger.warning("Firebase private key not configured - Firestore unavailable")
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
        self._initialized = False
        logger.info("Firebase connections closed")


# Global instance
firebase_manager = FirebaseManager()


async def get_firestore():
    """Get Firestore client"""
    if not firebase_manager._initialized:
        await firebase_manager.initialize()
    return firebase_manager.get_firestore()


def get_firebase_auth():
    return firebase_manager.get_auth()


def get_firebase_messaging():
    return firebase_manager.get_messaging()


def is_firebase_enabled():
    return firebase_manager.is_firebase_available
