"""Helper utilities"""
import random
import string
from typing import Optional, Tuple, Dict, Any


def generate_sl_id() -> str:
    """Generate unique Sanatan Lok ID"""
    return f"SL-{random.randint(100000, 999999)}"


def generate_circle_code(name: str) -> str:
    """Generate circle code from name"""
    clean_name = ''.join(c for c in name.upper() if c.isalnum())[:6]
    random_suffix = ''.join(random.choices(string.digits, k=3))
    return f"{clean_name}{random_suffix}"


def generate_community_code(name: str) -> str:
    """Generate community code"""
    clean_name = ''.join(c for c in name.upper() if c.isalnum())[:8]
    return f"{clean_name}108"


def generate_temple_id() -> str:
    """Generate unique Temple ID"""
    return f"TPL-{random.randint(1000, 9999)}"


def serialize_doc(doc: Optional[Dict]) -> Optional[Dict]:
    """Convert MongoDB document to serializable dict"""
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc


# Keyword-based moderation (basic)
BLOCKED_KEYWORDS = ["spam", "scam", "fraud", "abuse", "hack", "porn", "xxx"]


def moderate_content(content: str) -> Tuple[bool, Optional[str]]:
    """Basic keyword-based content moderation"""
    content_lower = content.lower()
    for keyword in BLOCKED_KEYWORDS:
        if keyword in content_lower:
            return False, f"Content contains inappropriate keyword"
    return True, None


# Daily Wisdom Quotes
WISDOM_QUOTES = [
    {"quote": "You have the right to perform your duty, but not the fruits of action.", "source": "Bhagavad Gita 2.47"},
    {"quote": "The soul is neither born, nor does it ever die. It is unborn, eternal, and primeval.", "source": "Bhagavad Gita 2.20"},
    {"quote": "Set thy heart upon thy work, but never on its reward.", "source": "Bhagavad Gita"},
    {"quote": "When meditation is mastered, the mind is unwavering like the flame of a candle in a windless place.", "source": "Bhagavad Gita 6.19"},
    {"quote": "One who sees inaction in action, and action in inaction, is intelligent among men.", "source": "Bhagavad Gita 4.18"},
    {"quote": "The mind is restless and difficult to restrain, but it is subdued by practice.", "source": "Bhagavad Gita 6.35"},
    {"quote": "Whatever happened, happened for the good. Whatever is happening, is happening for the good.", "source": "Bhagavad Gita"},
    {"quote": "He who has no attachments can really love others, for his love is pure and divine.", "source": "Bhagavad Gita"},
    {"quote": "A person can rise through the efforts of his own mind; he can also degrade himself.", "source": "Bhagavad Gita 6.5"},
    {"quote": "The wise see knowledge and action as one; they see truly.", "source": "Bhagavad Gita 5.4"},
    {"quote": "Perform your obligatory duty, because action is indeed better than inaction.", "source": "Bhagavad Gita 3.8"},
    {"quote": "Reshape yourself through the power of your will. Those who have conquered themselves live in peace.", "source": "Bhagavad Gita"},
]

# Hindu Calendar Tithis
TITHIS = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", 
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima/Amavasya"
]

# Common Vrats
VRATS = [
    "Ekadashi Vrat", "Pradosh Vrat", "Satyanarayan Vrat", "Somvar Vrat",
    "Mangalvar Vrat", "Guruvar Vrat", "Shanivar Vrat", "Shukravar Vrat",
    "Purnima Vrat", "Amavasya Vrat", "Nirjala Ekadashi", "Karwa Chauth"
]

# Community subgroups template
SUBGROUPS = [
    {"name": "Community Chat", "type": "chat", "rules": "No promotions. No political discussions. Respectful communication."},
    {"name": "Political Discussion", "type": "political", "rules": "Respectful debate only. No abusive language."},
    {"name": "Local Vendors", "type": "marketplace", "rules": "Marketplace for local Hindu businesses. Promotions allowed."},
    {"name": "Festival Marketplace", "type": "festival", "rules": "Vendors related to festivals only."},
    {"name": "Temple Events", "type": "events", "rules": "Religious and temple events only."},
    {"name": "Community Volunteers", "type": "volunteers", "rules": "Volunteer for events, seva activities, and community work."},
    {"name": "Community Invitations", "type": "invitations", "rules": "Invitations to personal or public events."},
    {"name": "Community Help", "type": "help", "rules": "Emergency support. Blood donation, hospital help, urgent assistance."}
]

# Supported languages
SUPPORTED_LANGUAGES = ["English", "Hindi", "Gujarati", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali"]
