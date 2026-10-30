const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize email transporter
 * Supports both SMTP and Gmail with app-specific passwords
 */
const initializeEmailService = () => {
  if (transporter) {
    return; // Already initialized
  }

  try {
    // Support both Gmail and generic SMTP
    if (process.env.EMAIL_PROVIDER === 'gmail') {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD, // Gmail app-specific password
        },
      });
    } else {
      // Generic SMTP
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }

    console.log('[EMAIL] Service initialized successfully');
  } catch (err) {
    console.error('[EMAIL] Initialization failed:', err.message);
  }
};

/**
 * Send OTP email
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendOTPEmail = async (email, otp) => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP for Ride Sharing App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your One-Time Password</h2>
          <p style="color: #666; font-size: 16px;">
            Your OTP is valid for 5 minutes. Do not share this with anyone.
          </p>
          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 2px;">
              Your OTP
            </p>
            <p style="margin: 10px 0; font-size: 32px; font-weight: bold; color: #333; letter-spacing: 4px;">
              ${otp}
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you didn't request this OTP, please ignore this email.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
            © 2024 Ride Sharing App. All rights reserved.
          </p>
        </div>
      `,
      text: `Your OTP is: ${otp}. Valid for 5 minutes. Do not share this with anyone.`,
    };

    await transporter.sendMail(mailOptions);

    console.log(`[EMAIL] OTP sent to ${email}`);
    return { success: true };
  } catch (err) {
    console.error(`[EMAIL] Error sending OTP to ${email}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Send generic email (for future use)
 * @param {string} email - Recipient
 * @param {string} subject
 * @param {string} htmlContent
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendEmail = async (email, subject, htmlContent) => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject,
      html: htmlContent,
    });

    console.log(`[EMAIL] Email sent to ${email}`);
    return { success: true };
  } catch (err) {
    console.error(`[EMAIL] Error sending email to ${email}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Test email connection
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const testConnection = async () => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    await transporter.verify();
    console.log('[EMAIL] Connection verified');
    return { success: true };
  } catch (err) {
    console.error('[EMAIL] Connection test failed:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

module.exports = {
  initializeEmailService,
  sendOTPEmail,
  sendEmail,
  testConnection,
};
