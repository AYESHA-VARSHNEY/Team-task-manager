// src/middleware/auth.middleware.js
//
// Developer Notes:
// Two middleware functions live here:
// 1. `authenticate` — validates JWT and attaches req.user (used on all protected routes)
// 2. `requireProjectAdmin` — checks project-level ADMIN role (used on mutation routes)
//
// Why we hit the DB in `authenticate` instead of just trusting the JWT payload:
// JWTs can't be invalidated after signing. By verifying the userId still exists
// in the DB, we ensure deleted/deactivated accounts can't use old tokens.
// Tradeoff: one extra DB query per request. Acceptable at this scale.
// TODO: Implement a token blocklist (Redis set) for explicit logout invalidation.

const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

// -------------------------------------------------------------------
// Middleware: authenticate
// Validates Bearer token and hydrates req.user for downstream handlers
// -------------------------------------------------------------------
const authenticate = async (req, res, next) => {
  try {
    // Expect header: "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.split(' ')[1];

    if (!bearerToken) {
      console.log('[Auth Middleware] Request rejected — no token in Authorization header');
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    // jwt.verify throws if token is expired or tampered with
    const decodedPayload = jwt.verify(bearerToken, process.env.JWT_SECRET);

    // DB lookup ensures the user account still exists (handles deleted accounts)
    const authenticatedUser = await prisma.user.findUnique({
      where: { id: decodedPayload.userId },
    });

    if (!authenticatedUser) {
      console.log(`[Auth Middleware] Token valid but user not found — userId: ${decodedPayload.userId}`);
      return res.status(401).json({ error: 'User account no longer exists' });
    }

    // Attach user to request so controllers can access it without another DB call
    req.user = authenticatedUser;
    next();

  } catch (err) {
    console.log('[Auth Middleware] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};

// -------------------------------------------------------------------
// Middleware: requireProjectAdmin
// Must be used AFTER `authenticate` — relies on req.user being set.
// Checks the ProjectMember table for ADMIN role on the specific project.
// -------------------------------------------------------------------
const requireProjectAdmin = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    console.log(`[Auth Middleware] Checking ADMIN role — userId: ${req.user.id}, projectId: ${projectId}`);

    const memberRecord = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });

    if (!memberRecord || memberRecord.role !== 'ADMIN') {
      console.log(`[Auth Middleware] Access denied — userId: ${req.user.id} is not ADMIN of projectId: ${projectId}`);
      return res.status(403).json({ error: 'This action requires Project Admin access' });
    }

    // Attach member record in case controllers need the role downstream
    req.projectMember = memberRecord;
    next();

  } catch (err) {
    console.error('[Auth Middleware] Error checking project admin role:', err.message);
    next(err);
  }
};

module.exports = { authenticate, requireProjectAdmin };
