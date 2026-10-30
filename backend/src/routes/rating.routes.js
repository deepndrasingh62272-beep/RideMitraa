const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/rating.controller');

// Submit a rating (passenger → driver or driver → passenger)
router.post(
  '/',
  authenticate,
  [
    body('bookingId').isMongoId().withMessage('Valid bookingId is required'),
    body('score').isInt({ min: 1, max: 5 }).withMessage('Score must be between 1 and 5'),
    body('comment').optional().isString().isLength({ max: 300 }).withMessage('Comment max 300 chars'),
  ],
  validate,
  ctrl.submitRating
);

// Get rating summary for a user
router.get('/user/:id', authenticate, ctrl.getUserRating);

// Get a specific rating by ID
router.get('/:id', authenticate, ctrl.getRatingById);

// Update a rating (within 24h window)
router.put('/:id', authenticate,
  [
    body('score').optional().isInt({ min: 1, max: 5 }),
    body('comment').optional().isString().isLength({ max: 300 }),
  ],
  validate,
  ctrl.updateRating
);

// Delete a rating (admin or owner within 1h)
router.delete('/:id', authenticate, ctrl.deleteRating);

module.exports = router;
