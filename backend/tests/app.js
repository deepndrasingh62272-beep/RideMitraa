// Minimal Express app for testing — no DB connect, no HTTP listen
require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const app        = express();

app.use(helmet());
app.use(express.json({
  verify: (req, _res, buf) => {
    if (buf && buf.length) req.rawBody = buf.toString('utf8');
  },
}));

app.use('/api/auth',          require('../src/routes/auth.routes'));
app.use('/api/driver',        require('../src/routes/driver.routes'));
app.use('/api/rides',         require('../src/routes/ride.routes'));
app.use('/api/bookings',      require('../src/routes/booking.routes'));
app.use('/api/payments',      require('../src/routes/payment.routes'));
app.use('/api/tracking',      require('../src/routes/tracking.routes'));
app.use('/api/safety',        require('../src/routes/safety.routes'));
app.use('/api/chat',          require('../src/routes/chat.routes'));
app.use('/api/ratings',       require('../src/routes/rating.routes'));
app.use('/api/notifications', require('../src/routes/notification.routes'));
app.use('/api/admin',         require('../src/routes/admin.routes'));
app.use('/api/v1/admin',      require('../src/routes/v1/admin.routes'));
app.use('/api/map',           require('../src/modules/map/map.routes'));

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
