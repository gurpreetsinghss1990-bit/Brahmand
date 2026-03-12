#!/usr/bin/env python3
"""
Backend API Testing Script for SOS Emergency System and Spiritual Engine
Tests all endpoints as specified in the review request
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any

# Base URL for API testing - using environment configured URL
BASE_URL = "https://brahmand-vendors.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = {}
        self.test_results = []
        self.sos_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if success else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, headers: Dict = None) -> Dict:
        """Make API request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        
        # Add auth header if token available
        if self.auth_token and headers is None:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
        elif self.auth_token and headers:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
                
            return {
                'status_code': response.status_code,
                'data': response.json() if response.content else {},
                'success': 200 <= response.status_code < 300
            }
        except Exception as e:
            return {
                'status_code': 0,
                'data': {'error': str(e)},
                'success': False
            }
    
    def test_authentication(self):
        """Test 1: User Authentication Flow"""
        print(f"\n{Colors.BLUE}=== 1. AUTHENTICATION TESTING ==={Colors.END}")
        
        # Test OTP Send
        phone = "+911111100005"
        response = self.make_request("POST", "/auth/send-otp", {"phone": phone})
        
        if response['success']:
            self.log_test("OTP Send", True, f"Status: {response['status_code']}")
        else:
            self.log_test("OTP Send", False, f"Status: {response['status_code']}, Error: {response['data']}")
            return False
            
        # Test OTP Verify
        response = self.make_request("POST", "/auth/verify-otp", {
            "phone": phone,
            "otp": "123456"
        })
        
        if response['success']:
            # Check if it's a new user who needs registration
            if response['data'].get('is_new_user'):
                self.log_test("OTP Verify (New User)", True, f"New user detected, proceeding to registration")
                
                # Register the new user
                reg_response = self.make_request("POST", "/auth/register", {
                    "phone": phone,
                    "name": "Test SOS User",
                    "language": "en"
                })
                
                if reg_response['success'] and 'token' in reg_response['data']:
                    self.auth_token = reg_response['data']['token']
                    self.user_data = reg_response['data'].get('user', {})
                    self.log_test("User Registration", True, f"Registration successful, SL-ID: {self.user_data.get('sl_id', 'N/A')}")
                    return True
                else:
                    self.log_test("User Registration", False, f"Status: {reg_response['status_code']}, Error: {reg_response['data']}")
                    return False
            elif 'token' in response['data']:
                # Existing user with token
                self.auth_token = response['data']['token']
                self.user_data = response['data'].get('user', {})
                self.log_test("OTP Verify (Existing User)", True, f"Token received: {self.auth_token[:20]}...")
                return True
            else:
                self.log_test("OTP Verify", False, f"Unexpected response format: {response['data']}")
                return False
        else:
            self.log_test("OTP Verify", False, f"Status: {response['status_code']}, Error: {response['data']}")
            return False
    
    def test_sos_emergency_system(self):
        """Test 2: SOS Emergency System"""
        print(f"\n{Colors.PURPLE}=== 2. SOS EMERGENCY SYSTEM ==={Colors.END}")
        
        # Test Create SOS Alert
        sos_data = {
            "latitude": 19.0760,
            "longitude": 72.8777,
            "area": "Andheri",
            "city": "Mumbai",
            "state": "Maharashtra"
        }
        
        response = self.make_request("POST", "/sos", sos_data)
        if response['success']:
            self.sos_id = response['data'].get('id')
            self.log_test("Create SOS Alert", True, f"SOS ID: {self.sos_id}")
        else:
            self.log_test("Create SOS Alert", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get My SOS
        response = self.make_request("GET", "/sos/my")
        if response['success']:
            has_sos = response['data'] is not None
            self.log_test("Get My SOS", True, f"Active SOS found: {has_sos}")
        else:
            self.log_test("Get My SOS", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get Nearby SOS
        params = {"lat": 19.0760, "lng": 72.8777, "radius": 10}
        response = self.make_request("GET", "/sos/nearby", params=params)
        if response['success']:
            nearby_count = len(response['data']) if isinstance(response['data'], list) else 0
            self.log_test("Get Nearby SOS", True, f"Found {nearby_count} nearby SOS alerts")
        else:
            self.log_test("Get Nearby SOS", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Respond to SOS (if we have an SOS ID)
        if self.sos_id:
            response = self.make_request("POST", f"/sos/{self.sos_id}/respond", {"response": "coming"})
            if response['success']:
                self.log_test("Respond to SOS", True, f"Response recorded")
            else:
                self.log_test("Respond to SOS", False, f"Status: {response['status_code']}, Error: {response['data']}")
                
            # Test Resolve SOS
            response = self.make_request("POST", f"/sos/{self.sos_id}/resolve", {"status": "resolved"})
            if response['success']:
                self.log_test("Resolve SOS", True, f"SOS resolved")
            else:
                self.log_test("Resolve SOS", False, f"Status: {response['status_code']}, Error: {response['data']}")
        else:
            self.log_test("Respond to SOS", False, "No SOS ID available from creation")
            self.log_test("Resolve SOS", False, "No SOS ID available from creation")
    
    def test_spiritual_engine_panchang(self):
        """Test 3: Spiritual Engine - Panchang"""
        print(f"\n{Colors.CYAN}=== 3. SPIRITUAL ENGINE - PANCHANG ==={Colors.END}")
        
        # Test Get Today's Panchang
        response = self.make_request("GET", "/spiritual/panchang")
        if response['success']:
            panchang = response['data']
            required_fields = ['date', 'tithi', 'nakshatra', 'yoga', 'karana']
            has_required = all(field in panchang for field in required_fields)
            self.log_test("Get Today's Panchang", has_required, 
                         f"Date: {panchang.get('date')}, Tithi: {panchang.get('tithi')}")
        else:
            self.log_test("Get Today's Panchang", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get Specific Date Panchang
        params = {
            "lat": 28.6139,
            "lng": 77.2090,
            "date_str": "2026-03-15"
        }
        response = self.make_request("GET", "/spiritual/panchang", params=params)
        if response['success']:
            panchang = response['data']
            is_specific_date = panchang.get('date') == "2026-03-15"
            self.log_test("Get Specific Date Panchang", is_specific_date, 
                         f"Date: {panchang.get('date')}, Location: Delhi")
        else:
            self.log_test("Get Specific Date Panchang", False, f"Status: {response['status_code']}, Error: {response['data']}")
    
    def test_spiritual_engine_festivals(self):
        """Test 4: Spiritual Engine - Festivals"""
        print(f"\n{Colors.CYAN}=== 4. SPIRITUAL ENGINE - FESTIVALS ==={Colors.END}")
        
        # Test Get Upcoming Festivals (default)
        response = self.make_request("GET", "/spiritual/festivals")
        if response['success']:
            festivals = response['data']
            is_list = isinstance(festivals, list)
            has_festivals = len(festivals) > 0 if is_list else False
            self.log_test("Get Upcoming Festivals", is_list and has_festivals, 
                         f"Found {len(festivals) if is_list else 0} upcoming festivals")
        else:
            self.log_test("Get Upcoming Festivals", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get Limited Festivals
        params = {"limit": 3}
        response = self.make_request("GET", "/spiritual/festivals", params=params)
        if response['success']:
            festivals = response['data']
            is_list = isinstance(festivals, list)
            correct_limit = len(festivals) <= 3 if is_list else False
            self.log_test("Get 3 Upcoming Festivals", is_list and correct_limit, 
                         f"Returned {len(festivals) if is_list else 0} festivals (limit: 3)")
        else:
            self.log_test("Get 3 Upcoming Festivals", False, f"Status: {response['status_code']}, Error: {response['data']}")
    
    def test_spiritual_engine_horoscope(self):
        """Test 5: Spiritual Engine - Horoscope"""
        print(f"\n{Colors.CYAN}=== 5. SPIRITUAL ENGINE - HOROSCOPE ==={Colors.END}")
        
        # Test Get All Rashis
        response = self.make_request("GET", "/spiritual/rashis")
        if response['success']:
            rashis = response['data']
            has_mesh = 'Mesh' in rashis
            has_english = rashis.get('Mesh', {}).get('english') == 'Aries' if has_mesh else False
            self.log_test("Get All Rashis", has_mesh and has_english, 
                         f"Found {len(rashis)} rashis, Mesh -> {rashis.get('Mesh', {}).get('english')}")
        else:
            self.log_test("Get All Rashis", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get Horoscope for Specific Rashi
        response = self.make_request("GET", "/spiritual/horoscope/Mesh")
        if response['success']:
            horoscope = response['data']
            has_prediction = 'prediction' in horoscope
            is_aries = horoscope.get('rashi_english') == 'Aries'
            self.log_test("Get Horoscope for Aries", has_prediction and is_aries, 
                         f"Rashi: {horoscope.get('rashi')}, Prediction available: {has_prediction}")
        else:
            self.log_test("Get Horoscope for Aries", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get User's Horoscope (should say no profile initially)
        response = self.make_request("GET", "/spiritual/horoscope")
        if response['success']:
            result = response['data']
            no_profile = not result.get('has_profile', True)
            has_message = 'message' in result
            self.log_test("Get User Horoscope (No Profile)", no_profile and has_message, 
                         f"Message: {result.get('message', '')}")
        else:
            self.log_test("Get User Horoscope (No Profile)", False, f"Status: {response['status_code']}, Error: {response['data']}")
    
    def test_astrology_profile(self):
        """Test 6: Astrology Profile Management"""
        print(f"\n{Colors.YELLOW}=== 6. ASTROLOGY PROFILE ==={Colors.END}")
        
        # Test Set Astrology Profile
        profile_data = {
            "date_of_birth": "1990-05-15",
            "time_of_birth": "10:30",
            "place_of_birth": "Mumbai"
        }
        
        response = self.make_request("PUT", "/user/astrology-profile", profile_data)
        if response['success']:
            self.log_test("Set Astrology Profile", True, f"Profile updated successfully")
        else:
            self.log_test("Set Astrology Profile", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get Astrology Profile
        response = self.make_request("GET", "/user/astrology-profile")
        if response['success']:
            profile = response['data']
            has_dob = profile.get('date_of_birth') == "1990-05-15"
            has_rashi = 'rashi' in profile
            calculated_rashi = profile.get('rashi')
            self.log_test("Get Astrology Profile", has_dob and has_rashi, 
                         f"DOB: {profile.get('date_of_birth')}, Calculated Rashi: {calculated_rashi}")
        else:
            self.log_test("Get Astrology Profile", False, f"Status: {response['status_code']}, Error: {response['data']}")
            
        # Test Get User's Horoscope (should now return personalized)
        response = self.make_request("GET", "/spiritual/horoscope")
        if response['success']:
            result = response['data']
            has_profile = result.get('has_profile', False)
            has_prediction = 'prediction' in result
            user_rashi = result.get('rashi')
            self.log_test("Get Personalized Horoscope", has_profile and has_prediction, 
                         f"Rashi: {user_rashi}, Has Profile: {has_profile}")
        else:
            self.log_test("Get Personalized Horoscope", False, f"Status: {response['status_code']}, Error: {response['data']}")
    
    def print_summary(self):
        """Print test summary"""
        print(f"\n{Colors.BOLD}=== TEST SUMMARY ==={Colors.END}")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for test in self.test_results if test['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"{Colors.GREEN}Passed: {passed_tests}{Colors.END}")
        print(f"{Colors.RED}Failed: {failed_tests}{Colors.END}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n{Colors.RED}FAILED TESTS:{Colors.END}")
            for test in self.test_results:
                if not test['success']:
                    print(f"  ❌ {test['test']}: {test['details']}")
        
        return passed_tests, failed_tests
    
    def run_all_tests(self):
        """Run all test suites"""
        print(f"{Colors.BOLD}{Colors.UNDERLINE}SOS EMERGENCY SYSTEM & SPIRITUAL ENGINE API TESTING{Colors.END}")
        print(f"Base URL: {BASE_URL}")
        print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run tests in sequence
        if self.test_authentication():
            self.test_sos_emergency_system()
            self.test_spiritual_engine_panchang()
            self.test_spiritual_engine_festivals()
            self.test_spiritual_engine_horoscope()
            self.test_astrology_profile()
        else:
            print(f"{Colors.RED}Authentication failed, skipping other tests{Colors.END}")
            
        return self.print_summary()

if __name__ == "__main__":
    tester = APITester()
    passed, failed = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    sys.exit(1 if failed > 0 else 0)