#!/usr/bin/env bash
# run_tests.sh
# Run the test suite with coverage reporting.
# Usage: bash run_tests.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo " Todo App — Backend Test Runner"
echo "========================================"

# Install dependencies (skip if already satisfied)
echo ""
echo "→ Installing dependencies..."
pip3 install -q -r requirements.txt

# Install test dependencies
echo "→ Installing test dependencies..."
pip3 install -q pytest pytest-cov

echo ""
echo "→ Running tests with coverage..."
echo ""

python3 -m pytest test_app.py \
    -v \
    --tb=short \
    --cov=app \
    --cov=models \
    --cov=database \
    --cov-report=term-missing \
    --cov-fail-under=90

echo ""
echo "✅ All tests passed with ≥ 90% coverage!"
