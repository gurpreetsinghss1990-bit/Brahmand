#!/usr/bin/env python3
"""
Backend API Testing Script for Circle Feature
Comprehensive test for all Circle endpoints based on review request
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

BASE_URL = "https://brahmand-vendors.preview.emergentagent.com/api"

class CircleTestSuite:
    def __init__(self):
        self.session = None
        self.user_a_token = None
        self.user_b_token = None
        self.user_a_id = None
        self.user_b_id = None
        self.user_a_sl_id = None
        self.user_b_sl_id = None
        self.circle_id = None
        self.circle_code = None
        self.second_circle_id = None
        self.second_circle_code = None
        self.test_results = []

    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'Content-Type': 'application/json'}
        )

    async def teardown_session(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} | {test_name}"
        if details:
            result += f" | {details}"
        print(result)
        self.test_results.append((test_name, success, details))

    async def make_request(self, method: str, endpoint: str, data: dict = None, token: str = None):
        """Make HTTP request"""
        url = f"{BASE_URL}{endpoint}"
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                async with self.session.get(url, headers=headers) as resp:
                    return resp.status, await resp.json()
            elif method == 'POST':
                async with self.session.post(url, json=data, headers=headers) as resp:
                    return resp.status, await resp.json()
            elif method == 'PUT':
                async with self.session.put(url, json=data, headers=headers) as resp:
                    return resp.status, await resp.json()
            elif method == 'DELETE':
                async with self.session.delete(url, headers=headers) as resp:
                    return resp.status, await resp.json()
        except Exception as e:
            return 500, {"error": str(e)}

    async def test_01_create_user_a(self):
        """Create User A with OTP auth"""
        print("\n=== Test 1: Create User A (+911111100001) ===")
        
        # Send OTP
        status, response = await self.make_request('POST', '/auth/send-otp', {
            "phone": "+911111100001"
        })
        
        if status != 200:
            self.log_result("User A OTP Send", False, f"Status: {status}, Response: {response}")
            return False

        # Verify OTP (mock: 123456)
        status, response = await self.make_request('POST', '/auth/verify-otp', {
            "phone": "+911111100001",
            "otp": "123456"
        })
        
        if status != 200 or not response.get('is_new_user'):
            self.log_result("User A OTP Verify", False, f"Status: {status}, Response: {response}")
            return False

        # Register User A
        status, response = await self.make_request('POST', '/auth/register', {
            "phone": "+911111100001",
            "name": "User Alpha",
            "language": "English"
        })
        
        if status != 200 or not response.get('token'):
            self.log_result("User A Registration", False, f"Status: {status}, Response: {response}")
            return False

        self.user_a_token = response['token']
        self.user_a_id = response['user']['id']
        self.user_a_sl_id = response['user']['sl_id']
        
        self.log_result("User A Creation", True, f"SL-ID: {self.user_a_sl_id}, ID: {self.user_a_id}")
        return True

    async def test_02_create_user_b(self):
        """Create User B with OTP auth"""
        print("\n=== Test 2: Create User B (+911111100002) ===")
        
        # Send OTP
        status, response = await self.make_request('POST', '/auth/send-otp', {
            "phone": "+911111100002"
        })
        
        if status != 200:
            self.log_result("User B OTP Send", False, f"Status: {status}, Response: {response}")
            return False

        # Verify OTP (mock: 123456)
        status, response = await self.make_request('POST', '/auth/verify-otp', {
            "phone": "+911111100002",
            "otp": "123456"
        })
        
        if status != 200 or not response.get('is_new_user'):
            self.log_result("User B OTP Verify", False, f"Status: {status}, Response: {response}")
            return False

        # Register User B
        status, response = await self.make_request('POST', '/auth/register', {
            "phone": "+911111100002",
            "name": "User Beta",
            "language": "English"
        })
        
        if status != 200 or not response.get('token'):
            self.log_result("User B Registration", False, f"Status: {status}, Response: {response}")
            return False

        self.user_b_token = response['token']
        self.user_b_id = response['user']['id']
        self.user_b_sl_id = response['user']['sl_id']
        
        self.log_result("User B Creation", True, f"SL-ID: {self.user_b_sl_id}, ID: {self.user_b_id}")
        return True

    async def test_03_create_circle(self):
        """Test Circle Creation (User A)"""
        print("\n=== Test 3: Create Circle (User A) ===")
        
        status, response = await self.make_request('POST', '/circles', {
            "name": "Family Circle",
            "description": "A circle for my family members",
            "privacy": "private"
        }, self.user_a_token)
        
        if status != 200:
            self.log_result("Circle Creation", False, f"Status: {status}, Response: {response}")
            return False

        # Validate response
        required_fields = ['id', 'name', 'description', 'code', 'privacy', 'creator_id', 'admin_id', 'member_count', 'is_admin']
        for field in required_fields:
            if field not in response:
                self.log_result("Circle Creation", False, f"Missing field: {field}")
                return False

        self.circle_id = response['id']
        self.circle_code = response['code']
        
        # Validate values
        if (response['name'] != "Family Circle" or 
            response['description'] != "A circle for my family members" or
            response['privacy'] != "private" or
            response['creator_id'] != self.user_a_id or
            response['admin_id'] != self.user_a_id or
            response['member_count'] != 1 or
            response['is_admin'] != True):
            self.log_result("Circle Creation", False, f"Invalid values in response: {response}")
            return False

        self.log_result("Circle Creation", True, f"Circle ID: {self.circle_id}, Code: {self.circle_code}")
        return True

    async def test_04_get_circles(self):
        """Test Get Circles (User A)"""
        print("\n=== Test 4: Get Circles (User A) ===")
        
        status, response = await self.make_request('GET', '/circles', token=self.user_a_token)
        
        if status != 200:
            self.log_result("Get Circles", False, f"Status: {status}, Response: {response}")
            return False

        if not isinstance(response, list) or len(response) == 0:
            self.log_result("Get Circles", False, f"Expected non-empty list, got: {response}")
            return False

        # Check if created circle is in the list
        found_circle = None
        for circle in response:
            if circle.get('id') == self.circle_id:
                found_circle = circle
                break

        if not found_circle:
            self.log_result("Get Circles", False, f"Created circle not found in list: {response}")
            return False

        self.log_result("Get Circles", True, f"Found {len(response)} circles, including created circle")
        return True

    async def test_05_get_circle_details(self):
        """Test Get Circle Details (User A)"""
        print("\n=== Test 5: Get Circle Details (User A) ===")
        
        status, response = await self.make_request('GET', f'/circles/{self.circle_id}', token=self.user_a_token)
        
        if status != 200:
            self.log_result("Get Circle Details", False, f"Status: {status}, Response: {response}")
            return False

        # Validate response has members list
        if 'members' not in response:
            self.log_result("Get Circle Details", False, f"Missing members field: {response}")
            return False

        if not isinstance(response['members'], list) or len(response['members']) != 1:
            self.log_result("Get Circle Details", False, f"Expected 1 member, got: {len(response['members'])}")
            return False

        # Check if User A is in members
        if response['members'][0]['user_id'] != self.user_a_id:
            self.log_result("Get Circle Details", False, f"User A not found in members: {response['members']}")
            return False

        self.log_result("Get Circle Details", True, f"Circle has {len(response['members'])} member(s)")
        return True

    async def test_06_join_circle_with_code(self):
        """Test Join Circle with Code (User B)"""
        print("\n=== Test 6: Join Circle with Code (User B) ===")
        
        status, response = await self.make_request('POST', '/circles/join', {
            "code": self.circle_code
        }, self.user_b_token)
        
        if status != 200:
            self.log_result("Join Circle with Code", False, f"Status: {status}, Response: {response}")
            return False

        # For private circles, should return "pending" status
        if response.get('status') != 'pending':
            self.log_result("Join Circle with Code", False, f"Expected 'pending' status, got: {response}")
            return False

        self.log_result("Join Circle with Code", True, f"Join request sent, status: {response.get('status')}")
        return True

    async def test_07_get_join_requests(self):
        """Test Get Join Requests (User A - Admin)"""
        print("\n=== Test 7: Get Join Requests (User A - Admin) ===")
        
        status, response = await self.make_request('GET', f'/circles/{self.circle_id}/requests', token=self.user_a_token)
        
        if status != 200:
            self.log_result("Get Join Requests", False, f"Status: {status}, Response: {response}")
            return False

        if not isinstance(response, list):
            self.log_result("Get Join Requests", False, f"Expected list, got: {response}")
            return False

        # Should have User B's request
        found_request = None
        for request in response:
            if request.get('user_id') == self.user_b_id:
                found_request = request
                break

        if not found_request:
            self.log_result("Get Join Requests", False, f"User B's request not found in: {response}")
            return False

        self.log_result("Get Join Requests", True, f"Found {len(response)} pending request(s), including User B's")
        return True

    async def test_08_approve_request(self):
        """Test Approve Request (User A)"""
        print("\n=== Test 8: Approve Request (User A) ===")
        
        status, response = await self.make_request('POST', f'/circles/{self.circle_id}/approve/{self.user_b_id}', 
                                                 token=self.user_a_token)
        
        if status != 200:
            self.log_result("Approve Request", False, f"Status: {status}, Response: {response}")
            return False

        # Verify User B is now a member - check circle details
        status, circle_response = await self.make_request('GET', f'/circles/{self.circle_id}', token=self.user_a_token)
        
        if status != 200:
            self.log_result("Approve Request", False, f"Failed to get circle after approval: {status}")
            return False

        # Check if User B is in members
        user_b_found = False
        for member in circle_response.get('members', []):
            if member.get('user_id') == self.user_b_id:
                user_b_found = True
                break

        if not user_b_found:
            self.log_result("Approve Request", False, f"User B not found in members after approval: {circle_response.get('members')}")
            return False

        self.log_result("Approve Request", True, f"User B approved and added to circle")
        return True

    async def test_09_circle_messaging(self):
        """Test Circle Messaging"""
        print("\n=== Test 9: Circle Messaging ===")
        
        # User A sends message
        status, response = await self.make_request('POST', f'/messages/circle/{self.circle_id}', {
            "content": "Hello everyone!",
            "message_type": "text"
        }, self.user_a_token)
        
        if status != 200:
            self.log_result("Circle Messaging - User A", False, f"Status: {status}, Response: {response}")
            return False

        # User B sends message
        status, response = await self.make_request('POST', f'/messages/circle/{self.circle_id}', {
            "content": "Hi back!",
            "message_type": "text"
        }, self.user_b_token)
        
        if status != 200:
            self.log_result("Circle Messaging - User B", False, f"Status: {status}, Response: {response}")
            return False

        # Get messages
        status, messages = await self.make_request('GET', f'/messages/circle/{self.circle_id}', token=self.user_a_token)
        
        if status != 200:
            self.log_result("Circle Messaging - Get Messages", False, f"Status: {status}, Response: {messages}")
            return False

        if not isinstance(messages, list) or len(messages) != 2:
            self.log_result("Circle Messaging - Get Messages", False, f"Expected 2 messages, got: {len(messages) if isinstance(messages, list) else 'not list'}")
            return False

        # Check message contents
        message_contents = [msg.get('content') for msg in messages]
        if "Hello everyone!" not in message_contents or "Hi back!" not in message_contents:
            self.log_result("Circle Messaging - Get Messages", False, f"Messages not found: {message_contents}")
            return False

        self.log_result("Circle Messaging", True, f"Both messages sent and retrieved successfully")
        return True

    async def test_10_circle_with_invite_code_privacy(self):
        """Test Circle with Invite Code Privacy"""
        print("\n=== Test 10: Circle with Invite Code Privacy ===")
        
        # User A creates another circle with privacy "invite_code"
        status, response = await self.make_request('POST', '/circles', {
            "name": "Open Circle",
            "description": "A circle with invite code privacy",
            "privacy": "invite_code"
        }, self.user_a_token)
        
        if status != 200:
            self.log_result("Create Invite Code Circle", False, f"Status: {status}, Response: {response}")
            return False

        self.second_circle_id = response['id']
        self.second_circle_code = response['code']
        
        # User B joins using code - should join directly without approval
        status, response = await self.make_request('POST', '/circles/join', {
            "code": self.second_circle_code
        }, self.user_b_token)
        
        if status != 200:
            self.log_result("Join Invite Code Circle", False, f"Status: {status}, Response: {response}")
            return False

        # Should return "joined" status for invite_code privacy
        if response.get('status') != 'joined':
            self.log_result("Join Invite Code Circle", False, f"Expected 'joined' status, got: {response}")
            return False

        # Verify User B is immediately a member
        status, circle_response = await self.make_request('GET', f'/circles/{self.second_circle_id}', token=self.user_a_token)
        
        if status != 200:
            self.log_result("Verify Invite Code Join", False, f"Failed to get circle: {status}")
            return False

        user_b_found = False
        for member in circle_response.get('members', []):
            if member.get('user_id') == self.user_b_id:
                user_b_found = True
                break

        if not user_b_found:
            self.log_result("Verify Invite Code Join", False, f"User B not found in members: {circle_response.get('members')}")
            return False

        self.log_result("Circle with Invite Code Privacy", True, f"User B joined directly without approval")
        return True

    async def test_11_leave_circle(self):
        """Test Leave Circle (User B)"""
        print("\n=== Test 11: Leave Circle (User B) ===")
        
        status, response = await self.make_request('POST', f'/circles/{self.circle_id}/leave', 
                                                 token=self.user_b_token)
        
        if status != 200:
            self.log_result("Leave Circle", False, f"Status: {status}, Response: {response}")
            return False

        # Verify User B is no longer a member
        status, circle_response = await self.make_request('GET', f'/circles/{self.circle_id}', token=self.user_a_token)
        
        if status != 200:
            self.log_result("Verify Leave Circle", False, f"Failed to get circle after leave: {status}")
            return False

        # Check if User B is still in members (should not be)
        user_b_found = False
        for member in circle_response.get('members', []):
            if member.get('user_id') == self.user_b_id:
                user_b_found = True
                break

        if user_b_found:
            self.log_result("Leave Circle", False, f"User B still found in members after leaving: {circle_response.get('members')}")
            return False

        self.log_result("Leave Circle", True, f"User B successfully left the circle")
        return True

    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Circle Feature Comprehensive Testing")
        print("=" * 60)
        
        await self.setup_session()
        
        try:
            tests = [
                self.test_01_create_user_a,
                self.test_02_create_user_b,
                self.test_03_create_circle,
                self.test_04_get_circles,
                self.test_05_get_circle_details,
                self.test_06_join_circle_with_code,
                self.test_07_get_join_requests,
                self.test_08_approve_request,
                self.test_09_circle_messaging,
                self.test_10_circle_with_invite_code_privacy,
                self.test_11_leave_circle,
            ]
            
            success_count = 0
            for test in tests:
                try:
                    success = await test()
                    if success:
                        success_count += 1
                    else:
                        # Continue with other tests even if one fails
                        continue
                except Exception as e:
                    self.log_result(test.__name__, False, f"Exception: {str(e)}")
            
            # Summary
            print(f"\n{'='*60}")
            print(f"📊 TEST SUMMARY")
            print(f"{'='*60}")
            print(f"✅ Passed: {success_count}/{len(tests)}")
            print(f"❌ Failed: {len(tests) - success_count}/{len(tests)}")
            print(f"📈 Success Rate: {(success_count/len(tests)*100):.1f}%")
            
            if success_count == len(tests):
                print("🎉 All Circle feature tests PASSED!")
            else:
                print("⚠️  Some tests FAILED - see details above")
            
            return success_count == len(tests)
            
        finally:
            await self.teardown_session()

async def main():
    """Main function"""
    tester = CircleTestSuite()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())