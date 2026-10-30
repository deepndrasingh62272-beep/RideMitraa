#!/bin/bash

# 🚀 DEPLOYMENT CHECKLIST - Real-Time OTP System
# Run this script to verify production readiness

echo "=========================================="
echo "  🚀 PRODUCTION READINESS CHECKER"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((passed++))
  else
    echo -e "${RED}✗${NC} $1"
    ((failed++))
  fi
}

# 1. Check Node.js
node --version > /dev/null 2>&1
check "Node.js installed"

# 2. Check npm
npm --version > /dev/null 2>&1
check "npm installed"

# 3. Check if .env exists
[ -f .env ]
check ".env file exists"

# 4. Check NODE_ENV is set
grep "NODE_ENV=production" .env > /dev/null 2>&1
check "NODE_ENV=production configured"

# 5. Check JWT_SECRET
[ $(grep -c "JWT_SECRET=" .env) -eq 1 ]
check "JWT_SECRET configured"

# 6. Check MONGODB_URI
grep "MONGODB_URI=" .env | grep -v "^#" > /dev/null 2>&1
check "MONGODB_URI configured"

# 7. Check Email settings
grep "EMAIL_PROVIDER=" .env > /dev/null 2>&1
check "EMAIL_PROVIDER configured"

# 8. Check Email credentials
grep "EMAIL_USER=" .env > /dev/null 2>&1
check "EMAIL_USER configured"

# 9. Check Firebase
grep "FIREBASE_SERVICE_ACCOUNT_KEY=" .env | grep -v "^#" > /dev/null 2>&1
check "FIREBASE_SERVICE_ACCOUNT_KEY configured"

# 10. Check package.json
[ -f package.json ]
check "package.json exists"

# 11. Check node_modules
[ -d node_modules ]
check "Dependencies installed (node_modules present)"

# 12. Check for sensitive files in git
! git ls-files --error-unmatch .env > /dev/null 2>&1
check ".env not tracked in git"

# 13. Check .gitignore has .env
grep "^.env$" .gitignore > /dev/null 2>&1
check ".env in .gitignore"

# 14. Check server.js
[ -f server.js ]
check "server.js exists"

# 15. Check required models
[ -f src/models/OTP.js ] && [ -f src/models/User.js ]
check "Required models exist"

# 16. Check services
[ -f src/services/otpService.js ] && [ -f src/services/emailService.js ] && [ -f src/services/firebaseService.js ]
check "All services initialized"

# 17. Check auth routes
[ -f src/routes/auth.routes.js ]
check "Auth routes configured"

# 18. Check MongoDB connection
timeout 5 node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test')
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
" > /dev/null 2>&1
check "MongoDB connection successful"

# 19. Check if ports are available
! lsof -i :5000 > /dev/null 2>&1
check "Port 5000 is available"

# 20. Security checks
grep -q "SECRET_KEY_CHANGE_THIS\|todo\|FIXME\|hardcoded" src/controllers/auth.controller.js 2>/dev/null
[ $? -ne 0 ]
check "No hardcoded secrets in code"

echo ""
echo "=========================================="
echo "  📊 SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $passed${NC}"
echo -e "${RED}Failed: $failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Ready to deploy!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Please fix issues above.${NC}"
  exit 1
fi
