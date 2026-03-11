#!/usr/bin/env python3
"""
Simple Message Status Test - Focus on the exact issue
"""

import asyncio
import aiohttp
import json
import sys
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Base URLs
BASE_URL = "https://beta-launch-prep-3.preview.emergentagent.com/api"

# Test configuration  
PHONE_A = "+915555551111"
PHONE_B = "+915555552222"
OTP = "123456"

class SimpleMessageStatusTester:
    def __init__(self):
        self.session = None
        self.user_a_token = None
        self.user_b_token = None
        self.user_a_sl_id = None
        self.user_b_sl_id = None
        self.chat_id = None
        
    async def setup_session(self):
        """Initialize HTTP session"""
        connector = aiohttp.TCPConnector(ssl=False)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(connector=connector, timeout=timeout)
        
    async def cleanup_session(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
            
    async def make_request(self, method, endpoint, data=None, headers=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        
        if headers is None:
            headers = {}
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url, headers=headers) as response:
                    response_text = await response.text()
                    logger.info(f"📤 GET {endpoint} -> {response.status}")
                    
                    if response.status != expected_status:
                        logger.error(f"❌ Expected {expected_status}, got {response.status}: {response_text}")
                        return None
                        
                    if response.content_type == 'application/json':
                        return await response.json()
                    return response_text
                    
            elif method.upper() == "POST":
                async with self.session.post(url, json=data, headers=headers) as response:
                    response_text = await response.text()
                    logger.info(f"📤 POST {endpoint} -> {response.status}")
                    
                    if response.status != expected_status:
                        logger.error(f"❌ Expected {expected_status}, got {response.status}: {response_text}")
                        return None
                        
                    if response.content_type == 'application/json':
                        return await response.json()
                    return response_text
                    
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data, headers=headers) as response:
                    response_text = await response.text()
                    logger.info(f"📤 PUT {endpoint} -> {response.status}")
                    
                    if response.status != expected_status:
                        logger.error(f"❌ Expected {expected_status}, got {response.status}: {response_text}")
                        return None
                        
                    if response.content_type == 'application/json':
                        return await response.json()
                    return response_text
                    
        except Exception as e:
            logger.error(f"❌ Request failed: {method} {endpoint} - {str(e)}")
            return None
            
    async def create_user_quick(self, phone, name):
        """Quick user creation"""
        logger.info(f"🔐 Creating {name} ({phone})")
        
        # Send OTP
        response = await self.make_request("POST", "/auth/send-otp", {"phone": phone})
        if not response:
            return None, None
            
        # Verify OTP
        response = await self.make_request("POST", "/auth/verify-otp", {"phone": phone, "otp": OTP})
        if not response:
            return None, None
            
        if response.get("is_new_user"):
            # Register new user
            response = await self.make_request("POST", "/auth/register", {
                "phone": phone, "name": name, "language": "English"
            })
            if not response:
                return None, None
            return response.get("token"), response.get("user", {}).get("sl_id")
        else:
            # Existing user
            return response.get("token"), response.get("user", {}).get("sl_id")
            
    async def run_simple_test(self):
        """Run simple message status test"""
        logger.info("🧪 SIMPLE MESSAGE STATUS TEST")
        logger.info("=" * 50)
        
        # 1. Create users
        self.user_a_token, self.user_a_sl_id = await self.create_user_quick(PHONE_A, "User A")
        self.user_b_token, self.user_b_sl_id = await self.create_user_quick(PHONE_B, "User B")
        
        if not self.user_a_token or not self.user_b_token:
            logger.error("❌ Failed to create users")
            return False
            
        logger.info(f"✅ Users: A({self.user_a_sl_id}) B({self.user_b_sl_id})")
        
        # 2. Send message
        headers_a = {"Authorization": f"Bearer {self.user_a_token}"}
        response = await self.make_request("POST", "/dm", {
            "recipient_sl_id": self.user_b_sl_id,
            "content": "Test message"
        }, headers_a)
        
        if not response:
            logger.error("❌ Failed to send message")
            return False
            
        self.chat_id = response.get("chat_id")
        logger.info(f"✅ Message sent, chat: {self.chat_id}")
        
        # 3. Check initial status
        response = await self.make_request("GET", f"/dm/{self.chat_id}", None, headers_a)
        if response and len(response) > 0:
            status = response[-1].get("status", "unknown")
            logger.info(f"📊 Initial status: {status}")
        
        # 4. Mark as read
        headers_b = {"Authorization": f"Bearer {self.user_b_token}"}
        response = await self.make_request("POST", f"/dm/{self.chat_id}/read", None, headers_b)
        if response:
            logger.info(f"✅ Mark as read: {response.get('message', 'Done')}")
        
        # 5. Check final status  
        await asyncio.sleep(1)  # Wait for update
        response = await self.make_request("GET", f"/dm/{self.chat_id}", None, headers_a)
        if response and len(response) > 0:
            status = response[-1].get("status", "unknown")
            logger.info(f"📊 Final status: {status}")
            
            if status == "read":
                logger.info("🎉 SUCCESS: Message status correctly changed to 'read'")
                return True
            else:
                logger.error(f"❌ FAIL: Expected 'read', got '{status}'")
                # Debug: show the full message object
                logger.info(f"🔍 Full message object: {json.dumps(response[-1], indent=2)}")
                return False
        else:
            logger.error("❌ FAIL: Could not retrieve messages")
            return False


async def main():
    """Main runner"""
    tester = SimpleMessageStatusTester()
    
    try:
        await tester.setup_session()
        success = await tester.run_simple_test()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)
    finally:
        await tester.cleanup_session()


if __name__ == "__main__":
    asyncio.run(main())