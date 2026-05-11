#!/bin/bash
# GroovyMark Financial System — Production Start Script
# Builds the React frontend, then starts Express to serve everything on one port.
# Apache/Nginx should reverse-proxy the domain to http://localhost:3001

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 Building React frontend..."
cd "$SCRIPT_DIR/frontend"
npm install --silent
npm run build
echo "✅ Frontend build complete → frontend/dist/"

echo ""
echo "🚀 Starting GroovyMark backend (port 3001)..."
cd "$SCRIPT_DIR/backend"
npm install --silent

# Kill any existing process on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1

node src/server.js
