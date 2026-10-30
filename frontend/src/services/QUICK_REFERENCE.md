# Service Layer - Quick Reference

Fast lookup for common service operations.

## 🚀 Import

```typescript
import { 
  bookingService, 
  rideService, 
  paymentService,
  trackingService,
  chatService,
  kycService,
  userService,
  emergencyService,
  notificationService,
  mapService,
  referralService
} from '@/services';
```

## 📋 Booking Service

```typescript
// Search rides
await bookingService.searchRides(filters);

// Create booking
await bookingService.createBooking({
  rideId, passengersCount, paymentMethod, pickup, dropoff
});

// Get my trips (passenger)
await bookingService.getMyTrips();

// Get my rides (driver)
await bookingService.getMyRides();

// Accept booking (driver)
await bookingService.acceptBooking(bookingId);

// Reject booking (driver)
await bookingService.rejectBooking(bookingId, reason);

// Cancel booking
await bookingService.cancelBooking(bookingId, reason);

// Rate booking
await bookingService.rateBooking(bookingId, rating, review);
```

## 🚗 Ride Service

```typescript
// Publish ride
await rideService.publishRide({
  pickup, dropoff, vehicle, schedule, farePerSeat
});

// Get all rides
await rideService.getAllRides(filters);

// Get ride by ID
await rideService.getRideById(rideId);

// Estimate fare
await rideService.estimateFare(pickupLat, pickupLng, dropoffLat, dropoffLng);

// Start ride
await rideService.startRide(rideId);

// End ride
await rideService.endRide(rideId);

// Cancel ride
await rideService.cancelRide(rideId, reason);
```

## 💳 Payment Service

```typescript
// Get wallet balance
await paymentService.getWalletBalance();

// Get transactions
await paymentService.getTransactions(filters);

// Topup wallet
await paymentService.topupWallet({ amount, paymentMethod });

// Initiate payment
await paymentService.initiatePayment({ bookingId, amount, paymentMethod });

// Confirm payment
await paymentService.confirmPayment(bookingId, paymentId);

// Process refund
await paymentService.processRefund(bookingId, reason);

// Withdraw wallet
await paymentService.withdrawWallet(amount, bankDetails);
```

## 📍 Tracking Service

```typescript
// Update location
await trackingService.updateLocation({
  rideId, lat, lng, accuracy, heading, speed
});

// Get live location
await trackingService.getLiveLocation(rideId);

// Get route history
await trackingService.getRouteHistory(rideId);

// Get ETA
await trackingService.getETA(rideId);

// Start tracking
await trackingService.startTracking(rideId);

// Stop tracking
await trackingService.stopTracking(rideId);
```

## 💬 Chat Service

```typescript
// Get conversations
await chatService.getConversations();

// Get messages
await chatService.getMessages(conversationId, page, limit);

// Send message
await chatService.sendMessage({ conversationId, content, type });

// Send ride message
await chatService.sendRideMessage(rideId, content, type);

// Mark as read
await chatService.markConversationAsRead(conversationId);

// Delete message
await chatService.deleteMessage(messageId);

// Delete conversation
await chatService.deleteConversation(conversationId);
```

## 🆔 KYC Service

```typescript
// Get KYC status
await kycService.getKYCStatus();

// Upload documents
await kycService.uploadKYCDocuments({
  govtId, govtIdType, rc, insurance, pollutionCert, selfie
});

// Submit KYC
await kycService.submitKYC();

// Verify face
await kycService.verifyFace(selfieFile);

// Get KYC history
await kycService.getKYCHistory();

// Resubmit KYC
await kycService.resubmitKYC(documents);
```

## 👤 User Service

```typescript
// Get profile
await userService.getProfile();

// Update profile
await userService.updateProfile({ name, email, gender, emergencyContacts });

// Upload profile photo
await userService.uploadProfilePhoto(file);

// Get preferences
await userService.getPreferences();

// Update preferences
await userService.updatePreferences(preferences);

// Get analytics
await userService.getAnalytics();

// Get statistics
await userService.getStatistics();

// Get trust score
await userService.getTrustScore();

// Get referral data
await userService.getReferralData();
```

## 🆘 Emergency Service

```typescript
// Get emergency contacts
await emergencyService.getEmergencyContacts();

// Add emergency contact
await emergencyService.addEmergencyContact(name, phone, relationship);

// Update emergency contact
await emergencyService.updateEmergencyContact(contactId, updates);

// Delete emergency contact
await emergencyService.deleteEmergencyContact(contactId);

// Trigger SOS
await emergencyService.triggerSOS({ lat, lng }, rideId);

// Cancel SOS
await emergencyService.cancelSOS(rideId);

// Update SOS location
await emergencyService.updateSOSLocation(rideId, { lat, lng, accuracy });

// Alert emergency services
await emergencyService.alertEmergencyServices(rideId, serviceType, location);

// Notify emergency contacts
await emergencyService.notifyEmergencyContacts(rideId);

// Get SOS record
await emergencyService.getSOSRecord(rideId);

// Get SOS history
await emergencyService.getSOSHistory(limit);

// Resolve SOS
await emergencyService.resolveSOSIncident(rideId, resolutionNotes);
```

## 🔔 Notification Service

```typescript
// Get notifications
await notificationService.getNotifications(page, limit);

// Get unread count
await notificationService.getUnreadCount();

// Mark as read
await notificationService.markAsRead(notificationId);

// Mark all as read
await notificationService.markAllAsRead();

// Delete notification
await notificationService.deleteNotification(notificationId);

// Get preferences
await notificationService.getNotificationPreferences();

// Update preferences
await notificationService.updateNotificationPreferences(preferences);

// Subscribe to push
await notificationService.subscribeToPushNotifications(subscription);

// Unsubscribe from push
await notificationService.unsubscribeFromPushNotifications();
```

## 🗺️ Map Service

```typescript
// Geocode address
await mapService.geocodeAddress(address);

// Reverse geocode
await mapService.reverseGeocodeCoordinates(lat, lng);

// Get address suggestions
await mapService.getAddressSuggestions(query, limit);

// Get route
await mapService.getRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);

// Calculate distance
await mapService.calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);

// Estimate fare
await mapService.estimateFare(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType);

// Get nearby places
await mapService.getNearbyPlaces(lat, lng, radius, type);

// Search places
await mapService.searchPlaces(query, limit);

// Get saved places
await mapService.getSavedPlaces();

// Save place
await mapService.savePlace(name, lat, lng, label);

// Delete saved place
await mapService.deleteSavedPlace(placeId);
```

## 🎁 Referral Service

```typescript
// Get referral data
await referralService.getReferralData();

// Get my referrals
await referralService.getMyReferrals(page, limit);

// Get referral code
await referralService.getReferralCode();

// Generate new code
await referralService.generateReferralCode();

// Apply referral code
await referralService.applyReferralCode(referralCode);

// Get referral stats
await referralService.getReferralStats();

// Get earnings
await referralService.getReferralEarnings(page, limit);

// Withdraw earnings
await referralService.withdrawReferralEarnings(amount);

// Share referral link
await referralService.shareReferralLink(platform);
```

## 📊 Response Format

All services return:
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

```typescript
try {
  const result = await bookingService.searchRides(filters);
  if (result.success) {
    // Handle success
  }
} catch (error) {
  // Error already handled and toast shown
  // error object: { message, code, status, details, isRetryable }
}
```

## 🔄 Common Patterns

### Search with Filters
```typescript
const result = await bookingService.searchRides({
  pickupLat: 28.6139,
  pickupLng: 77.2090,
  dropoffLat: 28.5244,
  dropoffLng: 77.1855,
  date: '2026-04-25',
  time: '14:30',
});
```

### Pagination
```typescript
const result = await notificationService.getNotifications(
  page = 1,
  limit = 20
);
console.log(result.pagination); // { page, limit, total, pages }
```

### File Upload
```typescript
const result = await kycService.uploadKYCDocuments({
  govtId: fileInput.files[0],
  govtIdType: 'AADHAR',
  selfie: selfieFile,
});
```

### Location Operations
```typescript
// Update location
await trackingService.updateLocation({
  rideId: 'ride123',
  lat: 28.6139,
  lng: 77.2090,
  accuracy: 10,
});

// Get live location
const result = await trackingService.getLiveLocation('ride123');
console.log(result.data); // { lat, lng, accuracy, timestamp, eta }
```

### Payment Flow
```typescript
// 1. Get wallet balance
const balance = await paymentService.getWalletBalance();

// 2. Topup if needed
if (balance.data.balance < 250) {
  await paymentService.topupWallet({
    amount: 500,
    paymentMethod: 'UPI',
  });
}

// 3. Initiate payment
const payment = await paymentService.initiatePayment({
  bookingId: 'booking123',
  amount: 250,
  paymentMethod: 'WALLET',
});

// 4. Confirm payment
await paymentService.confirmPayment('booking123', payment.data.paymentId);
```

## 🎯 Tips & Tricks

1. **Check success flag** - Always check `result.success`
2. **Handle errors** - Services show toast, but handle in UI
3. **Use TypeScript** - All services are fully typed
4. **Avoid duplicates** - Use React Query or SWR for caching
5. **Test services** - Write unit tests for service calls
6. **Log errors** - Services log to console for debugging
7. **Retry logic** - Services automatically retry failed requests
8. **Data transform** - Services automatically transform data

## 📚 More Info

- Full documentation: `src/services/README.md`
- Migration guide: `MIGRATION_GUIDE.md`
- Service summary: `SERVICE_LAYER_SUMMARY.md`

---

**Last Updated:** April 24, 2026  
**Version:** 1.0.0
