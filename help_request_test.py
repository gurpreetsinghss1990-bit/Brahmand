#!/usr/bin/env python3
"""
Help Request API Testing - As per Review Request
Tests the specific endpoints requested:
1. POST /api/auth/send-otp with phone: +919998887770
2. POST /api/auth/verify-otp with phone: +919998887770, otp: 123456  
3. POST /api/help-requests with specific body
4. GET /api/help-requests/active
5. POST /api/help-requests/{request_id}/fulfill
6. GET /api/help-requests/active (verify null)
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "https://brahmand-requests.preview.emergentagent.com/api"
TEST_PHONE = "+919998887770"
TEST_OTP = "123456"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def log_test(test_name, status="INFO", message=""):
    """Log test results with colors"""
    color = Colors.GREEN if status == "PASS" else Colors.RED if status == "FAIL" else Colors.BLUE
    print(f"{color}[{status}]{Colors.END} {test_name}: {message}")

def make_request(method, endpoint, headers=None, data=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        log_test(f"Request Error for {method} {endpoint}", "FAIL", str(e))
        return None

def test_help_request_flow():
    """Test the complete Help Request flow as specified in review request"""
    
    print(f"\n{Colors.BOLD}=== HELP REQUEST API TESTING ==={Colors.END}")
    print(f"Testing with phone: {TEST_PHONE}")
    print(f"Testing backend: {BASE_URL}")
    
    auth_token = None
    request_id = None
    
    # Test 1: Send OTP
    print(f"\n{Colors.YELLOW}Step 1: POST /api/auth/send-otp{Colors.END}")
    otp_data = {"phone": TEST_PHONE}
    response = make_request("POST", "/auth/send-otp", data=otp_data)
    
    if response and response.status_code == 200:
        log_test("Send OTP", "PASS", f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    else:
        log_test("Send OTP", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
        if response:
            print(f"Response: {response.text}")
        return False
    
    # Test 2: Verify OTP
    print(f"\n{Colors.YELLOW}Step 2: POST /api/auth/verify-otp{Colors.END}")
    verify_data = {"phone": TEST_PHONE, "otp": TEST_OTP}
    response = make_request("POST", "/auth/verify-otp", data=verify_data)
    
    if response and response.status_code == 200:
        log_test("Verify OTP", "PASS", f"Status: {response.status_code}")
        response_data = response.json()
        print(f"Response: {response_data}")
        
        if "token" in response_data:
            # Existing user - got token directly
            auth_token = response_data["token"]
            log_test("Token Received (Existing User)", "PASS", f"Token length: {len(auth_token)}")
        elif response_data.get("is_new_user"):
            # New user - need to register
            log_test("New User - Registration Required", "INFO", "Proceeding with registration")
            
            # Test 2b: Register new user
            print(f"\n{Colors.YELLOW}Step 2b: POST /api/auth/register{Colors.END}")
            register_data = {
                "phone": TEST_PHONE,
                "name": "Help Request Test User",
                "language": "English"
            }
            response = make_request("POST", "/auth/register", data=register_data)
            
            if response and response.status_code == 200:
                log_test("User Registration", "PASS", f"Status: {response.status_code}")
                register_response = response.json()
                print(f"Registration Response: {register_response}")
                
                if "token" in register_response:
                    auth_token = register_response["token"]
                    log_test("Token Received (New User)", "PASS", f"Token length: {len(auth_token)}")
                else:
                    log_test("Token Missing After Registration", "FAIL", "No token in registration response")
                    return False
            else:
                log_test("User Registration", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
                if response:
                    print(f"Response: {response.text}")
                return False
        else:
            log_test("Token Missing", "FAIL", "No token in response and not a new user")
            return False
    else:
        log_test("Verify OTP", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
        if response:
            print(f"Response: {response.text}")
        return False
    
    # Test 3: Create Help Request
    print(f"\n{Colors.YELLOW}Step 3: POST /api/help-requests{Colors.END}")
    headers = {"Authorization": f"Bearer {auth_token}"}
    help_request_data = {
        "type": "blood",
        "title": "Blood Test", 
        "description": "Testing blood request creation",
        "contact_number": TEST_PHONE,
        "urgency": "normal",
        "blood_group": "A+",
        "community_level": "area"
    }
    
    print(f"Request Body: {json.dumps(help_request_data, indent=2)}")
    response = make_request("POST", "/help-requests", headers=headers, data=help_request_data)
    
    if response and response.status_code == 200:
        log_test("Create Help Request", "PASS", f"Status: {response.status_code}")
        response_data = response.json()
        print(f"Response: {json.dumps(response_data, indent=2)}")
        
        if "id" in response_data:
            request_id = response_data["id"]
            log_test("Request ID Received", "PASS", f"Request ID: {request_id}")
        else:
            log_test("Request ID Missing", "FAIL", "No request ID in response")
            return False
    else:
        log_test("Create Help Request", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
        if response:
            print(f"Response: {response.text}")
        return False
    
    # Test 4: Get Active Help Request
    print(f"\n{Colors.YELLOW}Step 4: GET /api/help-requests/active{Colors.END}")
    response = make_request("GET", "/help-requests/active", headers=headers)
    
    if response and response.status_code == 200:
        log_test("Get Active Request", "PASS", f"Status: {response.status_code}")
        response_data = response.json()
        print(f"Response: {json.dumps(response_data, indent=2)}")
        
        if response_data and "id" in response_data and response_data["id"] == request_id:
            log_test("Active Request Match", "PASS", "Returned request matches created request")
        elif response_data is None:
            log_test("No Active Request", "FAIL", "Expected active request but got null")
            return False
        else:
            log_test("Active Request Mismatch", "FAIL", "Returned request doesn't match created request")
            return False
    else:
        log_test("Get Active Request", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
        if response:
            print(f"Response: {response.text}")
        return False
    
    # Test 5: Mark as Fulfilled
    print(f"\n{Colors.YELLOW}Step 5: POST /api/help-requests/{request_id}/fulfill{Colors.END}")
    response = make_request("POST", f"/help-requests/{request_id}/fulfill", headers=headers)
    
    if response and response.status_code == 200:
        log_test("Fulfill Request", "PASS", f"Status: {response.status_code}")
        response_data = response.json()
        print(f"Response: {response_data}")
    else:
        log_test("Fulfill Request", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
        if response:
            print(f"Response: {response.text}")
        return False
    
    # Test 6: Verify No Active Request After Fulfill
    print(f"\n{Colors.YELLOW}Step 6: GET /api/help-requests/active (verify null){Colors.END}")
    response = make_request("GET", "/help-requests/active", headers=headers)
    
    if response and response.status_code == 200:
        log_test("Get Active Request (After Fulfill)", "PASS", f"Status: {response.status_code}")
        response_data = response.json()
        print(f"Response: {response_data}")
        
        if response_data is None:
            log_test("No Active Request (Expected)", "PASS", "Correctly returns null after fulfill")
        else:
            log_test("Active Request Still Exists", "FAIL", "Request still active after fulfill")
            return False
    else:
        log_test("Get Active Request (After Fulfill)", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
        if response:
            print(f"Response: {response.text}")
        return False
    
    return True

def test_backend_health():
    """Test backend health and availability"""
    print(f"\n{Colors.BOLD}=== BACKEND HEALTH CHECK ==={Colors.END}")
    
    # Test health endpoint
    response = make_request("GET", "/health")
    if response and response.status_code == 200:
        log_test("Backend Health", "PASS", f"Status: {response.status_code}")
        print(f"Health: {response.json()}")
        return True
    else:
        log_test("Backend Health", "FAIL", f"Status: {response.status_code if response else 'No Response'}")
        if response:
            print(f"Response: {response.text}")
        return False

def main():
    """Main test function"""
    print(f"{Colors.BOLD}Help Request API Testing - Review Request{Colors.END}")
    print(f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"Backend URL: {BASE_URL}")
    print(f"Phone: {TEST_PHONE}")
    print(f"Mock OTP: {TEST_OTP}")
    
    # Test backend health first
    health_ok = test_backend_health()
    if not health_ok:
        print(f"\n{Colors.RED}❌ Backend health check failed. Cannot proceed with tests.{Colors.END}")
        sys.exit(1)
    
    # Run Help Request flow test
    success = test_help_request_flow()
    
    # Print final results
    print(f"\n{Colors.BOLD}=== TEST RESULTS ==={Colors.END}")
    if success:
        print(f"{Colors.GREEN}✅ All Help Request API tests passed!{Colors.END}")
        print(f"\n{Colors.BOLD}Expected Results Achieved:{Colors.END}")
        print(f"✅ Create help request: 200 OK")
        print(f"✅ Get active request: Returns request data")
        print(f"✅ Fulfill request: 200 OK") 
        print(f"✅ Get active after fulfill: Returns null")
        return 0
    else:
        print(f"{Colors.RED}❌ Some Help Request API tests failed!{Colors.END}")
        return 1

if __name__ == "__main__":
    sys.exit(main())