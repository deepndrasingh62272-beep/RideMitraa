const router = require('express').Router();
const {
  authenticate,
  requireAdmin,
  requireRideOwnerOrEarnings,
  requireKycStatusAccess,
} = require('../middleware/auth');
const { uploadKYC } = require('../config/cloudinary');
const ctrl       = require('../controllers/driver.controller');
const walletCtrl = require('../controllers/driverWallet.controller');

// All driver routes require authentication
router.use(authenticate);

// KYC document upload — accepts multiple named file fields
router.post(
  '/kyc/upload',
  uploadKYC.fields([
    { name: 'govtId', maxCount: 1 },
    { name: 'rc', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'pollutionCert', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  ctrl.uploadKYC
);

router.get('/kyc/status', requireKycStatusAccess, ctrl.getKYCStatus);

// Admin-only KYC review endpoint
router.patch('/kyc/review', requireAdmin, ctrl.reviewKYC);

router.get('/profile', ctrl.getProfile);

// ── Wallet ────────────────────────────────────────────────────────────────────
// Dynamic eligibility: user must have offered at least one ride or have earnings.
router.get('/wallet',    requireRideOwnerOrEarnings, walletCtrl.getDriverWallet);
router.post('/withdraw', requireRideOwnerOrEarnings, walletCtrl.requestWithdrawal);

module.exports = router;
