// src/index.js
//
// Developer Notes:
// Application entry point — wires up middleware, routes, and starts the server.
//
// CORS configuration note:
// During local development we allow localhost:5173 (Vite dev server).
// In production (Railway), FRONTEND_URL env var is set to the deployed frontend domain.
// We use a dynamic origin check instead of '*' because our routes use credentials:true
// and browsers block credentialed requests to wildcard origins.
//
// Why we don't use a separate config file for routes:
// At this scale (4 route groups), keeping everything in index.js is readable.
// If routes grow beyond 8-10 groups, extract to a src/routes/index.js barrel file.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const taskRoutes = require('./routes/task.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

// Allowed origins list — filter(Boolean) removes undefined if FRONTEND_URL is not set
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log('[Server] Allowed CORS origins:', allowedOrigins);

// CORS must be configured before any route handlers
app.use(cors({
  origin: (incomingOrigin, callback) => {
    // Allow requests with no origin (Postman, Railway health checks, curl)
    if (!incomingOrigin) return callback(null, true);
    if (allowedOrigins.includes(incomingOrigin)) return callback(null, true);
    console.log(`[CORS] Blocked request from origin: ${incomingOrigin}`);
    callback(new Error('Not allowed by CORS policy'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// Health check — used by Railway to verify the service is alive
// This must respond quickly and NOT depend on the database
app.get('/health', (req, res) => {
  console.log('[Server] Health check pinged');
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API route groups
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
// Tasks are nested under projects — projectId is merged into task route params
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global error handler — catches anything passed to next(err) in controllers
// Keeps error handling consistent across all routes
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.stack);
  return res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred',
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});
