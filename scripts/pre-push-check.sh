#!/bin/bash

echo "🔍 Running pre-push checks..."

# Run TypeScript type checking
echo "📝 Checking TypeScript types..."
if ! npm run build > /dev/null 2>&1; then
    echo "❌ TypeScript build failed! Please fix errors before pushing."
    echo "Run 'npm run build' to see detailed errors."
    exit 1
fi

echo "✅ All checks passed! Pushing to remote..."