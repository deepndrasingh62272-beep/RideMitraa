# Service Layer Migration Guide

Guide for migrating existing components from direct API calls to the new service layer.

## 📋 Overview

**Before:** Components make direct API calls using axios  
**After:** Components use centralized services with error handling and data transformation

## 🔄 Migration Steps

### Step 1: Replace Direct API Calls

**Before:**
```typescript
import axios from 'axios';

const fetchRides = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/rides', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    setRides(response.data.data);
  } catch (error) {
    console.error(error);
    toast.error('Failed to fetch rides');
  }
};
```

**After:**
```typescript
import { bookingService } from '@/services';

const fetchRides = async () => {
  try {
    const result = await bookingService.searchRides();
    if (result.success) {
      setRides(result.data);
    }
  } catch (error) {
    // Error already handled by service
  }
};
```

### Step 2: Update Component Imports

**Before:**
```typescript
import axios from 'axios';
import { toast } from 'sonner';
```

**After:**
```typescript
import { bookingService, rideService, paymentService } from '@/services';
```

### Step 3: Handle Response Format

**Before:**
```typescript
const response = await axios.get('/rides');
const rides = response.data.data; // Direct access
```

**After:**
```typescript
const result = await bookingService.searchRides();
const rides = result.data; // Already transformed
```

## 📝 Common Migrations

### Booking Operations

#### Search Rides
```typescript
// Before
const response = await axios.get('/rides', { params: filters });
const rides = response.data.data;

// After
const result = await bookingService.searchRides(filters);
const rides = result.data;
```

#### Create Booking
```typescript
// Before
const response = await axios.post('/bookings', bookingData);
const booking = response.data.data;

// After
const result = await bookingService.createBooking(bookingData);
const booking = result.data;
```

#### Get My Trips
```typescript
// Before
const response = await axios.get('/bookings/my-trips');
const trips = response.data.data;

// After
const result = await bookingService.getMyTrips();
const trips = result.data;
```

### Ride Operations

#### Publish Ride
```typescript
// Before
const response = await axios.post('/rides', rideData);
const ride = response.data.data;

// After
const result = await rideService.publishRide(rideData);
const ride = result.data;
```

#### Estimate Fare
```typescript
// Before
const response = await axios.get('/rides/fare-estimate', {
  params: { pickupLat, pickupLng, dropoffLat, dropoffLng },
});
const fare = response.data.data;

// After
const result = await rideService.estimateFare(
  pickupLat, pickupLng, dropoffLat, dropoffLng
);
const fare = result.data;
```

### Payment Operations

#### Get Wallet Balance
```typescript
// Before
const response = await axios.get('/wallet/balance');
const balance = response.data.data.balance;

// After
const result = await paymentService.getWalletBalance();
const balance = result.data.balance;
```

#### Topup Wallet
```typescript
// Before
const response = await axios.post('/wallet/topup', {
  amount: 500,
  paymentMethod: 'UPI',
});

// After
const result = await paymentService.topupWallet({
  amount: 500,
  paymentMethod: 'UPI',
});
```

### User Profile

#### Get Profile
```typescript
// Before
const response = await axios.get('/users/me');
const user = response.data.data;

// After
const result = await userService.getProfile();
const user = result.data;
```

#### Update Profile
```typescript
// Before
const response = await axios.patch('/users/me', updates);
const user = response.data.data;

// After
const result = await userService.updateProfile(updates);
const user = result.data;
```

### Chat Operations

#### Get Messages
```typescript
// Before
const response = await axios.get(`/chat/${conversationId}/messages`);
const messages = response.data.data;

// After
const result = await chatService.getMessages(conversationId);
const messages = result.data;
```

#### Send Message
```typescript
// Before
const response = await axios.post(`/chat/${conversationId}/send`, {
  content: message,
});

// After
const result = await chatService.sendMessage({
  conversationId,
  content: message,
});
```

### Emergency/SOS

#### Trigger SOS
```typescript
// Before
const response = await axios.post('/safety/sos', {
  location: { lat, lng },
  rideId,
});

// After
const result = await emergencyService.triggerSOS(
  { lat, lng },
  rideId
);
```

### Maps

#### Geocode Address
```typescript
// Before
const response = await axios.get('/map/geocode', {
  params: { address },
});
const location = response.data.data;

// After
const result = await mapService.geocodeAddress(address);
const location = result.data;
```

## 🔧 Component Examples

### Example 1: FindRidePage

**Before:**
```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

export default function FindRidePage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchRides = async (filters) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/rides', {
        params: filters,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setRides(response.data.data);
    } catch (error) {
      toast.error('Failed to search rides');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

**After:**
```typescript
import { useState } from 'react';
import { bookingService } from '@/services';

export default function FindRidePage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchRides = async (filters) => {
    setLoading(true);
    try {
      const result = await bookingService.searchRides(filters);
      if (result.success) {
        setRides(result.data);
      }
    } catch (error) {
      // Error already handled by service
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### Example 2: WalletPage

**Before:**
```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        const [balanceRes, transRes] = await Promise.all([
          axios.get('/api/wallet/balance', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }),
          axios.get('/api/wallet/transactions', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }),
        ]);
        setBalance(balanceRes.data.data.balance);
        setTransactions(transRes.data.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchWalletData();
  }, []);

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

**After:**
```typescript
import { useState, useEffect } from 'react';
import { paymentService } from '@/services';

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        const [balanceResult, transResult] = await Promise.all([
          paymentService.getWalletBalance(),
          paymentService.getTransactions(),
        ]);
        if (balanceResult.success) {
          setBalance(balanceResult.data.balance);
        }
        if (transResult.success) {
          setTransactions(transResult.data);
        }
      } catch (error) {
        // Error already handled
      }
    };

    fetchWalletData();
  }, []);

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### Example 3: ChatPage

**Before:**
```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');

  const sendMessage = async (content) => {
    try {
      const response = await axios.post(
        `/api/chat/${conversationId}/send`,
        { content },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      setMessages([...messages, response.data.data]);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

**After:**
```typescript
import { useState } from 'react';
import { chatService } from '@/services';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');

  const sendMessage = async (content) => {
    try {
      const result = await chatService.sendMessage({
        conversationId,
        content,
      });
      if (result.success) {
        setMessages([...messages, result.data]);
      }
    } catch (error) {
      // Error already handled
    }
  };

  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

## 🎯 Migration Checklist

- [ ] Replace all `axios.get()` calls with service functions
- [ ] Replace all `axios.post()` calls with service functions
- [ ] Replace all `axios.patch()` calls with service functions
- [ ] Replace all `axios.delete()` calls with service functions
- [ ] Remove manual Authorization header injection
- [ ] Remove manual error handling (services handle it)
- [ ] Remove manual toast notifications for errors
- [ ] Update TypeScript types to use service interfaces
- [ ] Test all API calls
- [ ] Remove unused axios imports
- [ ] Update component tests

## 🧪 Testing Services

### Unit Test Example

```typescript
import { bookingService } from '@/services';

describe('bookingService', () => {
  it('should search rides successfully', async () => {
    const result = await bookingService.searchRides({
      pickupLat: 28.6139,
      pickupLng: 77.2090,
      dropoffLat: 28.5244,
      dropoffLng: 77.1855,
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should handle search errors', async () => {
    try {
      await bookingService.searchRides({
        pickupLat: 'invalid',
        pickupLng: 'invalid',
        dropoffLat: 'invalid',
        dropoffLng: 'invalid',
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
```

## 📊 Migration Progress

Track your migration progress:

| Component | Status | Notes |
|-----------|--------|-------|
| FindRidePage | ⏳ | In progress |
| OfferRidePage | ⏳ | In progress |
| MyBookingsPage | ⏳ | In progress |
| WalletPage | ⏳ | In progress |
| ChatPage | ⏳ | In progress |
| ProfilePage | ⏳ | In progress |
| LiveTrackingPage | ⏳ | In progress |

## 🚀 Benefits After Migration

✅ Centralized error handling  
✅ Automatic retry logic  
✅ Consistent response format  
✅ Automatic data transformation  
✅ Automatic JWT injection  
✅ Better code organization  
✅ Easier testing  
✅ Reduced code duplication  
✅ Better type safety  
✅ Easier maintenance  

## 📞 Need Help?

1. Check the service documentation in `src/services/README.md`
2. Review service implementation files
3. Check examples in this guide
4. Look at component examples above

---

**Last Updated:** April 24, 2026  
**Version:** 1.0.0
