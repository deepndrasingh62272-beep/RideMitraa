# 🚗 COMPLETE BACKEND TESTING SUITE  
## P2P Ride-Sharing Application (Node.js + Express + MongoDB)

---

## 📋 Overview

This comprehensive testing suite covers **18 core flows** of a ride-sharing backend system. Each flow is independently testable and includes detailed logging for easy debugging.

**Framework**: Jest + Supertest  
**Database**: MongoDB Memory Server (in-memory for fast tests)  
**Total Flows**: 18  
**Test Files**: 18 test files (one per flow)  

---

## 🎯 18 Core Test Flows

### 1. **AUTH SYSTEM TEST** (`01-auth.test.js`)
Tests user authentication and JWT token management:
- ✓ Register passenger via OTP
- ✓ Register driver via OTP  
- ✓ Verify OTP with correct code
- ✓ Verify OTP with wrong code (rejection)
- ✓ JWT token validation for protected routes
- ✓ Missing token returns 401
- ✓ Login with existing credentials

### 2. **DRIVER KYC TEST** (`02-kyc.test.js`)
Tests driver verification and KYC workflow:
- ✓ Register driver for KYC flow
- ✓ KYC status starts as PENDING
- ✓ PENDING driver cannot create ride
- ✓ Approve driver KYC (PENDING → APPROVED)
- ✓ APPROVED driver can create ride

### 3. **RIDE CREATION TEST** (`03-ride-creation.test.js`)
Tests ride creation with different vehicle types and seat configurations:
- ✓ Register and approve driver
- ✓ Create BIKE ride with 1 seat available
- ✓ Create 5-seater CAR ride with 4 seats available
- ✓ Create 7-seater VAN ride with 6 seats available
- ✓ Verify ride has all required fields

**Seat Validation Rules:**
- BIKE (2 seats): 1 seat available (driver + 1 passenger)
- CAR 5-seater: 4 seats available (driver + 4 passengers)
- VAN 7-seater: 6 seats available (driver + 6 passengers)

### 4. **PRICING ENGINE TEST** (`04-pricing.test.js`)
Tests fare calculation and pricing logic:
- ✓ Calculate fare: SEDAN, 30km, ₹100/L, 15kmpl, 3 passengers
  - FuelCost = 30 × 100 ÷ 15 = ₹200
  - Overhead = 30 × 3.5 = ₹105
  - Total = ₹305
  - Per Seat = ₹305 ÷ 4 = ₹76.25
  - Platform Fee = ₹10 (fixed per passenger)
  - Price per Passenger = ₹86.25
  - Total Amount = ₹86.25 × 3 = ₹258.75
  - Driver Earnings = ₹305 - (₹10 × 3) = ₹275

- ✓ Calculate fare: BIKE, 10km, ₹110/L, 50kmpl, 1 passenger
- ✓ Fare breakdown API returns correct structure
- ✓ Fare estimate API returns all vehicle types
- ✓ Invalid vehicleType throws error
- ✓ Zero distance throws error
- ✓ Platform fee = ₹10 per passenger (fixed, not percentage)
- ✓ Driver earnings correctly calculated

### 5. **RIDE SEARCH TEST** (`05-ride-search.test.js`)
Tests ride discovery and filtering:
- ✓ Setup: Publish multiple rides
- ✓ Search returns only ACTIVE rides
- ✓ All rides have availableSeats > 0
- ✓ Rides sorted by price (ascending)
- ✓ Smart match with coordinates

### 6. **BOOKING FLOW TEST** (`06-booking-flow.test.js`)
Tests passenger booking and seat locking:
- ✓ Setup: Register passenger, driver, and create ride
- ✓ Passenger creates booking - status PENDING
- ✓ Booking has requestExpiry ~5 minutes
- ✓ Seat locking works - availableSeats decreases

### 7. **DRIVER ACTION TEST** (`07-driver-actions.test.js`)
Tests driver acceptance/rejection of bookings:
- ✓ Driver accepts booking → status ACCEPTED
- ✓ Driver rejects booking → status REJECTED  
- ✓ Seats updated correctly
- ✓ Rejection triggers auto-match to next driver

### 8. **PAYMENT TEST** (`08-payment.test.js`)
Tests payment processing and multiple payment methods:
- ✓ Payment via Wallet
- ✓ Payment via UPI (simulated)
- ✓ Payment via Card (simulated)
- ✓ Payment success updates booking status
- ✓ Payment failure keeps booking PENDING
- ✓ Refund on rejection

### 9. **CANCELLATION TEST** (`09-cancellation.test.js`)
Tests ride cancellation flows:
- ✓ Passenger cancels ride
- ✓ Driver cancels ride
- ✓ Penalty applied on cancellation
- ✓ Refund processed correctly
- ✓ Seats freed up after cancellation

### 10. **RIDE LIFECYCLE TEST** (`10-ride-lifecycle.test.js`)
Tests complete ride journey:
- ✓ Start ride (status: IN_PROGRESS)
- ✓ End ride (status: COMPLETED)
- ✓ Ride distance calculated
- ✓ Final payment processed

### 11. **REAL-TIME LOCATION TEST** (`11-tracking.test.js`)
Tests live location tracking:
- ✓ Update driver location
- ✓ Fetch live location
- ✓ Coordinates update correctly
- ✓ Location history stored

### 12. **CHAT SYSTEM TEST** (`12-chat.test.js`)
Tests in-app messaging:
- ✓ Send message
- ✓ Fetch message history
- ✓ Unread message count
- ✓ Mark messages as read

### 13. **SOS SYSTEM TEST** (`13-sos.test.js`)
Tests emergency alert system:
- ✓ Trigger SOS during ride
- ✓ Check alert stored in database
- ✓ Emergency notification sent
- ✓ Location captured with SOS

### 14. **RATING SYSTEM TEST** (`14-rating.test.js`)
Tests review and rating:
- ✓ Submit rating (1-5 stars)
- ✓ Update average rating
- ✓ Rating validation
- ✓ Rating affects driver/passenger reputation

### 15. **NOTIFICATION TEST** (`15-notifications.test.js`)
Tests notification delivery:
- ✓ Booking request notification sent
- ✓ Acceptance notification sent
- ✓ Rejection notification sent
- ✓ Ride completion notification

### 16. **WALLET SYSTEM TEST** (`16-wallet.test.js`)
Tests digital wallet and transactions:
- ✓ Deduct passenger balance
- ✓ Add driver earnings
- ✓ Transaction logs updated
- ✓ Wallet balance consistency

### 17. **CRON JOB TEST** (`17-cron.test.js`)
Tests background jobs and automation:
- ✓ Booking expires after 5 minutes
- ✓ Seats unlocked after expiry
- ✓ Status changed to EXPIRED
- ✓ Refund issued for expired bookings

### 18. **AUTO MATCHING TEST** (`18-auto-match.test.js`)
Tests automatic driver assignment:
- ✓ Driver rejects booking
- ✓ Auto-match assigns to next driver
- ✓ Automatic notification sent to new driver
- ✓ Max retry limit enforced

---

## 🚀 Quick Start

### Installation

```bash
cd ride-sharing-backend
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests with Verbose Output

```bash
npm run test:verbose
```

### Run Specific Test Flow

```bash
npm test -- 01-auth.test.js
npm test -- 02-kyc.test.js
npm test -- 03-ride-creation.test.js
# ... etc
```

---

## 📊 Expected Test Output

```
PASS  tests/00-master.test.js
PASS  tests/01-auth.test.js
  AUTH SYSTEM TEST
  ────────────────────────────────────────────────────
  ✓ 1.1 Register passenger | PASS
  ✓ 1.2 Register driver | PASS
  ✓ 1.3 Verify OTP (correct) | PASS
  ✓ 1.4 Verify OTP (wrong code) | PASS
  ✓ 1.5 JWT Validation (valid token) | PASS
  ✓ 1.6 JWT Validation (missing token) | PASS
  ✓ 1.7 Login Flow | PASS
  ────────────────────────────────────────────────────
  ✅ PASS | AUTH SYSTEM TEST: 7/7 passed

PASS  tests/02-kyc.test.js
  ✓ 2.1 Register Driver | PASS
  ✓ 2.2 Initial KYC Status | PASS
  ✓ 2.3 PENDING Blocked from Ride | PASS
  ✓ 2.4 KYC Status Change | PASS
  ✓ 2.5 APPROVED Creates Ride | PASS
  ✅ PASS | DRIVER KYC TEST: 5/5 passed

PASS  tests/03-ride-creation.test.js
  ✓ 3.1 Register & Approve Driver | PASS
  ✓ 3.2 BIKE Ride: 1 Seat | PASS
  ✓ 3.3 5-Seater CAR: 4 Seats | PASS
  ✓ 3.4 7-Seater VAN: 6 Seats | PASS
  ✓ 3.5 Ride Field Validation | PASS
  ✅ PASS | RIDE CREATION TEST: 5/5 passed

... [continues for all 18 flows]

════════════════════════════════════════════════════════════
✅ ALL 18 FLOWS PASSED SUCCESSFULLY
════════════════════════════════════════════════════════════
```

---

## 🔧 Helper Functions Reference

The `helpers.js` file provides useful utilities:

```javascript
// Register a user with OTP verification
const { token, user } = await registerUser(phone, role, name);

// Approve driver KYC directly
await approveDriverKYC(userId);

// Create a ride payload
const payload = ridePayload({ farePerSeat: 200 });

// Create wallet for user
const wallet = await createWallet(userId, balance);

// Get wallet by user ID
const wallet = await getWallet(userId);

// Log test results
testLog('Test Name', 'PASS', 'Additional details');
testLog('Test Name', 'FAIL', 'Error message');

// Log test flow start
logTestStart('FLOW NAME');

// Log test flow end with summary
logTestEnd('FLOW NAME', passedCount, failedCount);

// Auth header for protected routes
const headers = auth(token);
```

---

## 🏗️ Architecture

### Test Structure

```
tests/
├── 00-master.test.js          # Master test runner
├── 01-auth.test.js             # Authentication flows
├── 02-kyc.test.js              # Driver KYC verification
├── 03-ride-creation.test.js     # Ride creation & validation
├── 04-pricing.test.js           # Pricing engine
├── 05-ride-search.test.js       # Ride discovery
├── 06-booking-flow.test.js      # Booking management
├── 07-driver-actions.test.js    # Driver operations
├── 08-payment.test.js           # Payment processing
├── 09-cancellation.test.js      # Cancellation flows
├── 10-ride-lifecycle.test.js    # Ride completion
├── 11-tracking.test.js          # Location tracking
├── 12-chat.test.js              # Messaging system
├── 13-sos.test.js               # Emergency alerts
├── 14-rating.test.js            # Reviews & ratings
├── 15-notifications.test.js     # Push notifications
├── 16-wallet.test.js            # Digital wallet
├── 17-cron.test.js              # Background jobs
├── 18-auto-match.test.js        # Auto driver matching
├── app.js                        # Test Express app
├── helpers.js                    # Test utilities
├── setup.js                      # Jest configuration
└── TEST-SUITE-CONFIG.js          # Test metadata
```

### Database Setup

Each test file uses MongoDB Memory Server, which:
- Starts an in-memory MongoDB instance for each test run
- Clears collections between test files  
- Automatically shuts down after tests complete
- No external database required

---

## 📈 System Health Metrics

After running all tests, you should see:

| Metric | Expected | Status |
|--------|----------|--------|
| Total Flows | 18 | ✓ |
| Total Steps | 80+ | ✓ |
| Pass Rate | 100% | ✓ |
| Avg Response Time | <500ms | ✓ |
| DB Operations | Clean | ✓ |
| Error Handling | Complete | ✓ |

---

## 🔍 Debugging Failed Tests

### Step 1: Run verbose output
```bash
npm run test:verbose
```

### Step 2: Check error messages
Look for `✗ FAIL` markers in output:
```
✗ FAIL | Test Name | Error message details
```

### Step 3: Run specific failing test
```bash
npm test -- 01-auth.test.js --verbose
```

### Step 4: Check test-results.log
```bash
cat test-execution.log | grep -A 5 "FAIL"
```

### Step 5: Debug with console.log
Add logging to test:
```javascript
test('test name', async () => {
  console.log('Debug info:', someVariable);
  expect(result).toBe(expected);
});
```

---

## ✅ Test Coverage Checklist

- [x] User Authentication (OTP + JWT)
- [x] Driver KYC Workflow
- [x] Ride Creation & Validation
- [x] Price Calculation Engine
- [x] Ride Discovery & Filtering
- [x] Booking & Seat Management
- [x] Driver Actions (Accept/Reject)
- [x] Payment Processing
- [x] Cancellation & Refunds
- [x] Ride Lifecycle (Start → End)
- [x] Real-time Location Tracking
- [x] Chat Messaging
- [x] SOS / Emergency Alerts
- [x] Rating System
- [x] Notifications
- [x] Wallet & Transactions
- [x] CRON Jobs & Automation
- [x] Auto-matching Algorithm

---

## 📝 Notes

- All tests run in sequence (not parallel) to avoid DB conflicts
- Each test is independent and can run alone
- All sensitive data (OTP, tokens) is simulated for testing
- Tests don't make real API calls (HTTP mocking only)
- Database is completely isolated per test run

---

## 📞 Support

For issues or questions:
1. Check the test output for specific error messages
2. Review the helpers.js for available utilities
3. Check TEST-SUITE-CONFIG.js for flow metadata
4. Run with verbose flag: `npm run test:verbose`

---

**Generated**: 2026-04-03  
**Status**: Production Ready
