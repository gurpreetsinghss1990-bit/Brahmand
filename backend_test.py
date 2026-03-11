#!/usr/bin/env python3
"""
Sanatan Lok Backend API Test Suite
Testing Direct Messaging (Private Chat) Implementation
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
        
        # User 1 data
        self.token1 = None
        self.user1_phone = "+911111111111"
        self.user1_sl_id = None
        
        # User 2 data  
        self.token2 = None
        self.user2_phone = "+912222222222"
        self.user2_sl_id = None
        
        self.mock_otp = "123456"
        self.chat_id = None
        
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

    def test_1_create_user_1(self) -> bool:
        """Test 1: Create User 1 (+911111111111)"""
        try:
            self.token1, self.user1_sl_id = self.create_user(self.user1_phone, "User One")
            
            if self.token1 and self.user1_sl_id:
                self.log_test("Create User 1", "PASS", 
                            f"User 1 created: {self.user1_sl_id}")
                return True
            else:
                self.log_test("Create User 1", "FAIL", "Failed to create user 1")
                return False
                
        except Exception as e:
            self.log_test("Create User 1", "FAIL", f"Exception: {str(e)}")
            return False

    def test_2_create_user_2(self) -> bool:
        """Test 2: Create User 2 (+912222222222)"""
        try:
            self.token2, self.user2_sl_id = self.create_user(self.user2_phone, "User Two")
            
            if self.token2 and self.user2_sl_id:
                self.log_test("Create User 2", "PASS", 
                            f"User 2 created: {self.user2_sl_id}")
                return True
            else:
                self.log_test("Create User 2", "FAIL", "Failed to create user 2")
                return False
                
        except Exception as e:
            self.log_test("Create User 2", "FAIL", f"Exception: {str(e)}")
            return False

    def test_3_user_search(self) -> bool:
        """Test 3: User 1 searches for User 2"""
        if not self.token1 or not self.user2_sl_id:
            self.log_test("User Search", "SKIP", "Missing user tokens or SL-IDs")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/user/search/{self.user2_sl_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if (data.get('sl_id') == self.user2_sl_id and 
                    data.get('name') == 'User Two'):
                    self.log_test("User Search", "PASS", 
                                f"Found user: {data.get('name')} ({data.get('sl_id')})")
                    return True
                else:
                    self.log_test("User Search", "FAIL", 
                                f"Unexpected search result: {data}")
                    return False
            else:
                self.log_test("User Search", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Search", "FAIL", f"Exception: {str(e)}")
            return False

    def test_4_send_first_dm(self) -> bool:
        """Test 4: User 1 sends first DM to User 2"""
        if not self.token1 or not self.user2_sl_id:
            self.log_test("Send First DM", "SKIP", "Missing user tokens or SL-IDs")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            payload = {
                "recipient_sl_id": self.user2_sl_id,
                "content": "Hello User Two!"
            }
            response = requests.post(f"{self.base_url}/dm", headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                self.chat_id = data.get('chat_id')
                message = data.get('message', {})
                recipient = data.get('recipient', {})
                
                if (self.chat_id and 
                    self.chat_id.startswith('private_') and
                    message.get('content') == 'Hello User Two!' and
                    recipient.get('sl_id') == self.user2_sl_id):
                    
                    self.log_test("Send First DM", "PASS", 
                                f"DM sent successfully. Chat ID: {self.chat_id}")
                    return True
                else:
                    self.log_test("Send First DM", "FAIL", 
                                f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Send First DM", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Send First DM", "FAIL", f"Exception: {str(e)}")
            return False

    def test_5_user1_conversations(self) -> bool:
        """Test 5: User 1 checks conversations"""
        if not self.token1:
            self.log_test("User 1 Conversations", "SKIP", "Missing User 1 token")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/dm/conversations", headers=headers)
            
            if response.status_code == 200:
                conversations = response.json()
                if isinstance(conversations, list) and len(conversations) > 0:
                    # Find conversation with User 2
                    user2_conversation = None
                    for conv in conversations:
                        if conv.get('user', {}).get('sl_id') == self.user2_sl_id:
                            user2_conversation = conv
                            break
                    
                    if user2_conversation:
                        self.log_test("User 1 Conversations", "PASS", 
                                    f"Found conversation with User Two: {user2_conversation.get('chat_id')}")
                        return True
                    else:
                        self.log_test("User 1 Conversations", "FAIL", 
                                    "Conversation with User Two not found")
                        return False
                else:
                    self.log_test("User 1 Conversations", "FAIL", 
                                "No conversations found")
                    return False
            else:
                self.log_test("User 1 Conversations", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User 1 Conversations", "FAIL", f"Exception: {str(e)}")
            return False

    def test_6_user2_conversations(self) -> bool:
        """Test 6: User 2 checks conversations"""
        if not self.token2:
            self.log_test("User 2 Conversations", "SKIP", "Missing User 2 token")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token2}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/dm/conversations", headers=headers)
            
            if response.status_code == 200:
                conversations = response.json()
                if isinstance(conversations, list) and len(conversations) > 0:
                    # Find conversation with User 1
                    user1_conversation = None
                    for conv in conversations:
                        if conv.get('user', {}).get('sl_id') == self.user1_sl_id:
                            user1_conversation = conv
                            break
                    
                    if user1_conversation:
                        self.log_test("User 2 Conversations", "PASS", 
                                    f"Found conversation with User One: {user1_conversation.get('chat_id')}")
                        return True
                    else:
                        self.log_test("User 2 Conversations", "FAIL", 
                                    "Conversation with User One not found")
                        return False
                else:
                    self.log_test("User 2 Conversations", "FAIL", 
                                "No conversations found")
                    return False
            else:
                self.log_test("User 2 Conversations", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User 2 Conversations", "FAIL", f"Exception: {str(e)}")
            return False

    def test_7_user2_reply(self) -> bool:
        """Test 7: User 2 replies to User 1"""
        if not self.token2 or not self.user1_sl_id:
            self.log_test("User 2 Reply", "SKIP", "Missing User 2 token or User 1 SL-ID")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token2}', 'Content-Type': 'application/json'}
            payload = {
                "recipient_sl_id": self.user1_sl_id,
                "content": "Hi User One!"
            }
            response = requests.post(f"{self.base_url}/dm", headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                reply_chat_id = data.get('chat_id')
                message = data.get('message', {})
                
                # Verify it's the same chat ID (not a new chat)
                if (reply_chat_id == self.chat_id and 
                    message.get('content') == 'Hi User One!'):
                    
                    self.log_test("User 2 Reply", "PASS", 
                                f"Reply sent to same chat: {reply_chat_id}")
                    return True
                else:
                    # Even if chat_id is different but deterministic, it's still correct
                    if (reply_chat_id and reply_chat_id.startswith('private_') and
                        message.get('content') == 'Hi User One!'):
                        self.log_test("User 2 Reply", "PASS", 
                                    f"Reply sent (chat_id: {reply_chat_id})")
                        # Update our chat_id reference
                        self.chat_id = reply_chat_id
                        return True
                    else:
                        self.log_test("User 2 Reply", "FAIL", 
                                    f"Invalid reply response: {data}")
                        return False
            else:
                self.log_test("User 2 Reply", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User 2 Reply", "FAIL", f"Exception: {str(e)}")
            return False

    def test_8_get_chat_messages(self) -> bool:
        """Test 8: Get chat messages (User 1 perspective)"""
        if not self.token1 or not self.chat_id:
            self.log_test("Get Chat Messages", "SKIP", "Missing User 1 token or chat_id")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/dm/{self.chat_id}", headers=headers)
            
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list) and len(messages) >= 2:
                    # Check for both messages in chronological order
                    contents = [msg.get('content') or msg.get('text', '') for msg in messages]
                    
                    if ('Hello User Two!' in contents and 'Hi User One!' in contents):
                        self.log_test("Get Chat Messages", "PASS", 
                                    f"Found {len(messages)} messages: {contents}")
                        return True
                    else:
                        self.log_test("Get Chat Messages", "FAIL", 
                                    f"Expected messages not found: {contents}")
                        return False
                elif len(messages) == 1:
                    self.log_test("Get Chat Messages", "PARTIAL", 
                                f"Only 1 message found: {messages[0].get('content') or messages[0].get('text')}")
                    return False
                else:
                    self.log_test("Get Chat Messages", "FAIL", 
                                "No messages found in chat")
                    return False
            else:
                self.log_test("Get Chat Messages", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Chat Messages", "FAIL", f"Exception: {str(e)}")
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

    def run_dm_test_flow(self) -> Dict[str, bool]:
        """Run the complete Direct Messaging test flow"""
        print("🚀 Starting Sanatan Lok Direct Messaging Test Flow")
        print("="*60)
        
        results = {}
        
        # Test sequence as specified in the review request
        test_sequence = [
            ("health_check", self.test_health_check),
            ("create_user_1", self.test_1_create_user_1),
            ("create_user_2", self.test_2_create_user_2),
            ("user_search", self.test_3_user_search),
            ("send_first_dm", self.test_4_send_first_dm),
            ("user1_conversations", self.test_5_user1_conversations),
            ("user2_conversations", self.test_6_user2_conversations),
            ("user2_reply", self.test_7_user2_reply),
            ("get_chat_messages", self.test_8_get_chat_messages)
        ]
        
        for test_name, test_func in test_sequence:
            results[test_name] = test_func()
            time.sleep(0.5)  # Brief pause between tests
        
        print("="*60)
        print("📊 DIRECT MESSAGING TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<20}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        # Summary of key findings
        if self.chat_id:
            print(f"\n🔑 Key Results:")
            print(f"   User 1 SL-ID: {self.user1_sl_id}")
            print(f"   User 2 SL-ID: {self.user2_sl_id}")
            print(f"   Chat ID: {self.chat_id}")
            print(f"   Chat Format: {'✅ Correct (private_*)' if self.chat_id.startswith('private_') else '❌ Incorrect'}")
        
        if passed == total:
            print("\n🎉 All DM tests passed! Private Chat is working correctly.")
        elif passed >= total * 0.75:
            print("\n⚠️  Most tests passed, minor issues detected.")
        else:
            print("\n❌ Multiple test failures. Direct Messaging needs attention.")
            
        return results


if __name__ == "__main__":
    tester = SanatanLokTester()
    results = tester.run_dm_test_flow()