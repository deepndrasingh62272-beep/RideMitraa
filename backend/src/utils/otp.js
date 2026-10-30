/**
 * OTP utility — DEV MODE
 * OTP is always 1234 until SMS provider is integrated.
 */

const generateOTP = () => {
  // DEV: fixed OTP for testing — change to random in production
  return '1234';
};

const sendOTP = async (phone, otp) => {
  // DEV: just log — replace with Twilio/MSG91 in production
  console.log(`[DEV] OTP for ${phone}: ${otp}`);
  return true;
};

module.exports = { generateOTP, sendOTP };
