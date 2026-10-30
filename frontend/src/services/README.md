# Service Layer Documentation

Complete service layer for RideMitraa frontend application with centralized API management, error handling, and data transformation.

## 📁 Structure

```
services/
├── apiClient.ts           # Axios instance with interceptors
├── errorHandler.ts        # Centralized error handling
├── responseMapper.ts      # Data transformation utilities
├── bookingService.ts      # Booking operations
├── rideService.ts         # Ride operations
├── paymentService.ts      # Payment & wallet operations
├── trackingService.ts     # Live tracking
├── chatService.ts         # Chat messaging
├── kycService.ts          # KYC verification
├── userService.ts         # User profile management
├── emergencyService.ts    # Emergency & SOS features
├── notificationService.ts # Notifications
├── mapService.ts          # Maps & geocoding
├── referralService.ts     # Referral system
├── index.ts               # Central export point
└── README.md              # This file
```

## 🚀 Quick Start

### Import Services

```typescript
// Import specific service
import { bookingService } from '@/services';

// Or import specific functions
import { createBooking, getMyTrips } from '@/services';

// Or import everything
import * as services from '@/services';
```

### Basic Usage

```typescript
// Search rides
const result = await bookingService.searchRides({
  pickupLat: 28.6139,
  pickupLng: 77.2090,
  dropoffLat: 28.5244,
  dropoffLng: 77.1855,
});

if (result.success) {
  console.log('Rides found:', result.data);
} else {
  console.error('Error:', result.error);
}
```

## 📋 Services Overview

### 1. **apiClient.ts**
Axios instance with automatic JWT token injection and retry logic.

**Features:**
- Automatic JWT token injection
- Request/response interceptors
- Retry logic with exponential backoff
- Token expiry handling
- Timeout configuration

**Usage:**
```typescript
import apiClient, { retryRequest } from '@/services';

// Direct API call
const response = await apiClient.get('/rides');

// With retry logic
const response = await retryRequest(() =>
  apiClient.get('/rides')
);
```

### 2. **errorHandler.ts**
Centralized error parsing and handling.

**Features:**
- Parse API errors
- Show toast notifications
- Determine if error is retryable
- Consistent error format

**Usage:**
```typescript
import { handleError, parseError } from '@/services';

try {
  await someApiCall();
} catch (error) {
  const parsedError = handleError(error);
  console.log(parsedError.message);
  console.log(parsedError.isRetryable);
}
```

### 3. **responseMapper.ts**
Transform backend responses to frontend format.

**Features:**
- Convert `_id` to `id`
- Transform GeoJSON coordinates
- Map nested objects
- Handle arrays

**Usage:**
```typescript
import { mapId, mapRide, mapArray } from '@/services';

const ride = mapRide(backendRideData);
const rides = mapArray(backendRidesArray);
```

### 4. **bookingService.ts**
Booking operations (search, create, accept, reject, cancel, rate).

**Key Functions:**
```typescript
// Search rides
await bookingService.searchRides(filters);

// Create booking
await bookingService.createBooking({
  rideId: 'ride123',
  passengersCount: 2,
  paymentMethod: 'UPI',
  pickup: { name: 'Delhi', coordinates: [77.2090, 28.6139] },
  dropoff: { name: 'Gurgaon', coordinates: [77.0369, 28.4595] },
});

// Get my trips (as passenger)
await bookingService.getMyTrips();

// Get my rides (as driver)
await bookingService.getMyRides();

// Accept booking (driver)
await bookingService.acceptBooking(bookingId);

// Rate booking
await bookingService.rateBooking(bookingId, 5, 'Great ride!');
```

### 5. **rideService.ts**
Ride operations (publish, search, update, start, end, cancel).

**Key Functions:**
```typescript
// Publish new ride
await rideService.publishRide({
  pickup: { name: 'Delhi', coordinates: [77.2090, 28.6139] },
  dropoff: { name: 'Gurgaon', coordinates: [77.0369, 28.4595] },
  vehicle: {
    type: 'CAR',
    name: 'Honda City',
    registrationNumber: 'DL01AB1234',
    seatingCapacity: 4,
  },
  schedule: { date: '2026-04-25', time: '14:30' },
  farePerSeat: 250,
});

// Estimate fare
await rideService.estimateFare(28.6139, 77.2090, 28.5244, 77.1855);

// Start ride
await rideService.startRide(rideId);

// End ride
await rideService.endRide(rideId);
```

### 6. **paymentService.ts**
Payment and wallet operations.

**Key Functions:**
```typescript
// Get wallet balance
await paymentService.getWalletBalance();

// Topup wallet
await paymentService.topupWallet({
  amount: 500,
  paymentMethod: 'UPI',
});

// Initiate payment for booking
await paymentService.initiatePayment({
  bookingId: 'booking123',
  amount: 250,
  paymentMethod: 'WALLET',
});

// Get transaction history
await paymentService.getTransactions({ limit: 20 });
```

### 7. **trackingService.ts**
Live location tracking.

**Key Functions:**
```typescript
// Update driver location
await trackingService.updateLocation({
  rideId: 'ride123',
  lat: 28.6139,
  lng: 77.2090,
  accuracy: 10,
});

// Get live location
await trackingService.getLiveLocation(rideId);

// Get route history
await trackingService.getRouteHistory(rideId);

// Get ETA
await trackingService.getETA(rideId);
```

### 8. **chatService.ts**
Chat messaging.

**Key Functions:**
```typescript
// Get conversations
await chatService.getConversations();

// Get messages
await chatService.getMessages(conversationId, page, limit);

// Send message
await chatService.sendMessage({
  conversationId: 'conv123',
  content: 'Hello!',
  type: 'text',
});

// Mark as read
await chatService.markConversationAsRead(conversationId);
```

### 9. **kycService.ts**
KYC verification.

**Key Functions:**
```typescript
// Get KYC status
await kycService.getKYCStatus();

// Upload documents
await kycService.uploadKYCDocuments({
  govtId: file1,
  govtIdType: 'AADHAR',
  rc: file2,
  selfie: file3,
});

// Submit KYC
await kycService.submitKYC();

// Verify face
await kycService.verifyFace(selfieFile);
```

### 10. **userService.ts**
User profile management.

**Key Functions:**
```typescript
// Get profile
await userService.getProfile();

// Update profile
await userService.updateProfile({
  name: 'John Doe',
  email: 'john@example.com',
  gender: 'MALE',
});

// Upload profile photo
await userService.uploadProfilePhoto(photoFile);

// Get preferences
await userService.getPreferences();

// Update preferences
await userService.updatePreferences({
  notifications: true,
  darkMode: false,
});
```

### 11. **emergencyService.ts**
Emergency and SOS features.

**Key Functions:**
```typescript
// Get emergency contacts
await emergencyService.getEmergencyContacts();

// Add emergency contact
await emergencyService.addEmergencyContact('Mom', '9876543210');

// Trigger SOS
await emergencyService.triggerSOS({
  lat: 28.6139,
  lng: 77.2090,
}, rideId);

// Cancel SOS
await emergencyService.cancelSOS(rideId);

// Alert emergency services
await emergencyService.alertEmergencyServices(
  rideId,
  'police',
  { lat: 28.6139, lng: 77.2090 }
);
```

### 12. **notificationService.ts**
Notifications.

**Key Functions:**
```typescript
// Get notifications
await notificationService.getNotifications(page, limit);

// Get unread count
await notificationService.getUnreadCount();

// Mark as read
await notificationService.markAsRead(notificationId);

// Mark all as read
await notificationService.markAllAsRead();

// Update preferences
await notificationService.updateNotificationPreferences({
  bookingUpdates: true,
  promotions: false,
});
```

### 13. **mapService.ts**
Maps and geocoding.

**Key Functions:**
```typescript
// Geocode address
await mapService.geocodeAddress('Delhi');

// Reverse geocode
await mapService.reverseGeocodeCoordinates(28.6139, 77.2090);

// Get address suggestions
await mapService.getAddressSuggestions('Delhi', 5);

// Get route
await mapService.getRoute(28.6139, 77.2090, 28.5244, 77.1855);

// Estimate fare
await mapService.estimateFare(28.6139, 77.2090, 28.5244, 77.1855);

// Get saved places
await mapService.getSavedPlaces();

// Save place
await mapService.savePlace('Home', 28.6139, 77.2090, 'HOME');
```

### 14. **referralService.ts**
Referral system.

**Key Functions:**
```typescript
// Get referral data
await referralService.getReferralData();

// Get my referrals
await referralService.getMyReferrals(page, limit);

// Get referral code
await referralService.getReferralCode();

// Apply referral code
await referralService.applyReferralCode('REF123');

// Get earnings
await referralService.getReferralEarnings();

// Withdraw earnings
await referralService.withdrawReferralEarnings(1000);
```

## 🔄 Response Format

All services return a consistent response format:

```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

## ❌ Error Handling

All services automatically handle errors and show toast notifications:

```typescript
try {
  const result = await bookingService.createBooking(data);
  if (result.success) {
    // Handle success
  }
} catch (error) {
  // Error is already handled and toast shown
  // error object contains: message, code, status, details
}
```

## 🔄 Retry Logic

Services automatically retry failed requests with exponential backoff:

- **Max Retries:** 2
- **Initial Delay:** 1 second
- **Backoff:** 1.5x multiplier

Retryable errors:
- Network errors
- 5xx server errors
- 429 rate limit errors
- Timeout errors

## 🔐 Authentication

JWT token is automatically injected in all requests:

```typescript
// Token is automatically added to Authorization header
// Authorization: Bearer <token>

// Token is read from localStorage
// localStorage.getItem('token')
```

## 📝 Data Transformation

Backend responses are automatically transformed:

```typescript
// Backend response
{
  _id: '507f1f77bcf86cd799439011',
  name: 'John',
  pickup: {
    coordinates: {
      type: 'Point',
      coordinates: [77.2090, 28.6139]
    }
  }
}

// Transformed response
{
  id: '507f1f77bcf86cd799439011',
  name: 'John',
  pickup: {
    coordinates: {
      lat: 28.6139,
      lng: 77.2090
    }
  }
}
```

## 🧪 Testing

Example test for a service:

```typescript
import { bookingService } from '@/services';

describe('bookingService', () => {
  it('should search rides', async () => {
    const result = await bookingService.searchRides({
      pickupLat: 28.6139,
      pickupLng: 77.2090,
      dropoffLat: 28.5244,
      dropoffLng: 77.1855,
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should handle errors', async () => {
    try {
      await bookingService.createBooking({
        rideId: 'invalid',
        paymentMethod: 'UPI',
        pickup: { name: '', coordinates: [0, 0] },
        dropoff: { name: '', coordinates: [0, 0] },
      });
    } catch (error) {
      expect(error.message).toBeDefined();
    }
  });
});
```

## 🚨 Common Issues

### Issue: Token not being sent
**Solution:** Ensure token is stored in `localStorage.getItem('token')`

### Issue: CORS errors
**Solution:** Backend must have CORS enabled for your frontend URL

### Issue: 401 Unauthorized
**Solution:** Token expired, user needs to login again

### Issue: Slow requests
**Solution:** Check network tab, may need to optimize backend queries

## 📚 Best Practices

1. **Always use services** - Don't make direct API calls
2. **Handle errors** - Services show toast, but handle in UI
3. **Use TypeScript** - All services are fully typed
4. **Check success flag** - Always check `result.success`
5. **Avoid duplicate calls** - Use React Query or SWR for caching
6. **Test services** - Write unit tests for service calls
7. **Log errors** - Services log to console for debugging

## 🔗 Related Files

- `src/api/axios.ts` - Old axios setup (deprecated, use apiClient)
- `src/contexts/SocketContext.tsx` - Real-time events
- `src/store/` - State management

## 📞 Support

For issues or questions:
1. Check the service documentation above
2. Review the service implementation
3. Check browser console for errors
4. Check network tab for API responses

---

**Last Updated:** April 24, 2026  
**Version:** 1.0.0
