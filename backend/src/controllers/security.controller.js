const User        = require('../models/User');
const FraudFlag   = require('../models/FraudFlag');
const AuditLog    = require('../models/AuditLog');
const { compareFaces }      = require('../utils/faceVerification');
const { revokeAllSessions } = require('../utils/jwt');
const { audit }             = require('../utils/audit');

// ─── Face Verification ────────────────────────────────────────────────────────

/**
 * POST /api/security/face-verify
 * Compares driver's uploaded selfie against their govt ID photo.
 * Stores result on the User document.
 */
exports.verifyFace = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // Any user who wants to offer rides needs face verification
    const { selfie, govtId } = user.kycDocuments || {};
    if (!selfie || !govtId)
      return res.status(400).json({ error: 'Upload KYC documents (selfie + govtId) first' });

    const result = await compareFaces(selfie, govtId);

    user.faceVerified          = result.match;
    user.faceVerificationMeta  = {
      similarity:  result.similarity,
      skipped:     result.skipped,
      verifiedAt:  new Date(),
    };
    await user.save();

    audit({
      req,
      user,
      action:   result.match ? 'FACE_VERIFY_PASSED' : 'FACE_VERIFY_FAILED',
      resource: 'User',
      resourceId: user._id,
      meta:     { similarity: result.similarity, skipped: result.skipped },
      severity: result.match ? 'INFO' : 'WARN',
    });

    if (!result.match && !result.skipped) {
      // Flag for manual review
      await FraudFlag.create({
        userId:      user._id,
        flagType:    'FACE_MISMATCH',
        windowStart: new Date(),
        meta:        { similarity: result.similarity },
      });
    }

    res.json({
      faceVerified: user.faceVerified,
      similarity:   result.similarity,
      skipped:      result.skipped,
      message:      result.skipped
        ? 'Face verification skipped (service unavailable)'
        : result.match
          ? 'Face verification passed'
          : 'Face verification failed — flagged for manual review',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/security/face-verify/status
 */
exports.getFaceVerifyStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'faceVerified faceVerificationMeta kycStatus'
    );
    res.json({
      faceVerified:         user.faceVerified,
      faceVerificationMeta: user.faceVerificationMeta,
      kycStatus:            user.kycStatus,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GDPR / Data Privacy ──────────────────────────────────────────────────────

/**
 * DELETE /api/security/account
 * Right to erasure — anonymises PII and revokes all sessions.
 * Retains anonymised records for legal/financial compliance.
 */
exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Anonymise PII — do NOT hard-delete (needed for financial audit trail)
    await User.findByIdAndUpdate(userId, {
      $set: {
        name:         '[DELETED]',
        phone:        `DELETED_${userId}`,
        email:        null,
        kycDocuments: {},
        isGuest:      true,
        deletedAt:    new Date(),
      },
    });

    // Revoke all active sessions immediately
    await revokeAllSessions(userId);

    audit({
      req,
      user:     req.user,
      action:   'ACCOUNT_DELETED',
      resource: 'User',
      resourceId: userId,
      severity: 'CRITICAL',
    });

    res.json({ message: 'Account deleted. Your personal data has been removed.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/security/my-data
 * Data portability — returns all data held about the requesting user.
 */
exports.exportMyData = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [user, auditLogs, fraudFlags] = await Promise.all([
      User.findById(userId).select('-__v -kycDocuments').lean(),
      AuditLog.find({ 'actor.userId': userId }).select('-__v').lean(),
      FraudFlag.find({ userId }).select('-__v').lean(),
    ]);

    audit({
      req,
      user:     req.user,
      action:   'DATA_EXPORT_REQUESTED',
      resource: 'User',
      resourceId: userId,
    });

    res.json({ user, auditLogs, fraudFlags });
  } catch (err) {
    next(err);
  }
};

// ─── Fraud Flags (Admin) ──────────────────────────────────────────────────────

/**
 * GET /api/security/fraud-flags  (Admin)
 * Lists unresolved fraud flags for review.
 */
exports.listFraudFlags = async (req, res, next) => {
  try {
    const flags = await FraudFlag.find({ resolved: false })
      .populate('userId', 'name phone role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(flags);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/security/fraud-flags/:id/resolve  (Admin)
 */
exports.resolveFraudFlag = async (req, res, next) => {
  try {
    const flag = await FraudFlag.findByIdAndUpdate(
      req.params.id,
      { resolved: true },
      { new: true }
    );
    if (!flag) return res.status(404).json({ error: 'Flag not found' });

    audit({
      req,
      user:     req.user,
      action:   'FRAUD_FLAG_RESOLVED',
      resource: 'FraudFlag',
      resourceId: flag._id,
      meta:     { flagType: flag.flagType, targetUser: flag.userId },
    });

    res.json({ message: 'Flag resolved', flag });
  } catch (err) {
    next(err);
  }
};
