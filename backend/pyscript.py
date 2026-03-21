code = """import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

class FirebaseManager:
    def __init__(self):
        self.app = None
        self.db = None
        self._initialized = False
        self._firebase_available = False
    
    async def initialize(self):
        if self._initialized:
            return
            
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", str(Path(__file__).parent.parent / "firebase.json"))
            
            if not os.path.exists(cred_path):
                logger.warning(f"Firebase configuration file not found at {cred_path}")
                self._firebase_available = False
                return

            try:
                self.app = firebase_admin.get_app()
                logger.info("Firebase app already exists")
            except ValueError:
                cred = credentials.Certificate(cred_path)
                self.app = firebase_admin.initialize_app(cred)
                logger.info(f"Firebase app created with JSON file at: {cred_path}")
            
            self.db = firestore.client()
            self._firebase_available = True
            logger.info("Firebase Firestore connected successfully")
            
        except Exception as e:
            logger.error(f"Firebase initialization error: {e}")
            self._firebase_available = False
            
        self._initialized = True
    
    @property
    def is_firebase_available(self):
        return self._firebase_available
    
    def get_firestore(self):
        return self.db
    
    def get_auth(self):
        return __import__('firebase_admin').auth if self._firebase_available else None
    
    def get_messaging(self):
        return __import__('firebase_admin').messaging if self._firebase_available else None

firebase_manager = FirebaseManager()

async def get_firestore():
    if not firebase_manager._initialized:
        await firebase_manager.initialize()
    return firebase_manager.get_firestore()

def get_firebase_auth():
    return firebase_manager.get_auth()

def get_firebase_messaging():
    return firebase_manager.get_messaging()

def is_firebase_enabled():
    return firebase_manager.is_firebase_available
"""
with open("/Users/developer/Desktop/Brahmand-main/backend/config/firebase_config.py", "w") as f:
    f.write(code)
