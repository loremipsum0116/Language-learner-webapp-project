#!/bin/bash

# Simple validation script for audio files using Claude

echo "Audio Validation Script with Claude"
echo "===================================="

# Check if API key is provided
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Please set ANTHROPIC_API_KEY environment variable"
    echo "Usage: export ANTHROPIC_API_KEY='your-api-key'"
    exit 1
fi

# Install dependencies if needed
echo "Installing required packages..."
pip install openai-whisper anthropic tqdm

# Run validation with limit for testing
echo ""
echo "Starting validation (testing with 10 files first)..."
python validate-audio-with-claude.py \
    --api-key "$ANTHROPIC_API_KEY" \
    --directory "./advanced" \
    --limit 10 \
    --output "audio_validation_test.json"

echo ""
echo "Test validation complete. Check audio_validation_test.json for results."
echo ""
echo "To validate all files, run:"
echo "python validate-audio-with-claude.py --api-key \$ANTHROPIC_API_KEY --directory ./advanced"