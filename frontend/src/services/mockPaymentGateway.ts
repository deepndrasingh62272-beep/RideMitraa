/**
 * Mock Payment Gateway Service
 * Simulates payment processing without real gateway integration
 * Used for development and testing
 */

import { logInfo, logError, logDebug } from './errorLogger';

export interface MockPaymentOrder {
  id: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PENDING' | 'CAPTURED' | 'FAILED';
  createdAt: string;
  bookingId: string;
  method: string;
}

export interface MockPaymentResult {
  success: boolean;
  orderId: string;
  paymentId?: string;
  message: string;
  mock: true;
}

class MockPaymentGateway {
  private orders: Map<string, MockPaymentOrder> = new Map();
  private payments: Map<string, any> = new Map();

  /**
   * Create a mock payment order
   */
  createOrder(data: {
    amount: number;
    currency: string;
    bookingId: string;
    method: string;
  }): MockPaymentOrder {
    const orderId = `order_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const order: MockPaymentOrder = {
      id: orderId,
      amount: data.amount,
      currency: data.currency,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      bookingId: data.bookingId,
      method: data.method,
    };

    this.orders.set(orderId, order);

    logInfo('MockPaymentGateway', 'createOrder', `Order created: ${orderId}`, {
      amount: data.amount,
      bookingId: data.bookingId,
      method: data.method,
    });

    return order;
  }

  /**
   * Simulate payment capture (success by default, can be configured to fail)
   */
  capturePayment(orderId: string, shouldFail: boolean = false): MockPaymentResult {
    const order = this.orders.get(orderId);

    if (!order) {
      logError('MockPaymentGateway', 'capturePayment', `Order not found: ${orderId}`);
      return {
        success: false,
        orderId,
        message: 'Order not found',
        mock: true,
      };
    }

    if (shouldFail) {
      order.status = 'FAILED';
      logWarn('MockPaymentGateway', 'capturePayment', `Payment capture failed (simulated): ${orderId}`);
      return {
        success: false,
        orderId,
        message: 'Payment capture failed (simulated)',
        mock: true,
      };
    }

    const paymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    order.status = 'CAPTURED';

    this.payments.set(paymentId, {
      id: paymentId,
      orderId,
      amount: order.amount,
      status: 'SUCCESS',
      capturedAt: new Date().toISOString(),
    });

    logInfo('MockPaymentGateway', 'capturePayment', `Payment captured: ${paymentId}`, {
      orderId,
      amount: order.amount,
    });

    return {
      success: true,
      orderId,
      paymentId,
      message: 'Payment captured successfully',
      mock: true,
    };
  }

  /**
   * Simulate refund
   */
  refundPayment(paymentId: string, amount: number): MockPaymentResult {
    const payment = this.payments.get(paymentId);

    if (!payment) {
      logError('MockPaymentGateway', 'refundPayment', `Payment not found: ${paymentId}`);
      return {
        success: false,
        orderId: '',
        message: 'Payment not found',
        mock: true,
      };
    }

    const refundId = `rfnd_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logInfo('MockPaymentGateway', 'refundPayment', `Refund processed: ${refundId}`, {
      paymentId,
      amount,
    });

    return {
      success: true,
      orderId: payment.orderId,
      paymentId: refundId,
      message: 'Refund processed successfully',
      mock: true,
    };
  }

  /**
   * Get order details
   */
  getOrder(orderId: string): MockPaymentOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Get payment details
   */
  getPayment(paymentId: string): any {
    return this.payments.get(paymentId) || null;
  }

  /**
   * List all orders (for debugging)
   */
  listOrders(): MockPaymentOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.orders.clear();
    this.payments.clear();
    logDebug('MockPaymentGateway', 'clear', 'All mock data cleared');
  }
}

// Singleton instance
const mockGateway = new MockPaymentGateway();

export default mockGateway;

// Helper function for logging
const logWarn = (service: string, action: string, message: string) => {
  console.warn(`[${new Date().toISOString()}] [WARN] [${service}/${action}] ${message}`);
};
