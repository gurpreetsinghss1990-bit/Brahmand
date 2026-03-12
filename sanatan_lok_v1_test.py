#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Sanatan Lok VERSION 1 Features
Testing all the new features implemented for Sanatan Lok VERSION 1 as per review request
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
BASE_URL = "https://brahmand-requests.preview.emergentagent.com/api"

# Test configuration - Using specified phone numbers from review request (modified to avoid rate limiting)
PHONE_USER1 = "+919999001111"
PHONE_USER2 = "+919999002222" 
OTP = "123456"

class SanatanLokV1Tester:
    def __init__(self):
        self.session = None
        self.user1_token = None
        self.user2_token = None
        self.user1_sl_id = None
        self.user2_sl_id = None
        self.chat_id = None
        self.temple_id = None
        
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
            headers = {"Content-Type": "application/json"}
            
        try:
            kwargs = {"headers": headers}
            if data:
                kwargs["json"] = data
                
            async with self.session.request(method, url, **kwargs) as response:
                response_text = await response.text()
                
                try:
                    response_json = json.loads(response_text) if response_text else {}
                except json.JSONDecodeError:
                    response_json = {"raw_response": response_text}
                
                # If expected_status is None, accept any status
                if expected_status is not None and response.status != expected_status:
                    logger.error(f"❌ {method} {endpoint} failed with {response.status}: {response_json}")
                    return None, response.status
                    
                logger.info(f"✅ {method} {endpoint} -> {response.status}")
                return response_json, response.status
                
        except Exception as e:
            logger.error(f"❌ Request failed: {method} {endpoint} - {str(e)}")
            return None, 0

    async def create_test_user(self, phone, name):
        """Create a test user with OTP flow or login existing user"""
        logger.info(f"📱 Creating test user: {name} ({phone})")
        
        # Step 1: Send OTP
        otp_response, status = await self.make_request(
            "POST", "/auth/send-otp", 
            {"phone": phone}
        )
        if not otp_response:
            return None, None
            
        # Step 2: Verify OTP
        verify_response, status = await self.make_request(
            "POST", "/auth/verify-otp",
            {"phone": phone, "otp": OTP}
        )
        if not verify_response:
            return None, None
            
        # Step 3: Try to register user (or get existing user info)
        register_response, status = await self.make_request(
            "POST", "/auth/register",
            {"name": name, "phone": phone},
            expected_status=None  # Allow any status
        )
        
        if status == 400 and register_response and "User already exists" in register_response.get("detail", ""):
            # User exists, we should have gotten the token from OTP verify
            token = verify_response.get("token") or verify_response.get("access_token")
            user_info = verify_response.get("user", {})
            sl_id = user_info.get("sl_id")
            
            if token and sl_id:
                logger.info(f"✅ Existing user logged in: {name} -> {sl_id}")
                return token, sl_id
            else:
                logger.error("❌ Existing user but no token received")
                return None, None
        elif status == 200:
            # New user registered successfully
            token = register_response.get("token")
            sl_id = register_response.get("user", {}).get("sl_id")
            logger.info(f"✅ User created: {name} -> {sl_id}")
            return token, sl_id
        else:
            logger.error(f"❌ Registration failed with status {status}: {register_response}")
            return None, None

    async def test_setup_users(self):
        """Setup - Create test users first"""
        logger.info("🚀 SETUP: Creating test users...")
        
        # Create User 1
        self.user1_token, self.user1_sl_id = await self.create_test_user(
            PHONE_USER1, "Temple Admin User"
        )
        if not self.user1_token:
            logger.error("❌ Failed to create User 1")
            return False
            
        # Create User 2  
        self.user2_token, self.user2_sl_id = await self.create_test_user(
            PHONE_USER2, "Regular User"
        )
        if not self.user2_token:
            logger.error("❌ Failed to create User 2")
            return False
            
        logger.info(f"✅ Setup complete - User 1: {self.user1_sl_id}, User 2: {self.user2_sl_id}")
        return True

    async def test_kyc_system(self):
        """Test 1: KYC System"""
        logger.info("🔍 TEST 1: KYC System")
        
        # Test 1a: Get KYC status (should return null status for new user)
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        status_response, status = await self.make_request(
            "GET", "/kyc/status", headers=headers
        )
        if not status_response:
            return False
            
        if status_response.get("kyc_status") is not None:
            logger.error(f"❌ Expected null KYC status for new user, got: {status_response.get('kyc_status')}")
            return False
        logger.info("✅ KYC status is null for new user")
        
        # Test 1b: Submit KYC
        kyc_data = {
            "kyc_role": "temple",
            "id_type": "aadhaar", 
            "id_number": "123456789012"
        }
        submit_response, status = await self.make_request(
            "POST", "/kyc/submit", kyc_data, headers=headers
        )
        if not submit_response:
            return False
        logger.info("✅ KYC submission successful")
        
        # Test 1c: Get KYC status (should show pending status)
        status_response2, status = await self.make_request(
            "GET", "/kyc/status", headers=headers
        )
        if not status_response2:
            return False
            
        if status_response2.get("kyc_status") != "pending":
            logger.error(f"❌ Expected pending KYC status, got: {status_response2.get('kyc_status')}")
            return False
        logger.info("✅ KYC status shows pending after submission")
        
        return True

    async def test_temples_api(self):
        """Test 2: Temples API"""
        logger.info("🏛️ TEST 2: Temples API")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Test 2a: Get temples (should return empty or existing temples)
        temples_response, status = await self.make_request(
            "GET", "/temples", headers=headers
        )
        if temples_response is None:
            return False
        logger.info(f"✅ GET /api/temples returned {len(temples_response)} temples")
        
        # Test 2b: Initialize sample temples
        init_response, status = await self.make_request(
            "POST", "/admin/init-sample-temples", headers=headers
        )
        if not init_response:
            return False
        logger.info(f"✅ Sample temples initialized: {init_response.get('message')}")
        
        # Test 2c: Get temples (should now return 5 sample temples)
        temples_response2, status = await self.make_request(
            "GET", "/temples", headers=headers
        )
        if temples_response2 is None:
            return False
            
        temple_count = len(temples_response2)
        if temple_count < 5:
            logger.error(f"❌ Expected at least 5 temples, got {temple_count}")
            return False
        logger.info(f"✅ GET /api/temples now returns {temple_count} temples")
        
        # Test 2d: Get temples nearby (should return temples with is_following and follower_count)
        nearby_response, status = await self.make_request(
            "GET", "/temples/nearby", headers=headers
        )
        if nearby_response is None:
            return False
            
        if len(nearby_response) > 0:
            first_temple = nearby_response[0]
            if 'is_following' not in first_temple or 'follower_count' not in first_temple:
                logger.error("❌ Nearby temples missing is_following or follower_count fields")
                return False
            logger.info(f"✅ Nearby temples include follow status fields")
            
            # Store temple ID for follow/unfollow test
            self.temple_id = first_temple.get('id') or first_temple.get('temple_id')
        
        return True

    async def test_temple_follow_unfollow(self):
        """Test 3: Temple Follow/Unfollow"""
        logger.info("❤️ TEST 3: Temple Follow/Unfollow")
        
        if not self.temple_id:
            logger.error("❌ No temple ID available for follow/unfollow test")
            return False
            
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Test 3a: Follow temple
        follow_response, status = await self.make_request(
            "POST", f"/temples/{self.temple_id}/follow", headers=headers
        )
        if not follow_response:
            return False
        logger.info(f"✅ Successfully followed temple {self.temple_id}")
        
        # Test 3b: Get temple details (verify is_following: true)
        temple_response, status = await self.make_request(
            "GET", f"/temples/{self.temple_id}", headers=headers
        )
        if not temple_response:
            return False
            
        if temple_response.get('is_following') != True:
            logger.error(f"❌ Expected is_following: true, got: {temple_response.get('is_following')}")
            return False
        logger.info("✅ Temple details show is_following: true")
        
        # Test 3c: Unfollow temple
        unfollow_response, status = await self.make_request(
            "POST", f"/temples/{self.temple_id}/unfollow", headers=headers
        )
        if not unfollow_response:
            return False
        logger.info(f"✅ Successfully unfollowed temple {self.temple_id}")
        
        # Test 3d: Get temple details (verify is_following: false)
        temple_response2, status = await self.make_request(
            "GET", f"/temples/{self.temple_id}", headers=headers
        )
        if not temple_response2:
            return False
            
        if temple_response2.get('is_following') != False:
            logger.error(f"❌ Expected is_following: false, got: {temple_response2.get('is_following')}")
            return False
        logger.info("✅ Temple details show is_following: false")
        
        return True

    async def test_report_system(self):
        """Test 4: Report System"""
        logger.info("🚨 TEST 4: Report System")
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Test 4a: Submit a report
        report_data = {
            "content_type": "message",
            "content_id": "test123", 
            "category": "spam",
            "description": "Test report"
        }
        report_response, status = await self.make_request(
            "POST", "/report", report_data, headers=headers
        )
        if not report_response:
            return False
            
        report_id = report_response.get("report_id")
        if not report_id:
            logger.error("❌ Report creation did not return report_id")
            return False
            
        logger.info(f"✅ Report created successfully: {report_id}")
        return True

    async def test_direct_message_status(self):
        """Test 5: Direct Message Status"""
        logger.info("💬 TEST 5: Direct Message Status")
        
        user1_headers = {"Authorization": f"Bearer {self.user1_token}"}
        user2_headers = {"Authorization": f"Bearer {self.user2_token}"}
        
        # Test 5a: User 1 sends DM to User 2
        dm_data = {
            "recipient_sl_id": self.user2_sl_id,
            "text": "Hello User Two! Testing message status."
        }
        dm_response, status = await self.make_request(
            "POST", "/dm", dm_data, headers=user1_headers
        )
        if not dm_response:
            return False
            
        # Extract chat_id from response
        self.chat_id = dm_response.get("chat_id")
        if not self.chat_id:
            logger.error("❌ DM creation did not return chat_id")
            return False
        logger.info(f"✅ DM sent successfully, chat_id: {self.chat_id}")
        
        # Test 5b: Verify message status is "delivered"
        messages_response, status = await self.make_request(
            "GET", f"/dm/{self.chat_id}", headers=user1_headers
        )
        if not messages_response:
            return False
            
        messages = messages_response.get("messages", [])
        if not messages:
            logger.error("❌ No messages found in chat")
            return False
            
        last_message = messages[-1]
        if last_message.get("status") != "delivered":
            logger.error(f"❌ Expected message status 'delivered', got: {last_message.get('status')}")
            return False
        logger.info("✅ Message status is 'delivered'")
        
        # Test 5c: User 2 calls GET /api/dm/{chat_id} to view messages  
        user2_messages_response, status = await self.make_request(
            "GET", f"/dm/{self.chat_id}", headers=user2_headers
        )
        if not user2_messages_response:
            return False
        logger.info("✅ User 2 successfully viewed messages")
        
        # Test 5d: User 2 calls POST /api/dm/{chat_id}/read
        read_response, status = await self.make_request(
            "POST", f"/dm/{self.chat_id}/read", headers=user2_headers
        )
        if not read_response:
            return False
        logger.info("✅ User 2 marked messages as read")
        
        # Test 5e: User 1 calls GET /api/dm/conversations
        conversations_response, status = await self.make_request(
            "GET", "/dm/conversations", headers=user1_headers
        )
        if not conversations_response:
            return False
            
        # Test 5f: Verify last_message_status shows "read"
        conversations = conversations_response if isinstance(conversations_response, list) else conversations_response.get("conversations", [])
        
        if not conversations:
            logger.error("❌ No conversations found")
            return False
            
        target_conversation = None
        for conv in conversations:
            if conv.get("chat_id") == self.chat_id:
                target_conversation = conv
                break
                
        if not target_conversation:
            logger.error(f"❌ Conversation with chat_id {self.chat_id} not found")
            return False
            
        last_message_status = target_conversation.get("last_message_status")
        if last_message_status != "read":
            logger.error(f"❌ Expected last_message_status 'read', got: {last_message_status}")
            return False
        logger.info("✅ Conversation shows last_message_status: 'read'")
        
        return True

    async def test_privacy_settings(self):
        """Test 6: Privacy Settings"""
        logger.info("🔒 TEST 6: Privacy Settings")
        
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        
        # Test 6a: Update privacy settings
        privacy_data = {"read_receipts": False}
        privacy_response, status = await self.make_request(
            "PUT", "/user/privacy-settings", privacy_data, headers=headers
        )
        if not privacy_response:
            return False
        logger.info("✅ Privacy settings updated: read_receipts: false")
        
        # Test 6b: Get privacy settings (verify read_receipts: false)
        get_privacy_response, status = await self.make_request(
            "GET", "/user/privacy-settings", headers=headers
        )
        if not get_privacy_response:
            return False
            
        if get_privacy_response.get("read_receipts") != False:
            logger.error(f"❌ Expected read_receipts: false, got: {get_privacy_response.get('read_receipts')}")
            return False
        logger.info("✅ Privacy settings verified: read_receipts: false")
        
        return True

    async def run_all_tests(self):
        """Run all test scenarios"""
        logger.info("🚀 Starting Sanatan Lok VERSION 1 comprehensive testing...")
        
        test_results = []
        
        # Test scenarios
        tests = [
            ("Setup Users", self.test_setup_users),
            ("KYC System", self.test_kyc_system),
            ("Temples API", self.test_temples_api),
            ("Temple Follow/Unfollow", self.test_temple_follow_unfollow),
            ("Report System", self.test_report_system),
            ("Direct Message Status", self.test_direct_message_status),
            ("Privacy Settings", self.test_privacy_settings)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            logger.info(f"\n{'='*50}")
            logger.info(f"Running: {test_name}")
            logger.info(f"{'='*50}")
            
            try:
                result = await test_func()
                if result:
                    logger.info(f"✅ {test_name} - PASSED")
                    passed += 1
                else:
                    logger.error(f"❌ {test_name} - FAILED")
                    failed += 1
                test_results.append((test_name, result))
            except Exception as e:
                logger.error(f"❌ {test_name} - EXCEPTION: {str(e)}")
                failed += 1
                test_results.append((test_name, False))
        
        # Summary
        logger.info(f"\n{'='*60}")
        logger.info("🎯 SANATAN LOK VERSION 1 TEST SUMMARY")
        logger.info(f"{'='*60}")
        
        for test_name, result in test_results:
            status = "✅ PASSED" if result else "❌ FAILED"
            logger.info(f"{status} - {test_name}")
        
        total_tests = passed + failed
        success_rate = (passed / total_tests * 100) if total_tests > 0 else 0
        
        logger.info(f"\n📊 Results: {passed}/{total_tests} tests passed ({success_rate:.1f}% success rate)")
        
        if failed == 0:
            logger.info("🎉 ALL TESTS PASSED! VERSION 1 features are working correctly.")
        else:
            logger.error("💥 SOME TESTS FAILED! Check the logs above for details.")
            
        return failed == 0


async def main():
    """Main test runner"""
    tester = SanatanLokV1Tester()
    
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