const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/chat.controller');

// Send a message
router.post(
  '/:rideId/send',
  authenticate,
  [
    body('text')
      .notEmpty().withMessage('Message text is required')
      .isLength({ max: 1000 }).withMessage('Message too long (max 1000 chars)'),
    body('bookingId').optional().isMongoId().withMessage('bookingId must be a valid id'),
    body('eventId').optional().isString().isLength({ max: 120 }).withMessage('eventId is invalid'),
  ],
  validate,
  ctrl.sendMessage
);

// Fetch paginated messages for a ride chat
router.get('/:rideId/messages', authenticate, ctrl.getMessages);

// List all conversations for a user
router.get('/conversations', authenticate, ctrl.getConversations);

module.exports = router;
