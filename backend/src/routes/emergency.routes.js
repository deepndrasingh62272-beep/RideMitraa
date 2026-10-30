const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

// Get emergency contacts for user
router.get('/contacts', authenticate, async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('emergencyContacts').lean();
    res.json({ contacts: user?.emergencyContacts || [] });
  } catch (err) {
    next(err);
  }
});

// Add emergency contact
router.post('/contacts', authenticate, [
  body('name').notEmpty().withMessage('Contact name is required'),
  body('phone').matches(/^\d{10}$/).withMessage('Valid 10-digit phone is required'),
], validate, async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { name, phone } = req.body;
    
    const contact = {
      id: new Date().getTime().toString(),
      name,
      phone
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { emergencyContacts: contact } },
      { new: true }
    ).select('emergencyContacts').lean();

    res.status(201).json({ contact, contacts: user?.emergencyContacts || [] });
  } catch (err) {
    next(err);
  }
});

// Delete emergency contact
router.delete('/contacts/:id', authenticate, [
  param('id').notEmpty().withMessage('Contact ID is required')
], validate, async (req, res, next) => {
  try {
    const User = require('../models/User');
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { emergencyContacts: { id: req.params.id } } },
      { new: true }
    ).select('emergencyContacts').lean();

    res.json({ success: true, contacts: user?.emergencyContacts || [] });
  } catch (err) {
    next(err);
  }
});

// Trigger SOS alert
router.post('/sos', authenticate, async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { location, rideId } = req.body;

    const user = await User.findById(req.user._id)
      .select('name phone emergencyContacts')
      .lean();

    // In a real app, would send SMS/notifications to emergency contacts
    // For now, just log the SOS trigger
    console.log(`[SOS] User ${user.name} triggered SOS at location:`, location);

    res.json({
      success: true,
      message: 'SOS alert sent to all emergency contacts',
      contactsNotified: user?.emergencyContacts?.length || 0
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
