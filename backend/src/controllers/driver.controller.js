const User = require('../models/User');

/**
 * POST /api/driver/kyc/upload
 * Handles multipart upload of KYC documents.
 * Fields: govtId, rc, insurance, pollutionCert, selfie
 * Body: govtIdType (AADHAR | DRIVING_LICENSE)
 */
exports.uploadKYC = async (req, res) => {
  const files = req.files;
  if (!files || Object.keys(files).length === 0)
    return res.status(400).json({ error: 'No files uploaded' });

  const { govtIdType } = req.body;
  if (!govtIdType || !['AADHAR', 'DRIVING_LICENSE'].includes(govtIdType))
    return res.status(400).json({ error: 'govtIdType must be AADHAR or DRIVING_LICENSE' });

  const kycDocuments = { govtIdType };

  // Map uploaded files to their Cloudinary secure URLs
  const fieldMap = ['govtId', 'rc', 'insurance', 'pollutionCert', 'selfie'];
  for (const field of fieldMap) {
    if (files[field]?.[0]) {
      kycDocuments[field] = files[field][0].path; // Cloudinary secure URL
    }
  }

  // Require minimum: govtId + selfie for face match
  if (!kycDocuments.govtId || !kycDocuments.selfie)
    return res.status(400).json({ error: 'govtId and selfie are required' });

  await User.findByIdAndUpdate(req.user._id, {
    kycDocuments,
    kycStatus: 'PENDING',
  });

  // TODO: Trigger async AI face-match job here
  // faceMatchQueue.add({ userId: req.user._id, selfie: kycDocuments.selfie, govtId: kycDocuments.govtId });

  res.json({ message: 'KYC documents uploaded. Verification in progress.', kycStatus: 'PENDING' });
};

/**
 * GET /api/driver/kyc/status
 */
exports.getKYCStatus = async (req, res) => {
  const user = await User.findById(req.user._id).select('kycStatus kycRejectionReason');
  res.json({ kycStatus: user.kycStatus, rejectionReason: user.kycRejectionReason || null });
};

/**
 * PATCH /api/driver/kyc/review  (Admin only)
 * Body: { userId, status: APPROVED | REJECTED, reason? }
 */
exports.reviewKYC = async (req, res) => {
  const { userId, status, reason } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status))
    return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });

  const update = { kycStatus: status };
  if (status === 'REJECTED') update.kycRejectionReason = reason || 'Documents not acceptable';

  const user = await User.findByIdAndUpdate(userId, update, { new: true }).select(
    'name phone kycStatus kycRejectionReason'
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ message: `KYC ${status}`, user });
};

/**
 * GET /api/driver/profile
 */
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select(
    'userId name phone email role kycStatus rating createdAt'
  );
  res.json(user);
};
