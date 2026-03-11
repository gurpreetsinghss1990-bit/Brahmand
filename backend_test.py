#!/usr/bin/env python3
"""
Sanatan Lok Backend API Testing - Firebase Integration
Version 2.1.0 Testing Suite

Tests Firebase integration endpoints and core functionality.
"""
import asyncio
import aiohttp
import json
from datetime import datetime
from typing import Dict, Any, Optional


class SanatanLokAPITester:
    """Comprehensive API tester for Sanatan Lok with Firebase integration"""
    
    def __init__(self):
        self.base_url = "https://temple-network.preview.emergentagent.com/api"
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token: Optional[str] = None
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': [],
            'successes': []
        }
    
    async def setup_session(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()
        print(f"🚀 Starting Sanatan Lok API Tests - Firebase Integration")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
    
    async def teardown_session(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, passed: bool, message: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
        if message:
            print(f"   📝 {message}")
        if response_data and isinstance(response_data, dict):
            print(f"   📊 Response: {json.dumps(response_data, indent=2)}")
        print()
        
        if passed:
            self.test_results['passed'] += 1
            self.test_results['successes'].append(test_name)
        else:
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"{test_name}: {message}")
    
    async def make_request(self, method: str, endpoint: str, data: dict = None, headers: dict = None) -> tuple:
        """Make HTTP request and return status, response data"""
        url = f"{self.base_url}{endpoint}"
        
        # Add auth header if token available
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        if self.auth_token:
            req_headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == 'GET':
                async with self.session.get(url, headers=req_headers) as response:
                    status = response.status
                    try:
                        data = await response.json()
                    except:
                        data = await response.text()
                    return status, data
            else:
                async with self.session.request(method, url, json=data, headers=req_headers) as response:
                    status = response.status
                    try:
                        data = await response.json()
                    except:
                        data = await response.text()
                    return status, data
        
        except Exception as e:
            return 0, f"Request failed: {str(e)}"
    
    async def test_root_endpoint(self):
        """Test GET /api/ - Should return version 2.1.0 and Firebase project info"""
        print("🔍 Testing Core Endpoints...")
        status, response = await self.make_request('GET', '/')
        
        expected_keys = ['message', 'version', 'status', 'database', 'firebase_project', 'features']
        
        if status == 200 and isinstance(response, dict):
            version_ok = response.get('version') == '2.1.0'
            firebase_project_ok = response.get('firebase_project') == 'sanatan-lok'
            database_ok = response.get('database') == 'MongoDB'
            all_keys_present = all(key in response for key in expected_keys)
            
            if version_ok and firebase_project_ok and database_ok and all_keys_present:
                self.log_test(
                    "Root Endpoint", 
                    True, 
                    f"Version {response.get('version')}, Firebase project: {response.get('firebase_project')}", 
                    response
                )
            else:
                missing = [k for k in expected_keys if k not in response]
                issues = []
                if not version_ok:
                    issues.append(f"Version is {response.get('version')}, expected 2.1.0")
                if not firebase_project_ok:
                    issues.append(f"Firebase project is {response.get('firebase_project')}, expected sanatan-lok")
                if missing:
                    issues.append(f"Missing keys: {missing}")
                
                self.log_test("Root Endpoint", False, "; ".join(issues), response)
        else:
            self.log_test("Root Endpoint", False, f"Status: {status}, Response: {response}")
    
    async def test_health_endpoint(self):
        """Test GET /api/health - Should show firebase_admin: config_only"""
        status, response = await self.make_request('GET', '/health')
        
        if status == 200 and isinstance(response, dict):
            services = response.get('services', {})
            firebase_admin = services.get('firebase_admin')
            database = services.get('database')
            firebase_project = response.get('firebase_project')
            version_ok = response.get('version') == '2.1.0'
            
            if (firebase_admin == 'config_only' and 
                database == 'healthy' and 
                firebase_project == 'sanatan-lok' and 
                version_ok):
                self.log_test(
                    "Health Endpoint", 
                    True, 
                    f"Database: {database}, Firebase: {firebase_admin}, Project: {firebase_project}", 
                    response
                )
            else:
                issues = []
                if firebase_admin != 'config_only':
                    issues.append(f"Firebase admin is {firebase_admin}, expected config_only")
                if database != 'healthy':
                    issues.append(f"Database is {database}, expected healthy")
                if firebase_project != 'sanatan-lok':
                    issues.append(f"Firebase project is {firebase_project}, expected sanatan-lok")
                if not version_ok:
                    issues.append(f"Version is {response.get('version')}, expected 2.1.0")
                
                self.log_test("Health Endpoint", False, "; ".join(issues), response)
        else:
            self.log_test("Health Endpoint", False, f"Status: {status}, Response: {response}")
    
    async def test_firebase_config_endpoint(self):
        """Test GET /api/firebase-config - Should return Firebase web config"""
        status, response = await self.make_request('GET', '/firebase-config')
        
        expected_keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId']
        
        if status == 200 and isinstance(response, dict):
            project_id_ok = response.get('projectId') == 'sanatan-lok'
            auth_domain_ok = response.get('authDomain') == 'sanatan-lok.firebaseapp.com'
            all_keys_present = all(key in response for key in expected_keys)
            
            if project_id_ok and auth_domain_ok and all_keys_present:
                self.log_test(
                    "Firebase Config", 
                    True, 
                    f"Project ID: {response.get('projectId')}, Auth Domain: {response.get('authDomain')}", 
                    response
                )
            else:
                issues = []
                if not project_id_ok:
                    issues.append(f"Project ID is {response.get('projectId')}, expected sanatan-lok")
                if not auth_domain_ok:
                    issues.append(f"Auth domain is {response.get('authDomain')}, expected sanatan-lok.firebaseapp.com")
                missing = [k for k in expected_keys if k not in response]
                if missing:
                    issues.append(f"Missing keys: {missing}")
                
                self.log_test("Firebase Config", False, "; ".join(issues), response)
        else:
            self.log_test("Firebase Config", False, f"Status: {status}, Response: {response}")
    
    async def test_auth_flow(self):
        """Test complete authentication flow with mock OTP"""
        print("🔐 Testing Authentication Flow...")
        
        phone_number = "8888777766"
        mock_otp = "123456"
        
        # Step 1: Send OTP
        status, response = await self.make_request('POST', '/auth/send-otp', {'phone': phone_number})
        
        if status == 200 and isinstance(response, dict):
            message = response.get('message', '')
            phone = response.get('phone')
            if 'successfully' in message.lower() and phone == phone_number:
                self.log_test("Send OTP", True, f"OTP sent to {phone_number}", response)
            else:
                self.log_test("Send OTP", False, f"Failed to send OTP: {response}", response)
                return
        else:
            self.log_test("Send OTP", False, f"Status: {status}, Response: {response}")
            return
        
        # Step 2: Verify OTP
        status, response = await self.make_request('POST', '/auth/verify-otp', {'phone': phone_number, 'otp': mock_otp})
        
        if status == 200 and isinstance(response, dict):
            message = response.get('message', '')
            is_new_user = response.get('is_new_user', False)
            if 'verified' in message.lower() or 'successful' in message.lower():
                if is_new_user:
                    self.log_test("Verify OTP", True, f"OTP verified for {phone_number} (new user)", response)
                else:
                    # Existing user - we should have token
                    token = response.get('token')
                    if token:
                        self.auth_token = token
                        self.log_test("Verify OTP", True, f"OTP verified for {phone_number} (existing user)", response)
                        return  # Skip registration for existing user
                    else:
                        self.log_test("Verify OTP", False, f"Missing token for existing user: {response}", response)
                        return
            else:
                self.log_test("Verify OTP", False, f"Failed to verify OTP: {response}", response)
                return
        else:
            self.log_test("Verify OTP", False, f"Status: {status}, Response: {response}")
            return
        
        # Step 3: Register User (only if new user)
        user_data = {
            'phone': phone_number,
            'name': 'Firebase Test User',
            'language': 'English'
        }
        
        status, response = await self.make_request('POST', '/auth/register', user_data)
        
        if status == 200 and isinstance(response, dict):
            token = response.get('token')
            user = response.get('user', {})
            sl_id = user.get('sl_id')
            message = response.get('message', '')
            
            if token and sl_id and 'successful' in message.lower():
                self.auth_token = token
                self.log_test("User Registration", True, f"User registered with SL-ID: {sl_id}", response)
            else:
                self.log_test("User Registration", False, f"Missing token or SL-ID: {response}", response)
        else:
            self.log_test("User Registration", False, f"Status: {status}, Response: {response}")
    
    async def test_user_endpoints(self):
        """Test user-related endpoints requiring authentication"""
        if not self.auth_token:
            self.log_test("User Endpoints", False, "No auth token available - skipping user tests")
            return
        
        print("👤 Testing User Endpoints...")
        
        # Test get profile
        status, response = await self.make_request('GET', '/user/profile')
        
        if status == 200 and isinstance(response, dict):
            sl_id = response.get('sl_id')
            name = response.get('name')
            if sl_id and name:
                self.log_test("Get Profile", True, f"Profile retrieved: {name} ({sl_id})", response)
            else:
                self.log_test("Get Profile", False, f"Missing profile data: {response}", response)
        else:
            self.log_test("Get Profile", False, f"Status: {status}, Response: {response}")
        
        # Test set location
        location_data = {
            'country': 'Bharat',
            'state': 'Gujarat',
            'city': 'Ahmedabad',
            'area': 'Navrangpura'
        }
        
        status, response = await self.make_request('POST', '/user/location', location_data)
        
        if status == 200 and isinstance(response, dict):
            message = response.get('message', '')
            communities_created = response.get('communities_created', 0) or response.get('communities_joined', 0)
            if 'successful' in message.lower() and communities_created > 0:
                self.log_test("Set Location", True, f"Location set, {communities_created} communities created", response)
            else:
                self.log_test("Set Location", False, f"Location setup failed: {response}", response)
        else:
            self.log_test("Set Location", False, f"Status: {status}, Response: {response}")
        
        # Test get communities
        status, response = await self.make_request('GET', '/communities')
        
        if status == 200 and isinstance(response, list):
            community_count = len(response)
            if community_count > 0:
                self.log_test("Get Communities", True, f"Found {community_count} communities", response[:2] if response else [])
            else:
                self.log_test("Get Communities", False, "No communities found", response)
        else:
            self.log_test("Get Communities", False, f"Status: {status}, Response: {response}")
    
    async def test_wisdom_and_panchang(self):
        """Test wisdom and panchang endpoints"""
        print("🕉️ Testing Wisdom & Panchang...")
        
        # Test wisdom
        status, response = await self.make_request('GET', '/wisdom/today')
        
        if status == 200 and isinstance(response, dict):
            quote = response.get('quote')
            source = response.get('source')
            if quote and source:
                self.log_test("Today's Wisdom", True, f"Quote from {source}: {quote[:50]}...", response)
            else:
                self.log_test("Today's Wisdom", False, f"Missing quote or source: {response}", response)
        else:
            self.log_test("Today's Wisdom", False, f"Status: {status}, Response: {response}")
        
        # Test panchang
        status, response = await self.make_request('GET', '/panchang/today')
        
        if status == 200 and isinstance(response, dict):
            tithi = response.get('tithi')
            sunrise = response.get('sunrise')
            sunset = response.get('sunset')
            if tithi and sunrise and sunset:
                self.log_test("Today's Panchang", True, f"Tithi: {tithi}, Sunrise: {sunrise}, Sunset: {sunset}", response)
            else:
                self.log_test("Today's Panchang", False, f"Missing panchang data: {response}", response)
        else:
            self.log_test("Today's Panchang", False, f"Status: {status}, Response: {response}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        print(f"📈 Success Rate: {self.test_results['passed']/(self.test_results['passed']+self.test_results['failed'])*100:.1f}%")
        
        if self.test_results['errors']:
            print(f"\n❌ FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        if self.test_results['successes']:
            print(f"\n✅ PASSED TESTS:")
            for success in self.test_results['successes']:
                print(f"   • {success}")
        
        print("\n" + "="*60)
        
        # Return result for script usage
        return self.test_results['failed'] == 0
    
    async def run_all_tests(self):
        """Execute all test suites"""
        await self.setup_session()
        
        try:
            # Core Firebase integration tests
            await self.test_root_endpoint()
            await self.test_health_endpoint()
            await self.test_firebase_config_endpoint()
            
            # Authentication flow
            await self.test_auth_flow()
            
            # User endpoints (requires auth)
            await self.test_user_endpoints()
            
            # Other endpoints
            await self.test_wisdom_and_panchang()
            
            # Print results
            success = self.print_summary()
            return success
            
        finally:
            await self.teardown_session()


async def main():
    """Main test runner"""
    tester = SanatanLokAPITester()
    success = await tester.run_all_tests()
    
    # Exit with appropriate code
    import sys
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())