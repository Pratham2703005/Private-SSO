#!/bin/bash
# Quick test runner - run only tests that don't require full app implementation

echo "Running IDP and basic tests..."
npm run test:e2e:oauth -- --reporter=list --workers=1

echo ""
echo "For widget tests, ensure client-c app has:"
echo "  - Dashboard page at /dashboard"
echo "  - Widget iframe embed: <iframe id='account-switcher-widget' src='http://localhost:3000/widget/...'"
echo "  - Session cookie set (app_session_c)"
