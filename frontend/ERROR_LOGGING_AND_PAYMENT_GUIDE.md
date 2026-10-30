# Error Logging & Mock Payment Gateway Guide

## Overview

This guide explains the comprehensive error logging system and mock payment gateway implementation added to the RideMitra frontend.

## 1. Error Logging System

### Location
- **Service**: `src/services/errorLogger.ts`
- **Usage**: Imported across all services for structured error logging

### Features

#### Log Levels
- **ERROR**: Critical failures that need immediate attention
- **WARN**: Warnings about potentially problematic situations
- **INFO**: General informational messages about operations
- **DEBUG**: Detailed debugging information (dev mode only)

#### Log Format
```
[TIMESTAMP] [LEVEL] [SERVICE/ACTION] Message | Context: {...} | Error: {...}
```

#### Example Output
```
[2026-04-27T10:30:45.123Z] [ERROR] [PaymentService/initiatePayment] Payment initiation failed | Context: {"bookingId":"123","amount":500} | Error: Network timeout
```

### Usage Examples

#### Log an Error
```typescript
import { logError } from '@/src/services/errorLogger';

try {
  // some operation
} catch (error) {
  logError('MyService', 'myAction', 'Operation failed', error, {
    userId: user.id,
    amount: 500,
  });
}
```

#### Log Info
```typescript
import { logInfo } from '@/src/services/errorLogger';

logInfo('PaymentService', 'initiatePayment', 'Payment initiated', {
  bookingId: '123',
  amount: 500,
});
```

#### Log Debug (Dev Only)
```typescript
import { logDebug } from '@/src/services/errorLogger';

logDebug('apiClient', 'response', 'Response received', {
  status: 200,
  duration: 150,
});
```

### Console Output

All logs are printed to the browser console with color-coded levels:
- 🔴 **ERROR** - Red
- 🟡 **WARN** - Yellow
- 🟢 **INFO** - Green
- 🔵 **DEBUG** - Blue (dev mode only)

## 2. Mock Payment Gateway

### Location
- **Service**: `src/services/mockPaymentGateway.ts`
- **Usage**: Simulates payment processing without real gateway

### Features

#### No Real Gateway Required
- Works without Razorpay/Stripe credentials
- Perfect for development and testing
- Simulates success and failure scenarios

#### Mock Order Creation
```typescript
import mockGateway from '@/src/services/mockPaymentGateway';

const order = mockGateway.createOrder({
  amount: 500,
  currency: 'INR',
  bookingId: 'booking_123',
  method: 'UPI',
});

// Returns:
// {
//   id: 'order_mock_1234567890_abc123',
//   amount: 500,
//   currency: 'INR',
//   status: 'CREATED',
//   createdAt: '2026-04-27T10:30:45.123Z',
//   bookingId: 'booking_123',
//   method: 'UPI'
// }
```

#### Mock Payment Capture
```typescript
// Simulate successful payment
const result = mockGateway.capturePayment(orderId);
// { success: true, orderId, paymentId, message, mock: true }

// Simulate failed payment
const failedResult = mockGateway.capturePayment(orderId, true);
// { success: false, orderId, message, mock: true }
```

#### Mock Refund
```typescript
const refund = mockGateway.refundPayment(paymentId, 500);
// { success: true, orderId, paymentId: refundId, message, mock: true }
```

### Integration with Payment Service

The `paymentService.ts` automatically uses the mock gateway:

```typescript
// In initiatePayment()
const mockOrder = mockGateway.createOrder({
  amount: paymentData.amount,
  currency: 'INR',
  bookingId: paymentData.bookingId,
  method: paymentData.paymentMethod,
});
// Then proceeds with API call
```

## 3. API Client Error Logging

### Location
- **Service**: `src/services/apiClient.ts`
- **Features**: Automatic error logging for all API calls

### Logged Information

#### Request Logging
- HTTP method and URL
- Retry attempts
- Request headers (sanitized)

#### Response Logging
- Status code
- Response time
- Error details
- Retry information

#### Example Console Output
```
[2026-04-27T10:30:45.123Z] [ERROR] [apiClient/response] GET /api/bookings/my-rides failed with status 500 | Context: {"status":500,"method":"GET","url":"/api/bookings/my-rides","retryCount":2}
```

### Retry Logging
```
[2026-04-27T10:30:45.123Z] [INFO] [apiClient/response] Retrying 1/3 | Context: {"method":"GET","url":"/api/bookings/my-rides","delay":1234}
```

## 4. Service-Level Error Logging

### Payment Service
All payment operations log their status:

```typescript
// Wallet topup
logInfo('PaymentService', 'topupWallet', 'Wallet topup successful', { amount: 500 });

// Payment initiation
logInfo('PaymentService', 'initiatePayment', 'Payment initiated successfully', {
  bookingId: 'booking_123',
});

// Refund processing
logInfo('PaymentService', 'processRefund', 'Refund processed successfully', {
  bookingId: 'booking_123',
});
```

### Booking Service
All booking operations log their status:

```typescript
logInfo('BookingService', 'createBooking', 'Booking created', {
  rideId: 'ride_123',
  passengerId: 'user_456',
});
```

### Ride Service
All ride operations log their status:

```typescript
logInfo('RideService', 'cancelRide', 'Ride cancelled', {
  rideId: 'ride_123',
  status: 'CANCELLED',
});
```

## 5. Debugging with Console Logs

### Enable Debug Logs
Debug logs are automatically enabled in development mode (`NODE_ENV === 'development'`).

### View Logs in Browser
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Filter by service name or log level
4. Click on any log to expand details

### Filter Console Logs
```javascript
// In browser console:
// Show only errors
console.error.bind(console);

// Show only payment service logs
console.log('%c[PaymentService]', 'color: blue');
```

## 6. Error Handling Best Practices

### Always Log Errors
```typescript
try {
  await someOperation();
} catch (error) {
  logError('MyService', 'myAction', 'Operation failed', error, {
    context: 'relevant_data',
  });
  // Then handle or re-throw
}
```

### Log Before Throwing
```typescript
try {
  const result = await apiCall();
} catch (error) {
  logError('Service', 'action', 'API call failed', error);
  throw error; // Re-throw after logging
}
```

### Log Success Operations
```typescript
const result = await operation();
logInfo('Service', 'action', 'Operation successful', {
  resultId: result.id,
});
```

## 7. Mock Gateway Testing

### Test Successful Payment
```typescript
const order = mockGateway.createOrder({
  amount: 500,
  currency: 'INR',
  bookingId: 'test_123',
  method: 'UPI',
});

const result = mockGateway.capturePayment(order.id);
console.log(result); // { success: true, ... }
```

### Test Failed Payment
```typescript
const order = mockGateway.createOrder({
  amount: 500,
  currency: 'INR',
  bookingId: 'test_123',
  method: 'UPI',
});

const result = mockGateway.capturePayment(order.id, true); // true = fail
console.log(result); // { success: false, ... }
```

### Clear Mock Data
```typescript
mockGateway.clear(); // Clears all mock orders and payments
```

## 8. Production Considerations

### Disable Debug Logs
Debug logs are automatically disabled in production (`NODE_ENV !== 'development'`).

### Error Reporting
For production, integrate with error tracking service:
```typescript
// Example: Sentry integration
import * as Sentry from "@sentry/react";

logError('Service', 'action', 'Error message', error);
Sentry.captureException(error); // Send to Sentry
```

### Real Payment Gateway
To use real payment gateway:
1. Remove mock gateway calls from `paymentService.ts`
2. Add Razorpay/Stripe SDK
3. Update `initiatePayment()` to use real gateway
4. Implement webhook handlers

## 9. Common Issues & Solutions

### Issue: No logs appearing
**Solution**: Check browser console is open and not filtered

### Issue: Too many logs
**Solution**: Filter by service name or log level in console

### Issue: Mock payment not working
**Solution**: Ensure `mockPaymentGateway` is imported and called before API request

### Issue: Errors not being caught
**Solution**: Ensure `try-catch` blocks wrap async operations and `logError()` is called

## 10. File Structure

```
src/services/
├── errorLogger.ts           # Error logging service
├── mockPaymentGateway.ts    # Mock payment gateway
├── paymentService.ts        # Payment operations (with logging)
├── apiClient.ts             # API client (with logging)
├── bookingService.ts        # Booking operations
├── rideService.ts           # Ride operations
└── ...
```

## Summary

- ✅ **Error Logging**: Structured, service-based error logging to console
- ✅ **Mock Gateway**: No real payment gateway needed for development
- ✅ **API Logging**: Automatic logging of all API calls and retries
- ✅ **Service Logging**: Each service logs its operations
- ✅ **Debug Mode**: Extra logging in development mode
- ✅ **Production Ready**: Logs disabled in production, ready for error tracking integration

All errors and important operations are now logged to the browser console for easy debugging!
