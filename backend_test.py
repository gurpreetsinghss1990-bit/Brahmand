#!/usr/bin/env python3
"""
Backend API Testing for Help Requests, Vendors, and Cultural Communities
Base URL: https://brahmand-vendors.preview.emergentagent.com/api
"""

import requests
import json
import time
from typing import Dict, Optional

class BackendTester:
    def __init__(self):
        self.base_url = "https://brahmand-vendors.preview.emergentagent.com/api"
        self.headers = {"Content-Type": "application/json"}
        self.auth_token = None
        self.user_id = None
        self.results = []
        
    def log_result(self, test_name: str, success: bool, details: str, response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {details}")
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, headers: Optional[Dict] = None) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        req_headers = {**self.headers}
        if headers:
            req_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=req_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            print(f"📡 {method.upper()} {endpoint} -> {response.status_code}")
            return response
        except Exception as e:
            print(f"🚨 Request failed: {e}")
            raise

    def authenticate(self) -> bool:
        """Authenticate user with OTP flow"""
        phone = "+911111100003"
        
        # Step 1: Send OTP
        response = self.make_request("POST", "/auth/send-otp", {"phone": phone})
        if response.status_code != 200:
            self.log_result("Send OTP", False, f"Failed with status {response.status_code}: {response.text}")
            return False
        
        # Step 2: Verify OTP (mock OTP is 123456)
        response = self.make_request("POST", "/auth/verify-otp", {
            "phone": phone,
            "otp": "123456"
        })
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if this is a new user that needs registration
            if data.get("is_new_user") and not data.get("token"):
                self.log_result("OTP Verification", True, "New user detected, proceeding with registration")
                
                # Step 3: Register the new user
                registration_data = {
                    "phone": phone,
                    "name": "Test User",
                    "language": "en"
                }
                
                response = self.make_request("POST", "/auth/register", registration_data)
                if response.status_code == 200:
                    reg_data = response.json()
                    self.auth_token = reg_data.get("token")
                    if self.auth_token:
                        self.headers["Authorization"] = f"Bearer {self.auth_token}"
                        self.log_result("Registration & Authentication", True, f"User registered and authenticated successfully")
                        return True
                    else:
                        self.log_result("Registration", False, f"No token in registration response: {reg_data}")
                        return False
                else:
                    self.log_result("Registration", False, f"Registration failed: {response.status_code} - {response.text}")
                    return False
            
            # Existing user with token
            elif data.get("token"):
                self.auth_token = data.get("token")
                self.user_id = data.get("user_id")
                self.headers["Authorization"] = f"Bearer {self.auth_token}"
                self.log_result("Authentication", True, f"Existing user authenticated successfully")
                return True
            else:
                self.log_result("Authentication", False, f"Unexpected response format: {data}")
                return False
        else:
            self.log_result("Authentication", False, f"OTP verification failed: {response.status_code} - {response.text}")
            return False

    def test_help_requests(self):
        """Test Help Request APIs"""
        print("\n🩸 TESTING HELP REQUEST APIs")
        
        # Test 1: Create help request
        help_data = {
            "type": "blood",
            "title": "Urgent Blood Needed",
            "description": "Need O+ blood for surgery at City Hospital",
            "community_level": "city",
            "contact_number": "9876543210",
            "urgency": "critical",
            "blood_group": "O+",
            "hospital_name": "City Hospital"
        }
        
        response = self.make_request("POST", "/help-requests", help_data)
        if response.status_code == 200:
            help_request_data = response.json()
            help_request_id = help_request_data.get("id")
            self.log_result("Create Help Request", True, f"Created help request ID: {help_request_id}", help_request_data)
        else:
            self.log_result("Create Help Request", False, f"Failed: {response.status_code} - {response.text}")
            return
        
        # Test 2: List all help requests
        response = self.make_request("GET", "/help-requests")
        if response.status_code == 200:
            requests_list = response.json()
            self.log_result("List Help Requests", True, f"Retrieved {len(requests_list)} help requests", requests_list)
        else:
            self.log_result("List Help Requests", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 3: Get active help request  
        response = self.make_request("GET", "/help-requests/active")
        if response.status_code == 200:
            active_request = response.json()
            self.log_result("Get Active Help Request", True, f"Active request: {active_request}", active_request)
        else:
            self.log_result("Get Active Help Request", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 4: Mark as fulfilled
        if help_request_id:
            response = self.make_request("POST", f"/help-requests/{help_request_id}/fulfill")
            if response.status_code == 200:
                self.log_result("Fulfill Help Request", True, "Help request marked as fulfilled")
            else:
                self.log_result("Fulfill Help Request", False, f"Failed: {response.status_code} - {response.text}")

    def test_vendors(self):
        """Test Vendor APIs"""
        print("\n🏪 TESTING VENDOR APIs")
        
        # Test 1: Create vendor
        vendor_data = {
            "business_name": "Sharma Yoga Center",
            "owner_name": "Ramesh Sharma", 
            "years_in_business": 5,
            "categories": ["Yoga", "Meditation", "Fitness"],
            "full_address": "123 Temple Road, Mumbai 400001",
            "phone_number": "9876543210",
            "latitude": 19.0760,
            "longitude": 72.8777
        }
        
        response = self.make_request("POST", "/vendors", vendor_data)
        if response.status_code == 200:
            vendor_response = response.json()
            vendor_id = vendor_response.get("id")
            self.log_result("Create Vendor", True, f"Created vendor ID: {vendor_id}", vendor_response)
        else:
            self.log_result("Create Vendor", False, f"Failed: {response.status_code} - {response.text}")
            vendor_id = None
        
        # Test 2: List all vendors
        response = self.make_request("GET", "/vendors")
        if response.status_code == 200:
            vendors_list = response.json()
            self.log_result("List Vendors", True, f"Retrieved {len(vendors_list)} vendors", vendors_list)
        else:
            self.log_result("List Vendors", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 3: Get user's vendor
        response = self.make_request("GET", "/vendors/my")
        if response.status_code == 200:
            my_vendor = response.json()
            self.log_result("Get My Vendor", True, f"My vendor: {my_vendor}", my_vendor)
        else:
            self.log_result("Get My Vendor", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 4: Get all categories
        response = self.make_request("GET", "/vendors/categories")
        if response.status_code == 200:
            categories = response.json()
            self.log_result("Get Vendor Categories", True, f"Categories: {categories}", categories)
        else:
            self.log_result("Get Vendor Categories", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 5: Update vendor (if we have vendor_id)
        if vendor_id:
            update_data = {
                "business_name": "Updated Sharma Yoga Center",
                "years_in_business": 6
            }
            response = self.make_request("PUT", f"/vendors/{vendor_id}", update_data)
            if response.status_code == 200:
                self.log_result("Update Vendor", True, "Vendor updated successfully")
            else:
                self.log_result("Update Vendor", False, f"Failed: {response.status_code} - {response.text}")

    def test_cultural_communities(self):
        """Test Cultural Community APIs"""
        print("\n🏛️ TESTING CULTURAL COMMUNITY APIs")
        
        # Test 1: List all communities
        response = self.make_request("GET", "/cultural-communities")
        if response.status_code == 200:
            communities = response.json()
            self.log_result("List Cultural Communities", True, f"Retrieved {len(communities)} communities", communities)
        else:
            self.log_result("List Cultural Communities", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 2: Search communities 
        response = self.make_request("GET", "/cultural-communities?search=Brahmin")
        if response.status_code == 200:
            search_results = response.json()
            self.log_result("Search Communities (Brahmin)", True, f"Found {len(search_results)} matches", search_results)
        else:
            self.log_result("Search Communities", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 3: Get user's cultural community
        response = self.make_request("GET", "/user/cultural-community")
        if response.status_code == 200:
            user_cg = response.json()
            self.log_result("Get User Cultural Community", True, f"User CG: {user_cg}", user_cg)
        else:
            self.log_result("Get User Cultural Community", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 4: Set cultural community (first time - should work)
        response = self.make_request("PUT", "/user/cultural-community", {
            "cultural_community": "Brahmin"
        })
        if response.status_code == 200:
            result = response.json()
            self.log_result("Set Cultural Community (Brahmin)", True, f"Result: {result}", result)
        else:
            self.log_result("Set Cultural Community", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 5: Change cultural community (should work - 1st change)
        response = self.make_request("PUT", "/user/cultural-community", {
            "cultural_community": "Rajput" 
        })
        if response.status_code == 200:
            result = response.json()
            self.log_result("Change Cultural Community (Rajput)", True, f"Result: {result}", result)
        else:
            self.log_result("Change Cultural Community", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 6: Try to change again (should work - 2nd change)
        response = self.make_request("PUT", "/user/cultural-community", {
            "cultural_community": "Kshatriya"
        })
        if response.status_code == 200:
            result = response.json()
            self.log_result("Change Cultural Community (Kshatriya)", True, f"Result: {result}", result)
        else:
            self.log_result("Change Cultural Community (2nd)", False, f"Failed: {response.status_code} - {response.text}")
        
        # Test 7: Try third change (should fail - locked after 2 changes)
        response = self.make_request("PUT", "/user/cultural-community", {
            "cultural_community": "Jain"
        })
        if response.status_code == 400:
            error = response.json()
            self.log_result("Change Cultural Community (3rd - Should Fail)", True, f"Correctly blocked: {error}")
        else:
            self.log_result("Change Cultural Community (3rd)", False, f"Should have failed but got: {response.status_code}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Backend API Tests for Help Requests, Vendors, and Cultural Communities")
        print(f"Base URL: {self.base_url}")
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Run all test suites
        self.test_help_requests()
        self.test_vendors() 
        self.test_cultural_communities()
        
        # Summary
        print(f"\n📊 TEST SUMMARY")
        print(f"Total Tests: {len(self.results)}")
        passed = sum(1 for r in self.results if r["success"])
        failed = len(self.results) - passed
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {passed/len(self.results)*100:.1f}%")
        
        if failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)