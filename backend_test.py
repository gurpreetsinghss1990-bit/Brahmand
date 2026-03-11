#!/usr/bin/env python3
"""
Sanatan Lok Backend API Test Suite
Testing complete new user sign-up flow with location detection
"""

import requests
import json
import time
from typing import Dict, Any

class SanatanLokTester:
    def __init__(self, base_url: str = "https://community-join-flow.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.token = None
        self.test_phone = "+918765432109"
        self.mock_otp = "123456"
        
    def log_test(self, test_name: str, status: str, details: str = ""):
        """Log test results"""
        status_emoji = "✅" if status == "PASS" else "❌"
        print(f"{status_emoji} {test_name}: {status}")
        if details:
            print(f"   {details}")
        print()
    
    def test_health_check(self) -> bool:
        """Test 1: Health Check - Verify backend is running with Firebase/Firestore"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                data = response.json()
                # Check if Firebase is enabled and working
                services = data.get('services', {})
                if (services.get('firestore') == 'connected' and 
                    data.get('firebase_project') == 'sanatan-lok'):
                    self.log_test("Health Check", "PASS", 
                                f"Firestore: {services.get('firestore')}, Project: {data.get('firebase_project')}")
                    return True
                else:
                    self.log_test("Health Check", "FAIL", 
                                f"Firebase not properly configured: {services}")
                    return False
            else:
                self.log_test("Health Check", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_send_otp(self) -> bool:
        """Test 2: Send OTP - Should return success message"""
        try:
            payload = {"phone": self.test_phone}
            response = self.session.post(f"{self.base_url}/auth/send-otp", 
                                       data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'OTP sent successfully' and data.get('phone') == self.test_phone:
                    self.log_test("Send OTP", "PASS", 
                                f"OTP sent to {self.test_phone}")
                    return True
                else:
                    self.log_test("Send OTP", "FAIL", f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Send OTP", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Send OTP", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_verify_otp(self) -> bool:
        """Test 3: Verify OTP - Should return auth token for new user"""
        try:
            payload = {"phone": self.test_phone, "otp": self.mock_otp}
            response = self.session.post(f"{self.base_url}/auth/verify-otp", 
                                       data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                if data.get('is_new_user') is True and data.get('message') == 'OTP verified':
                    self.log_test("Verify OTP", "PASS", 
                                f"New user verified, ready for registration")
                    return True
                elif data.get('is_new_user') is False and data.get('token'):
                    # Existing user - store token for further tests
                    self.token = data['token']
                    self.session.headers['Authorization'] = f"Bearer {self.token}"
                    self.log_test("Verify OTP", "PASS", 
                                f"Existing user logged in, token obtained")
                    return True
                else:
                    self.log_test("Verify OTP", "FAIL", f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Verify OTP", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify OTP", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_register_user(self) -> bool:
        """Test 4: Register User - Should create user with SL-ID"""
        try:
            payload = {
                "phone": self.test_phone,
                "name": "Arjun Sharma",
                "language": "Hindi"
            }
            response = self.session.post(f"{self.base_url}/auth/register", 
                                       data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                if (data.get('message') == 'Registration successful' and 
                    data.get('token') and 
                    data.get('user', {}).get('sl_id', '').startswith('SL-')):
                    
                    self.token = data['token']
                    self.session.headers['Authorization'] = f"Bearer {self.token}"
                    sl_id = data['user']['sl_id']
                    self.log_test("Register User", "PASS", 
                                f"User created with SL-ID: {sl_id}")
                    return True
                else:
                    self.log_test("Register User", "FAIL", f"Missing required fields: {data}")
                    return False
            elif response.status_code == 400 and "already exists" in response.text:
                # User already exists, need to login first
                self.log_test("Register User", "SKIP", 
                            "User already exists, should login first")
                return True
            else:
                self.log_test("Register User", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Register User", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_reverse_geocode(self) -> bool:
        """Test 5: Reverse Geocode - Should return location data for Mumbai coordinates"""
        try:
            payload = {"latitude": 19.0760, "longitude": 72.8777}  # Mumbai coordinates
            response = self.session.post(f"{self.base_url}/geocode/reverse", 
                                       data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['country', 'state', 'city', 'area']
                if all(field in data for field in required_fields):
                    self.log_test("Reverse Geocode", "PASS", 
                                f"Location: {data['area']}, {data['city']}, {data['state']}, {data['country']}")
                    return True
                else:
                    self.log_test("Reverse Geocode", "FAIL", 
                                f"Missing location fields: {data}")
                    return False
            else:
                self.log_test("Reverse Geocode", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Reverse Geocode", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_setup_dual_location(self) -> bool:
        """Test 6: Setup Dual Location - Should create communities and join user"""
        if not self.token:
            self.log_test("Setup Dual Location", "SKIP", "No auth token available")
            return False
            
        try:
            payload = {
                "home_location": {
                    "country": "Bharat",
                    "state": "Maharashtra",
                    "city": "Mumbai",
                    "area": "Andheri",
                    "latitude": 19.0760,
                    "longitude": 72.8777
                }
            }
            response = self.session.post(f"{self.base_url}/user/dual-location", 
                                       data=json.dumps(payload))
            
            if response.status_code == 200:
                data = response.json()
                communities_joined = data.get('communities_joined', 0)
                if communities_joined > 0:
                    self.log_test("Setup Dual Location", "PASS", 
                                f"Joined {communities_joined} communities")
                    return True
                else:
                    self.log_test("Setup Dual Location", "FAIL", 
                                f"No communities joined: {data}")
                    return False
            else:
                self.log_test("Setup Dual Location", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Setup Dual Location", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_get_communities(self) -> bool:
        """Test 7: Get Communities - Should show communities user was joined to"""
        if not self.token:
            self.log_test("Get Communities", "SKIP", "No auth token available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/communities")
            
            if response.status_code == 200:
                communities = response.json()
                if isinstance(communities, list):
                    expected_types = ['area', 'city', 'state', 'country']
                    found_types = [c.get('type') for c in communities]
                    
                    if len(communities) > 0:
                        self.log_test("Get Communities", "PASS", 
                                    f"Found {len(communities)} communities: {[c.get('name') for c in communities[:3]]}")
                        
                        # Verify community types
                        matching_types = [t for t in expected_types if t in found_types]
                        if len(matching_types) >= 3:  # Should have at least 3 of the 4 types
                            print(f"   Community types: {matching_types}")
                        
                        return True
                    else:
                        self.log_test("Get Communities", "FAIL", "No communities found for user")
                        return False
                else:
                    self.log_test("Get Communities", "FAIL", f"Invalid response format: {communities}")
                    return False
            else:
                self.log_test("Get Communities", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Communities", "FAIL", f"Exception: {str(e)}")
            return False
    
    def run_complete_flow_test(self) -> Dict[str, bool]:
        """Run the complete new user sign-up flow test"""
        print("🚀 Starting Sanatan Lok Complete Sign-up Flow Test")
        print("="*60)
        
        results = {}
        
        # Test sequence as specified in the review request
        test_sequence = [
            ("health_check", self.test_health_check),
            ("send_otp", self.test_send_otp),
            ("verify_otp", self.test_verify_otp),
            ("register_user", self.test_register_user),
            ("reverse_geocode", self.test_reverse_geocode),
            ("setup_dual_location", self.test_setup_dual_location),
            ("get_communities", self.test_get_communities),
        ]
        
        for test_name, test_func in test_sequence:
            results[test_name] = test_func()
            time.sleep(0.5)  # Brief pause between tests
        
        print("="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<20}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        if passed == total:
            print("🎉 All tests passed! Sign-up flow is working correctly.")
        else:
            print("⚠️  Some tests failed. Check the details above.")
            
        return results


if __name__ == "__main__":
    tester = SanatanLokTester()
    results = tester.run_complete_flow_test()