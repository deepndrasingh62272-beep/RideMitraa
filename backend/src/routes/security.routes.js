const router     = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/security.controller');

// All routes require authentication
router.use(authenticate);

// ── Face Verification (any authenticated user preparing to offer rides) ──────
router.post('/face-verify',        ctrl.verifyFace);
router.get('/face-verify/status',  ctrl.getFaceVerifyStatus);

// ── GDPR / Data Privacy ───────────────────────────────────────────────────────
router.delete('/account',  ctrl.deleteAccount);
router.get('/my-data',     ctrl.exportMyData);

// ── Admin: Fraud Flags ────────────────────────────────────────────────────────
// In production, add an 'ADMIN' role check here
router.get('/fraud-flags',              ctrl.listFraudFlags);
router.patch('/fraud-flags/:id/resolve', ctrl.resolveFraudFlag);

module.exports = router;
