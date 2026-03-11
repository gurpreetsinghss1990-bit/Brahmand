#!/usr/bin/env python3
"""
Sanatan Lok Backend API Test Suite
Testing FCM Push Notification Endpoints
Focus: FCM token management and push notification integration
"""

import requests
import json
import time
from typing import Dict, Any, Optional

class SanatanLokTester:
    def __init__(self, base_url: str = "https://community-join-flow.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        # FCM Test User 1 data  
        self.token1 = None
        self.user1_phone = "+915555555555"
        self.user1_sl_id = None
        self.user1_fcm_token = "test_fcm_token_123456789"
        
        # FCM Test User 2 data
        self.token2 = None
        self.user2_phone = "+916666666666"
        self.user2_sl_id = None
        self.user2_fcm_token = "second_user_fcm_token"
        
        self.mock_otp = "123456"
        self.chat_id = None
        self.all_messages = []  # Track all messages sent for verification
        
    def log_test(self, test_name: str, status: str, details: str = ""):
        """Log test results"""
        status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏭️"
        print(f"{status_emoji} {test_name}: {status}")
        if details:
            print(f"   {details}")
        print()

    def create_user(self, phone: str, name: str) -> tuple[Optional[str], Optional[str]]:
        """Helper method to create a user and return (token, sl_id)"""
        try:
            # Step 1: Send OTP
            payload = {"phone": phone}
            response = self.session.post(f"{self.base_url}/auth/send-otp", 
                                       data=json.dumps(payload))
            
            if response.status_code != 200:
                print(f"   OTP send failed for {phone}: {response.status_code}")
                return None, None
            
            # Step 2: Verify OTP
            payload = {"phone": phone, "otp": self.mock_otp}
            response = self.session.post(f"{self.base_url}/auth/verify-otp", 
                                       data=json.dumps(payload))
            
            if response.status_code != 200:
                print(f"   OTP verify failed for {phone}: {response.status_code}")
                return None, None
                
            data = response.json()
            
            # Check if existing user
            if not data.get('is_new_user'):
                token = data.get('token')
                user_data = data.get('user', {})
                sl_id = user_data.get('sl_id')
                print(f"   Existing user logged in: {sl_id}")
                return token, sl_id
            
            # Step 3: Register new user
            payload = {
                "phone": phone,
                "name": name,
                "language": "Hindi"
            }
            response = self.session.post(f"{self.base_url}/auth/register", 
                                       data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                token = data.get('token')
                user_data = data.get('user', {})
                sl_id = user_data.get('sl_id')
                print(f"   New user registered: {sl_id}")
                return token, sl_id
            else:
                print(f"   Registration failed for {phone}: {response.status_code} - {response.text}")
                return None, None
                
        except Exception as e:
            print(f"   Exception creating user {phone}: {str(e)}")
            return None, None

    def test_1_create_fcm_user_1(self) -> bool:
        """Test 1: Create/Login FCM Test User 1 (+915555555555)"""
        try:
            self.token1, self.user1_sl_id = self.create_user(self.user1_phone, "FCM Test User")
            
            if self.token1 and self.user1_sl_id:
                self.log_test("Create FCM User 1", "PASS", 
                            f"User 1 created: {self.user1_sl_id}")
                return True
            else:
                self.log_test("Create FCM User 1", "FAIL", "Failed to create FCM user 1")
                return False
                
        except Exception as e:
            self.log_test("Create FCM User 1", "FAIL", f"Exception: {str(e)}")
            return False

    def test_2_save_fcm_token_user1(self) -> bool:
        """Test 2: Save FCM token for User 1"""
        if not self.token1:
            self.log_test("Save FCM Token User 1", "SKIP", "Missing User 1 token")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            payload = {"fcm_token": self.user1_fcm_token}
            response = requests.post(f"{self.base_url}/user/fcm-token", 
                                   headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'FCM token saved successfully':
                    self.log_test("Save FCM Token User 1", "PASS", 
                                f"FCM token saved for {self.user1_sl_id}")
                    return True
                else:
                    self.log_test("Save FCM Token User 1", "FAIL", 
                                f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Save FCM Token User 1", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Save FCM Token User 1", "FAIL", f"Exception: {str(e)}")
            return False

    def test_3_verify_fcm_token_in_profile(self) -> bool:
        """Test 3: Verify FCM token is saved in user profile"""
        if not self.token1:
            self.log_test("Verify FCM Token in Profile", "SKIP", "Missing User 1 token")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/user/profile", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                saved_token = user_data.get('fcm_token')
                
                if saved_token == self.user1_fcm_token:
                    self.log_test("Verify FCM Token in Profile", "PASS", 
                                f"FCM token verified in profile: {saved_token[:20]}...")
                    return True
                elif saved_token:
                    self.log_test("Verify FCM Token in Profile", "FAIL", 
                                f"Token mismatch: expected {self.user1_fcm_token[:20]}..., got {saved_token[:20]}...")
                    return False
                else:
                    self.log_test("Verify FCM Token in Profile", "FAIL", 
                                "FCM token not found in profile")
                    return False
            else:
                self.log_test("Verify FCM Token in Profile", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify FCM Token in Profile", "FAIL", f"Exception: {str(e)}")
            return False

    def test_4_create_second_user(self) -> bool:
        """Test 4: Create second user for DM testing"""
        try:
            self.token2, self.user2_sl_id = self.create_user(self.user2_phone, "Second FCM User")
            
            if self.token2 and self.user2_sl_id:
                self.log_test("Create Second User", "PASS", 
                            f"User 2 created: {self.user2_sl_id}")
                return True
            else:
                self.log_test("Create Second User", "FAIL", "Failed to create second user")
                return False
                
        except Exception as e:
            self.log_test("Create Second User", "FAIL", f"Exception: {str(e)}")
            return False

    def test_5_save_fcm_token_user2(self) -> bool:
        """Test 5: Save FCM token for User 2"""
        if not self.token2:
            self.log_test("Save FCM Token User 2", "SKIP", "Missing User 2 token")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token2}', 'Content-Type': 'application/json'}
            payload = {"fcm_token": self.user2_fcm_token}
            response = requests.post(f"{self.base_url}/user/fcm-token", 
                                   headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'FCM token saved successfully':
                    self.log_test("Save FCM Token User 2", "PASS", 
                                f"FCM token saved for {self.user2_sl_id}")
                    return True
                else:
                    self.log_test("Save FCM Token User 2", "FAIL", 
                                f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Save FCM Token User 2", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Save FCM Token User 2", "FAIL", f"Exception: {str(e)}")
            return False

    def test_6_user1_send_dm_with_push(self) -> bool:
        """Test 6: User 1 sends DM to User 2 (should trigger push notification)"""
        if not self.token1 or not self.user2_sl_id:
            self.log_test("User 1 Send DM with Push", "SKIP", "Missing user tokens or SL-IDs")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            payload = {
                "recipient_sl_id": self.user2_sl_id,
                "content": "Hello! This should trigger a push notification."
            }
            response = requests.post(f"{self.base_url}/dm", headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                self.chat_id = data.get('chat_id')
                message = data.get('message', {})
                recipient = data.get('recipient', {})
                
                if (self.chat_id and 
                    self.chat_id.startswith('private_') and
                    message.get('content') == 'Hello! This should trigger a push notification.' and
                    recipient.get('sl_id') == self.user2_sl_id):
                    
                    self.log_test("User 1 Send DM with Push", "PASS", 
                                f"DM sent successfully. Chat ID: {self.chat_id}. Backend should attempt push notification to {self.user2_fcm_token[:20]}...")
                    return True
                else:
                    self.log_test("User 1 Send DM with Push", "FAIL", 
                                f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("User 1 Send DM with Push", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User 1 Send DM with Push", "FAIL", f"Exception: {str(e)}")
            return False

    def test_7_verify_dm_stored(self) -> bool:
        """Test 7: Verify DM is stored correctly in database"""
        if not self.token2 or not self.chat_id:
            self.log_test("Verify DM Stored", "SKIP", "Missing token or chat_id")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token2}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/dm/{self.chat_id}", headers=headers)
            
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list) and len(messages) >= 1:
                    # Check for the message
                    found_message = False
                    for msg in messages:
                        content = msg.get('content') or msg.get('text', '')
                        if content == 'Hello! This should trigger a push notification.':
                            found_message = True
                            self.log_test("Verify DM Stored", "PASS", 
                                        f"DM found in database with proper content")
                            break
                    
                    if not found_message:
                        self.log_test("Verify DM Stored", "FAIL", 
                                    "DM message not found in database")
                        return False
                        
                    return True
                else:
                    self.log_test("Verify DM Stored", "FAIL", 
                                "No messages found in database")
                    return False
            else:
                self.log_test("Verify DM Stored", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify DM Stored", "FAIL", f"Exception: {str(e)}")
            return False

    def test_8_user2_reply_with_push(self) -> bool:
        """Test 8: User 2 replies to User 1 (should trigger push notification)"""
        if not self.token2 or not self.user1_sl_id:
            self.log_test("User 2 Reply with Push", "SKIP", "Missing User 2 token or User 1 SL-ID")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token2}', 'Content-Type': 'application/json'}
            payload = {
                "recipient_sl_id": self.user1_sl_id,
                "content": "Thanks for the message! Push notification working?"
            }
            response = requests.post(f"{self.base_url}/dm", headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                reply_chat_id = data.get('chat_id')
                message = data.get('message', {})
                
                # Verify it's the same chat ID (deterministic behavior)
                if (reply_chat_id and reply_chat_id.startswith('private_') and
                    message.get('content') == 'Thanks for the message! Push notification working?'):
                    
                    self.log_test("User 2 Reply with Push", "PASS", 
                                f"Reply sent (chat_id: {reply_chat_id}). Backend should attempt push notification to {self.user1_fcm_token[:20]}...")
                    return True
                else:
                    self.log_test("User 2 Reply with Push", "FAIL", 
                                f"Invalid reply response: {data}")
                    return False
            else:
                self.log_test("User 2 Reply with Push", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User 2 Reply with Push", "FAIL", f"Exception: {str(e)}")
            return False

    def test_health_check(self) -> bool:
        """Test: Health Check - Verify backend is running"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                data = response.json()
                services = data.get('services', {})
                if services.get('firestore') == 'connected':
                    self.log_test("Health Check", "PASS", 
                                f"Backend healthy with Firestore")
                    return True
                else:
                    self.log_test("Health Check", "FAIL", 
                                f"Backend unhealthy: {services}")
                    return False
            else:
                self.log_test("Health Check", "FAIL", f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", "FAIL", f"Exception: {str(e)}")
            return False

    def run_fcm_push_notification_test(self) -> Dict[str, bool]:
        """Run the complete FCM Push Notification test flow as per review request"""
        print("🚀 Starting Sanatan Lok FCM Push Notification Test")
        print("Focus: FCM token management and push notification integration")
        print("="*60)
        
        results = {}
        
        # Test sequence as specified in the review request
        test_sequence = [
            ("health_check", self.test_health_check),
            ("create_fcm_user_1", self.test_1_create_fcm_user_1),
            ("save_fcm_token_user1", self.test_2_save_fcm_token_user1),
            ("verify_fcm_token_in_profile", self.test_3_verify_fcm_token_in_profile),
            ("create_second_user", self.test_4_create_second_user),
            ("save_fcm_token_user2", self.test_5_save_fcm_token_user2),
            ("user1_send_dm_with_push", self.test_6_user1_send_dm_with_push),
            ("verify_dm_stored", self.test_7_verify_dm_stored),
            ("user2_reply_with_push", self.test_8_user2_reply_with_push)
        ]
        
        for test_name, test_func in test_sequence:
            results[test_name] = test_func()
            time.sleep(0.5)  # Brief pause between tests
        
        print("="*60)
        print("📊 FCM PUSH NOTIFICATION TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<30}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        # Summary of key findings
        if self.token1 and self.user1_sl_id:
            print(f"\n🔑 FCM Test Results:")
            print(f"   User 1 Phone: {self.user1_phone} -> SL-ID: {self.user1_sl_id}")
            print(f"   User 1 FCM Token: {self.user1_fcm_token[:20]}... (test token)")
            if self.token2 and self.user2_sl_id:
                print(f"   User 2 Phone: {self.user2_phone} -> SL-ID: {self.user2_sl_id}")
                print(f"   User 2 FCM Token: {self.user2_fcm_token[:20]}... (test token)")
            if self.chat_id:
                print(f"   Chat ID: {self.chat_id}")
                print(f"   Chat Format: {'✅ Correct (private_*)' if self.chat_id.startswith('private_') else '❌ Incorrect'}")
        
        # FCM Endpoints Assessment
        fcm_tests = ['save_fcm_token_user1', 'verify_fcm_token_in_profile', 'save_fcm_token_user2']
        fcm_passed = sum(1 for test in fcm_tests if results.get(test, False))
        
        print(f"\n📱 FCM Token Management Assessment:")
        print(f"   FCM Token Tests: {fcm_passed}/{len(fcm_tests)} passed")
        if fcm_passed == len(fcm_tests):
            print("   ✅ FCM token endpoints working correctly")
        elif fcm_passed >= 2:
            print("   ⚠️  FCM token management mostly working, minor issues detected")
        else:
            print("   ❌ FCM token management needs attention")
        
        # Push Notification Assessment
        dm_tests = ['user1_send_dm_with_push', 'verify_dm_stored', 'user2_reply_with_push']
        dm_passed = sum(1 for test in dm_tests if results.get(test, False))
        
        print(f"\n🔔 Push Notification Integration Assessment:")
        print(f"   DM with Push Tests: {dm_passed}/{len(dm_tests)} passed")
        if dm_passed == len(dm_tests):
            print("   ✅ Push notification integration working (mock tokens used)")
        elif dm_passed >= 2:
            print("   ⚠️  Push notification integration mostly working")
        else:
            print("   ❌ Push notification integration needs attention")
        
        print(f"\n💡 Important Notes:")
        print(f"   • Mock OTP used: {self.mock_otp}")
        print(f"   • Test FCM tokens used - actual push won't be sent")
        print(f"   • Backend should attempt FCM send but fail silently with mock tokens")
        print(f"   • Focus was on endpoint functionality, not actual push delivery")
        
        # Overall assessment
        if passed == total:
            print("\n🎉 All FCM push notification tests passed! Endpoints working correctly.")
        elif passed >= total * 0.8:
            print("\n⚠️  Most tests passed, FCM functionality mostly working.")
        else:
            print("\n❌ Multiple failures detected. FCM implementation needs significant fixes.")
            
        return results


if __name__ == "__main__":
    tester = SanatanLokTester()
    results = tester.run_fcm_push_notification_test()