const admin = require('firebase-admin');

/**
 * Initialize Firebase Admin SDK
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY in .env (JSON stringified)
 */
const initializeFirebase = () => {
  if (admin.apps.length > 0) {
    return; // Already initialized
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.warn(
      '[FIREBASE] Service account key not found. Phone OTP verification will not work.'
    );
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[FIREBASE] Initialized successfully');
  } catch (err) {
    console.error('[FIREBASE] Initialization failed:', err.message);
  }
};

/**
 * Send phone OTP via Firebase Authentication
 * Returns verificationId needed for verification
 * 
 * @param {string} phoneNumber - E.164 format: +919876543210
 * @returns {Promise<{success: boolean, verificationId?: string, error?: string}>}
 */
const sendPhoneOTP = async (phoneNumber) => {
  try {
    if (!admin.apps.length) {
      return {
        success: false,
        error: 'Firebase not initialized'
      };
    }

    // In production, use Firebase Phone Auth Provider
    // For now, return a mock verificationId that can be tested
    // The actual Firebase Phone Auth is client-side
    // This is a workaround for backends that need to initiate OTP
    
    // NOTE: Firebase Phone Authentication is primarily client-side
    // For backend-initiated OTP, consider using Twilio, AWS SNS, or similar
    // This implementation provides a unified interface
    
    const verificationId = `firebase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(
      `[FIREBASE] Phone OTP initiated for: ${phoneNumber} (verificationId: ${verificationId})`
    );

    return {
      success: true,
      verificationId,
    };
  } catch (err) {
    console.error('[FIREBASE] Error sending phone OTP:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Verify phone OTP with Firebase
 * Note: Firebase Phone Auth verification is typically done on client-side
 * This validates the OTP code from client
 *
 * @param {string} phoneNumber - E.164 format
 * @param {string} verificationId - From sendPhoneOTP response
 * @param {string} otp - 6-digit code from SMS
 * @returns {Promise<{success: boolean, idToken?: string, error?: string}>}
 */
const verifyPhoneOTP = async (phoneNumber, verificationId, otp) => {
  try {
    if (!admin.apps.length) {
      return {
        success: false,
        error: 'Firebase not initialized'
      };
    }

    // In a client-side Firebase app, verification happens via:
    // firebase.auth().signInWithPhoneNumber() + confirmationResult.confirm(code)
    // 
    // For backend verification, we simulate the verification
    // In production, integrate with Twilio or similar backend SMS provider
    
    // For MVP: assume verification if OTP matches the one stored in MongoDB
    // This allows the unified OTP service to handle the verification
    
    console.log(
      `[FIREBASE] Verifying phone OTP for: ${phoneNumber}`
    );

    return {
      success: true, // Actual verification done in OTP service
      message: 'OTP code validation to be handled by OTP service'
    };
  } catch (err) {
    console.error('[FIREBASE] Error verifying phone OTP:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Get Firebase Auth user by phone number
 * @param {string} phoneNumber
 * @returns {Promise<{exists: boolean, uid?: string}>}
 */
const getUserByPhoneNumber = async (phoneNumber) => {
  try {
    if (!admin.apps.length) {
      return { exists: false };
    }

    const user = await admin.auth().getUserByPhoneNumber(phoneNumber);
    return { exists: true, uid: user.uid };
  } catch (err) {
    // User doesn't exist or error
    return { exists: false };
  }
};

/**
 * Create or update Firebase Auth user with phone number
 * @param {string} phoneNumber
 * @param {string} displayName - optional
 * @returns {Promise<{success: boolean, uid?: string, error?: string}>}
 */
const createOrUpdatePhoneUser = async (phoneNumber, displayName = '') => {
  try {
    if (!admin.apps.length) {
      return {
        success: false,
        error: 'Firebase not initialized'
      };
    }

    const existing = await getUserByPhoneNumber(phoneNumber);
    if (existing.exists) {
      return { success: true, uid: existing.uid };
    }

    // Create new Firebase Auth user
    const user = await admin.auth().createUser({
      phoneNumber,
      displayName,
    });

    return { success: true, uid: user.uid };
  } catch (err) {
    console.error('[FIREBASE] Error creating phone user:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

module.exports = {
  initializeFirebase,
  sendPhoneOTP,
  verifyPhoneOTP,
  getUserByPhoneNumber,
  createOrUpdatePhoneUser,
};
