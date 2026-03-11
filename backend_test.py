#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Sanatan Lok
Tests the microservices architecture endpoints
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, Any, Optional
from datetime import datetime

# Test configuration
BASE_URL = "https://temple-network.preview.emergentagent.com/api"
MOCK_OTP = "123456"
# Use random phone to avoid rate limiting
import random
TEST_PHONE = f"999{random.randint(1000000, 9999999)}"

class SanatanLokTester:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    async def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> Dict:
        """Make HTTP request with error handling"""
        try:
            url = f"{BASE_URL}{endpoint}"
            request_headers = {}
            
            # Add auth token if available
            if self.auth_token and headers is None:
                request_headers["Authorization"] = f"Bearer {self.auth_token}"
            elif headers:
                request_headers.update(headers)
            
            async with self.session.request(
                method=method,
                url=url,
                json=data,
                headers=request_headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                try:
                    response_data = await response.json()
                except:
                    response_data = {"text": await response.text()}
                
                return {
                    "status": response.status,
                    "data": response_data,
                    "success": response.status < 400
                }
        except asyncio.TimeoutError:
            return {
                "status": 408,
                "data": {"error": "Request timeout"},
                "success": False
            }
        except Exception as e:
            return {
                "status": 500,
                "data": {"error": str(e)},
                "success": False
            }

    async def test_health_endpoints(self):
        """Test health and status endpoints"""
        print("🔍 Testing Health & Status Endpoints...")
        
        # Test root endpoint
        response = await self.make_request("GET", "/")
        expected_version = "2.0.0"
        
        if response["success"]:
            data = response["data"]
            version_match = data.get("version") == expected_version
            has_architecture = data.get("architecture") == "microservices"
            
            self.log_test(
                "GET /api/ - Root endpoint",
                version_match and has_architecture,
                f"Version: {data.get('version')}, Architecture: {data.get('architecture')}",
                data
            )
        else:
            self.log_test(
                "GET /api/ - Root endpoint",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test health endpoint
        response = await self.make_request("GET", "/health")
        
        if response["success"]:
            data = response["data"]
            has_services = "services" in data
            db_status = data.get("services", {}).get("database") == "healthy"
            cache_status = data.get("services", {}).get("cache") == "healthy"
            task_queue_status = data.get("services", {}).get("task_queue") in ["healthy", "stopped"]
            
            self.log_test(
                "GET /api/health - Health check",
                has_services and db_status and cache_status and task_queue_status,
                f"DB: {data.get('services', {}).get('database')}, Cache: {data.get('services', {}).get('cache')}, Queue: {data.get('services', {}).get('task_queue')}",
                data
            )
        else:
            self.log_test(
                "GET /api/health - Health check",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )

    async def test_authentication_flow(self):
        """Test complete authentication flow"""
        print("🔐 Testing Authentication Flow...")
        
        # Test send OTP
        response = await self.make_request("POST", "/auth/send-otp", {"phone": TEST_PHONE})
        
        if response["success"]:
            self.log_test(
                "POST /api/auth/send-otp",
                True,
                f"OTP sent to {TEST_PHONE}",
                response["data"]
            )
        else:
            self.log_test(
                "POST /api/auth/send-otp",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
            return False
        
        # Test verify OTP
        response = await self.make_request("POST", "/auth/verify-otp", {
            "phone": TEST_PHONE,
            "otp": MOCK_OTP
        })
        
        if response["success"]:
            data = response["data"]
            is_new_user = data.get("is_new_user", False)
            
            self.log_test(
                "POST /api/auth/verify-otp",
                True,
                f"OTP verified, new user: {is_new_user}",
                data
            )
            
            # If existing user, get token
            if not is_new_user and "token" in data:
                self.auth_token = data["token"]
                self.user_id = data.get("user", {}).get("user_id")
                return True
                
        else:
            self.log_test(
                "POST /api/auth/verify-otp",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
            return False
        
        # Test user registration (for new users)
        response = await self.make_request("POST", "/auth/register", {
            "phone": TEST_PHONE,
            "name": "Test User Sanatan",
            "language": "English"
        })
        
        if response["success"]:
            data = response["data"]
            self.auth_token = data.get("token")
            self.user_id = data.get("user", {}).get("user_id")
            
            self.log_test(
                "POST /api/auth/register",
                self.auth_token is not None,
                f"User registered with SL-ID: {data.get('user', {}).get('sl_id')}",
                data
            )
            return True
        else:
            self.log_test(
                "POST /api/auth/register",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
            return False

    async def test_user_endpoints(self):
        """Test user management endpoints"""
        if not self.auth_token:
            self.log_test("User Endpoints", False, "No auth token available")
            return
        
        print("👤 Testing User Endpoints...")
        
        # Test get profile
        response = await self.make_request("GET", "/user/profile")
        
        if response["success"]:
            data = response["data"]
            has_sl_id = "sl_id" in data
            has_name = "name" in data
            
            self.log_test(
                "GET /api/user/profile",
                has_sl_id and has_name,
                f"Profile loaded for SL-ID: {data.get('sl_id')}",
                data
            )
        else:
            self.log_test(
                "GET /api/user/profile",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test update profile
        response = await self.make_request("PUT", "/user/profile", {
            "name": "Updated Test User"
        })
        
        if response["success"]:
            self.log_test(
                "PUT /api/user/profile",
                True,
                "Profile updated successfully",
                response["data"]
            )
        else:
            self.log_test(
                "PUT /api/user/profile",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test location setup
        response = await self.make_request("POST", "/user/location", {
            "country": "Bharat",
            "state": "Maharashtra", 
            "city": "Mumbai",
            "area": "Andheri"
        })
        
        if response["success"]:
            data = response["data"]
            communities_created = data.get("communities_joined", 0)
            
            self.log_test(
                "POST /api/user/location",
                communities_created > 0,
                f"Location set, {communities_created} communities joined",
                data
            )
        else:
            self.log_test(
                "POST /api/user/location",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test verification status
        response = await self.make_request("GET", "/user/verification-status")
        
        if response["success"]:
            self.log_test(
                "GET /api/user/verification-status",
                True,
                "Verification status retrieved",
                response["data"]
            )
        else:
            self.log_test(
                "GET /api/user/verification-status",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test profile completion
        response = await self.make_request("GET", "/user/profile-completion")
        
        if response["success"]:
            data = response["data"]
            has_percentage = "completion_percentage" in data
            
            self.log_test(
                "GET /api/user/profile-completion",
                has_percentage,
                f"Profile completion: {data.get('completion_percentage', 0)}%",
                data
            )
        else:
            self.log_test(
                "GET /api/user/profile-completion",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )

    async def test_community_endpoints(self):
        """Test community endpoints"""
        if not self.auth_token:
            self.log_test("Community Endpoints", False, "No auth token available")
            return
        
        print("🏘️ Testing Community Endpoints...")
        
        # Test get communities
        response = await self.make_request("GET", "/communities")
        
        if response["success"]:
            data = response["data"]
            # Handle case where response is a list directly or has communities key
            communities = data if isinstance(data, list) else data.get("communities", [])
            
            self.log_test(
                "GET /api/communities",
                len(communities) >= 0,
                f"Found {len(communities)} communities",
                {"community_count": len(communities)}
            )
        else:
            self.log_test(
                "GET /api/communities",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test discover communities
        response = await self.make_request("GET", "/communities/discover")
        
        if response["success"]:
            data = response["data"]
            # Handle case where response is a list directly or has communities key
            discovered = data if isinstance(data, list) else data.get("communities", [])
            
            self.log_test(
                "GET /api/communities/discover",
                isinstance(discovered, list),
                f"Discovered {len(discovered)} communities",
                {"discovered_count": len(discovered)}
            )
        else:
            self.log_test(
                "GET /api/communities/discover",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )

    async def test_wisdom_and_panchang(self):
        """Test wisdom and panchang endpoints"""
        print("📖 Testing Wisdom & Panchang Endpoints...")
        
        # Test today's wisdom
        response = await self.make_request("GET", "/wisdom/today")
        
        if response["success"]:
            data = response["data"]
            has_quote = "quote" in data
            has_author = "author" in data or "source" in data
            
            author = data.get("author") or data.get("source", "Unknown")
            
            self.log_test(
                "GET /api/wisdom/today",
                has_quote and has_author,
                f"Wisdom by {author}",
                {"quote_length": len(data.get("quote", ""))}
            )
        else:
            self.log_test(
                "GET /api/wisdom/today",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test today's panchang
        response = await self.make_request("GET", "/panchang/today")
        
        if response["success"]:
            data = response["data"]
            has_tithi = "tithi" in data
            has_sunrise = "sunrise" in data
            has_date = "date" in data
            
            self.log_test(
                "GET /api/panchang/today",
                has_tithi and has_sunrise and has_date,
                f"Panchang for {data.get('date', 'today')}, Tithi: {data.get('tithi', 'N/A')}",
                data
            )
        else:
            self.log_test(
                "GET /api/panchang/today",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )

    async def test_temples_and_events(self):
        """Test temples and events endpoints"""
        if not self.auth_token:
            self.log_test("Temples & Events", False, "No auth token available")
            return
        
        print("🏛️ Testing Temples & Events Endpoints...")
        
        # Test get temples
        response = await self.make_request("GET", "/temples")
        
        if response["success"]:
            data = response["data"]
            # Handle case where response is a list directly or has temples key
            temples = data if isinstance(data, list) else data.get("temples", [])
            
            self.log_test(
                "GET /api/temples",
                isinstance(temples, list),
                f"Found {len(temples)} temples",
                {"temple_count": len(temples)}
            )
        else:
            self.log_test(
                "GET /api/temples",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )
        
        # Test get events
        response = await self.make_request("GET", "/events")
        
        if response["success"]:
            data = response["data"]
            # Handle case where response is a list directly or has events key
            events = data if isinstance(data, list) else data.get("events", [])
            
            self.log_test(
                "GET /api/events",
                isinstance(events, list),
                f"Found {len(events)} events",
                {"event_count": len(events)}
            )
        else:
            self.log_test(
                "GET /api/events",
                False,
                f"Failed with status {response['status']}",
                response["data"]
            )

    async def test_rate_limiting(self):
        """Test rate limiting on auth endpoints"""
        print("🚦 Testing Rate Limiting...")
        
        # Make 15 rapid requests to send-otp
        rate_limited = False
        successful_requests = 0
        
        for i in range(15):
            response = await self.make_request("POST", "/auth/send-otp", {"phone": "9999000001"})
            
            if response["success"]:
                successful_requests += 1
            elif response["status"] == 429:  # Too Many Requests
                rate_limited = True
                break
                
        self.log_test(
            "Rate Limiting Test",
            rate_limited and successful_requests <= 10,
            f"Rate limited after {successful_requests} requests (expected <= 10)",
            {"successful_requests": successful_requests, "rate_limited": rate_limited}
        )

    async def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Sanatan Lok Backend API Tests")
        print(f"Base URL: {BASE_URL}")
        print("="*60)
        
        # Run test suites
        await self.test_health_endpoints()
        auth_success = await self.test_authentication_flow()
        
        if auth_success:
            await self.test_user_endpoints()
            await self.test_community_endpoints()
        
        await self.test_wisdom_and_panchang()
        
        if auth_success:
            await self.test_temples_and_events()
        
        await self.test_rate_limiting()
        
        # Print summary
        self.print_test_summary()

    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}")
        
        print("="*60)
        
        # Return overall success
        return failed_tests == 0


async def main():
    """Main test runner"""
    async with SanatanLokTester() as tester:
        success = await tester.run_all_tests()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())