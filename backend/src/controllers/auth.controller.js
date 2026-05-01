// src/controllers/auth.controller.js
//
// Developer Notes:
// Handles all authentication logic — registration, login, and session validation.
// We use bcryptjs (not bcrypt) intentionally: bcrypt requires native bindings which
// fail silently on Railway's Nixpacks builder. bcryptjs is pure JS and portable.
//
// JWT tokens are signed with a 7-day expiry. This was a deliberate tradeoff —
// short-lived tokens require refresh token infrastructure which is out of scope here.
// TODO: Implement refresh token rotation for production hardening.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

// -------------------------------------------------------------------
// POST /api/auth/register
// -------------------------------------------------------------------
// Why salt rounds = 12:
// 10 is the bcrypt default but 12 gives better brute-force resistance
// with only ~250ms overhead per hash — acceptable for auth flows.
const register = async (req, res, next) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      console.log('[Auth] Registration validation failed:', validationErrors.array());
      return res.status(400).json({ errors: validationErrors.array() });
    }

    const { name, email, password } = req.body;
    console.log(`[Auth] Registration attempt for email: ${email}`);

    // Explicit duplicate check before insert — gives a clearer error than
    // letting Prisma throw a raw unique constraint violation
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.log(`[Auth] Blocked — email already registered: ${email}`);
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // `select` whitelists response fields — passwordHash must never be exposed
    const newUser = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const authToken = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Auth] New user registered — userId: ${newUser.id}`);
    return res.status(201).json({ user: newUser, token: authToken });

  } catch (err) {
    // TODO: Integrate structured logging (Winston/Sentry) for production monitoring
    console.error('[Auth] Unexpected error during registration:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// POST /api/auth/login
// -------------------------------------------------------------------
// Security: Same error message for "user not found" vs "wrong password"
// This prevents user enumeration attacks (fishing for valid emails).
const login = async (req, res, next) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({ errors: validationErrors.array() });
    }

    const { email, password } = req.body;
    console.log(`[Auth] Login attempt — email: ${email}`);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      console.log(`[Auth] Login failed — no account for: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, existingUser.passwordHash);
    if (!isPasswordValid) {
      console.log(`[Auth] Login failed — wrong password for userId: ${existingUser.id}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const authToken = jwt.sign(
      { userId: existingUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Auth] Login successful — userId: ${existingUser.id}`);
    return res.json({
      user: { id: existingUser.id, name: existingUser.name, email: existingUser.email },
      token: authToken,
    });

  } catch (err) {
    console.error('[Auth] Unexpected error during login:', err.message);
    next(err);
  }
};

// -------------------------------------------------------------------
// GET /api/auth/me
// -------------------------------------------------------------------
// Called by frontend on every page load to rehydrate user state from
// a stored JWT. authenticate middleware already attaches req.user,
// so we just return the safe subset of fields.
const getAuthenticatedUser = async (req, res) => {
  console.log(`[Auth] Session check — userId: ${req.user.id}`);
  return res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
  });
};

module.exports = { register, login, me: getAuthenticatedUser };
