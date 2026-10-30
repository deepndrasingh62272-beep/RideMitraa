# Firebase Phone OTP + Email OTP Integration Guide

## Overview

This guide covers the new Firebase Phone OTP and Email OTP authentication system integrated into your ride-sharing backend. The system provides:

- ✅ **Firebase Authentication for Phone OTP** - Secure phone-based OTP via Firebase
- ✅ **Email OTP via Nodemailer** - Email-based OTP for alternative login method
- ✅ **Unified OTP Endpoint** - Single endpoint that handles both email and phone
- ✅ **Rate Limiting** - 5 OTP requests per hour per user
- ✅ **Resend Cooldown** - 30-second wait between OTP requests
- ✅ **Bcrypt Hashing** - OTPs are hashed before storage in MongoDB
- ✅ **Backward Compatibility** - Existing phone OTP system still works
- ✅ **Clean Architecture** - Services separated for maintainability

---

## 1. Installation & Setup

### 1.1 Install Dependencies

```bash
npm install
```

The following packages have been added to `package.json`:
- `firebase-admin` (v12.0.0) - Firebase Admin SDK for backend
- `nodemailer` (v6.9.7) - Email sending via SMTP/Gmail

### 1.2 Set Up Environment Variables

Copy and customize your `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

---

## 2. Firebase Phone OTP Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create Project"
3. Name it (e.g., "ride-sharing-backend")
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2.2 Generate Service Account Key

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click the **Service Accounts** tab
3. Select **Node.js** if not already selected
4. Click **Generate New Private Key**
5. A JSON file will download - keep it safe!

### 2.3 Add Service Account Key to .env

The JSON file looks like this:
```json
{
  "type": "service_account",
  "project_id": "ride-sharing-backend",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xyz@appspot.gserviceaccount.com",
  ...
}
```

**To add it to .env:**

Option A - Single line (easiest):
```bash
# In your .env file, replace special characters as needed:
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"ride-sharing-backend",...}
```

Option B - Using Node.js to stringify:
```bash
node -e "console.log(JSON.stringify(require('./path/to/serviceAccountKey.json')))"
```

### 2.4 Enable Phone Authentication in Firebase

1. Go to Firebase Console > Authentication
2. Click **Sign-in method** tab
3. Enable **Phone**
4. Add your test phone numbers if in development

### 2.5 Deploy Rules (Optional - for Realtime DB)

If using Firestore/Realtime Database:
1. Go to **Firestore Database** tab
2. Click **Create Database**
3. Start in test mode (development)
4. Later, secure with proper rules

---

## 3. Email OTP Setup

### 3.1 Using Gmail (Recommended for Development)

#### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

#### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select **Mail** and **Windows Computer** (or your platform)
3. Click **Generate**
4. Copy the 16-character password

#### Step 3: Add to .env
```env
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop        # 16-char app password (remove spaces)
EMAIL_FROM=no-reply@ridesharing.com
```

### 3.2 Using Generic SMTP (Production)

For server-based email (SendGrid, AWS SES, etc.):

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.sendgrid.net              # or your SMTP server
SMTP_PORT=587
SMTP_SECURE=false                        # true for port 465
SMTP_USER=apikey                         # varies by provider
SMTP_PASSWORD=SG.xxxxx                   # your API key
EMAIL_FROM=no-reply@ridesharing.com
```

**Popular SMTP Providers:**
- **SendGrid**: `SMTP_HOST=smtp.sendgrid.net`, Port 587
- **AWS SES**: `SMTP_HOST=smtp.ses.region.amazonaws.com`, Port 587
- **Mailgun**: `SMTP_HOST=smtp.mailgun.org`, Port 587
- **Gmail**: `SMTP_HOST=smtp.gmail.com`, Port 587

---

## 4. API Endpoints

### 4.1 Unified OTP Endpoints (Recommended)

Use these endpoints for maximum flexibility.

#### Send OTP (Email or Phone)

**Endpoint:** `POST /api/auth/send-otp`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```
OR
```json
{
  "phone": "+919876543210"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent to user@example.com",
  "data": {
    "type": "EMAIL",
    "expiryMinutes": 5
  }
}
```

**Response (Error - Rate Limited):**
```json
{
  "success": false,
  "message": "Maximum 5 OTP requests per hour exceeded",
  "error": "RATE_LIMIT_EXCEEDED"
}
```

**Response (Error - Resend Cooldown):**
```json
{
  "success": false,
  "message": "Please wait 25 seconds before requesting a new OTP",
  "error": "RESEND_COOLDOWN_ACTIVE",
  "data": {
    "remainingSeconds": 25
  }
}
```

---

#### Verify OTP

**Endpoint:** `POST /api/auth/verify-otp`

**Request Body (Email):**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "role": "PASSENGER",
  "name": "John Doe"
}
```

**Request Body (Phone):**
```json
{
  "phone": "+919876543210",
  "otp": "123456",
  "verificationId": "verification_id_from_firebase",
  "role": "DRIVER",
  "name": "John Doe"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "userId": "user_123",
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "+919876543210",
      "role": "PASSENGER",
      "isPhoneVerified": true,
      "isEmailVerified": true
    }
  }
}
```

**Response (Error - Invalid OTP):**
```json
{
  "success": false,
  "message": "Invalid OTP",
  "error": "INVALID_OTP"
}
```

---

### 4.2 Dedicated Phone OTP Endpoints

For backward compatibility or phone-only flows.

#### Send Phone OTP

**Endpoint:** `POST /api/auth/send-phone-otp`

**Request:**
```json
{
  "phone": "9876543210"  (or "+919876543210")
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP initiated for +919876543210",
  "data": {
    "type": "PHONE",
    "expiryMinutes": 5,
    "verificationId": "firebase_1712234567_abc123def"
  }
}
```

---

#### Verify Phone OTP

**Endpoint:** `POST /api/auth/verify-phone-otp`

**Request:**
```json
{
  "phone": "9876543210",
  "otp": "123456",
  "verificationId": "firebase_1712234567_abc123def",
  "role": "DRIVER",
  "name": "John Doe"
}
```

---

### 4.3 Dedicated Email OTP Endpoints

#### Send Email OTP

**Endpoint:** `POST /api/auth/send-email-otp`

**Request:**
```json
{
  "email": "user@example.com"
}
```

---

#### Verify Email OTP

**Endpoint:** `POST /api/auth/verify-email-otp`

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "role": "PASSENGER",
  "name": "John Doe"
}
```

---

## 5. Security Features

### 5.1 OTP Hashing (Bcrypt)

- OTPs are hashed using bcrypt before storing in MongoDB
- Plain OTPs are never stored in database
- Verification uses bcrypt.compare() for secure matching
- Makes database breaches less critical

### 5.2 Rate Limiting

**Per User, Per Hour:** Maximum 5 OTP requests per user per hour

Configured in `.env`:
```env
MAX_OTP_REQUESTS_PER_HOUR=5
```

**Bypass:** Express rate limiter is skipped in development mode

### 5.3 Resend Cooldown

**Minimum Wait:** 30 seconds between consecutive OTP requests for same user

```env
RESEND_COOLDOWN_SECONDS=30
```

### 5.4 TTL Auto-Deletion

MongoDB TTL index automatically deletes expired OTPs:
- Set to expire after `OTP_EXPIRY_MINUTES` (default: 5 minutes)
- No manual cleanup needed

### 5.5 Attempt Limiting

- Maximum 5 failed verification attempts per OTP
- After 5 failed attempts, OTP is deleted
- User must request a new OTP

### 5.6 Error Handling

All endpoints return consistent error structure:
```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "ERROR_CODE"
}
```

Error codes:
- `INVALID_OTP` - Wrong OTP
- `OTP_EXPIRED` - OTP time limit exceeded
- `OTP_NOT_FOUND` - OTP doesn't exist or already used
- `TOO_MANY_ATTEMPTS` - Max failed attempts reached
- `RATE_LIMIT_EXCEEDED` - User exceeded max requests/hour
- `RESEND_COOLDOWN_ACTIVE` - User must wait before resending
- `INVALID_PHONE_FORMAT` - Phone number not in E.164 format
- `MISSING_CONTACT_INFO` - Neither email nor phone provided

---

## 6. Database Schema

### OTP Model

```javascript
{
  _id: ObjectId,
  
  // Contact info (one required)
  phone: String,           // E.164 format: +919876543210
  email: String,           // lowercase
  
  // OTP data
  otpHash: String,         // Bcrypt hashed
  type: String,            // "PHONE" or "EMAIL"
  expiresAt: Date,         // TTL index deletes after expiry
  
  // Verification tracking
  verified: Boolean,       // default: false
  attempts: Number,        // Failed verification attempts
  
  // Firebase data
  firebaseVerificationId: String, // For phone OTP
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

### User Model Updates

Added fields:
```javascript
{
  isPhoneVerified: Boolean,  // true after phone OTP verification
  isEmailVerified: Boolean,  // true after email OTP verification
}
```

---

## 7. Testing the System

### 7.1 Development Testing

In development mode (`NODE_ENV=development`), phone OTPs are logged to console:

```bash
[DEV] Phone OTP for +919876543210: 123456
```

For email OTPs, check email inbox or use Mailhog for local testing.

### 7.2 cURL Examples

#### Send Email OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

#### Send Phone OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210"
  }'
```

#### Verify Email OTP
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456",
    "role": "PASSENGER",
    "name": "John Doe"
  }'
```

#### Verify Phone OTP
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "123456",
    "role": "DRIVER",
    "name": "John Doe",
    "verificationId": "firebase_1712234567_abc123"
  }'
```

---

## 8. Troubleshooting

### Issue: Firebase not initializing
**Solution:**
- Check `FIREBASE_SERVICE_ACCOUNT_KEY` in .env
- Ensure it's properly stringified JSON
- Run: `node -e "console.log(JSON.parse(${process.env.FIREBASE_SERVICE_ACCOUNT_KEY}))"`
- Watch console logs for `[FIREBASE] Initialized successfully`

### Issue: Email OTP not sending
**Solution:**
- Verify `EMAIL_USER` and `EMAIL_PASSWORD` in .env
- For Gmail: Use 16-char app password (not your main password)
- Check firewall/proxy blocking port 587
- Run: `node -e "require('./src/services/emailService').testConnection()"`

### Issue: Rate limit errors
**Possible fixes:**
- Check `MAX_OTP_REQUESTS_PER_HOUR` setting
- Wait the cooldown period (`RESEND_COOLDOWN_SECONDS`)
- In dev, disable rate limiter: `NODE_ENV=development`

### Issue: "Phone number must be E.164 format"
**Solution:**
- Use format: `+<country_code><phone_number>`
- Example: `+919876543210` (India)
- Example: `+14155552671` (USA)

### Issue: JWT token not returned after OTP verification
**Solution:**
- Ensure JWT secret is set: `JWT_SECRET=your-secret`
- Check if `role` is provided in verify request
- Verify `createSession()` is working in auth controller

---

## 9. Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (32+ chars)
- [ ] Use strong `FIREBASE_SERVICE_ACCOUNT_KEY` and store securely
- [ ] Use production email provider (SendGrid, AWS SES, etc.)
- [ ] Set `OTP_EXPIRY_MINUTES` to 3-5 minutes
- [ ] Set `MAX_OTP_REQUESTS_PER_HOUR` to 3-5
- [ ] Set `RESEND_COOLDOWN_SECONDS` to 60+ seconds
- [ ] Enable HTTPS on your domain
- [ ] Set up proper error logging
- [ ] Test all OTP flows with real phone/email
- [ ] Set up rate limiting for entire API
- [ ] Add WAF rules to block OTP spam
- [ ] Monitor Firebase and Email quotas
- [ ] Set up backup email provider if possible
- [ ] Enable MongoDB encryption at rest
- [ ] Regular rotate Firebase service account key

---

## 10. Architecture Overview

```
Request → Express Routes → Auth Controller → OTP Service → Firebase/Email Service
                                                         ↓
                                                  MongoDB (OTP Model)
                                                  User Model
```

### File Structure

```
src/
├── controllers/
│   └── auth.controller.js       (Routes logic)
├── routes/
│   └── auth.routes.js           (Endpoint definitions)
├── services/
│   ├── firebaseService.js       (Firebase Admin SDK)
│   ├── emailService.js          (Nodemailer)
│   └── otpService.js            (Unified OTP logic)
├── models/
│   ├── OTP.js                   (Updated schema)
│   └── User.js                  (Updated schema)
└── middleware/
    └── auth.js                  (JWT verification)
```

### Service Functions

**otpService.js:**
- `sendOTP(email?, phone?)` - Unified send
- `sendEmailOTP(email)` - Email-specific
- `sendPhoneOTPViaFirebase(phone)` - Phone-specific
- `verifyOTP(email?, phone?, otp, verificationId?)` - Unified verify
- `verifyEmailOTP(email, otp)` - Email-specific
- `verifyPhoneOTP(phone, otp, verificationId?)` - Phone-specific
- `checkRateLimit(phone?, email?)` - Rate limiting
- `checkResendCooldown(phone?, email?)` - Resend cooldown

---

## 11. FAQ

**Q: What if a user provides both email and phone?**
A: Phone takes precedence. Modify logic in controller if needed.

**Q: Can I change OTP expiry?**
A: Yes, set `OTP_EXPIRY_MINUTES` in .env (default: 5)

**Q: How do I test without Firebase?**
A: Set a mock `FIREBASE_SERVICE_ACCOUNT_KEY`. Phone OTP will still be stored in MongoDB.

**Q: Can I send OTP via SMS provider like Twilio?**
A: Yes! Replace `sendPhoneOTPViaFirebase()` with Twilio API in otpService.js

**Q: How do I implement email verification flow?**
A: Check `isEmailVerified` flag in User model and enforce it in endpoints.

**Q: Can existing phone-only users still login?**
A: Yes! Legacy `/api/auth/send-otp` endpoint still works if provided.

---

## 12. Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Set up Firebase project and generate service account key
3. ✅ Configure Gmail or SMTP in .env
4. ✅ Set `OTP_EXPIRY_MINUTES`, rate limits in .env
5. ✅ Start server: `npm start` or `npm run dev`
6. ✅ Test endpoints using cURL or Postman
7. ✅ Deploy to production with proper .env values
8. ✅ Monitor Firebase and Email quotas

---

## Support & References

- **Firebase Docs:** https://firebase.google.com/docs/admin/setup
- **Nodemailer Docs:** https://nodemailer.com/
- **Express-Validator:** https://express-validator.github.io/docs/
- **bcryptjs:** https://www.npmjs.com/package/bcryptjs
- **JWT:** https://jwt.io/

---

**Last Updated:** April 2026  
**Maintainer:** Your Team
