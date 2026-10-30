require('dotenv').config();
const http    = require('http');
const express = require('express');
const helmet  = require('helmet');
const morgan  = require('morgan');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const { initSocket } = require('./src/config/socket');
const { startScheduler } = require('./src/jobs/scheduler');
const { initializeFirebase } = require('./src/services/firebaseService');
const { initializeEmailService } = require('./src/services/emailService');
const { sanitizeInput } = require('./src/middleware/sanitize');

const app    = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Initialize Firebase Phone OTP
initializeFirebase();

// Initialize Email Service
initializeEmailService();

// Attach Socket.IO
initSocket(server);

// Start background jobs
startScheduler();

// CORS - Flutter Web compatible
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false, crossOriginOpenerPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({
  verify: (req, _res, buf) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString('utf8');
    }
  },
}));

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 100,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'development',
});
app.use('/api/', limiter);

// Auth route rate limiter
// Development: disabled (high limit) — avoids 429 on /auth/me during HMR/dev reloads
// Production: 50 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 50,
  message: { error: 'Too many requests' },
  skip: () => process.env.NODE_ENV === 'development',
});
app.use('/api/auth', authLimiter);

// NoSQL injection sanitization
app.use(sanitizeInput);

// API Path Mapping Middleware - for backward compatibility
app.use((req, res, next) => {
  // Map /api/user/* -> /api/users/*
  if (req.path.startsWith('/api/user/') && !req.path.startsWith('/api/users/')) {
    req.url = req.url.replace('/api/user/', '/api/users/');
  }
  
  // Map /api/user/wallet -> /api/wallet
  if (req.path === '/api/user/wallet') {
    req.url = '/api/wallet/balance';
  }
  
  // Map /api/user/notifications -> /api/notifications
  if (req.path === '/api/user/notifications') {
    req.url = '/api/notifications/';
  }
  
  // Map /api/user/referral -> /api/users/me/referrals
  if (req.path === '/api/user/referral') {
    req.url = '/api/users/me/referrals';
  }
  
  // Map /api/kyc/status -> /api/kyc/verification-status
  if (req.path === '/api/kyc/status') {
    req.url = '/api/kyc/verification-status';
  }
  
  // Map /api/kyc/upload -> /api/kyc/photo-verify
  if (req.path === '/api/kyc/upload' && req.method === 'POST') {
    req.url = '/api/kyc/photo-verify';
  }
  
  // Map /api/rides/my-rides -> /api/rides/published
  if (req.path === '/api/rides/my-rides') {
    req.url = '/api/rides/published';
  }

  // Map /api/user/preferences -> /api/users/preferences
  if (req.path.startsWith('/api/user/preferences')) {
    req.url = req.url.replace('/api/user/preferences', '/api/users/preferences');
  }

  // Map /api/user/analytics -> /api/users/analytics
  if (req.path === '/api/user/analytics') {
    req.url = '/api/users/analytics';
  }

  // Map /api/user/referral -> /api/users/referral
  if (req.path === '/api/user/referral') {
    req.url = '/api/users/referral';
  }

  next();
});

// Routes
app.use('/api/auth',     require('./src/routes/auth.routes'));
app.use('/api/driver',   require('./src/routes/driver.routes'));
app.use('/api/rides',    require('./src/routes/ride.routes'));
app.use('/api/bookings', require('./src/routes/booking.routes'));
app.use('/api/payments', require('./src/routes/payment.routes'));
app.use('/api/tracking', require('./src/routes/tracking.routes'));
app.use('/api/safety',   require('./src/routes/safety.routes'));
app.use('/api/chat',     require('./src/routes/chat.routes'));
app.use('/api/security', require('./src/routes/security.routes'));
app.use('/api/admin',    require('./src/routes/admin.routes'));
app.use('/api/v1/admin', require('./src/routes/v1/admin.routes'));
app.use('/api/ratings',        require('./src/routes/rating.routes'));
app.use('/api/notifications',  require('./src/routes/notification.routes'));
app.use('/api/map',            require('./src/routes/map.routes'));
app.use('/api/seat-locks',     require('./src/routes/seatLock.routes'));
app.use('/api/tracking',       require('./src/routes/driverTracking.routes'));
app.use('/api/users',          require('./src/routes/user.routes'));
app.use('/api/wallet',         require('./src/routes/wallet.routes'));
app.use('/api/analytics',     require('./src/routes/analytics.routes'));
app.use('/api/kyc',           require('./src/routes/kyc.routes'));
app.use('/api/emergency',     require('./src/routes/emergency.routes'));
app.use('/api/vehicles',      require('./src/routes/vehicle.routes'));
app.use('/api/fare',          require('./src/routes/fare.routes'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'OK' }));

// Test endpoint for mobile app connection
app.get('/api/test', (_req, res) => {
  res.json({
    status: 'success',
    message: 'Backend Connected Successfully',
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

// Global error handler — standardized response format
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Log all 5xx errors with full stack, 4xx errors with message only
  if (status >= 500) {
    console.error(`[ERROR ${status}] ${_req.method} ${_req.originalUrl}:`, err.stack);
  } else {
    console.warn(`[WARN ${status}] ${_req.method} ${_req.originalUrl}: ${message}`);
  }

  res.status(status).json({
    success: false,
    data: null,
    error: message,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


