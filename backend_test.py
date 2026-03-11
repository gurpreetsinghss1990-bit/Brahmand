#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Sanatan Lok - Message Status & Read Receipts
Test the message status and read receipts functionality according to the review request.
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
PHONE_A = "+919999991111"
PHONE_B = "+919999992222"
OTP = "123456"

class MessageStatusTester:
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
            
    async def create_user(self, phone, name):
        """Create a user with OTP auth and registration"""
        logger.info(f"🔐 Creating user {name} with phone {phone}")
        
        # Step 1: Send OTP
        otp_data = {"phone": phone}
        response = await self.make_request("POST", "/auth/send-otp", otp_data)
        if not response:
            return None, None
            
        logger.info(f"✅ OTP sent to {phone}")
        
        # Step 2: Verify OTP
        verify_data = {"phone": phone, "otp": OTP}
        response = await self.make_request("POST", "/auth/verify-otp", verify_data)
        if not response:
            return None, None
            
        if response.get("is_new_user"):
            logger.info(f"✅ OTP verified for new user")
            
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
            logger.info(f"✅ User {name} registered with SL-ID: {sl_id}")
            return token, sl_id
        else:
            # Existing user
            token = response.get("token")
            sl_id = response.get("user", {}).get("sl_id")
            logger.info(f"✅ Existing user {name} logged in with SL-ID: {sl_id}")
            return token, sl_id
            
    async def test_1_setup_users(self):
        """Test 1: Setup - Create User A and User B"""
        logger.info("🧪 TEST 1: Setup - Creating users")
        
        self.user_a_token, self.user_a_sl_id = await self.create_user(PHONE_A, "User A")
        if not self.user_a_token:
            logger.error("❌ Failed to create User A")
            return False
            
        self.user_b_token, self.user_b_sl_id = await self.create_user(PHONE_B, "User B")
        if not self.user_b_token:
            logger.error("❌ Failed to create User B")
            return False
            
        logger.info(f"✅ TEST 1 PASSED - Users created: A({self.user_a_sl_id}), B({self.user_b_sl_id})")
        return True
        
    async def test_2_send_first_message(self):
        """Test 2: User A sends message to User B"""
        logger.info("🧪 TEST 2: User A sends message to User B")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        message_data = {
            "recipient_sl_id": self.user_b_sl_id,
            "content": "Test message status"
        }
        
        response = await self.make_request("POST", "/dm", message_data, headers)
        if not response:
            logger.error("❌ Failed to send message")
            return False
            
        self.chat_id = response.get("chat_id")
        message = response.get("message", {})
        
        if not self.chat_id:
            logger.error("❌ No chat_id returned")
            return False
            
        logger.info(f"✅ TEST 2 PASSED - Message sent, chat_id: {self.chat_id}")
        logger.info(f"📨 Message status: {message.get('status', 'unknown')}")
        return True
        
    async def test_3_verify_delivered_status(self):
        """Test 3: Verify message has 'delivered' status"""
        logger.info("🧪 TEST 3: Verify message status is 'delivered'")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        
        response = await self.make_request("GET", f"/dm/{self.chat_id}", None, headers)
        if not response:
            logger.error("❌ Failed to get messages")
            return False
            
        messages = response if isinstance(response, list) else []
        if not messages:
            logger.error("❌ No messages found")
            return False
            
        latest_message = messages[-1]  # Get the latest message
        status = latest_message.get("status", "unknown")
        
        if status != "delivered":
            logger.error(f"❌ Expected 'delivered', got '{status}'")
            return False
            
        logger.info(f"✅ TEST 3 PASSED - Message status is 'delivered'")
        return True
        
    async def test_4_mark_messages_read(self):
        """Test 4: User B opens chat and marks messages as read"""
        logger.info("🧪 TEST 4: User B marks messages as read")
        
        headers = {"Authorization": f"Bearer {self.user_b_token}"}
        
        response = await self.make_request("POST", f"/dm/{self.chat_id}/read", None, headers)
        if not response:
            logger.error("❌ Failed to mark messages as read")
            return False
            
        message = response.get("message", "")
        if "Read receipts disabled" in message:
            logger.error("❌ Read receipts are disabled when they should be enabled")
            return False
            
        logger.info(f"✅ TEST 4 PASSED - Messages marked as read: {message}")
        return True
        
    async def test_5_verify_read_status(self):
        """Test 5: User A checks message status (should be 'read')"""
        logger.info("🧪 TEST 5: Verify message status changed to 'read'")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        
        # Wait a moment for status to update
        await asyncio.sleep(1)
        
        response = await self.make_request("GET", f"/dm/{self.chat_id}", None, headers)
        if not response:
            logger.error("❌ Failed to get messages")
            return False
            
        messages = response if isinstance(response, list) else []
        if not messages:
            logger.error("❌ No messages found")
            return False
            
        latest_message = messages[-1]  # Get the latest message
        status = latest_message.get("status", "unknown")
        
        if status != "read":
            logger.error(f"❌ Expected 'read', got '{status}'")
            return False
            
        logger.info(f"✅ TEST 5 PASSED - Message status is now 'read'")
        return True
        
    async def test_6_disable_read_receipts(self):
        """Test 6: Test privacy setting - disable read receipts"""
        logger.info("🧪 TEST 6: User B disables read receipts")
        
        headers = {"Authorization": f"Bearer {self.user_b_token}"}
        privacy_settings = {"read_receipts": False}
        
        response = await self.make_request("PUT", "/user/privacy-settings", privacy_settings, headers)
        if not response:
            logger.error("❌ Failed to update privacy settings")
            return False
            
        settings = response.get("settings", {})
        if settings.get("read_receipts") is not False:
            logger.error("❌ Read receipts not disabled properly")
            return False
            
        logger.info(f"✅ TEST 6 PASSED - Read receipts disabled")
        return True
        
    async def test_7_send_second_message(self):
        """Test 7: User A sends another message"""
        logger.info("🧪 TEST 7: User A sends second message")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        message_data = {
            "recipient_sl_id": self.user_b_sl_id,
            "content": "Second test message"
        }
        
        response = await self.make_request("POST", "/dm", message_data, headers)
        if not response:
            logger.error("❌ Failed to send second message")
            return False
            
        message = response.get("message", {})
        status = message.get("status", "unknown")
        
        if status != "delivered":
            logger.error(f"❌ Expected 'delivered', got '{status}'")
            return False
            
        logger.info(f"✅ TEST 7 PASSED - Second message sent with status 'delivered'")
        return True
        
    async def test_8_blocked_read_receipts(self):
        """Test 8: User B marks as read (should be blocked)"""
        logger.info("🧪 TEST 8: User B attempts to mark as read (should be blocked)")
        
        headers = {"Authorization": f"Bearer {self.user_b_token}"}
        
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
        
    async def test_9_status_remains_delivered(self):
        """Test 9: User A checks - status should still be 'delivered'"""
        logger.info("🧪 TEST 9: Verify second message status remains 'delivered'")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        
        response = await self.make_request("GET", f"/dm/{self.chat_id}", None, headers)
        if not response:
            logger.error("❌ Failed to get messages")
            return False
            
        messages = response if isinstance(response, list) else []
        if len(messages) < 2:
            logger.error("❌ Expected at least 2 messages")
            return False
            
        second_message = messages[-1]  # Get the latest (second) message
        status = second_message.get("status", "unknown")
        
        if status != "delivered":
            logger.error(f"❌ Expected 'delivered', got '{status}'")
            return False
            
        logger.info(f"✅ TEST 9 PASSED - Second message status remains 'delivered' (not 'read')")
        return True
        
    async def run_all_tests(self):
        """Run all message status and read receipts tests"""
        logger.info("🚀 Starting Message Status & Read Receipts Testing")
        logger.info("=" * 60)
        
        tests = [
            self.test_1_setup_users,
            self.test_2_send_first_message,
            self.test_3_verify_delivered_status,
            self.test_4_mark_messages_read,
            self.test_5_verify_read_status,
            self.test_6_disable_read_receipts,
            self.test_7_send_second_message,
            self.test_8_blocked_read_receipts,
            self.test_9_status_remains_delivered,
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
        logger.info("🏁 TEST SUMMARY")
        logger.info(f"✅ Passed: {passed}")
        logger.info(f"❌ Failed: {failed}")
        logger.info(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            logger.info("🎉 ALL TESTS PASSED! Message status and read receipts working correctly.")
        else:
            logger.error("💥 SOME TESTS FAILED! Check the logs above for details.")
            
        return failed == 0


async def main():
    """Main test runner"""
    tester = MessageStatusTester()
    
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