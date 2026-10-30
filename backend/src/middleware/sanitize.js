/**
 * NoSQL injection sanitization middleware.
 * Recursively strips keys starting with '$' or '.' from objects
 * in req.body, req.query, and req.params.
 */

function stripOperatorKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(stripOperatorKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.startsWith('.')) continue;
      cleaned[key] = stripOperatorKeys(obj[key]);
    }
    return cleaned;
  }
  return obj;
}

const sanitizeInput = (req, _res, next) => {
  if (req.body)   req.body   = stripOperatorKeys(req.body);
  if (req.query)  req.query  = stripOperatorKeys(req.query);
  if (req.params) req.params = stripOperatorKeys(req.params);
  next();
};

module.exports = { sanitizeInput };
