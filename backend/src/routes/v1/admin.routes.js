const router = require('express').Router();
const { body } = require('express-validator');

const ctrl = require('../../controllers/adminV1.controller');
const validate = require('../../middleware/validate');
const { authenticateAdmin, requireAdminRoles } = require('../../middleware/adminAuth');

const loginRules = [
  body('email').isEmail().withMessage('Valid admin email is required'),
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

router.post('/auth/login', loginRules, validate, ctrl.login);

router.use(authenticateAdmin);

router.get('/auth/me', ctrl.getMe);

router.get('/users', ctrl.listUsers);
router.get('/users/:userId', ctrl.getUser);
router.patch('/users/:userId/block', requireAdminRoles('SUPER_ADMIN', 'ADMIN'), ctrl.blockUser);
router.patch('/users/:userId/unblock', requireAdminRoles('SUPER_ADMIN', 'ADMIN'), ctrl.unblockUser);

router.get('/kyc/pending', ctrl.listPendingKyc);
router.post('/kyc/:driverId/approve', requireAdminRoles('SUPER_ADMIN', 'ADMIN'), ctrl.approveKyc);
router.post('/kyc/:driverId/reject', requireAdminRoles('SUPER_ADMIN', 'ADMIN'), ctrl.rejectKyc);

router.get('/rides', ctrl.listRides);
router.get('/rides/:rideId/live', ctrl.getRideLive);
router.get('/rides/:rideId/tracking-history', ctrl.getRideTrackingHistory);

router.get('/sos/alerts', ctrl.listSafetyAlerts);
router.patch('/sos/alerts/:alertId/resolve', ctrl.resolveSafetyAlert);

router.get('/payments/transactions', ctrl.listTransactions);
router.post('/payments/refunds', requireAdminRoles('SUPER_ADMIN', 'ADMIN'), ctrl.processRefund);

router.get('/config', ctrl.getConfig);
router.patch('/config', requireAdminRoles('SUPER_ADMIN'), ctrl.updateConfig);

router.get('/analytics/overview', ctrl.getAnalyticsOverview);
router.get('/logs', ctrl.getAdminLogs);

module.exports = router;
