const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { notify } = require('./notify');

const REFERRAL_BONUS = 50;
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate an 8-character uppercase alphanumeric referral code.
 * @returns {string}
 */
const generateReferralCode = () => {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
};

/**
 * Apply a referral code for a new user.
 * Credits both the referrer and the new user ₹50 via Wallet + Transaction.
 *
 * @param {string|ObjectId} newUserId
 * @param {string} referralCode
 * @returns {{ referrer: User, newUser: User }}
 */
const applyReferral = async (newUserId, referralCode) => {
  const referrer = await User.findOne({ referralCode });
  if (!referrer) {
    throw new Error('Invalid referral code');
  }

  if (referrer._id.toString() === newUserId.toString()) {
    throw new Error('Cannot use your own referral code');
  }

  const newUser = await User.findById(newUserId);
  if (newUser.referredBy) {
    throw new Error('Referral already applied');
  }

  // Credit referrer wallet
  await Wallet.findOneAndUpdate(
    { userId: referrer._id },
    { $inc: { balance: REFERRAL_BONUS } },
    { upsert: true, new: true }
  );

  // Credit new user wallet
  await Wallet.findOneAndUpdate(
    { userId: newUser._id },
    { $inc: { balance: REFERRAL_BONUS } },
    { upsert: true, new: true }
  );

  // Create TOPUP transaction for referrer
  await Transaction.create({
    userId: referrer._id,
    type: 'TOPUP',
    amount: REFERRAL_BONUS,
    paymentMethod: 'WALLET',
    note: 'Referral bonus',
  });

  // Create TOPUP transaction for new user
  await Transaction.create({
    userId: newUser._id,
    type: 'TOPUP',
    amount: REFERRAL_BONUS,
    paymentMethod: 'WALLET',
    note: 'Referral bonus',
  });

  // Mark new user as referred
  newUser.referredBy = referrer._id;
  await newUser.save();

  // Notify referrer
  await notify({
    userId: referrer._id,
    type: 'REFERRAL_BONUS',
    title: 'Referral Bonus Earned!',
    body: `You earned ₹${REFERRAL_BONUS} for referring a new user.`,
  });

  return { referrer, newUser };
};

module.exports = { generateReferralCode, applyReferral };
