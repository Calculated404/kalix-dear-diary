#!/usr/bin/env bash
# Audit integration boundaries for the backend (apps/api)
# 
# This script ensures the backend remains a passive datastore
# with no outbound HTTP calls to external services.
#
# Exit codes:
#   0 - All checks passed
#   1 - Boundary violations detected

set -e

API_DIR="apps/api"
VIOLATIONS=0

echo "=========================================="
echo "Integration Boundary Audit"
echo "=========================================="
echo ""

# Check if API directory exists
if [ ! -d "$API_DIR" ]; then
  echo "ERROR: $API_DIR directory not found"
  exit 1
fi

echo "Checking: $API_DIR"
echo ""

# ==========================================
# Check 1: Forbidden Google-related imports
# ==========================================
echo "1. Checking for Google API dependencies..."

GOOGLE_PATTERNS=(
  "googleapis"
  "@google-cloud"
  "@google/"
  "google-auth-library"
  "gmail"
  "calendar"
)

for pattern in "${GOOGLE_PATTERNS[@]}"; do
  if grep -rq "$pattern" "$API_DIR/src" 2>/dev/null; then
    echo "   ❌ VIOLATION: Found '$pattern' in source files"
    grep -rn "$pattern" "$API_DIR/src" 2>/dev/null || true
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Check package.json for Google deps
if [ -f "$API_DIR/package.json" ]; then
  for pattern in "${GOOGLE_PATTERNS[@]}"; do
    if grep -q "\"$pattern" "$API_DIR/package.json" 2>/dev/null; then
      echo "   ❌ VIOLATION: Found '$pattern' in package.json"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
fi

if [ $VIOLATIONS -eq 0 ]; then
  echo "   ✓ No Google API dependencies found"
fi
echo ""

# ==========================================
# Check 2: Outbound HTTP client usage
# ==========================================
echo "2. Checking for outbound HTTP client usage..."

# Note: We're looking for actual usage patterns, not just the word "fetch"
# The backend should not have fetch/axios/etc for outbound calls

PREV_VIOLATIONS=$VIOLATIONS

# Check for axios
if grep -rq "from ['\"]axios['\"]" "$API_DIR/src" 2>/dev/null; then
  echo "   ❌ VIOLATION: axios import found"
  grep -rn "from ['\"]axios['\"]" "$API_DIR/src" 2>/dev/null || true
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for node-fetch
if grep -rq "from ['\"]node-fetch['\"]" "$API_DIR/src" 2>/dev/null; then
  echo "   ❌ VIOLATION: node-fetch import found"
  grep -rn "from ['\"]node-fetch['\"]" "$API_DIR/src" 2>/dev/null || true
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for got
if grep -rq "from ['\"]got['\"]" "$API_DIR/src" 2>/dev/null; then
  echo "   ❌ VIOLATION: got import found"
  grep -rn "from ['\"]got['\"]" "$API_DIR/src" 2>/dev/null || true
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for undici request
if grep -rq "undici" "$API_DIR/src" 2>/dev/null; then
  echo "   ❌ VIOLATION: undici import found"
  grep -rn "undici" "$API_DIR/src" 2>/dev/null || true
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for global fetch usage (outbound calls)
# Ignore test files and look for fetch( patterns
if grep -rq "fetch(" "$API_DIR/src" 2>/dev/null; then
  echo "   ⚠️  WARNING: fetch() call found - verify it's not outbound HTTP"
  grep -rn "fetch(" "$API_DIR/src" 2>/dev/null || true
  echo "   (Manual review required - may be false positive)"
fi

# Check package.json for HTTP client deps
HTTP_CLIENTS=("axios" "node-fetch" "got" "superagent" "request" "undici")
if [ -f "$API_DIR/package.json" ]; then
  for client in "${HTTP_CLIENTS[@]}"; do
    if grep -q "\"$client\"" "$API_DIR/package.json" 2>/dev/null; then
      echo "   ❌ VIOLATION: '$client' found in package.json dependencies"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
fi

if [ $VIOLATIONS -eq $PREV_VIOLATIONS ]; then
  echo "   ✓ No outbound HTTP client usage found"
fi
echo ""

# ==========================================
# Check 3: n8n outbound calls
# ==========================================
echo "3. Checking for n8n outbound calls..."

PREV_VIOLATIONS=$VIOLATIONS

if grep -riq "n8n.io" "$API_DIR/src" 2>/dev/null; then
  echo "   ❌ VIOLATION: n8n.io URL found in source"
  grep -rin "n8n.io" "$API_DIR/src" 2>/dev/null || true
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if grep -riq "webhook.n8n" "$API_DIR/src" 2>/dev/null; then
  echo "   ❌ VIOLATION: n8n webhook URL found"
  grep -rin "webhook.n8n" "$API_DIR/src" 2>/dev/null || true
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ $VIOLATIONS -eq $PREV_VIOLATIONS ]; then
  echo "   ✓ No n8n outbound calls found"
fi
echo ""

# ==========================================
# Summary
# ==========================================
echo "=========================================="
if [ $VIOLATIONS -eq 0 ]; then
  echo "✓ All boundary checks passed"
  echo "=========================================="
  exit 0
else
  echo "❌ Found $VIOLATIONS boundary violation(s)"
  echo "=========================================="
  echo ""
  echo "The backend must be a passive datastore only:"
  echo "  - No Google API calls"
  echo "  - No outbound HTTP clients"
  echo "  - No n8n API calls"
  echo ""
  echo "See docs/integration-boundaries.md for details."
  exit 1
fi
