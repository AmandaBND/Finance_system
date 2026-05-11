#!/bin/bash
# GroovyMark Financial System - Start Script

echo "🚀 Starting GroovyMark Financial System..."
echo ""

# Kill any existing processes on ports
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

sleep 1

# Start backend
echo "▶  Starting backend server (port 3001)..."
cd "$(dirname "$0")/backend" && node src/server.js &
BACKEND_PID=$!

sleep 2

# Start frontend
echo "▶  Starting frontend (port 5173)..."
cd "$(dirname "$0")/frontend" && npm run dev &
FRONTEND_PID=$!

sleep 3

echo ""
echo "✅ GroovyMark Financial System is running!"
echo ""
echo "   🌐 Dashboard: http://localhost:5173"
echo "   🔧 API:       http://localhost:3001/api"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait for interrupt
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
