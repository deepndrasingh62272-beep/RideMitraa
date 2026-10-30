const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl       = require('../controllers/admin.controller');
const walletCtrl = require('../controllers/driverWallet.controller');

// All admin routes require a valid session + ADMIN role
router.use(authenticate, requireAdmin);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',          ctrl.listUsers);
router.get('/users/:id',      ctrl.getUser);
router.patch('/users/:id/ban', ctrl.banUser);

// ── Rides ─────────────────────────────────────────────────────────────────────
router.get('/rides', ctrl.listRides);
router.delete('/rides/clear-all', ctrl.clearAllRides);

// ── Bookings ──────────────────────────────────────────────────────────────────
router.get('/bookings', ctrl.listBookings);

// ── Payments & Refunds ────────────────────────────────────────────────────────
router.get('/payments',         ctrl.listPayments);
router.get('/payments/refunds', ctrl.listRefunds);

// ── KYC ───────────────────────────────────────────────────────────────────────
router.get('/kyc/pending',              ctrl.listPendingKYC);
router.post('/kyc/:driverId/approve',   ctrl.approveKYC);
router.post('/kyc/:driverId/reject',    ctrl.rejectKYC);

// ── Safety Alerts ─────────────────────────────────────────────────────────────
router.get('/alerts',              ctrl.listAlerts);
router.patch('/alerts/:id/resolve', ctrl.resolveAlert);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics',       ctrl.getAnalytics);
router.get('/analytics/fraud', ctrl.getFraudAnalytics);

// ── Withdrawals ───────────────────────────────────────────────────────────────
router.get('/withdrawals',                  walletCtrl.listWithdrawals);
router.post('/withdrawals/:id/approve',     walletCtrl.approveWithdrawal);
router.post('/withdrawals/:id/reject',      walletCtrl.rejectWithdrawal);

module.exports = router;
