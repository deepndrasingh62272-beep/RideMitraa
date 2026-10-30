# 🔥 REAL-TIME USE - Step-by-Step Guide
# (हिंदी + English)

## ⚡ 5 मिनट में चलाओ

### Step 1️⃣: Terminal खोलो
```bash
cd "c:\Users\abhii\OneDrive\Desktop\New folder (2)\ride-sharing-backend"
```

### Step 2️⃣: Dependencies install करो
```bash
npm install
```
**देखो:** "added XX packages" message आएगा ✅

---

## 📱 PHONE OTP Setup

### Step 3️⃣: Firebase Account बनाओ
1. जाओ: https://console.firebase.google.com
2. "Create Project" दबाओ
3. Project का नाम दो (e.g., "ride-sharing-backend")
4. "Create project" दबाओ

### Step 4️⃣: Service Account Key निकालो
1. Firebase Console में → ⚙️ Settings (gear icon)
2. "Service Accounts" tab दबाओ
3. "Generate New Private Key" दबाओ
4. JSON file download होगी

### Step 5️⃣: .env file बनाओ
1. `.env.production` को copy करो: `.env`
2. इसमें fill करो:

```env
NODE_ENV=production
PORT=5000

# MongoDB - Local (अंदर testing के लिए)
MONGODB_URI=mongodb://localhost:27017/ridesharing

# या MongoDB Atlas (Cloud)
# MONGODB_URI=mongodb+srv://<credentials-redacted>@<cluster-host>/ridesharing

JWT_SECRET=your-super-secret-key-min-32-chars
OTP_EXPIRY_MINUTES=5
MAX_OTP_REQUESTS_PER_HOUR=5
RESEND_COOLDOWN_SECONDS=30
```

### Step 6️⃣: Firebase key add करो

Download की गई JSON file को copy करो, फिर:

```bash
# Windows PowerShell में:
node -e "console.log(JSON.stringify(require('./serviceAccountKey.json')))"
```

Output को `.env` में add करो:
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

---

## 📧 EMAIL OTP Setup

### Step 7️⃣: Gmail Setup करो

**Option A: Gmail से (आसान)**
1. जाओ: https://myaccount.google.com/security
2. 2-Step Verification enable करो
3. App Passwords जाओ: https://myaccount.google.com/apppasswords
4. Mail + Windows Computer select करो
5. 16-character password copy करो

`.env` में add करो:
```env
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
EMAIL_FROM=no-reply@ridesharing.com
```

**Option B: अगर Gmail नहीं है तो SMTP use करो**
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.google.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-password
```

---

## 🚀 Server चलाओ

### Step 8️⃣: Development mode में

```bash
npm run dev
```

Output:
```
[FIREBASE] Initialized successfully
[EMAIL] Service initialized successfully
Server running on port 5000
```

दिल से खुश हो जाओ! ✅

### Step 9️⃣: Production mode में

```bash
NODE_ENV=production npm start
```

---

## 🧪 Testing - Real-Time

### Test Phone OTP

**Option 1: PowerShell/Command Prompt में**

```powershell
# 1. OTP भेजो
$response = curl -Method Post `
  -Uri "http://localhost:5000/api/auth/send-phone-otp" `
  -Headers @{"Content-Type" = "application/json"} `
  -Body '{"phone": "+919876543210"}'

$response | ConvertFrom-Json

# Output देखो:
# {
#   "success": true,
#   "message": "OTP initiated for +919876543210",
#   "data": {"type": "PHONE", "verificationId": "firebase_..."}
# }
```

Console में OTP दिखेगा (DEV mode में):
```
[DEV] Phone OTP for +919876543210: 123456
```

```powershell
# 2. OTP verify करो
$body = @{
    phone = "+919876543210"
    otp = "123456"
    verificationId = "firebase_..."
    role = "PASSENGER"
    name = "John Doe"
} | ConvertTo-Json

$response = curl -Method Post `
  -Uri "http://localhost:5000/api/auth/verify-phone-otp" `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $body

$response | ConvertFrom-Json

# Output:
# {
#   "success": true,
#   "data": {
#     "token": "eyJhbGc...",
#     "user": {...}
#   }
# }
```

---

### Test Email OTP

```powershell
# 1. Email OTP भेजो
$body = @{email = "you@gmail.com"} | ConvertTo-Json

$response = curl -Method Post `
  -Uri "http://localhost:5000/api/auth/send-email-otp" `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $body

# 2. Email में OTP check करो
# 3. Verify करो
$body = @{
    email = "you@gmail.com"
    otp = "123456"
    role = "DRIVER"
} | ConvertTo-Json

$response = curl -Method Post `
  -Uri "http://localhost:5000/api/auth/verify-email-otp" `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $body
```

---

## 📱 Frontend में integrate करो

### React (Web)

```javascript
// src/screens/LoginScreen.js
import { useState } from 'react';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'

  const sendOTP = async () => {
    const res = await fetch('http://localhost:5000/api/auth/send-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    
    if (data.success) {
      setVerificationId(data.data.verificationId);
      setStep('otp');
      alert('OTP sent!');
    }
  };

  const verifyOTP = async () => {
    const res = await fetch('http://localhost:5000/api/auth/verify-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        otp,
        verificationId,
        role: 'PASSENGER',
        name: 'User'
      })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('authToken', data.data.token);
      window.location.href = '/home';
    } else {
      alert(data.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px' }}>
      {step === 'phone' ? (
        <>
          <input
            placeholder="Phone: +919876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button onClick={sendOTP}>Send OTP</button>
        </>
      ) : (
        <>
          <input
            placeholder="OTP from SMS"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button onClick={verifyOTP}>Verify OTP</button>
        </>
      )}
    </div>
  );
}
```

### Flutter (Mobile)

```dart
// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final phoneController = TextEditingController();
  final otpController = TextEditingController();
  String? verificationId;
  bool showOTPInput = false;

  Future<void> sendOTP() async {
    final response = await http.post(
      Uri.parse('http://localhost:5000/api/auth/send-phone-otp'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phoneController.text}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['success']) {
        setState(() {
          verificationId = data['data']['verificationId'];
          showOTPInput = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('OTP sent!')),
        );
      }
    }
  }

  Future<void> verifyOTP() async {
    final response = await http.post(
      Uri.parse('http://localhost:5000/api/auth/verify-phone-otp'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phone': phoneController.text,
        'otp': otpController.text,
        'verificationId': verificationId,
        'role': 'PASSENGER',
        'name': 'User'
      }),
    );

    final data = jsonDecode(response.body);
    if (data['success']) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('authToken', data['data']['token']);
      Navigator.of(context).pushReplacementNamed('/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(data['message'])),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Login')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: phoneController,
              decoration: InputDecoration(hintText: '+919876543210'),
            ),
            SizedBox(height: 16),
            if (!showOTPInput)
              ElevatedButton(
                onPressed: sendOTP,
                child: Text('Send OTP'),
              )
            else ...[
              TextField(
                controller: otpController,
                decoration: InputDecoration(hintText: 'OTP'),
              ),
              SizedBox(height: 16),
              ElevatedButton(
                onPressed: verifyOTP,
                child: Text('Verify OTP'),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
```

---

## ✅ Verification Checklist

- [ ] Dependencies installed (`npm install` successful)
- [ ] `.env` file created with all values
- [ ] Firebase project created & key obtained
- [ ] Gmail app password generated
- [ ] Server runs without errors (`npm run dev`)
- [ ] Console shows: `[FIREBASE] Initialized successfully`
- [ ] Console shows: `[EMAIL] Service initialized successfully`
- [ ] Phone OTP test successful (console में OTP दिखता है)
- [ ] Email OTP test successful (email में OTP आता है)
- [ ] Frontend में API integrate किया

---

## 🆘 Common Issues & Fixes

### Issue: Firebase error
```bash
# Check:
node -e "console.log(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))"

# Fix करो: .env में सही JSON paste करो
```

### Issue: Email नहीं आ रहा
```bash
# Gmail की app password check करो
# 16 characters होनी चाहिए
# Space हटाओ अगर हैं
```

### Issue: MongoDB connect नहीं हो रहा
```bash
# अगर local MongoDB है:
mongod --version  # Check if installed

# अगर MongoDB Atlas है:
# Connection string check करो
```

### Issue: Port 5000 busy है
```bash
# दूसरा port use करो:
PORT=3000 npm start
```

---

## 🎉 Ready!

अब तुम्हारा system completely **PRODUCTION READY** है!

Next: 
- [ ] Database में test users बनाओ
- [ ] Load testing करो
- [ ] Analytics setup करो
- [ ] Production server पर deploy करो

---

**Questions?** Check करो:
- `PRODUCTION_READY.md`
- `API_REFERENCE.md`
- `FIREBASE_OTP_SETUP.md`

**Go Live! 🚀**
