import os
import logging
from pathlib import Path

content = """import os
import logging
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

logger = logging.getLogger(__name__)

class FirebaseManager:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirebaseManager, cls).__new__(cls)
            cls._instance.app = None
            cls._instance.db = None
            cls._instance._firebase_available = False
        return cls._instance

    async def initialize(self):
        if self._initialized: return
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            
            cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if not cred_path:
                cred_path = str(Path(__file__).parent.parent / 'firebase.json')
            
            if not os.path.exists(cred_path):
                logger.warning(f'Firebase credentials not found at: {cred_path}')
                self._firebase_available = False
                return

            try:
                self.app = firebase_admin.get_app()
            except ValueError:
                cred = credentials.Certificate(cred_path)
                self.app = firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            self._firebase_available = True
        except Exception as e:
            logger.error(f'Failed to init Firebase: {str(e)}')
            self._firebase_available = False
        self._initialized = True

    def get_firestore(self): return self.db
    def get_auth(self): 
        if not self._firebase_available: return None
        from firebase_admin import auth
        return auth
    def get_messaging(self): 
        if not self._firebase_available: return None
        from firebase_admin import messaging
        return messaging
    @property
    def is_firebase_available(self): return self._firebase_available

firebase_manager = FirebaseManager()

async def get_firestore():
    if not firebase_manager._initialized: await firebase_manager.initialize()
    return firebase_manager.get_firestore()

def get_firebase_auth(): return firebase_manager.get_auth()
def get_firebase_messaging(): return firebase_manager.get_messaging()
def is_firebase_enabled(): return firebase_manager.is_firebase_available
"""

file_path = "/Users/developer/Desktop/Brahmand-main/backend/config/firebase_config.py"
with open(file_path, "w") as f:
    f.write(content)

print(f"Updated {file_path}")
