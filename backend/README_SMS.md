Twilio SMS Setup for Sanatan Lok Backend

This project can send real OTP SMS using Twilio. By default the backend uses a mock OTP (`123456`).

Steps to enable real SMS:

1. Create a Twilio account and a phone number.
   - Get your `Account SID` and `Auth Token` from the Twilio console.
   - Buy or configure a Twilio phone number (E.164 format, e.g. `+12025550123`).

2. Set environment variables (add to your backend `.env`):

```
USE_MOCK_OTP=false
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
```

3. Install the Python dependency inside the backend venv:

```bash
cd backend
.venv/bin/python -m pip install -r requirements.txt
```

4. Restart the backend (inside venv):

```bash
cd backend
.venv/bin/uvicorn main:app --reload --port 8000
```

5. Test flow:
- From the app, enter a real phone number (E.164, e.g. `+919876543210`).
- The server will generate a 6-digit OTP, store it in Firestore and send it via Twilio.
- Enter the received OTP in the app to complete login/registration.

Logging and troubleshooting:
- Server logs will show whether Twilio send succeeded or failed.
- If you see "Twilio credentials missing" set the env vars correctly.
- If SMS fails, check Twilio console for delivery errors and ensure the `TWILIO_FROM_NUMBER` is capable of sending SMS to the destination country.

Security note:
- Keep `TWILIO_AUTH_TOKEN` secret. Do not commit `.env` to VCS.

If you'd like, I can also add automatic retries, per-number rate limiting, and SMS audit logs.