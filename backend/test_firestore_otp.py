import asyncio
import os
from services.firebase_auth_service import FirebaseAuthService
from dotenv import load_dotenv

load_dotenv()

async def main():
    print("Testing Firestore OTP insert...")
    try:
        db = await FirebaseAuthService.get_db()
        print("Successfully connected to Firestore!")
        
        # Try sending an OTP
        print("Sending mock OTP to +911234567890...")
        result = await FirebaseAuthService.send_otp("+911234567890")
        print(f"Result: {result}")
        
        # Let's check if the doc actually exists
        doc = await db.find_one('otps', [('phone', '==', '+911234567890')])
        if doc:
            print(f"Verified OTP exists in Firestore: {doc}")
        else:
            print("Failed to find OTP in Firestore!")
            
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main())
