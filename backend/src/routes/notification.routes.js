const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { NOTIFICATION_TYPES } = require('../models/Notification');
const ctrl = require('../controllers/notification.controller');

// Send a notification — admin only
router.post(
  '/send',
  authenticate,
  requireRole('ADMIN'),
  [
    body('userId').isMongoId().withMessage('Valid userId required'),
    body('type').isIn(NOTIFICATION_TYPES).withMessage(`type must be one of: ${NOTIFICATION_TYPES.join(', ')}`),
    body('title').notEmpty().withMessage('title is required'),
    body('body').notEmpty().withMessage('body is required'),
  ],
  validate,
  ctrl.sendNotification
);

// Get own notifications (authenticated user)
router.get('/', authenticate, ctrl.getMyNotifications);

// Get notifications for a user
router.get('/:userId', authenticate, ctrl.getNotifications);

// Mark single notification as read
router.patch('/:id/read', authenticate, ctrl.markRead);

// Mark all as read
router.patch('/read-all', authenticate, ctrl.markAllRead);

module.exports = router;
