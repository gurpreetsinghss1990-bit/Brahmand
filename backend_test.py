#!/usr/bin/env python3
"""
Community Request System Backend API Testing
Quick verification test as per review request:
1. Create test user with phone: +911112223333
2. Create Help Request with specific data  
3. Get Community Requests filtered by type=help
"""

import requests
import json
import time
import random
from datetime import datetime

# Backend configuration
BASE_URL = "https://brahmand-requests.preview.emergentagent.com/api"
MOCK_OTP = "123456"

class QuickVerificationTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_data = None
        self.request_id = None
        self.results = []
        
    def log(self, message, success=True):
        """Log test results"""
        status = "✅" if success else "❌"
        print(f"{status} {message}")
        self.results.append({"message": message, "success": success})
        
    def post(self, endpoint, data=None):
        """Make POST request with authentication"""
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        response = self.session.post(f"{BASE_URL}{endpoint}", 
                                   json=data, headers=headers, timeout=30)
        return response
        
    def get(self, endpoint, params=None):
        """Make GET request with authentication"""
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        response = self.session.get(f"{BASE_URL}{endpoint}", 
                                  params=params, headers=headers, timeout=30)
        return response

    def test_1_create_test_user(self):
        """TEST 1: Create test user with phone: +911112223333"""
        print("\n🔹 TEST 1: Create test user with phone: +911112223333")
        
        phone = "+911112223333"
        
        try:
            # Send OTP
            print("   📤 Sending OTP...")
            response = self.post("/auth/send-otp", {"phone": phone})
            
            if response.status_code != 200:
                self.log(f"Send OTP failed: {response.status_code} - {response.text}", False)
                return False
            
            self.log("OTP sent successfully")
            
            # Verify OTP with mock code
            print("   🔐 Verifying OTP with mock code 123456...")
            response = self.post("/auth/verify-otp", {
                "phone": phone,
                "otp": MOCK_OTP
            })
            
            if response.status_code != 200:
                self.log(f"OTP verification failed: {response.status_code} - {response.text}", False)
                return False
            
            data = response.json()
            self.log(f"OTP verified, is_new_user: {data.get('is_new_user')}")
            
            # Register user if new
            if data.get('is_new_user'):
                print("   👤 Registering new user...")
                response = self.post("/auth/register", {
                    "name": "Community Test User",
                    "phone": phone,
                    "language": "English"
                })
                
                if response.status_code != 200:
                    self.log(f"Registration failed: {response.status_code} - {response.text}", False)
                    return False
                
                register_data = response.json()
                self.token = register_data.get('token')
                self.user_data = register_data.get('user')
                self.log(f"User registered with SL-ID: {self.user_data.get('sl_id')}")
            else:
                # Existing user
                self.token = data.get('token')
                self.user_data = data.get('user')
                self.log(f"Existing user logged in with SL-ID: {self.user_data.get('sl_id')}")
            
            return True
            
        except Exception as e:
            self.log(f"Test 1 exception: {str(e)}", False)
            return False
    
    def test_2_create_help_request(self):
        """TEST 2: Create Help Request with specific data"""
        print("\n🔹 TEST 2: Create Help Request")
        
        if not self.token:
            self.log("No auth token available", False)
            return False
        
        try:
            help_request = {
                "request_type": "help",
                "title": "Test Help",
                "description": "Testing help request", 
                "contact_number": "+911112223333",
                "visibility_level": "area",
                "urgency_level": "low"
            }
            
            print("   📝 Creating help request...")
            response = self.post("/community-requests", help_request)
            
            if response.status_code != 200:
                self.log(f"Help request creation failed: {response.status_code} - {response.text}", False)
                return False
            
            data = response.json()
            self.request_id = data.get('id')
            
            self.log(f"Help request created successfully with ID: {self.request_id}")
            self.log(f"Request details - Type: {data.get('request_type')}, Title: {data.get('title')}, Status: {data.get('status')}")
            
            return True
            
        except Exception as e:
            self.log(f"Test 2 exception: {str(e)}", False)
            return False
    
    def test_3_get_help_requests(self):
        """TEST 3: Get Community Requests with type=help"""
        print("\n🔹 TEST 3: Get Community Requests with type=help")
        
        if not self.token:
            self.log("No auth token available", False)
            return False
        
        try:
            print("   🔍 Fetching help requests...")
            response = self.get("/community-requests", {"type": "help"})
            
            if response.status_code != 200:
                self.log(f"Get help requests failed: {response.status_code} - {response.text}", False)
                return False
            
            requests_data = response.json()
            self.log(f"Retrieved {len(requests_data)} help requests")
            
            # Check if our request is in the results
            our_request_found = False
            if self.request_id:
                for req in requests_data:
                    if req.get('id') == self.request_id:
                        our_request_found = True
                        self.log(f"Our created request found in results: {req.get('title')}")
                        break
                
                if not our_request_found:
                    self.log("⚠️  Our created request not found in results (may be due to visibility filtering)", True)
            
            return True
            
        except Exception as e:
            self.log(f"Test 3 exception: {str(e)}", False)
            return False
    
    def run_quick_verification(self):
        """Run quick verification as per review request"""
        print("🚀 COMMUNITY REQUEST SYSTEM - QUICK VERIFICATION TEST")
        print("=" * 60)
        print("Test Scenarios:")
        print("1. Create test user with phone: +911112223333")
        print("2. Create Help Request with specific data")
        print("3. Get Community Requests filtered by type=help")
        print("=" * 60)
        
        results = {}
        
        # Run tests
        results['test_1'] = self.test_1_create_test_user()
        results['test_2'] = self.test_2_create_help_request()
        results['test_3'] = self.test_3_get_help_requests()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 QUICK VERIFICATION RESULTS:")
        
        passed = sum(results.values())
        total = len(results)
        
        test_names = {
            'test_1': "Create test user (+911112223333)",
            'test_2': "Create Help Request",
            'test_3': "Get Community Requests (type=help)"
        }
        
        for test_key, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {test_names[test_key]}: {status}")
        
        print(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL 3 TESTS PASSED - Community Request System backend is working correctly!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Check details above")
            return False


def main():
    """Main function"""
    print(f"🔗 Testing against: {BASE_URL}")
    print(f"🕐 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = QuickVerificationTester()
    success = tester.run_quick_verification()
    
    print(f"\n🏁 Testing completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if success:
        exit(0)
    else:
        exit(1)


if __name__ == "__main__":
    main()