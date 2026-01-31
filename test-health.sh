#!/bin/bash

# Test script to verify health endpoint is accessible and logging
# Usage: ./test-health.sh [api-url]

API_URL="${1:-https://api-dev.owlby.com}"

echo "Testing health endpoint at: ${API_URL}/health"
echo "----------------------------------------"

# Test health endpoint
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${API_URL}/health")
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d')

echo "Response:"
echo "$body"
echo ""
echo "HTTP Status: $http_code"
echo ""

if [ "$http_code" = "200" ]; then
  echo "✅ Health check successful!"
  echo ""
  echo "Check Vercel logs to see the request logged:"
  echo "1. Go to https://vercel.com/dashboard"
  echo "2. Select your Owlby-api project"
  echo "3. Click on 'Deployments'"
  echo "4. Click on the latest deployment"
  echo "5. Click on 'Functions' tab"
  echo "6. Look for logs with '[HEALTH]' prefix"
else
  echo "❌ Health check failed with status: $http_code"
  echo "Check your domain configuration and Vercel deployment"
fi
