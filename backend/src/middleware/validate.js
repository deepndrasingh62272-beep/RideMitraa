const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[VALIDATE] 422 errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

module.exports = validate;
