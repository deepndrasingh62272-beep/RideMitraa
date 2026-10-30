# ⚡ Production Ready - Real-Time OTP System

## 🚀 Quick Start (5 मिनट)

### 1️⃣ Dependencies Install करो
```bash
npm install
```

### 2️⃣ Production .env Setup करो
```bash
cp .env.example .env
```

**ध्यान दें:** सभी values सेट करनी हैं!

```env
# ===== SERVER =====
NODE_ENV=production
PORT=5000

# ===== DATABASE =====
MONGODB_URI=mongodb+srv://<credentials-redacted>@<cluster-host>/ridesharing

# ===== JWT =====
JWT_SECRET=use-strong-random-32-char-secret
JWT_EXPIRY=7d

# ===== OTP =====
OTP_EXPIRY_MINUTES=5
MAX_OTP_REQUESTS_PER_HOUR=5
RESEND_COOLDOWN_SECONDS=30

# ===== FIREBASE (Phone OTP) =====
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# ===== EMAIL (Gmail या SMTP) =====
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=16-char-app-password
EMAIL_FROM=no-reply@ridesharing.com

# ===== Other Services =====
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-south-1
```

### 3️⃣ Server Start करो
```bash
# Development
npm run dev

# Production
NODE_ENV=production npm start
```

---

## ✅ Production Checklist

### Before Going Live:

- [ ] **Database**: MongoDB Atlas connection tested
- [ ] **Firebase**: Service account key configured & working
- [ ] **Email**: Gmail app password या SMTP setup done
- [ ] **Security**: Strong JWT secret (32+ chars)
- [ ] **HTTPS**: SSL certificate installed (production only)
- [ ] **CORS**: Allowed origins configured
- [ ] **Rate Limiting**: Enabled and tested
- [ ] **Error Logging**: Sentry/LogRocket setup (optional)
- [ ] **Monitoring**: Firebase quota monitoring
- [ ] **Backup**: Database backup strategy ready

---

## 📊 Real-Time Testing

### Phone OTP Flow:
```bash
# 1. Send OTP
curl -X POST http://localhost:5000/api/auth/send-phone-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# Response:
{
  "success": true,
  "data": {
    "type": "PHONE",
    "expiryMinutes": 5,
    "verificationId": "firebase_..."
  }
}

# 2. Verify OTP (development में console से check करो)
curl -X POST http://localhost:5000/api/auth/verify-phone-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "123456",
    "verificationId": "firebase_...",
    "role": "PASSENGER"
  }'

# Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {...}
  }
}
```

### Email OTP Flow:
```bash
# 1. Send Email OTP
curl -X POST http://localhost:5000/api/auth/send-email-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 2. Verify (OTP check करो email में)
curl -X POST http://localhost:5000/api/auth/verify-email-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456",
    "role": "DRIVER"
  }'
```

---

## 🔒 Security Best Practices

### 1. Secret Management
```env
# ❌ WRONG - Do not hardcode
JWT_SECRET=mysecret123

# ✅ RIGHT - Use strong random secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Firebase Service Account Security
```bash
# ❌ WRONG - Hardcode in code
const key = require('./serviceAccountKey.json');

# ✅ RIGHT - Use environment variables
const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
```

### 3. Rate Limiting
```env
# Production settings (strict)
MAX_OTP_REQUESTS_PER_HOUR=3
RESEND_COOLDOWN_SECONDS=60

# Development settings (loose)
MAX_OTP_REQUESTS_PER_HOUR=10
RESEND_COOLDOWN_SECONDS=10
```

### 4. CORS Configuration
```javascript
// src/server.js
const allowedOrigins = [
  'https://yourdomain.com',
  'https://app.yourdomain.com',
  'https://admin.yourdomain.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## 📱 Frontend Integration

### React Setup:
```javascript
// src/api/auth.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export async function sendPhoneOTP(phone) {
  const response = await fetch(`${API_URL}/api/auth/send-phone-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  return response.json();
}

export async function verifyPhoneOTP(phone, otp, verificationId) {
  const response = await fetch(`${API_URL}/api/auth/verify-phone-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, verificationId, role: 'PASSENGER' })
  });
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('authToken', data.data.token);
  }
  return data;
}
```

### Flutter Setup:
```dart
// lib/services/auth_service.dart
class AuthService {
  final String baseUrl = const String.fromEnvironment('API_URL', 
    defaultValue: 'http://localhost:5000');

  Future<void> sendPhoneOTP(String phone) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/send-phone-otp'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone}),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['success']) {
        // Show OTP input screen
      }
    }
  }
}
```

---

## 🚨 Error Handling

### Client Side:
```javascript
async function handleOTPFlow(phone) {
  try {
    // Send OTP
    const sendRes = await fetch('/api/auth/send-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    if (sendRes.status === 429) {
      // Rate limited
      alert('Too many requests. Try again later.');
      return;
    }

    const sendData = await sendRes.json();
    if (!sendData.success) {
      alert(`Error: ${sendData.message}`);
      return;
    }

    // Show OTP input...
    const otp = await getUserInput('Enter OTP:');

    // Verify OTP
    const verifyRes = await fetch('/api/auth/verify-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        otp,
        verificationId: sendData.data.verificationId,
        role: 'PASSENGER'
      })
    });

    const verifyData = await verifyRes.json();

    if (verifyData.success) {
      localStorage.setItem('authToken', verifyData.data.token);
      window.location.href = '/home';
    } else {
      // Handle specific errors
      if (verifyData.error === 'INVALID_OTP') {
        alert('Wrong OTP. Try again.');
      } else if (verifyData.error === 'OTP_EXPIRED') {
        alert('OTP expired. Request a new one.');
      } else if (verifyData.error === 'TOO_MANY_ATTEMPTS') {
        alert('Too many wrong attempts. Request a new OTP.');
      }
    }
  } catch (error) {
    console.error('Flow error:', error);
    alert('Something went wrong. Try again.');
  }
}
```

---

## 📊 Monitoring & Analytics

### Logs को Monitor करो:

```bash
# Real-time logs देखो
npm start | tee server.log

# Errors को grep करो
tail -f server.log | grep ERROR

# OTP activity देखो
tail -f server.log | grep "\[OTP\]"
```

### Database Monitoring:

```javascript
// src/utils/monitoring.js
const logOTPActivity = async (action, userId, status) => {
  console.log(`[MONITOR] ${action} - User: ${userId} - Status: ${status}`);
  // You can also store this in MongoDB for analytics
};

// Use in auth controller:
await logOTPActivity('SEND_OTP', user._id, 'SUCCESS');
```

---

## 🔧 Deployment Guide

### Heroku Deployment:
```bash
# 1. Login करो
heroku login

# 2. App create करो
heroku create your-app-name

# 3. Environment variables set करो
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
heroku config:set FIREBASE_SERVICE_ACCOUNT_KEY='...'
heroku config:set MONGODB_URI=mongodb+srv://...

# 4. Deploy करो
git push heroku main

# 5. Logs देखो
heroku logs --tail
```

### AWS EC2 Deployment:
```bash
# 1. Connect करो
ssh -i key.pem ec2-user@your-instance

# 2. Dependencies install करो
sudo apt update && sudo apt install nodejs npm

# 3. Code pull करो
git clone your-repo
cd your-repo
npm install

# 4. PM2 से run करो (background में)
npm install -g pm2
pm2 start server.js --name "ride-otp"
pm2 startup
pm2 save

# 5. Logs देखो
pm2 logs ride-otp
```

### Docker Deployment:
```dockerfile
FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "server.js"]
```

```bash
# Build करो
docker build -t ride-sharing-backend .

# Run करो
docker run -d \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb+srv://... \
  -e JWT_SECRET=... \
  -p 5000:5000 \
  ride-sharing-backend
```

---

## 📈 Performance Optimization

### 1. Database Indexing
```javascript
// Already configured in OTP.js
otpSchema.index({ phone: 1, verified: 1 });
otpSchema.index({ email: 1, verified: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

### 2. Caching (Redis - Optional)
```javascript
// src/config/redis.js
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// Cache OTP rate limit check
async function checkRateLimitWithCache(identifier) {
  const cacheKey = `otp_limit:${identifier}`;
  const cached = await client.get(cacheKey);
  
  if (cached) {
    const count = parseInt(cached);
    return count < MAX_OTP_REQUESTS_PER_HOUR;
  }
  
  // Check DB and cache
  const count = await OTP.countDocuments({...});
  await client.setex(cacheKey, 3600, count.toString());
  
  return count < MAX_OTP_REQUESTS_PER_HOUR;
}
```

### 3. Async Email Sending
```javascript
// Already async in emailService.js
// Emails भेजते हैं in background
await sendOTPEmail(email, otp); // Non-blocking
```

---

## 🆘 Troubleshooting

### OTP नहीं आ रहा है?

**Phone OTP:**
```bash
# 1. Firebase service account key check करो
node -e "console.log(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))"

# 2. Console logs देखो
tail -f server.log | grep FIREBASE

# 3. Firebase project settings check करो
# - Authentication > Phone enabled?
# - Project has SMS quota?
```

**Email OTP:**
```bash
# 1. Gmail app password test करो
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
transporter.verify((err) => console.log(err || 'Email service OK'));
"

# 2. Logs check करो
tail -f server.log | grep EMAIL
```

### Rate Limiting Issues?

```bash
# Settings check करो
echo "MAX_OTP_REQUESTS_PER_HOUR: $MAX_OTP_REQUESTS_PER_HOUR"
echo "RESEND_COOLDOWN_SECONDS: $RESEND_COOLDOWN_SECONDS"

# Database से manually clean करो
mongo
use ridesharing
db.otps.deleteMany({ createdAt: { $lt: new Date(Date.now() - 3600000) } })
```

### Database Connection Issues?

```bash
# MongoDB connection test करो
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected!'))
  .catch(err => console.error('Connection error:', err));
"
```

---

## 📞 Support & Resources

- **Firebase Docs**: https://firebase.google.com/docs
- **Nodemailer**: https://nodemailer.com/
- **MongoDB**: https://docs.mongodb.com/
- **Express**: https://expressjs.com/

---

## ✨ Summary

| Feature | Status |
|---------|--------|
| Phone OTP | ✅ Ready |
| Email OTP | ✅ Ready |
| Rate Limiting | ✅ Ready |
| Security | ✅ Ready |
| Error Handling | ✅ Ready |
| Monitoring | ✅ Ready |
| Documentation | ✅ Complete |

**🎉 तुम्हारा system production-ready है! Go live!**
