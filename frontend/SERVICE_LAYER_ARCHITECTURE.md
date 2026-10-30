# Service Layer Architecture

Visual overview of the complete service layer architecture.

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Components                             │
│  (FindRidePage, WalletPage, ChatPage, ProfilePage, etc.)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer (11 Services)                   │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Booking     │  │  Ride        │  │  Payment     │           │
│  │  Service     │  │  Service     │  │  Service     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Tracking    │  │  Chat        │  │  KYC         │           │
│  │  Service     │  │  Service     │  │  Service     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  User        │  │  Emergency   │  │  Notification│           │
│  │  Service     │  │  Service     │  │  Service     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │  Map         │  │  Referral    │                             │
│  │  Service     │  │  Service     │                             │
│  └──────────────┘  └──────────────┘                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Foundation Layer                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  API Client  │  │  Error       │  │  Response    │           │
│  │  (Axios)     │  │  Handler     │  │  Mapper      │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                   │
│  • JWT Injection      • Error Parsing      • _id → id            │
│  • Retry Logic        • Toast Notifications • GeoJSON Transform  │
│  • Interceptors       • Retryable Detection • Nested Mapping     │
│  • Timeout Config     • Error Format       • Array Handling      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js)                         │
│                                                                   │
│  /api/bookings    /api/rides      /api/payments                 │
│  /api/tracking    /api/chat       /api/kyc                      │
│  /api/users       /api/safety     /api/notifications            │
│  /api/map         /api/referrals                                │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow

### Request Flow
```
Component
    ↓
Service Function
    ↓
apiClient (with JWT)
    ↓
Request Interceptor (add token)
    ↓
Backend API
    ↓
Response
    ↓
Response Interceptor (check 401)
    ↓
Response Mapper (transform data)
    ↓
Error Handler (if error)
    ↓
Return Result { success, data, error }
    ↓
Component
```

### Error Flow
```
API Error
    ↓
Error Handler
    ↓
Parse Error (status, message, code)
    ↓
Check if Retryable
    ├─ Yes → Retry with Backoff
    └─ No → Show Toast & Return Error
    ↓
Component Catches Error
```

## 🔄 Service Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                    Booking Service                               │
│                                                                   │
│  searchRides()                                                   │
│    ├─ Calls: apiClient.get('/rides')                            │
│    ├─ Transforms: mapArray(response)                            │
│    └─ Returns: { success, data: rides[] }                       │
│                                                                   │
│  createBooking()                                                │
│    ├─ Calls: apiClient.post('/bookings', data)                 │
│    ├─ Transforms: mapBooking(response)                          │
│    └─ Returns: { success, data: booking }                       │
│                                                                   │
│  getMyTrips()                                                   │
│    ├─ Calls: apiClient.get('/bookings/my-trips')               │
│    ├─ Transforms: mapArray(response)                            │
│    └─ Returns: { success, data: trips[] }                       │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Security Flow

```
Component
    ↓
Service Function
    ↓
apiClient
    ├─ Check localStorage for token
    ├─ Add Authorization header: "Bearer <token>"
    └─ Send request
    ↓
Backend
    ├─ Verify JWT
    ├─ Check permissions
    └─ Process request
    ↓
Response
    ↓
Response Interceptor
    ├─ Check status 401
    ├─ If 401: Clear token & redirect to login
    └─ Otherwise: Continue
    ↓
Component
```

## 📝 Response Format

```typescript
// Success Response
{
  success: true,
  data: {
    id: "507f1f77bcf86cd799439011",
    name: "John Doe",
    email: "john@example.com",
    // ... other fields
  },
  pagination?: {
    page: 1,
    limit: 20,
    total: 100,
    pages: 5
  }
}

// Error Response
{
  success: false,
  error: "INVALID_REQUEST",
  message: "Invalid booking data",
  details: {
    field: "rideId",
    reason: "Required"
  }
}
```

## 🔄 Retry Logic

```
Request
    ↓
Try API Call
    ├─ Success → Return Response
    └─ Error → Check if Retryable
        ├─ Network Error → Retry
        ├─ 5xx Error → Retry
        ├─ 429 (Rate Limit) → Retry
        ├─ Timeout → Retry
        └─ Other → Return Error
        ↓
    Wait (exponential backoff)
        ├─ Retry 1: 1 second
        ├─ Retry 2: 1.5 seconds
        └─ Max 2 retries
        ↓
    Try Again
        ├─ Success → Return Response
        └─ Error → Return Error
```

## 📊 Service Dependencies

```
All Services
    ↓
apiClient (HTTP requests)
    ↓
errorHandler (Error handling)
    ↓
responseMapper (Data transformation)
    ↓
Backend API
```

## 🎯 Component Integration

```
Component
    ├─ Import Service
    │   import { bookingService } from '@/services'
    │
    ├─ Call Service Function
    │   const result = await bookingService.searchRides(filters)
    │
    ├─ Check Success
    │   if (result.success) {
    │     setData(result.data)
    │   }
    │
    └─ Handle Error
        // Error already handled by service
        // Toast notification shown automatically
```

## 🔌 API Endpoint Mapping

```
Service Function          →  Backend Endpoint
─────────────────────────────────────────────
bookingService.searchRides()  →  GET /api/rides
bookingService.createBooking()  →  POST /api/bookings
bookingService.getMyTrips()  →  GET /api/bookings/my-trips
bookingService.acceptBooking()  →  POST /api/bookings/:id/accept

rideService.publishRide()  →  POST /api/rides
rideService.estimateFare()  →  GET /api/rides/fare-estimate
rideService.startRide()  →  POST /api/rides/:id/start

paymentService.getWalletBalance()  →  GET /api/wallet/balance
paymentService.topupWallet()  →  POST /api/wallet/topup
paymentService.initiatePayment()  →  POST /api/payments/initiate

trackingService.updateLocation()  →  POST /api/tracking/:id/location
trackingService.getLiveLocation()  →  GET /api/tracking/:id/location

chatService.getMessages()  →  GET /api/chat/:id/messages
chatService.sendMessage()  →  POST /api/chat/:id/send

kycService.uploadKYCDocuments()  →  POST /api/kyc/upload
kycService.submitKYC()  →  POST /api/kyc/submit

userService.getProfile()  →  GET /api/users/me
userService.updateProfile()  →  PATCH /api/users/me

emergencyService.triggerSOS()  →  POST /api/safety/sos
emergencyService.getEmergencyContacts()  →  GET /api/emergency/contacts

notificationService.getNotifications()  →  GET /api/notifications
notificationService.markAsRead()  →  PATCH /api/notifications/:id/read

mapService.geocodeAddress()  →  GET /api/map/geocode
mapService.getRoute()  →  GET /api/map/route

referralService.getReferralData()  →  GET /api/users/me/referrals
referralService.applyReferralCode()  →  POST /api/referrals/apply
```

## 🧪 Testing Architecture

```
Component Tests
    ↓
Mock Services
    ├─ Mock bookingService
    ├─ Mock rideService
    └─ Mock paymentService
    ↓
Test Component Behavior
    ├─ Verify service called
    ├─ Verify data displayed
    └─ Verify errors handled
    ↓
Service Tests
    ├─ Mock apiClient
    ├─ Test service functions
    └─ Test error handling
    ↓
Integration Tests
    ├─ Real apiClient
    ├─ Mock backend
    └─ Test full flow
```

## 📈 Performance Optimization

```
Component
    ↓
Service Call
    ├─ Check Cache (React Query/SWR)
    ├─ If cached: Return cached data
    └─ If not cached: Make API call
    ↓
API Call
    ├─ Retry on failure (max 2)
    ├─ Timeout after 30 seconds
    └─ Return response
    ↓
Cache Result
    ├─ Store in React Query/SWR
    ├─ Set expiry time
    └─ Return to component
```

## 🔐 Authentication Flow

```
User Login
    ↓
POST /api/auth/verify-otp
    ├─ Verify OTP
    └─ Return JWT token
    ↓
Store Token
    ├─ localStorage.setItem('token', jwt)
    └─ Set in apiClient header
    ↓
All Requests
    ├─ Add Authorization header
    ├─ Authorization: Bearer <token>
    └─ Send request
    ↓
Response
    ├─ Check status 401
    ├─ If 401: Clear token & redirect to login
    └─ Otherwise: Continue
```

## 📊 Error Handling Flow

```
API Error
    ↓
errorHandler.parseError()
    ├─ Extract status code
    ├─ Extract error message
    ├─ Determine error type
    └─ Check if retryable
    ↓
Return Error Object
    ├─ message: User-friendly message
    ├─ code: Error code
    ├─ status: HTTP status
    ├─ details: Additional info
    └─ isRetryable: Boolean
    ↓
Show Toast Notification
    ├─ toast.error(message)
    └─ Log to console
    ↓
Component Catches Error
    ├─ Handle in UI
    └─ Show error message
```

## 🎯 Data Transformation Flow

```
Backend Response
    {
      _id: "507f1f77bcf86cd799439011",
      name: "John",
      pickup: {
        coordinates: {
          type: "Point",
          coordinates: [77.2090, 28.6139]
        }
      }
    }
    ↓
responseMapper.mapRide()
    ├─ mapId() → _id to id
    ├─ mapLocation() → transform pickup
    ├─ mapCoordinates() → GeoJSON to {lat, lng}
    └─ Recursively map nested objects
    ↓
Frontend Response
    {
      id: "507f1f77bcf86cd799439011",
      name: "John",
      pickup: {
        coordinates: {
          lat: 28.6139,
          lng: 77.2090
        }
      }
    }
    ↓
Component Uses Data
```

## 🚀 Deployment Architecture

```
Development
    ├─ localhost:3000 (Frontend)
    ├─ localhost:5000 (Backend)
    └─ Services use http://localhost:5000/api

Staging
    ├─ staging.app.com (Frontend)
    ├─ api-staging.app.com (Backend)
    └─ Services use https://api-staging.app.com/api

Production
    ├─ app.com (Frontend)
    ├─ api.app.com (Backend)
    └─ Services use https://api.app.com/api
```

## 📚 File Structure

```
src/
├── services/
│   ├── apiClient.ts              # Axios setup
│   ├── errorHandler.ts           # Error handling
│   ├── responseMapper.ts         # Data transformation
│   ├── bookingService.ts         # Booking operations
│   ├── rideService.ts            # Ride operations
│   ├── paymentService.ts         # Payment operations
│   ├── trackingService.ts        # Tracking operations
│   ├── chatService.ts            # Chat operations
│   ├── kycService.ts             # KYC operations
│   ├── userService.ts            # User operations
│   ├── emergencyService.ts       # Emergency operations
│   ├── notificationService.ts    # Notification operations
│   ├── mapService.ts             # Map operations
│   ├── referralService.ts        # Referral operations
│   ├── index.ts                  # Export all services
│   ├── README.md                 # Documentation
│   └── QUICK_REFERENCE.md        # Quick lookup
├── components/
│   ├── FindRidePage.tsx          # Uses bookingService
│   ├── WalletPage.tsx            # Uses paymentService
│   ├── ChatPage.tsx              # Uses chatService
│   └── ... (other components)
└── ... (other directories)
```

## ✨ Summary

The service layer provides:
- **Centralized API management** - All API calls in one place
- **Consistent error handling** - Same error format everywhere
- **Automatic retry logic** - Handles network failures
- **Data transformation** - Clean data format
- **JWT injection** - Secure by default
- **Type safety** - Full TypeScript support
- **Easy testing** - Mock services easily
- **Scalable** - Easy to add new services

---

**Architecture Version:** 1.0.0  
**Last Updated:** April 24, 2026  
**Status:** ✅ Production Ready
