#!/usr/bin/env python3
"""
Beta Launch Preparation Testing for Sanatan Lok
Test the exact flow specified in the review request with specific phone numbers.
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

# Base URLs from frontend .env
BASE_URL = "https://brahmand-preview.preview.emergentagent.com/api"

# Test configuration as specified in review request
PHONE_1 = "+919999001111"
PHONE_2 = "+919999002222"
OTP = "123456"  # Mock OTP
NAME_1 = "Beta User 1"
NAME_2 = "Beta User 2"

class BetaLaunchTester:
    def __init__(self):
        self.session = None
        self.user1_token = None
        self.user2_token = None
        self.user1_sl_id = None
        self.user2_sl_id = None
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
                    
                    if response.status != expected_status:
                        logger.error(f"❌ {method} {endpoint} - Expected {expected_status}, got {response.status}")
                        logger.error(f"Response: {response_text}")
                        return None
                        
                    if response.content_type == 'application/json':
                        return await response.json()
                    return response_text
                    
            elif method.upper() == "POST":
                async with self.session.post(url, json=data, headers=headers) as response:
                    response_text = await response.text()
                    
                    if response.status != expected_status:
                        logger.error(f"❌ {method} {endpoint} - Expected {expected_status}, got {response.status}")
                        logger.error(f"Response: {response_text}")
                        return None
                        
                    if response.content_type == 'application/json':
                        return await response.json()
                    return response_text
                    
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data, headers=headers) as response:
                    response_text = await response.text()
                    
                    if response.status != expected_status:
                        logger.error(f"❌ {method} {endpoint} - Expected {expected_status}, got {response.status}")
                        logger.error(f"Response: {response_text}")
                        return None
                        
                    if response.content_type == 'application/json':
                        return await response.json()
                    return response_text
                    
        except Exception as e:
            logger.error(f"❌ Request failed: {method} {endpoint} - {str(e)}")
            return None

    async def complete_user_signup(self, phone, name):
        """Complete user sign-up flow as specified in review request"""
        logger.info(f"🔐 Starting complete sign-up flow for {name} with phone {phone}")
        
        # Step 1: Send OTP
        otp_data = {"phone": phone}
        response = await self.make_request("POST", "/auth/send-otp", otp_data)
        if not response:
            return None, None
        logger.info(f"✅ Step 1: OTP sent to {phone}")
        
        # Step 2: Verify OTP  
        verify_data = {"phone": phone, "otp": OTP}
        response = await self.make_request("POST", "/auth/verify-otp", verify_data)
        if not response:
            return None, None
        logger.info(f"✅ Step 2: OTP verified for {phone}")
        
        # Step 3: Register user
        register_data = {
            "phone": phone,
            "name": name,
            "language": "English"
        }
        response = await self.make_request("POST", "/auth/register", register_data)
        if not response:
            return None, None
            
        token = response.get("token")
        sl_id = response.get("user", {}).get("sl_id")
        logger.info(f"✅ Step 3: User {name} registered with SL-ID: {sl_id}")
        
        return token, sl_id

    async def test_1_user1_signup(self):
        """Test 1: Complete User Sign-up Flow (User 1)"""
        logger.info("🧪 TEST 1: Complete User Sign-up Flow (User 1)")
        
        self.user1_token, self.user1_sl_id = await self.complete_user_signup(PHONE_1, NAME_1)
        if not self.user1_token:
            logger.error("❌ User 1 signup failed")
            return False
            
        logger.info(f"✅ TEST 1 PASSED - {NAME_1} created with SL-ID: {self.user1_sl_id}")
        return True

    async def test_2_user2_signup(self):
        """Test 2: Complete User Sign-up Flow (User 2)"""
        logger.info("🧪 TEST 2: Complete User Sign-up Flow (User 2)")
        
        self.user2_token, self.user2_sl_id = await self.complete_user_signup(PHONE_2, NAME_2)
        if not self.user2_token:
            logger.error("❌ User 2 signup failed")
            return False
            
        logger.info(f"✅ TEST 2 PASSED - {NAME_2} created with SL-ID: {self.user2_sl_id}")
        return True

    async def test_3_dm_with_message_status(self):
        """Test 3: User 1 sends DM to User 2 with message status"""
        logger.info("🧪 TEST 3: Direct Messaging with Message Status")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        message_data = {
            "recipient_sl_id": self.user2_sl_id,
            "content": "Beta launch test message"
        }
        
        response = await self.make_request("POST", "/dm", message_data, headers)
        if not response:
            logger.error("❌ Failed to send DM")
            return False
            
        self.chat_id = response.get("chat_id")
        message = response.get("message", {})
        status = message.get("status", "unknown")
        
        if not self.chat_id:
            logger.error("❌ No chat_id returned")
            return False
            
        if status != "delivered":
            logger.error(f"❌ Expected status 'delivered', got '{status}'")
            return False
            
        logger.info(f"✅ TEST 3 PASSED - Message sent with status: {status}, chat_id: {self.chat_id}")
        return True

    async def test_4_conversations_with_status(self):
        """Test 4: Verify conversations endpoint returns status fields"""
        logger.info("🧪 TEST 4: GET /api/dm/conversations includes status fields")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        response = await self.make_request("GET", "/dm/conversations", None, headers)
        if not response:
            logger.error("❌ Failed to get conversations")
            return False
            
        if not isinstance(response, list) or len(response) == 0:
            logger.error("❌ No conversations found")
            return False
            
        conversation = response[0]
        required_fields = ["last_message_status", "last_message_sender_id"]
        missing_fields = [f for f in required_fields if f not in conversation]
        
        if missing_fields:
            logger.error(f"❌ Missing fields in conversation: {missing_fields}")
            return False
            
        logger.info(f"✅ TEST 4 PASSED - Conversation includes status fields")
        logger.info(f"   last_message_status: {conversation.get('last_message_status')}")
        logger.info(f"   last_message_sender_id: {conversation.get('last_message_sender_id')}")
        return True

    async def test_5_read_receipts(self):
        """Test 5: User 2 marks messages as read"""
        logger.info("🧪 TEST 5: Read Receipts - User 2 marks as read")
        
        # First, User 2 views the messages
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        response = await self.make_request("GET", f"/dm/{self.chat_id}", None, headers)
        if not response:
            logger.error("❌ User 2 failed to view messages")
            return False
        logger.info("✅ User 2 viewed messages")
        
        # Then mark as read
        response = await self.make_request("POST", f"/dm/{self.chat_id}/read", None, headers)
        if not response:
            logger.error("❌ Failed to mark as read")
            return False
            
        message = response.get("message", "")
        if "Read receipts disabled" in message:
            logger.error("❌ Read receipts should be enabled by default")
            return False
            
        logger.info(f"✅ TEST 5 PASSED - Messages marked as read: {message}")
        return True

    async def test_6_status_changed_to_read(self):
        """Test 6: Verify status changed to 'read' in conversations"""
        logger.info("🧪 TEST 6: Verify last_message_status changed to 'read'")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Wait a moment for status update
        await asyncio.sleep(1)
        
        response = await self.make_request("GET", "/dm/conversations", None, headers)
        if not response:
            logger.error("❌ Failed to get conversations")
            return False
            
        if not isinstance(response, list) or len(response) == 0:
            logger.error("❌ No conversations found")
            return False
            
        conversation = response[0]
        last_status = conversation.get('last_message_status')
        
        if last_status != "read":
            logger.error(f"❌ Expected 'read', got '{last_status}'")
            return False
            
        logger.info(f"✅ TEST 6 PASSED - Status changed to 'read'")
        return True

    async def test_7_privacy_settings_disable(self):
        """Test 7: User 1 disables read receipts"""
        logger.info("🧪 TEST 7: Privacy Settings - Disable read receipts")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        privacy_data = {"read_receipts": False}
        
        response = await self.make_request("PUT", "/user/privacy-settings", privacy_data, headers)
        if not response:
            logger.error("❌ Failed to update privacy settings")
            return False
            
        settings = response.get("settings", {})
        if settings.get("read_receipts") is not False:
            logger.error("❌ Read receipts not disabled")
            return False
            
        logger.info(f"✅ TEST 7 PASSED - Read receipts disabled for User 1")
        return True

    async def test_8_send_with_disabled_receipts(self):
        """Test 8: User 2 sends message, User 1 tries to mark read (should be blocked)"""
        logger.info("🧪 TEST 8: Send message with read receipts disabled")
        
        # User 2 sends a message
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        message_data = {
            "recipient_sl_id": self.user1_sl_id,
            "content": "Message to user with disabled receipts"
        }
        
        response = await self.make_request("POST", "/dm", message_data, headers)
        if not response:
            logger.error("❌ Failed to send message from User 2")
            return False
        logger.info("✅ User 2 sent message")
        
        # User 1 tries to mark as read (should be blocked)
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        response = await self.make_request("POST", f"/dm/{self.chat_id}/read", None, headers)
        if not response:
            logger.error("❌ Failed to make mark-as-read request")
            return False
            
        message = response.get("message", "")
        if "Read receipts disabled" not in message:
            logger.error(f"❌ Expected 'Read receipts disabled', got '{message}'")
            return False
            
        logger.info(f"✅ TEST 8 PASSED - Read receipts properly blocked: {message}")
        return True

    async def test_9_database_reset_endpoint(self):
        """Test 9: Verify database reset endpoint exists and requires confirmation"""
        logger.info("🧪 TEST 9: Database reset endpoint verification")
        
        # Call without confirm parameter - should return 400
        response = await self.make_request("POST", "/admin/reset-database", {}, {}, expected_status=400)
        if response is None:
            logger.error("❌ Database reset endpoint not responding correctly")
            return False
            
        # Check if it's asking for confirmation
        detail = response.get("detail", "")
        if "confirmation" not in detail.lower() or "confirm" not in detail.lower():
            logger.error(f"❌ Expected confirmation requirement, got: {detail}")
            return False
            
        logger.info(f"✅ TEST 9 PASSED - Database reset endpoint requires confirmation")
        logger.info(f"   Response: {detail}")
        return True

    async def run_all_tests(self):
        """Run all beta launch preparation tests"""
        logger.info("🚀 Starting Beta Launch Preparation Testing")
        logger.info("=" * 60)
        
        tests = [
            self.test_1_user1_signup,
            self.test_2_user2_signup,
            self.test_3_dm_with_message_status,
            self.test_4_conversations_with_status,
            self.test_5_read_receipts,
            self.test_6_status_changed_to_read,
            self.test_7_privacy_settings_disable,
            self.test_8_send_with_disabled_receipts,
            self.test_9_database_reset_endpoint,
        ]
        
        passed = 0
        failed = 0
        
        for i, test in enumerate(tests, 1):
            try:
                result = await test()
                if result:
                    passed += 1
                else:
                    failed += 1
                    logger.error(f"❌ Test {i} failed")
            except Exception as e:
                failed += 1
                logger.error(f"❌ Test {i} failed with exception: {str(e)}")
                
            logger.info("-" * 40)
            
        # Summary
        logger.info("=" * 60)
        logger.info("🏁 BETA LAUNCH TEST SUMMARY")
        logger.info(f"✅ Passed: {passed}")
        logger.info(f"❌ Failed: {failed}")
        logger.info(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            logger.info("🎉 ALL TESTS PASSED! Beta launch features ready.")
        else:
            logger.error("💥 SOME TESTS FAILED! Check the logs above for details.")
            
        return failed == 0


async def main():
    """Main test runner"""
    tester = BetaLaunchTester()
    
    try:
        await tester.setup_session()
        success = await tester.run_all_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)
    finally:
        await tester.cleanup_session()


if __name__ == "__main__":
    asyncio.run(main())