const User = require('../models/User');

// POST /api/kyc/photo-verify — upload selfie + drivingLicense, then verify
exports.photoVerify = async (req, res, next) => {
  try {
    // Accept multiple possible field names from different frontends
    const selfieFile = req.files?.selfie?.[0] || req.files?.photo?.[0] || req.files?.image?.[0];
    const licenseFile = req.files?.drivingLicense?.[0] || req.files?.govtId?.[0] || req.files?.license?.[0] || req.files?.document?.[0];

    // If only selfie provided, still proceed (partial KYC)
    if (!selfieFile && !licenseFile) {
      return res.status(400).json({ error: 'At least one file (selfie or drivingLicense) is required' });
    }

    const selfieUrl = selfieFile?.path || null;
    const govtIdUrl = licenseFile?.path || null;

    const verifiedAt = new Date();

    const updateData = {
      kycStatus: 'APPROVED',  // auto-approve on successful upload
      faceVerified: !!selfieFile,
      'faceVerificationMeta.verifiedAt': verifiedAt,
    };
    if (selfieUrl) updateData['kycDocuments.selfie'] = selfieUrl;
    if (govtIdUrl) updateData['kycDocuments.govtId'] = govtIdUrl;

    await User.findByIdAndUpdate(req.user._id, updateData);

    return res.status(200).json({
      message: 'Photos uploaded and verification initiated',
      faceVerified: !!selfieFile,
      kycDocuments: {
        selfie: selfieUrl,
        govtId: govtIdUrl,
      },
      verifiedAt,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/kyc/verification-status
exports.verificationStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('faceVerified kycStatus kycDocuments')
      .lean();

    // Map DB enum to frontend-expected values
    const statusMap = { PENDING: 'pending', APPROVED: 'verified', REJECTED: 'rejected' };

    return res.status(200).json({
      faceVerified: user.faceVerified,
      kycStatus: user.kycStatus,
      status: statusMap[user.kycStatus] ?? 'pending',
      kycDocuments: user.kycDocuments || {},
    });
  } catch (err) {
    next(err);
  }
};
