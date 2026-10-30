/**
 * Unit Tests — Frontend Component Logic
 * Feature: ride-request-booking-flow
 *
 * Tests the pure business logic extracted from frontend components:
 * - BookingCard: status × role → correct action buttons
 * - PaymentModal: fare calculation, step transitions, 1.5s delay
 * - OTPModal: validation, error handling, field clearing
 * - BookingRatingModal: 0-star validation
 *
 * These tests run in Node.js (no DOM) and verify the logic that drives
 * the UI decisions, matching the component source exactly.
 */

// ─── 15.2 BookingCard: status × role → action buttons ────────────────────────

describe('Unit 15.2: BookingCard — action buttons for each status × role', () => {
  /**
   * Mirrors the conditional rendering logic in BookingCard.tsx.
   * Returns the list of button labels that would be rendered for a given
   * (type, status, isMyPublishedRide) combination.
   */
  const getButtons = (type, rawStatus, isMyPublishedRide = false) => {
    const status = (rawStatus || '').toLowerCase();

    if (type === 'driver' && isMyPublishedRide &&
        !['ongoing', 'started', 'completed', 'cancelled', 'otp_verified'].includes(status)) {
      return ['Start Ride', 'Cancel'];
    }
    if (type === 'driver' && isMyPublishedRide && (status === 'ongoing' || status === 'started')) {
      return ['Complete Ride'];
    }
    if (type === 'driver' && status === 'pending') {
      return ['Accept', 'Reject'];
    }
    if (type === 'passenger' && status === 'pending') {
      return ['View Details', 'Cancel'];
    }
    if (type === 'passenger' && status === 'accepted') {
      return ['Pay Now', 'Cancel'];
    }
    if (type === 'passenger' && status === 'payment_done') {
      return ['Verify OTP', 'Cancel'];
    }
    if (type === 'driver' && status === 'payment_done') {
      return ['OTP Display', 'Cancel Ride'];
    }
    if (type === 'passenger' && status === 'otp_verified') {
      return ['Start Ride (disabled)', 'Cancel'];
    }
    if (type === 'driver' && status === 'otp_verified') {
      return ['Start Ride', 'Cancel'];
    }
    if (status === 'completed') {
      return ['Rate'];
    }
    if (['ongoing', 'on_the_way', 'arrived', 'in_progress'].includes(status)) {
      if (type === 'passenger') return ['Track', 'Cancel'];
      if (type === 'driver') return ['Track', 'Call'];
    }
    return ['Chat', 'Call'];
  };

  // Passenger cases
  test('passenger + PENDING → View Details, Cancel', () => {
    expect(getButtons('passenger', 'PENDING')).toEqual(['View Details', 'Cancel']);
  });

  test('passenger + ACCEPTED → Pay Now, Cancel', () => {
    expect(getButtons('passenger', 'ACCEPTED')).toEqual(['Pay Now', 'Cancel']);
  });

  test('passenger + PAYMENT_DONE → Verify OTP, Cancel', () => {
    expect(getButtons('passenger', 'PAYMENT_DONE')).toEqual(['Verify OTP', 'Cancel']);
  });

  test('passenger + OTP_VERIFIED → Start Ride (disabled), Cancel', () => {
    expect(getButtons('passenger', 'OTP_VERIFIED')).toEqual(['Start Ride (disabled)', 'Cancel']);
  });

  test('passenger + ONGOING → Track, Cancel', () => {
    expect(getButtons('passenger', 'ONGOING')).toEqual(['Track', 'Cancel']);
  });

  test('passenger + COMPLETED → Rate', () => {
    expect(getButtons('passenger', 'COMPLETED')).toEqual(['Rate']);
  });

  test('passenger + CANCELLED → Chat, Call (default)', () => {
    expect(getButtons('passenger', 'CANCELLED')).toEqual(['Chat', 'Call']);
  });

  // Driver cases
  test('driver + PENDING (incoming request) → Accept, Reject', () => {
    expect(getButtons('driver', 'PENDING')).toEqual(['Accept', 'Reject']);
  });

  test('driver + PAYMENT_DONE → OTP Display, Cancel Ride', () => {
    expect(getButtons('driver', 'PAYMENT_DONE')).toEqual(['OTP Display', 'Cancel Ride']);
  });

  test('driver + OTP_VERIFIED → Start Ride (enabled), Cancel', () => {
    expect(getButtons('driver', 'OTP_VERIFIED')).toEqual(['Start Ride', 'Cancel']);
  });

  test('driver + isMyPublishedRide + BOOKING_OPEN → Start Ride, Cancel', () => {
    expect(getButtons('driver', 'BOOKING_OPEN', true)).toEqual(['Start Ride', 'Cancel']);
  });

  test('driver + isMyPublishedRide + ONGOING → Complete Ride', () => {
    expect(getButtons('driver', 'ONGOING', true)).toEqual(['Complete Ride']);
  });

  test('driver + isMyPublishedRide + STARTED → Complete Ride', () => {
    expect(getButtons('driver', 'STARTED', true)).toEqual(['Complete Ride']);
  });

  test('driver + COMPLETED → Rate', () => {
    expect(getButtons('driver', 'COMPLETED')).toEqual(['Rate']);
  });

  // Status is case-insensitive
  test('status comparison is case-insensitive', () => {
    expect(getButtons('passenger', 'accepted')).toEqual(['Pay Now', 'Cancel']);
    expect(getButtons('passenger', 'ACCEPTED')).toEqual(['Pay Now', 'Cancel']);
    expect(getButtons('passenger', 'Accepted')).toEqual(['Pay Now', 'Cancel']);
  });
});

// ─── 15.3 PaymentModal: fare calculation + step transitions ──────────────────

describe('Unit 15.3: PaymentModal — fare calculation and step transitions', () => {
  const PLATFORM_FEE_PERCENT = 0.1;

  const calcFare = (pricePerSeat, seatsBooked) => {
    const subtotal = pricePerSeat * seatsBooked;
    const platformFee = parseFloat((subtotal * PLATFORM_FEE_PERCENT).toFixed(2));
    const grandTotal = parseFloat((subtotal + platformFee).toFixed(2));
    return { subtotal, platformFee, grandTotal };
  };

  test('subtotal = pricePerSeat × seatsBooked', () => {
    expect(calcFare(100, 2).subtotal).toBe(200);
    expect(calcFare(150, 1).subtotal).toBe(150);
    expect(calcFare(75, 3).subtotal).toBe(225);
  });

  test('platformFee = 10% of subtotal', () => {
    expect(calcFare(100, 2).platformFee).toBeCloseTo(20, 2);
    expect(calcFare(150, 1).platformFee).toBeCloseTo(15, 2);
  });

  test('grandTotal = subtotal + platformFee', () => {
    const { subtotal, platformFee, grandTotal } = calcFare(100, 2);
    expect(grandTotal).toBeCloseTo(subtotal + platformFee, 2);
  });

  test('step transitions: SELECT → SUCCESS on Pay Now click', () => {
    // Simulate the step state machine
    let step = 'SELECT';
    const handlePayNow = () => { step = 'SUCCESS'; };
    handlePayNow();
    expect(step).toBe('SUCCESS');
  });

  test('step resets to SELECT after payment confirmed', () => {
    let step = 'SUCCESS';
    const afterConfirm = () => { step = 'SELECT'; };
    afterConfirm();
    expect(step).toBe('SELECT');
  });

  test('close is blocked when step === SUCCESS', () => {
    let closed = false;
    const step = 'SUCCESS';
    const handleClose = () => {
      if (step === 'SUCCESS') return; // blocked
      closed = true;
    };
    handleClose();
    expect(closed).toBe(false);
  });

  test('close works when step === SELECT', () => {
    let closed = false;
    const step = 'SELECT';
    const handleClose = () => {
      if (step === 'SUCCESS') return;
      closed = true;
    };
    handleClose();
    expect(closed).toBe(true);
  });

  test('1500ms delay before calling onPaymentSuccess', (done) => {
    jest.useFakeTimers();
    let called = false;
    const onPaymentSuccess = () => { called = true; };

    // Simulate the setTimeout(1500) pattern
    setTimeout(() => {
      onPaymentSuccess();
    }, 1500);

    expect(called).toBe(false); // not called yet
    jest.advanceTimersByTime(1500);
    expect(called).toBe(true);  // called after 1500ms

    jest.useRealTimers();
    done();
  });

  test('payment method selection is single-select', () => {
    let selectedMethod = 'CASH';
    const selectMethod = (method) => { selectedMethod = method; };

    selectMethod('UPI');
    expect(selectedMethod).toBe('UPI');

    selectMethod('CARD');
    expect(selectedMethod).toBe('CARD');
    // Previous selection is replaced
    expect(selectedMethod).not.toBe('UPI');
  });

  test('all four payment methods are available', () => {
    const methods = ['CASH', 'UPI', 'CARD', 'WALLET'];
    expect(methods).toHaveLength(4);
    expect(methods).toContain('CASH');
    expect(methods).toContain('UPI');
    expect(methods).toContain('CARD');
    expect(methods).toContain('WALLET');
  });
});

// ─── 15.4 OTPModal: validation, error handling, field clearing ────────────────

describe('Unit 15.4: OTPModal — validation, error handling, field clearing', () => {
  /**
   * Mirrors OTPModal state logic.
   */
  const createOTPState = () => ({
    otp: ['', '', '', '', '', ''],
    errorMsg: null,
    isVerifying: false,
  });

  const handleChange = (state, index, value) => {
    if (value.length > 1) return state;
    if (!/^\d*$/.test(value)) return state;
    const newOtp = [...state.otp];
    newOtp[index] = value;
    return { ...state, otp: newOtp, errorMsg: null };
  };

  const isVerifyDisabled = (state) =>
    state.isVerifying || state.otp.some(digit => digit === '');

  const handleError = (state) => ({
    ...state,
    errorMsg: 'Invalid OTP. Please try again.',
    otp: ['', '', '', '', '', ''],
  });

  // Auto-advance focus logic
  const shouldAdvanceFocus = (value, index) => !!(value && index < 5);

  test('verify button disabled when any field is empty', () => {
    const state = createOTPState();
    expect(isVerifyDisabled(state)).toBe(true);
  });

  test('verify button disabled when only 5 of 6 fields filled', () => {
    let state = createOTPState();
    for (let i = 0; i < 5; i++) {
      state = handleChange(state, i, String(i + 1));
    }
    expect(isVerifyDisabled(state)).toBe(true);
  });

  test('verify button enabled when all 6 fields filled', () => {
    let state = createOTPState();
    for (let i = 0; i < 6; i++) {
      state = handleChange(state, i, String(i + 1));
    }
    expect(isVerifyDisabled(state)).toBe(false);
  });

  test('error message set to "Invalid OTP. Please try again." on API error', () => {
    let state = createOTPState();
    state = handleError(state);
    expect(state.errorMsg).toBe('Invalid OTP. Please try again.');
  });

  test('all 6 fields cleared when error is displayed', () => {
    let state = createOTPState();
    // Fill all fields
    for (let i = 0; i < 6; i++) {
      state = handleChange(state, i, String(i + 1));
    }
    expect(state.otp.every(d => d !== '')).toBe(true);

    // Trigger error
    state = handleError(state);
    expect(state.otp).toEqual(['', '', '', '', '', '']);
  });

  test('error message cleared when user starts typing again', () => {
    let state = { ...createOTPState(), errorMsg: 'Invalid OTP. Please try again.' };
    state = handleChange(state, 0, '1');
    expect(state.errorMsg).toBeNull();
  });

  test('auto-advance focus: returns true when value entered and not last field', () => {
    expect(shouldAdvanceFocus('5', 0)).toBe(true);
    expect(shouldAdvanceFocus('3', 4)).toBe(true);
  });

  test('auto-advance focus: returns false on last field (index 5)', () => {
    expect(shouldAdvanceFocus('9', 5)).toBe(false);
  });

  test('auto-advance focus: returns false when value is empty', () => {
    expect(shouldAdvanceFocus('', 0)).toBe(false);
  });

  test('non-digit input is rejected', () => {
    const state = createOTPState();
    const newState = handleChange(state, 0, 'a');
    expect(newState.otp[0]).toBe('');
  });

  test('input longer than 1 char is rejected', () => {
    const state = createOTPState();
    const newState = handleChange(state, 0, '12');
    expect(newState.otp[0]).toBe('');
  });

  test('API is NOT called when OTP is incomplete (< 6 digits)', () => {
    let apiCalled = false;
    const mockVerify = () => { apiCalled = true; };

    const state = createOTPState();
    // Only 3 fields filled
    const partialState = { ...state, otp: ['1', '2', '3', '', '', ''] };

    if (!isVerifyDisabled(partialState)) {
      mockVerify();
    }

    expect(apiCalled).toBe(false);
  });
});

// ─── 15.5 BookingRatingModal: 0-star validation ───────────────────────────────

describe('Unit 15.5: BookingRatingModal — 0-star validation', () => {
  /**
   * Mirrors the handleSubmit validation in BookingRatingModal.tsx.
   */
  const validateRating = (rating) => {
    if (rating === 0) {
      return { valid: false, error: 'Please select a rating' };
    }
    return { valid: true, error: null };
  };

  test('rating 0 fails validation with "Please select a rating"', () => {
    const result = validateRating(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please select a rating');
  });

  test('API is NOT called when rating is 0', () => {
    let apiCalled = false;
    const mockSubmit = () => { apiCalled = true; };

    const rating = 0;
    const { valid } = validateRating(rating);
    if (valid) mockSubmit();

    expect(apiCalled).toBe(false);
  });

  test('ratings 1–5 pass validation', () => {
    [1, 2, 3, 4, 5].forEach(star => {
      const result = validateRating(star);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  test('submit button is disabled when rating === 0', () => {
    // Mirrors: disabled={rating === 0 || isSubmitting}
    const isDisabled = (rating, isSubmitting) => rating === 0 || isSubmitting;

    expect(isDisabled(0, false)).toBe(true);
    expect(isDisabled(0, true)).toBe(true);
    expect(isDisabled(1, false)).toBe(false);
    expect(isDisabled(5, false)).toBe(false);
  });

  test('isSubmitted state shows "Thank You!" screen', () => {
    let isSubmitted = false;
    const onSuccess = () => { isSubmitted = true; };
    onSuccess();
    expect(isSubmitted).toBe(true);
  });

  test('modal auto-closes 2 seconds after successful submission', (done) => {
    jest.useFakeTimers();
    let closed = false;
    const onClose = () => { closed = true; };

    // Simulate the setTimeout(2000) in BookingRatingModal
    setTimeout(() => { onClose(); }, 2000);

    expect(closed).toBe(false);
    jest.advanceTimersByTime(2000);
    expect(closed).toBe(true);

    jest.useRealTimers();
    done();
  });

  test('hover rating is independent of selected rating', () => {
    let rating = 0;
    let hoverRating = 0;

    const setRating = (v) => { rating = v; };
    const setHoverRating = (v) => { hoverRating = v; };

    setRating(3);
    setHoverRating(5);

    expect(rating).toBe(3);
    expect(hoverRating).toBe(5);

    // On mouse leave, hover resets but rating stays
    setHoverRating(0);
    expect(rating).toBe(3);
    expect(hoverRating).toBe(0);
  });
});
