#!/usr/bin/env python3
"""
Community Request System Backend API Testing
Tests all Community Request APIs as per review request specifications
"""

import requests
import json
import time
import random
from datetime import datetime

# Backend configuration
BASE_URL = "https://brahmand-requests.preview.emergentagent.com/api"
MOCK_OTP = "123456"

class CommunityRequestTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_data = None
        self.test_requests = []
        self.results = []
        
    def log(self, message, success=True):
        """Log test results"""
        status = "✅" if success else "❌"
        print(f"{status} {message}")
        self.results.append({"message": message, "success": success})
        
    def post(self, endpoint, data=None, headers=None):
        """Make POST request with authentication"""
        if headers is None:
            headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        headers["Content-Type"] = "application/json"
        
        response = self.session.post(f"{BASE_URL}{endpoint}", 
                                   json=data, headers=headers, timeout=30)
        return response
        
    def get(self, endpoint, params=None, headers=None):
        """Make GET request with authentication"""
        if headers is None:
            headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        response = self.session.get(f"{BASE_URL}{endpoint}", 
                                  params=params, headers=headers, timeout=30)
        return response
        
    def setup_authentication(self):
        """Step 1: Setup authentication with mock OTP"""
        try:
            # Test phone number as specified in review request
            phone_number = "+911234567890"
            
            # Send OTP
            response = self.post("/auth/send-otp", {"phone": phone_number})
            if response.status_code == 200:
                self.log(f"OTP sent to {phone_number}")
            else:
                self.log(f"Failed to send OTP: {response.status_code} - {response.text}", False)
                return False
                
            # Verify OTP with mock code
            response = self.post("/auth/verify-otp", {
                "phone": phone_number,
                "otp": MOCK_OTP
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get("is_new_user"):
                    self.log("OTP verified - new user detected")
                    # Register user
                    user_response = self.post("/auth/register", {
                        "phone": phone_number,
                        "name": "Test User",
                        "language": "English"
                    })
                    
                    if user_response.status_code == 200:
                        user_data = user_response.json()
                        self.token = user_data.get("token")
                        self.user_data = user_data.get("user")
                        self.log(f"User registered successfully with SL-ID: {self.user_data.get('sl_id')}")
                        return True
                    else:
                        self.log(f"Registration failed: {user_response.status_code} - {user_response.text}", False)
                        return False
                else:
                    # Existing user
                    self.token = data.get("token")
                    self.user_data = data.get("user")
                    self.log(f"Existing user login successful with SL-ID: {self.user_data.get('sl_id')}")
                    return True
            else:
                self.log(f"OTP verification failed: {response.status_code} - {response.text}", False)
                return False
                
        except Exception as e:
            self.log(f"Authentication setup error: {str(e)}", False)
            return False
            
    def test_help_request(self):
        """Step 2: Test help request creation"""
        try:
            help_data = {
                "request_type": "help",
                "title": "Need help with groceries",
                "description": "Need someone to help me get groceries from the market",
                "contact_number": "+911234567890",
                "visibility_level": "area",
                "urgency_level": "low"
            }
            
            response = self.post("/community-requests", help_data)
            
            if response.status_code in [200, 201]:
                request_data = response.json()
                request_id = request_data.get("id")
                if request_id:
                    self.test_requests.append({"id": request_id, "type": "help"})
                    self.log(f"Help request created successfully - ID: {request_id}")
                    return True
                else:
                    self.log("Help request created but no ID returned", False)
                    return False
            else:
                self.log(f"Help request creation failed: {response.status_code} - {response.text}", False)
                return False
                
        except Exception as e:
            self.log(f"Help request test error: {str(e)}", False)
            return False
            
    def test_blood_request(self):
        """Step 3: Test blood request creation"""
        try:
            blood_data = {
                "request_type": "blood",
                "title": "Blood Required Urgently",
                "description": "A+ blood needed for surgery",
                "contact_number": "+911234567890",
                "visibility_level": "city",
                "urgency_level": "critical",
                "blood_group": "A+",
                "hospital_name": "City Hospital",
                "location": "Mumbai Central"
            }
            
            response = self.post("/community-requests", blood_data)
            
            if response.status_code in [200, 201]:
                request_data = response.json()
                request_id = request_data.get("id")
                if request_id:
                    self.test_requests.append({"id": request_id, "type": "blood"})
                    self.log(f"Blood request created successfully - ID: {request_id}")
                    # Verify blood-specific fields
                    if request_data.get("blood_group") == "A+" and request_data.get("hospital_name") == "City Hospital":
                        self.log("Blood request specific fields verified correctly")
                        return True
                    else:
                        self.log("Blood request missing specific fields", False)
                        return False
                else:
                    self.log("Blood request created but no ID returned", False)
                    return False
            else:
                self.log(f"Blood request creation failed: {response.status_code} - {response.text}", False)
                return False
                
        except Exception as e:
            self.log(f"Blood request test error: {str(e)}", False)
            return False
            
    def test_medical_request(self):
        """Step 4: Test medical request creation"""
        try:
            medical_data = {
                "request_type": "medical",
                "title": "Need medical supplies",
                "description": "Looking for oxygen cylinder",
                "contact_number": "+911234567890",
                "urgency_level": "high"
            }
            
            response = self.post("/community-requests", medical_data)
            
            if response.status_code in [200, 201]:
                request_data = response.json()
                request_id = request_data.get("id")
                if request_id:
                    self.test_requests.append({"id": request_id, "type": "medical"})
                    self.log(f"Medical request created successfully - ID: {request_id}")
                    return True
                else:
                    self.log("Medical request created but no ID returned", False)
                    return False
            else:
                self.log(f"Medical request creation failed: {response.status_code} - {response.text}", False)
                return False
                
        except Exception as e:
            self.log(f"Medical request test error: {str(e)}", False)
            return False
            
    def test_financial_request(self):
        """Step 5: Test financial request creation"""
        try:
            financial_data = {
                "request_type": "financial",
                "title": "Financial assistance needed",
                "description": "Need help with hospital bills",
                "contact_number": "+911234567890",
                "urgency_level": "medium",
                "amount": 50000
            }
            
            response = self.post("/community-requests", financial_data)
            
            if response.status_code in [200, 201]:
                request_data = response.json()
                request_id = request_data.get("id")
                if request_id:
                    self.test_requests.append({"id": request_id, "type": "financial"})
                    self.log(f"Financial request created successfully - ID: {request_id}")
                    # Verify amount field
                    if request_data.get("amount") == 50000:
                        self.log("Financial request amount field verified correctly")
                        return True
                    else:
                        self.log("Financial request missing amount field", False)
                        return False
                else:
                    self.log("Financial request created but no ID returned", False)
                    return False
            else:
                self.log(f"Financial request creation failed: {response.status_code} - {response.text}", False)
                return False
                
        except Exception as e:
            self.log(f"Financial request test error: {str(e)}", False)
            return False
            
    def test_petition_request(self):
        """Step 6: Test petition creation"""
        try:
            petition_data = {
                "request_type": "petition",
                "title": "Save the Temple Garden",
                "description": "Petition to save the temple garden from being demolished",
                "contact_number": "+911234567890",
                "support_needed": "1000 signatures",
                "contact_person_name": "Temple Committee"
            }
            
            response = self.post("/community-requests", petition_data)
            
            if response.status_code in [200, 201]:
                request_data = response.json()
                request_id = request_data.get("id")
                if request_id:
                    self.test_requests.append({"id": request_id, "type": "petition"})
                    self.log(f"Petition created successfully - ID: {request_id}")
                    # Verify petition-specific fields
                    if (request_data.get("support_needed") == "1000 signatures" and 
                        request_data.get("contact_person_name") == "Temple Committee"):
                        self.log("Petition specific fields verified correctly")
                        return True
                    else:
                        self.log("Petition missing specific fields", False)
                        return False
                else:
                    self.log("Petition created but no ID returned", False)
                    return False
            else:
                self.log(f"Petition creation failed: {response.status_code} - {response.text}", False)
                return False
                
        except Exception as e:
            self.log(f"Petition test error: {str(e)}", False)
            return False
            
    def test_get_requests_by_type(self):
        """Step 7: Test filtering requests by type"""
        try:
            success_count = 0
            
            # Test blood requests filter
            response = self.get("/community-requests", params={"type": "blood"})
            if response.status_code == 200:
                blood_requests = response.json()
                if any(req.get("request_type") == "blood" for req in blood_requests):
                    self.log("GET /community-requests?type=blood returned blood requests")
                    success_count += 1
                else:
                    self.log("No blood requests found in filtered results", False)
            else:
                self.log(f"Failed to get blood requests: {response.status_code} - {response.text}", False)
                
            # Test petition requests filter  
            response = self.get("/community-requests", params={"type": "petition"})
            if response.status_code == 200:
                petition_requests = response.json()
                if any(req.get("request_type") == "petition" for req in petition_requests):
                    self.log("GET /community-requests?type=petition returned petition requests")
                    success_count += 1
                else:
                    self.log("No petition requests found in filtered results", False)
            else:
                self.log(f"Failed to get petition requests: {response.status_code} - {response.text}", False)
                
            return success_count == 2
            
        except Exception as e:
            self.log(f"Get requests by type test error: {str(e)}", False)
            return False
            
    def test_get_my_requests(self):
        """Step 8: Test getting user's own requests"""
        try:
            response = self.get("/community-requests/my")
            
            if response.status_code == 200:
                my_requests = response.json()
                expected_types = {"help", "blood", "medical", "financial", "petition"}
                found_types = {req.get("request_type") for req in my_requests}
                
                if expected_types.issubset(found_types):
                    self.log(f"GET /community-requests/my returned all 5 expected request types")
                    self.log(f"Total requests found: {len(my_requests)}")
                    return True
                else:
                    missing_types = expected_types - found_types
                    self.log(f"Missing request types in my requests: {missing_types}", False)
                    return False
            else:
                self.log(f"Failed to get my requests: {response.status_code} - {response.text}", False)
                return False
                
        except Exception as e:
            self.log(f"Get my requests test error: {str(e)}", False)
            return False
            
    def run_comprehensive_test(self):
        """Run all Community Request System tests"""
        print("=" * 60)
        print("COMMUNITY REQUEST SYSTEM API TESTING")
        print("=" * 60)
        
        # Test sequence as specified in review request
        test_functions = [
            ("1. Authentication Setup", self.setup_authentication),
            ("2. Create Help Request", self.test_help_request),  
            ("3. Create Blood Request", self.test_blood_request),
            ("4. Create Medical Request", self.test_medical_request),
            ("5. Create Financial Request", self.test_financial_request),
            ("6. Create Petition", self.test_petition_request),
            ("7. Get Requests by Type", self.test_get_requests_by_type),
            ("8. Get My Requests", self.test_get_my_requests)
        ]
        
        passed_tests = 0
        total_tests = len(test_functions)
        
        for test_name, test_func in test_functions:
            print(f"\n--- {test_name} ---")
            try:
                if test_func():
                    passed_tests += 1
                    print(f"✅ {test_name} PASSED")
                else:
                    print(f"❌ {test_name} FAILED")
            except Exception as e:
                print(f"❌ {test_name} ERROR: {str(e)}")
        
        # Final summary
        print("\n" + "=" * 60)
        print("COMMUNITY REQUEST SYSTEM TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if passed_tests == total_tests:
            print("🎉 ALL COMMUNITY REQUEST SYSTEM TESTS PASSED!")
        else:
            print("⚠️  SOME TESTS FAILED - CHECK LOGS ABOVE")
            
        return passed_tests, total_tests

def main():
    """Main test execution"""
    tester = CommunityRequestTester()
    passed, total = tester.run_comprehensive_test()
    
    # Exit with error code if tests failed
    if passed < total:
        exit(1)
    else:
        exit(0)

if __name__ == "__main__":
    main()