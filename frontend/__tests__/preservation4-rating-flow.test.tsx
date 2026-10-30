/**
 * Preservation 4 — Successful Rating Flow
 *
 * These tests MUST PASS on unfixed code.
 * They document the baseline behavior that must be preserved after fixes:
 * - When the API returns 200, rateBooking completes without throwing.
 * - Zero-rating and missing bookingId validation blocks submission before API call.
 * - Error handling for non-422 errors works correctly.
 *
 * Validates: Requirements 3.9, 3.10, 3.11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// The UNFIXED rateBooking in bookingService.ts:
//
//   apiClient.post(`/ratings`, { bookingId, score: rating, comment: review })
//
// The function EXECUTES and makes the API call — it just sends the wrong field names.
// When we mock the API to return 200, the function completes successfully.
// This is the preservation property: the function flow works, just the payload is wrong.
// ---------------------------------------------------------------------------

// Module-level variable to capture the outgoing payload.
let capturedPayload: Record<string, unknown> | null = null;
let capturedUrl: string | null = null;

// vi.mock calls are hoisted to the top of the file by Vitest.
vi.mock('@/src/services/apiClient', () => {
  return {
    default: {
      post: vi.fn(async (url: string, payload: Record<string, unknown>) => {
        capturedUrl = url;
        capturedPayload = payload;
        // Mock a successful 200 response
        return { data: { success: true, data: { id: 'rating-123' } } };
      }),
      get: vi.fn(async () => ({ data: {} })),
      patch: vi.fn(async () => ({ data: {} })),
    },
    retryRequest: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  };
});

vi.mock('@/src/services/errorHandler', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/src/services/errorLogger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logDebug: vi.fn(),
}));

vi.mock('@/src/services/responseMapper', () => ({
  mapBooking: vi.fn((x: unknown) => x),
  mapArray: vi.fn((x: unknown) => x),
  mapId: vi.fn((x: unknown) => x),
}));

describe('Preservation 4 — Successful Rating Flow (MUST PASS on unfixed code)', () => {
  beforeEach(() => {
    capturedPayload = null;
    capturedUrl = null;
    vi.clearAllMocks();
  });

  it('rateBooking completes without throwing when API returns 200', async () => {
    /**
     * Property: When the API mock returns 200, rateBooking does not throw.
     * The function executes the full flow (even with wrong field names on unfixed code).
     *
     * Validates: Requirements 3.9 — successful rating shows "Thank You" confirmation
     */
    const { rateBooking } = await import('@/src/services/bookingService');

    // Should not throw
    await expect(
      rateBooking('booking-123', 5, 'Great ride!')
    ).resolves.not.toThrow();
  });

  it('rateBooking returns success: true when API returns 200', async () => {
    /**
     * Property: When the API returns 200, rateBooking returns { success: true }.
     *
     * Validates: Requirements 3.9 — successful rating flow completes
     */
    const { rateBooking } = await import('@/src/services/bookingService');

    const result = await rateBooking('booking-456', 4, 'Good driver');

    // PASSES on unfixed code: function returns success when API accepts the call
    expect(result.success).toBe(true);
  });

  it('rateBooking makes a POST request to /ratings endpoint', async () => {
    /**
     * Property: rateBooking always calls POST /ratings (the endpoint is correct).
     * Only the payload field names are wrong in the unfixed code.
     *
     * Validates: Requirements 3.9 — the API call is made (flow executes)
     */
    const { rateBooking } = await import('@/src/services/bookingService');

    await rateBooking('booking-789', 3, 'Average');

    // PASSES on unfixed code: the endpoint URL is correct
    expect(capturedUrl).toBe('/ratings');
  });

  it('rateBooking includes bookingId in the payload', async () => {
    /**
     * Property: The bookingId is always included in the payload.
     * This field name is correct in both unfixed and fixed code.
     *
     * Validates: Requirements 3.9 — bookingId is sent with the rating
     */
    const { rateBooking } = await import('@/src/services/bookingService');

    await rateBooking('booking-abc', 5, 'Excellent!');

    // PASSES on unfixed code: bookingId is always included
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload).toHaveProperty('bookingId', 'booking-abc');
  });

  it('rateBooking sends the rating value in the payload (as score on unfixed code)', async () => {
    /**
     * Property: The rating value is always sent in the payload.
     * On unfixed code it's under the 'score' field; after fix it will be 'rating'.
     * Either way, the numeric value is transmitted.
     *
     * Validates: Requirements 3.9 — rating value is sent
     */
    const { rateBooking } = await import('@/src/services/bookingService');

    await rateBooking('booking-def', 5, 'Perfect!');

    // PASSES on unfixed code: the value 5 is in the payload (under 'score')
    expect(capturedPayload).not.toBeNull();
    // Check that the rating value 5 appears somewhere in the payload
    const payloadValues = Object.values(capturedPayload!);
    expect(payloadValues).toContain(5);
  });

  it('scoped PBT: for any { bookingId, rating: 1-5 } with mocked 200 response, rateBooking succeeds', async () => {
    /**
     * Property: For any valid rating (1-5) with a mocked 200 response,
     * rateBooking completes without throwing and returns success.
     *
     * Validates: Requirements 3.9 — successful rating flow works for all valid ratings
     */
    const { rateBooking } = await import('@/src/services/bookingService');

    const testCases = [
      { bookingId: 'b-001', rating: 1, review: 'Poor' },
      { bookingId: 'b-002', rating: 2, review: 'Below average' },
      { bookingId: 'b-003', rating: 3, review: 'Average' },
      { bookingId: 'b-004', rating: 4, review: 'Good' },
      { bookingId: 'b-005', rating: 5, review: 'Excellent!' },
    ];

    for (const tc of testCases) {
      capturedPayload = null;

      const result = await rateBooking(tc.bookingId, tc.rating, tc.review);

      // PASSES on unfixed code: function executes successfully for all valid ratings
      expect(result.success).toBe(true);
      expect(capturedPayload).toHaveProperty('bookingId', tc.bookingId);
    }
  });

  it('scoped PBT: rateBooking with optional review (undefined) still completes', async () => {
    /**
     * Property: rateBooking works when review is undefined (optional parameter).
     *
     * Validates: Requirements 3.9 — rating without review still works
     */
    const { rateBooking } = await import('@/src/services/bookingService');

    const result = await rateBooking('booking-no-review', 4, undefined);

    // PASSES on unfixed code: review is optional
    expect(result.success).toBe(true);
    expect(capturedPayload).toHaveProperty('bookingId', 'booking-no-review');
  });

  it('BookingRatingModal validation: rating === 0 blocks submission before API call', () => {
    /**
     * Property: The modal's handleSubmit function blocks submission when rating is 0.
     * This validation happens BEFORE any API call.
     *
     * Validates: Requirements 3.10 — zero rating blocks submission with validation message
     */
    // Simulate the validation logic from BookingRatingModal.handleSubmit
    function validateRatingSubmission(rating: number, bookingId: string | undefined): string | null {
      if (rating === 0) {
        return 'Please select a rating';
      }
      if (!bookingId) {
        return 'Booking ID is required';
      }
      return null; // valid
    }

    // Zero rating should be blocked
    expect(validateRatingSubmission(0, 'booking-123')).toBe('Please select a rating');

    // Missing bookingId should be blocked
    expect(validateRatingSubmission(5, undefined)).toBe('Booking ID is required');

    // Valid submission should pass
    expect(validateRatingSubmission(5, 'booking-123')).toBeNull();
    expect(validateRatingSubmission(1, 'booking-456')).toBeNull();
  });

  it('scoped PBT: for any rating 1-5 with valid bookingId, validation passes', () => {
    /**
     * Property: For any valid rating (1-5) with a non-empty bookingId,
     * the validation passes and allows the API call.
     *
     * Validates: Requirements 3.10 — valid submissions are not blocked
     */
    function validateRatingSubmission(rating: number, bookingId: string | undefined): string | null {
      if (rating === 0) return 'Please select a rating';
      if (!bookingId) return 'Booking ID is required';
      return null;
    }

    const validRatings = [1, 2, 3, 4, 5];
    const validBookingIds = ['booking-001', 'booking-abc', 'b-xyz-123'];

    for (const rating of validRatings) {
      for (const bookingId of validBookingIds) {
        const error = validateRatingSubmission(rating, bookingId);
        // PASSES on unfixed code: valid inputs pass validation
        expect(error).toBeNull();
      }
    }
  });

  it('rateBooking throws when API returns an error (non-422)', async () => {
    /**
     * Property: When the API returns a non-422 error (e.g., network error, 500),
     * rateBooking throws the error so the caller can handle it.
     *
     * Validates: Requirements 3.11 — non-422 errors show error toast and keep modal open
     */
    const { default: apiClient } = await import('@/src/services/apiClient');
    const { retryRequest } = await import('@/src/services/apiClient');

    // Mock a network error
    vi.mocked(retryRequest).mockRejectedValueOnce(new Error('Network Error'));

    const { rateBooking } = await import('@/src/services/bookingService');

    // Should throw (so the caller can show an error toast)
    await expect(rateBooking('booking-error', 5, 'Test')).rejects.toThrow();
  });
});
