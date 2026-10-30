#!/bin/bash
# Test Execution Script for Ride-Sharing Backend
# This script runs all 18 test flows and generates a comprehensive report

set -e

echo "========================================="
echo "RIDE-SHARING BACKEND TEST SUITE"
echo "========================================="
echo ""
echo "Framework: Jest + Supertest"
echo "Database: MongoDB Memory Server"
echo "Total Flows: 18"
echo ""

echo "📋 Starting test execution..."
echo ""

# Run tests with detailed output
npm test -- --verbose --bail=false --runInBand 2>&1 | tee test-execution.log

echo ""
echo "========================================="
echo "TEST EXECUTION COMPLETE"
echo "========================================="
echo ""

echo "📊 Generating summary report..."
echo ""

# Extract pass/fail counts
TOTAL_TESTS=$(grep -o "✓\\|✗" test-execution.log | wc -l)
PASSED=$(grep -c "✓" test-execution.log || echo 0)
FAILED=$(grep -c "✗" test-execution.log || echo 0)

echo "Summary:"
echo "--------"
echo "Total Tests Run: $TOTAL_TESTS"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ ALL TESTS PASSED!"
  exit 0
else
  echo "❌ SOME TESTS FAILED"
  echo ""
  echo "Failed tests:"
  grep "✗" test-execution.log
  exit 1
fi
