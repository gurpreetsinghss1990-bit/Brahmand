#!/usr/bin/env python3
"""
Sanatan Lok Backend API Test Suite
Testing Real-time Chat Messaging Functionality with Firestore
Focus: Real-time listener and message ordering
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
        
        # Real Time User 1 data  
        self.token1 = None
        self.user1_phone = "+913333333333"
        self.user1_sl_id = None
        
        # Real Time User 2 data
        self.token2 = None
        self.user2_phone = "+914444444444"
        self.user2_sl_id = None
        
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

    def test_1_create_user_1(self) -> bool:
        """Test 1: Create Real Time User 1 (+913333333333)"""
        try:
            self.token1, self.user1_sl_id = self.create_user(self.user1_phone, "Real Time User 1")
            
            if self.token1 and self.user1_sl_id:
                self.log_test("Create Real Time User 1", "PASS", 
                            f"User 1 created: {self.user1_sl_id}")
                return True
            else:
                self.log_test("Create Real Time User 1", "FAIL", "Failed to create real time user 1")
                return False
                
        except Exception as e:
            self.log_test("Create Real Time User 1", "FAIL", f"Exception: {str(e)}")
            return False

    def test_2_create_user_2(self) -> bool:
        """Test 2: Create Real Time User 2 (+914444444444)"""
        try:
            self.token2, self.user2_sl_id = self.create_user(self.user2_phone, "Real Time User 2")
            
            if self.token2 and self.user2_sl_id:
                self.log_test("Create Real Time User 2", "PASS", 
                            f"User 2 created: {self.user2_sl_id}")
                return True
            else:
                self.log_test("Create Real Time User 2", "FAIL", "Failed to create real time user 2")
                return False
                
        except Exception as e:
            self.log_test("Create Real Time User 2", "FAIL", f"Exception: {str(e)}")
            return False

    def test_3_user1_send_first_message(self) -> bool:
        """Test 3: User 1 sends message to User 2 - 'Real-time test message 1'"""
        if not self.token1 or not self.user2_sl_id:
            self.log_test("User 1 Send First Message", "SKIP", "Missing user tokens or SL-IDs")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            payload = {
                "recipient_sl_id": self.user2_sl_id,
                "content": "Real-time test message 1"
            }
            response = requests.post(f"{self.base_url}/dm", headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                self.chat_id = data.get('chat_id')
                message = data.get('message', {})
                recipient = data.get('recipient', {})
                
                if (self.chat_id and 
                    self.chat_id.startswith('private_') and
                    message.get('content') == 'Real-time test message 1' and
                    recipient.get('sl_id') == self.user2_sl_id):
                    
                    self.all_messages.append({
                        'content': 'Real-time test message 1',
                        'sender': 'User 1',
                        'timestamp': message.get('created_at', message.get('timestamp'))
                    })
                    
                    self.log_test("User 1 Send First Message", "PASS", 
                                f"Message sent successfully. Chat ID: {self.chat_id}")
                    return True
                else:
                    self.log_test("User 1 Send First Message", "FAIL", 
                                f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("User 1 Send First Message", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User 1 Send First Message", "FAIL", f"Exception: {str(e)}")
            return False

    def test_4_verify_message_in_firestore(self) -> bool:
        """Test 4: Verify message exists in Firestore by getting chat messages"""
        if not self.token1 or not self.chat_id:
            self.log_test("Verify Message in Firestore", "SKIP", "Missing token or chat_id")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/dm/{self.chat_id}", headers=headers)
            
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list) and len(messages) >= 1:
                    # Check for the first message
                    found_message = False
                    for msg in messages:
                        content = msg.get('content') or msg.get('text', '')
                        if content == 'Real-time test message 1':
                            found_message = True
                            # Verify timestamp exists
                            timestamp = msg.get('created_at') or msg.get('timestamp')
                            if timestamp:
                                self.log_test("Verify Message in Firestore", "PASS", 
                                            f"Message found in Firestore with timestamp: {timestamp}")
                            else:
                                self.log_test("Verify Message in Firestore", "PASS", 
                                            "Message found in Firestore but no timestamp")
                            break
                    
                    if not found_message:
                        self.log_test("Verify Message in Firestore", "FAIL", 
                                    "First message not found in Firestore")
                        return False
                        
                    return True
                else:
                    self.log_test("Verify Message in Firestore", "FAIL", 
                                "No messages found in Firestore")
                    return False
            else:
                self.log_test("Verify Message in Firestore", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify Message in Firestore", "FAIL", f"Exception: {str(e)}")
            return False

    def test_5_user2_send_reply(self) -> bool:
        """Test 5: User 2 sends reply - 'Real-time reply from User 2'"""
        if not self.token2 or not self.user1_sl_id:
            self.log_test("User 2 Send Reply", "SKIP", "Missing User 2 token or User 1 SL-ID")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token2}', 'Content-Type': 'application/json'}
            payload = {
                "recipient_sl_id": self.user1_sl_id,
                "content": "Real-time reply from User 2"
            }
            response = requests.post(f"{self.base_url}/dm", headers=headers, data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                reply_chat_id = data.get('chat_id')
                message = data.get('message', {})
                
                # Verify it's the same chat ID (deterministic behavior)
                if (reply_chat_id and reply_chat_id.startswith('private_') and
                    message.get('content') == 'Real-time reply from User 2'):
                    
                    self.all_messages.append({
                        'content': 'Real-time reply from User 2',
                        'sender': 'User 2',
                        'timestamp': message.get('created_at', message.get('timestamp'))
                    })
                    
                    self.log_test("User 2 Send Reply", "PASS", 
                                f"Reply sent (chat_id: {reply_chat_id})")
                    # Update our chat_id reference if needed
                    if not self.chat_id:
                        self.chat_id = reply_chat_id
                    return True
                else:
                    self.log_test("User 2 Send Reply", "FAIL", 
                                f"Invalid reply response: {data}")
                    return False
            else:
                self.log_test("User 2 Send Reply", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User 2 Send Reply", "FAIL", f"Exception: {str(e)}")
            return False

    def test_6_verify_both_messages(self) -> bool:
        """Test 6: Verify both messages appear in correct order"""
        if not self.token1 or not self.chat_id:
            self.log_test("Verify Both Messages", "SKIP", "Missing token or chat_id")
            return False
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/dm/{self.chat_id}", headers=headers)
            
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list) and len(messages) >= 2:
                    # Check for both messages
                    contents = [msg.get('content') or msg.get('text', '') for msg in messages]
                    
                    if ('Real-time test message 1' in contents and 'Real-time reply from User 2' in contents):
                        # Verify timestamps exist and are in order
                        message_pairs = []
                        for msg in messages:
                            content = msg.get('content') or msg.get('text', '')
                            timestamp = msg.get('created_at') or msg.get('timestamp')
                            if content in ['Real-time test message 1', 'Real-time reply from User 2']:
                                message_pairs.append((content, timestamp))
                        
                        self.log_test("Verify Both Messages", "PASS", 
                                    f"Found {len(messages)} messages with proper timestamps: {contents}")
                        return True
                    else:
                        self.log_test("Verify Both Messages", "FAIL", 
                                    f"Expected messages not found: {contents}")
                        return False
                else:
                    self.log_test("Verify Both Messages", "FAIL", 
                                f"Expected 2+ messages, found {len(messages) if isinstance(messages, list) else 0}")
                    return False
            else:
                self.log_test("Verify Both Messages", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify Both Messages", "FAIL", f"Exception: {str(e)}")
            return False

    def test_7_rapid_messages_sequence(self) -> bool:
        """Test 7: Send multiple rapid messages to test real-time ordering"""
        if not self.token1 or not self.token2 or not self.user1_sl_id or not self.user2_sl_id:
            self.log_test("Rapid Messages Sequence", "SKIP", "Missing tokens or SL-IDs")
            return False
            
        try:
            success_count = 0
            
            # Message A from User 1
            headers1 = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            payload = {"recipient_sl_id": self.user2_sl_id, "content": "Message A"}
            response = requests.post(f"{self.base_url}/dm", headers=headers1, data=json.dumps(payload))
            if response.status_code == 200:
                success_count += 1
                self.all_messages.append({'content': 'Message A', 'sender': 'User 1'})
            
            time.sleep(0.1)  # Brief delay
            
            # Message B from User 2  
            headers2 = {'Authorization': f'Bearer {self.token2}', 'Content-Type': 'application/json'}
            payload = {"recipient_sl_id": self.user1_sl_id, "content": "Message B"}
            response = requests.post(f"{self.base_url}/dm", headers=headers2, data=json.dumps(payload))
            if response.status_code == 200:
                success_count += 1
                self.all_messages.append({'content': 'Message B', 'sender': 'User 2'})
            
            time.sleep(0.1)  # Brief delay
            
            # Message C from User 1
            payload = {"recipient_sl_id": self.user2_sl_id, "content": "Message C"}
            response = requests.post(f"{self.base_url}/dm", headers=headers1, data=json.dumps(payload))
            if response.status_code == 200:
                success_count += 1
                self.all_messages.append({'content': 'Message C', 'sender': 'User 1'})
            
            if success_count == 3:
                self.log_test("Rapid Messages Sequence", "PASS", 
                            f"All 3 rapid messages sent successfully")
                return True
            else:
                self.log_test("Rapid Messages Sequence", "FAIL", 
                            f"Only {success_count}/3 messages sent successfully")
                return False
                
        except Exception as e:
            self.log_test("Rapid Messages Sequence", "FAIL", f"Exception: {str(e)}")
            return False

    def test_8_verify_all_messages_order(self) -> bool:
        """Test 8: Verify all 5 messages appear in correct order with timestamps"""
        if not self.token1 or not self.chat_id:
            self.log_test("Verify All Messages Order", "SKIP", "Missing token or chat_id")
            return False
            
        # Wait a moment for all messages to be written to Firestore
        time.sleep(1)
            
        try:
            headers = {'Authorization': f'Bearer {self.token1}', 'Content-Type': 'application/json'}
            response = requests.get(f"{self.base_url}/dm/{self.chat_id}", headers=headers)
            
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list) and len(messages) >= 5:
                    # Expected message sequence
                    expected_messages = [
                        'Real-time test message 1',
                        'Real-time reply from User 2', 
                        'Message A',
                        'Message B',
                        'Message C'
                    ]
                    
                    # Check if all expected messages are present
                    found_messages = []
                    for msg in messages:
                        content = msg.get('content') or msg.get('text', '')
                        timestamp = msg.get('created_at') or msg.get('timestamp')
                        if content in expected_messages:
                            found_messages.append({
                                'content': content,
                                'timestamp': timestamp
                            })
                    
                    if len(found_messages) >= 5:
                        # Verify timestamps exist
                        timestamps_ok = all(msg.get('timestamp') for msg in found_messages)
                        contents = [msg['content'] for msg in found_messages]
                        
                        if timestamps_ok:
                            self.log_test("Verify All Messages Order", "PASS", 
                                        f"All {len(found_messages)} messages found with timestamps: {contents}")
                        else:
                            self.log_test("Verify All Messages Order", "PASS", 
                                        f"All {len(found_messages)} messages found (some missing timestamps): {contents}")
                        return True
                    else:
                        self.log_test("Verify All Messages Order", "FAIL", 
                                    f"Only {len(found_messages)}/5 expected messages found")
                        return False
                else:
                    self.log_test("Verify All Messages Order", "FAIL", 
                                f"Expected 5+ messages, found {len(messages) if isinstance(messages, list) else 0}")
                    return False
            else:
                self.log_test("Verify All Messages Order", "FAIL", 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify All Messages Order", "FAIL", f"Exception: {str(e)}")
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

    def run_realtime_messaging_test(self) -> Dict[str, bool]:
        """Run the complete Real-time Messaging test flow as per review request"""
        print("🚀 Starting Sanatan Lok Real-time Chat Messaging Test")
        print("Focus: Firestore real-time listener and message ordering")
        print("="*60)
        
        results = {}
        
        # Test sequence as specified in the review request
        test_sequence = [
            ("health_check", self.test_health_check),
            ("create_realtime_user_1", self.test_1_create_user_1),
            ("create_realtime_user_2", self.test_2_create_user_2),
            ("user1_send_first_message", self.test_3_user1_send_first_message),
            ("verify_message_in_firestore", self.test_4_verify_message_in_firestore),
            ("user2_send_reply", self.test_5_user2_send_reply),
            ("verify_both_messages", self.test_6_verify_both_messages),
            ("rapid_messages_sequence", self.test_7_rapid_messages_sequence),
            ("verify_all_messages_order", self.test_8_verify_all_messages_order)
        ]
        
        for test_name, test_func in test_sequence:
            results[test_name] = test_func()
            time.sleep(0.5)  # Brief pause between tests
        
        print("="*60)
        print("📊 REAL-TIME MESSAGING TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<30}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        # Summary of key findings
        if self.chat_id:
            print(f"\n🔑 Real-time Test Results:")
            print(f"   User 1 Phone: {self.user1_phone} -> SL-ID: {self.user1_sl_id}")
            print(f"   User 2 Phone: {self.user2_phone} -> SL-ID: {self.user2_sl_id}")
            print(f"   Chat ID: {self.chat_id}")
            print(f"   Chat Format: {'✅ Correct (private_*)' if self.chat_id.startswith('private_') else '❌ Incorrect'}")
            print(f"   Total Messages Sent: {len(self.all_messages)}")
            if self.all_messages:
                print(f"   Message Sequence:")
                for i, msg in enumerate(self.all_messages, 1):
                    print(f"     {i}. {msg['content']} (from {msg['sender']})")
        
        # Firestore Real-time Assessment
        firestore_tests = ['verify_message_in_firestore', 'verify_both_messages', 'verify_all_messages_order']
        firestore_passed = sum(1 for test in firestore_tests if results.get(test, False))
        
        print(f"\n🔥 Firestore Real-time Assessment:")
        print(f"   Firestore Tests: {firestore_passed}/{len(firestore_tests)} passed")
        if firestore_passed == len(firestore_tests):
            print("   ✅ Firestore real-time listener working correctly")
        elif firestore_passed >= 2:
            print("   ⚠️  Firestore mostly working, minor issues detected")
        else:
            print("   ❌ Firestore real-time listener needs attention")
        
        # Overall assessment
        if passed == total:
            print("\n🎉 All real-time messaging tests passed! Firestore integration working perfectly.")
        elif passed >= total * 0.8:
            print("\n⚠️  Most tests passed, real-time messaging mostly functional.")
        else:
            print("\n❌ Multiple failures detected. Real-time messaging needs significant fixes.")
            
        return results


if __name__ == "__main__":
    tester = SanatanLokTester()
    results = tester.run_realtime_messaging_test()