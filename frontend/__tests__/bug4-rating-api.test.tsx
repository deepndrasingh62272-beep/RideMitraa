/**
 * Regression test for the rating API payload contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// The backend expects { bookingId, rating, review }.
// ---------------------------------------------------------------------------

// Module-level variable to capture the outgoing payload.
// Must be declared at module scope so the vi.mock factory closure can access it.
let capturedPayload: Record<string, unknown> | null = null;

// vi.mock calls are hoisted to the top of the file by Vitest.
// The factory function captures `capturedPayload` via closure.
vi.mock('@/src/services/apiClient', () => {
  return {
    default: {
      post: vi.fn(async (_url: string, payload: Record<string, unknown>) => {
        capturedPayload = payload;
        return { data: { success: true } };
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

describe('Rating API payload', () => {
  beforeEach(() => {
    capturedPayload = null;
  });

  it('rateBooking payload should contain "rating" field (not "score")', async () => {
    const { rateBooking } = await import('@/src/services/bookingService');

    await rateBooking('booking-123', 5, 'Great ride');

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload).toHaveProperty('rating');
    expect(capturedPayload).not.toHaveProperty('score');
  });

  it('rateBooking payload should contain "review" field (not "comment")', async () => {
    const { rateBooking } = await import('@/src/services/bookingService');

    await rateBooking('booking-456', 4, 'Good driver');

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload).toHaveProperty('review');
    expect(capturedPayload).not.toHaveProperty('comment');
  });

  it('scoped PBT: for any { bookingId, rating, review }, outgoing payload has correct field names', async () => {
    const { rateBooking } = await import('@/src/services/bookingService');

    const testCases = [
      { bookingId: 'b-001', rating: 5, review: 'Excellent!' },
      { bookingId: 'b-002', rating: 3, review: 'Average' },
      { bookingId: 'b-003', rating: 1, review: 'Poor' },
    ];

    for (const tc of testCases) {
      capturedPayload = null;
      await rateBooking(tc.bookingId, tc.rating, tc.review);

      expect(capturedPayload).toHaveProperty('rating', tc.rating);
      expect(capturedPayload).toHaveProperty('review', tc.review);
      expect(capturedPayload).toHaveProperty('bookingId', tc.bookingId);
      expect(capturedPayload).not.toHaveProperty('score');
      expect(capturedPayload).not.toHaveProperty('comment');
    }
  });
});
