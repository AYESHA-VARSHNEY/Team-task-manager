# TaskFlow — Team Task Manager

A full-stack collaborative task management web application built with the PERN stack (PostgreSQL, Express, React, Node.js), deployed on Railway.

> **Built as part of the Ethara AI Full-Stack Engineering Assignment**

---

## Live Demo

| Service | URL |
|---|---|
| Frontend | `https://your-frontend.up.railway.app` |
| Backend API | `https://your-backend.up.railway.app/api` |
| Health Check | `https://your-backend.up.railway.app/health` |

---

## Screenshots

| Signup | Dashboard | Kanban Board |
|---|---|---|
| ![Signup](./screenshots/signup.png) | ![Dashboard](./screenshots/dashboard.png) | ![Kanban](./screenshots/kanban.png) |

---

## Tech Stack

| Layer | Technology | Why I chose it |
|---|---|---|
| Frontend | React 18 + Vite | Fast HMR in dev, optimized production build |
| Styling | Tailwind CSS v3 | Utility-first, no CSS file overhead |
| Routing | React Router v6 | Declarative nested routes, protected route pattern |
| HTTP Client | Axios | Cleaner error handling than fetch |
| Backend | Node.js + Express | Minimal, unopinionated, easy to structure |
| ORM | Prisma | Type-safe queries, schema-first migrations |
| Database | PostgreSQL | Relational model fits project/task/member relationships |
| Auth | JWT (jsonwebtoken) + bcryptjs | Stateless auth, bcryptjs chosen over bcrypt for Railway compatibility |
| Deployment | Railway | Nixpacks auto-detection, built-in PostgreSQL plugin |

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐        ┌─────────────┐
│   React Client  │──REST──▶│   Express API Server │──ORM──▶│  PostgreSQL │
│  (Vite + Tailwind)        │  (Node.js + Prisma)  │        │  (Railway)  │
└─────────────────┘         └──────────────────────┘        └─────────────┘
       ▲                              │
       │                    JWT middleware validates
       └── Auth token stored          every protected route
           in localStorage
```

### Database Schema

```
Users ──< ProjectMembers >── Projects ──< Tasks
                                          │
                                          └── assignedTo → Users
```

---

## Features

- **JWT Authentication** — Signup, Login with bcrypt password hashing
- **Project Management** — Create projects; creator auto-assigned as Admin
- **Role-Based Access Control** — Admin: full CRUD | Member: status updates only
- **Kanban Board** — Three-column task view (To Do / In Progress / Done)
- **Task Assignment** — Assign tasks to any project member with priority and due dates
- **Live Dashboard** — Real-time stats: project count, task status breakdown, overdue alerts, assigned tasks

---

## Technical Challenges & How I Solved Them

### Challenge 1: `bcrypt` Native Binding Failures on Railway

**Problem:** The `bcrypt` package uses native C++ bindings. Railway's Nixpacks builder compiled the bindings for a different Node.js version than what ran at runtime, causing silent authentication failures.

**Solution:** Switched to `bcryptjs` — a pure JavaScript implementation with identical API. No native bindings means zero platform-specific issues. The only tradeoff is ~20% slower hashing, which is negligible for auth endpoints.

```js
// Before — caused silent failures on Railway
const bcrypt = require('bcrypt');

// After — portable, works everywhere
const bcrypt = require('bcryptjs');
```

---

### Challenge 2: `VITE_API_URL` Not Available at Runtime on Railway

**Problem:** Vite env variables (`VITE_*`) are injected at **build time**, not runtime. When I added `VITE_API_URL` as a Railway environment variable after the initial build, the frontend was still making requests to `localhost:5000` — the hardcoded fallback.

**Solution:** Every time a frontend environment variable is added or changed on Railway, a **manual redeploy** is required to rebuild the bundle with the new value baked in. I documented this in the deployment steps and added a clear fallback log.

```js
// Vite replaces this at build time — changing it in Railway requires rebuild
const API = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
```

---

### Challenge 3: CORS Blocking API Calls from Railway Frontend

**Problem:** Setting `origin: '*'` in CORS config broke credentialed requests. The browser enforces that `credentials: true` cannot be used with a wildcard origin — requests failed silently with no useful error message.

**Solution:** Replaced the wildcard with a dynamic origin allowlist that reads from the `FRONTEND_URL` environment variable. Added explicit logging to track blocked origins during debugging.

```js
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,  // Set in Railway dashboard
].filter(Boolean);

app.use(cors({
  origin: (incomingOrigin, callback) => {
    if (!incomingOrigin || allowedOrigins.includes(incomingOrigin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS policy'));
  },
  credentials: true,
}));
```

---

### Challenge 4: Task Route Params Not Merging in Express

**Problem:** Task routes are nested under projects (`/api/projects/:projectId/tasks`). When I registered the task router separately, `req.params.projectId` was `undefined` inside task controllers — Express doesn't forward parent route params by default.

**Solution:** Added `{ mergeParams: true }` to the task Router constructor, which merges params from the parent route into the child router's `req.params`.

```js
// src/routes/task.routes.js
const router = express.Router({ mergeParams: true }); // <- this was the fix
```

---

## Local Development Setup

### Prerequisites
- Node.js v18+
- Git

### 1. Clone
```bash
git clone https://github.com/<your-username>/team-task-manager.git
cd team-task-manager
```

### 2. Backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
DATABASE_URL="your_postgresql_connection_string"
JWT_SECRET="any_random_secret_string"
PORT=5001
FRONTEND_URL=http://localhost:5173
```

```bash
npx prisma generate
npx prisma db push
npm run dev
# → Server running on port 5001
```

### 3. Frontend
```bash
cd ../frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5001/api
```

```bash
npm run dev
# → http://localhost:5173
```

---

## API Reference

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/auth/register` | No | — | Create account |
| POST | `/api/auth/login` | No | — | Login, get JWT |
| GET | `/api/auth/me` | JWT | Any | Get current user |
| GET | `/api/projects` | JWT | Any | List my projects |
| POST | `/api/projects` | JWT | Any | Create project |
| GET | `/api/projects/:id` | JWT | Member | Project details + tasks |
| DELETE | `/api/projects/:id` | JWT | Admin | Delete project |
| POST | `/api/projects/:id/members` | JWT | Admin | Add member by email |
| DELETE | `/api/projects/:id/members/:uid` | JWT | Admin | Remove member |
| POST | `/api/projects/:id/tasks` | JWT | Admin | Create task |
| PATCH | `/api/projects/:id/tasks/:tid` | JWT | Admin/Assignee | Update task |
| DELETE | `/api/projects/:id/tasks/:tid` | JWT | Admin | Delete task |
| GET | `/api/dashboard` | JWT | Any | Dashboard stats |

---

## Railway Deployment

### Backend Service
1. Railway → New Project → Deploy from GitHub → select repo
2. Set **Root Directory** → `backend`
3. Add environment variables:
   - `DATABASE_URL` — copy from Railway PostgreSQL plugin
   - `JWT_SECRET` — any secure random string
   - `FRONTEND_URL` — your frontend Railway URL (update after frontend deploy)
4. The `railway.toml` handles: `npx prisma generate && npx prisma db push && node src/index.js`

### PostgreSQL Plugin
Railway project → **+ New** → **Database** → **PostgreSQL** → copy `DATABASE_URL` into backend vars.

### Frontend Service
1. Same project → **+ New** → **GitHub Repo** → same repo
2. Set **Root Directory** → `frontend`
3. Add variable: `VITE_API_URL` = `https://<backend-domain>.railway.app/api`
4. **Important:** After changing any `VITE_*` variable, trigger a manual redeploy.

---

*Built by Ayesha Varshney — UPES Dehradun, B.Tech CSE (AIML)*
