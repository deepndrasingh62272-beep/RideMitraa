# OTP Authentication API Reference

Quick reference for all OTP authentication endpoints.

---

## Recommended Flow: Unified Endpoints

Use these endpoints for maximum flexibility and best practices.

### 1. Send OTP (Email or Phone)

**POST** `/api/auth/send-otp`

Send an OTP to either an email address or phone number. The system automatically determines which channel to use.

**Request:**
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

**Response (200):**
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

**Response (400):**
```json
{
  "success": false,
  "message": "Neither email nor phone provided",
  "error": "MISSING_CONTACT_INFO"
}
```

**Response (429):**
```json
{
  "success": false,
  "message": "Maximum 5 OTP requests per hour exceeded",
  "error": "RATE_LIMIT_EXCEEDED"
}
```

---

### 2. Verify OTP (Email or Phone)

**POST** `/api/auth/verify-otp`

Verify the OTP and receive a JWT token for authentication.

**Request (Email):**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "role": "PASSENGER",
  "name": "John Doe"
}
```

**Request (Phone):**
```json
{
  "phone": "+919876543210",
  "otp": "123456",
  "role": "DRIVER",
  "name": "John Doe",
  "verificationId": "firebase_xxx"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "user_123",
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "+919876543210",
      "role": "PASSENGER",
      "kycStatus": "PENDING",
      "isPhoneVerified": true,
      "isEmailVerified": true
    }
  }
}
```

**Response (400):**
```json
{
  "success": false,
  "message": "Invalid OTP",
  "error": "INVALID_OTP"
}
```

**Error Codes:**
| Code | Meaning |
|------|---------|
| `INVALID_OTP` | Wrong OTP entered |
| `OTP_EXPIRED` | OTP time limit exceeded |
| `OTP_NOT_FOUND` | No active OTP found |
| `TOO_MANY_ATTEMPTS` | Max failed attempts (5) exceeded |

---

## Phone-Only Endpoints

Use these for phone-specific flows (legacy support or phone-preferred).

### 3. Send Phone OTP

**POST** `/api/auth/send-phone-otp`

Send OTP specifically to a phone number via Firebase.

**Request:**
```json
{
  "phone": "9876543210"
}
```
or
```json
{
  "phone": "+919876543210"
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

**Client Usage:**
```javascript
// Step 1: Request phone OTP
const response = await fetch('/api/auth/send-phone-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '9876543210' })
});
const { data } = await response.json();
const { verificationId } = data;  // Save this!

// Step 2: User receives SMS, enters code
// userEnteredOTP = "123456"

// Step 3: Verify OTP
const verifyResponse = await fetch('/api/auth/verify-phone-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '9876543210',
    otp: userEnteredOTP,
    verificationId,  // Use saved verification ID
    role: 'PASSENGER',
    name: 'John Doe'
  })
});
```

---

### 4. Verify Phone OTP

**POST** `/api/auth/verify-phone-otp`

Verify the phone OTP and get JWT token.

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

**Response:** Same as unified verify endpoint

---

## Email-Only Endpoints

Use these for email-specific flows.

### 5. Send Email OTP

**POST** `/api/auth/send-email-otp`

Send OTP specifically to an email address.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
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

---

### 6. Verify Email OTP

**POST** `/api/auth/verify-email-otp`

Verify the email OTP and get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "role": "PASSENGER",
  "name": "John Doe"
}
```

**Response:** Same as unified verify endpoint

---

## Other Endpoints

### 7. Get Current User

**GET** `/api/auth/me`

Get the profile of the currently authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user_123",
      "name": "John Doe",
      "phone": "9876543210",
      "email": "user@example.com",
      "role": "DRIVER",
      "kycStatus": "PENDING",
      "isPhoneVerified": true,
      "isEmailVerified": false
    }
  }
}
```

---

### 8. Logout

**POST** `/api/auth/logout`

Log out the current user and revoke all sessions.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 9. Guest Login

**POST** `/api/auth/guest-login`

Create a temporary guest session (no authentication required).

**Request:** No body needed

**Response:**
```json
{
  "success": true,
  "message": "Guest session created",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "guest_abc123"
  }
}
```

---

## Status Codes Reference

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 429 | Too many requests (rate limited) |
| 500 | Server error |

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "ERROR_CODE"
}
```

**Common Error Codes:**
| Code | Cause | Solution |
|------|-------|----------|
| `MISSING_CONTACT_INFO` | No email or phone provided | Provide either email or phone |
| `INVALID_PHONE_FORMAT` | Phone not in E.164 format | Use format: +919876543210 |
| `RATE_LIMIT_EXCEEDED` | Too many requests in 1 hour | Wait 1 hour or try email |
| `RESEND_COOLDOWN_ACTIVE` | Less than 30 sec since last request | Wait 30 seconds |
| `INVALID_OTP` | Wrong OTP code | Enter correct OTP |
| `OTP_EXPIRED` | OTP older than 5 minutes | Request new OTP |
| `OTP_NOT_FOUND` | No OTP exists or already used | Request new OTP |
| `TOO_MANY_ATTEMPTS` | 5+ failed verification attempts | Request new OTP |

---

## cURL Examples

### Send Email OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### Send Phone OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-phone-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

### Verify Email OTP
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

### Verify Phone OTP
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

### Get Current User
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## JavaScript Fetch Examples

### Complete Email OTP Flow
```javascript
// 1. Send OTP to email
const sendResponse = await fetch('/api/auth/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});
const sendData = await sendResponse.json();

if (!sendData.success) {
  console.error('Failed to send OTP:', sendData.message);
  return;
}

// 2. User enters OTP from email
const userOTP = prompt('Enter OTP from email:');

// 3. Verify OTP
const verifyResponse = await fetch('/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    otp: userOTP,
    role: 'PASSENGER',
    name: 'John Doe'
  })
});
const verifyData = await verifyResponse.json();

if (verifyData.success) {
  // Save token
  localStorage.setItem('authToken', verifyData.data.token);
  console.log('Logged in as:', verifyData.data.user.name);
} else {
  console.error('Login failed:', verifyData.message);
}
```

### Complete Phone OTP Flow
```javascript
// 1. Send OTP to phone
const sendResponse = await fetch('/api/auth/send-phone-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+919876543210' })
});
const sendData = await sendResponse.json();
const verificationId = sendData.data.verificationId;  // Save this!

// 2. User enters OTP from SMS
const userOTP = prompt('Enter OTP from SMS:');

// 3. Verify OTP
const verifyResponse = await fetch('/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '+919876543210',
    otp: userOTP,
    verificationId,  // Use saved ID
    role: 'DRIVER',
    name: 'John Doe'
  })
});
const verifyData = await verifyResponse.json();

if (verifyData.success) {
  localStorage.setItem('authToken', verifyData.data.token);
  console.log('Logged in as:', verifyData.data.user.name);
}
```

---

## Response Examples by Channel

### Email OTP Response
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

### Phone OTP Response
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

## Quick Decision Tree

**Which endpoint should I use?**

```
┌─ Do I want to support BOTH email and phone?
│  └─ YES → Use /send-otp and /verify-otp (unified)
│
├─ Do I want ONLY phone OTP?
│  └─ YES → Use /send-phone-otp and /verify-phone-otp
│
└─ Do I want ONLY email OTP?
   └─ YES → Use /send-email-otp and /verify-email-otp
```

**Recommended:** Start with unified endpoints, then add specific endpoints if needed.

---

**Last Updated:** April 2026  
**API Version:** 2.0 (with Firebase & Email support)
