# ⚡ TaskFlow - Real-Time Task Collaboration Platform

A full-stack, real-time task collaboration platform similar to Trello/Notion hybrid.

---

## 📌 Project Overview

TaskFlow is a real-time collaborative task management platform
that allows teams to create boards, manage lists, assign tasks,
and collaborate live using WebSockets.

It is designed with modular architecture, proper state management,
role-based access control, and scalable real-time communication.

---



## 🚀 Quick Setup

### Prerequisites
- Node.js 18+ installed
- npm 9+ installed

### Step 1 — Clone & Install
```bash
# Navigate into the project
cd taskflow-real-time-collaboration

# Install all dependencies (root + backend + frontend)
npm run install:all
```

### Step 2 — Configure Backend
```bash
cd backend
cp  .env
```

### Step 3 — Seed Database
```bash
# From /taskflow root:
npm run seed
```

### Step 4 — Start Development Servers
```bash
# From /taskflow root (runs both frontend + backend):
npm run dev
```

Or run separately:
```bash
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Frontend
npm start:frontend
```

### Step 5 — Open App
```
Frontend:  http://localhost:3000
Backend:   http://localhost:5000
Health:    http://localhost:5000/health
```

---

## 🔐 Demo Credentials

| Name | Email | Password |
|------|-------|----------|
| Alice Johnson (Admin) | alice@taskflow.com | password123 |
| Bob Smith | bob@taskflow.com | password123 |
| Carol Davis | carol@taskflow.com | password123 |
| Ankur Singh | ankur@gmail.com | ankur12345 |



---

Open two browser tabs with different accounts to see **real-time collaboration**.

---

## 🧪 Running Tests

```bash
npm run test:backend
```

---

## 🏗️ Architecture

### Frontend Architecture

**Framework:** React 18 with React Router v6 (SPA)

**State Management:** Zustand
- `useAuthStore` — user session, login/logout
- `useBoardStore` — boards, lists, tasks, real-time state

**Folder Structure:**
```
frontend/src/
├── components/
│   ├── board/      ListColumn, ActivitySidebar
│   └── task/       TaskCard, TaskModal
├── pages/          LoginPage, SignupPage, DashboardPage, BoardPage
├── services/       api.js (Axios), socket.js (Socket.io client)
├── store/          index.js (Zustand stores)
└── App.js          Router + protected routes
```

**Key Design Decisions:**
- Axios interceptors auto-inject JWT and handle 401 globally
- Zustand for simple, boilerplate-free state management
- Optimistic UI updates for drag-and-drop (immediate feedback)
- Socket.io handles real-time sync of all board events

### Backend Architecture

**Framework:** Express.js + Node.js

**Folder Structure:**
```
backend/src/
├── db/
│   ├── database.js   SQLite init + promise wrappers
│   └── seed.js       Demo data seeder
├── middleware/
│   └── auth.js       JWT auth + board access check
├── routes/
│   ├── auth.js       POST /signup, /login, GET /me
│   ├── boards.js     CRUD + members + activity
│   ├── lists.js      CRUD + reorder
│   └── tasks.js      CRUD + move + assign
├── socket/
│   └── index.js      Socket.io handlers + room management
└── index.js          Express app + HTTP server + Socket.io
```

**Key Design Decisions:**
- SQLite for zero-config local development (swap for PostgreSQL in production)
- WAL journal mode for concurrent read performance
- Socket.io rooms per board — only relevant users receive events
- Activity log stored in DB — queryable history with pagination
- Rate limiting on all API routes

### Real-Time Sync Strategy

```
User A action → REST API (persist) → Emit Socket event → All board users update UI
```

Events:
- `task:created`, `task:updated`, `task:deleted`, `task:moved`
- `list:created`, `list:updated`, `list:deleted`
- `user:online`, `user:offline` (presence)

---

## 🗄️ Database Schema

```sql
users           — id, name, email, password_hash, created_at
boards          — id, title, description, color, owner_id
board_members   — board_id, user_id, role (admin|member)
lists           — id, title, board_id, position
tasks           — id, title, description, list_id, board_id, position, priority, due_date, created_by
task_assignees  — task_id, user_id
activity_log    — id, board_id, user_id, action, entity_type, entity_id, entity_title, metadata
```

**Indexes:** users.email, boards.owner_id, lists.board_id, tasks.list_id, tasks.board_id, activity_log.board_id

---

## 📡 API Documentation

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |

All protected routes require: `Authorization: Bearer <token>`

### Boards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/boards | List my boards |
| POST | /api/boards | Create board |
| GET | /api/boards/:id | Get board + lists + tasks |
| PUT | /api/boards/:id | Update board |
| DELETE | /api/boards/:id | Delete board |
| POST | /api/boards/:id/members | Invite member by email |
| GET | /api/boards/:id/activity | Paginated activity log |

### Lists
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/boards/:boardId/lists | Create list |
| PUT | /api/boards/:boardId/lists/:listId | Rename list |
| DELETE | /api/boards/:boardId/lists/:listId | Delete list |
| PUT | /api/boards/:boardId/lists/reorder | Reorder lists |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/boards/:boardId/tasks | List tasks (search, pagination) |
| POST | /api/boards/:boardId/tasks | Create task |
| GET | /api/boards/:boardId/tasks/:taskId | Get single task |
| PUT | /api/boards/:boardId/tasks/:taskId | Update task |
| DELETE | /api/boards/:boardId/tasks/:taskId | Delete task |
| PUT | /api/boards/:boardId/tasks/move | Move task (drag-drop) |
| POST | /api/boards/:boardId/tasks/:taskId/assign | Assign user |
| DELETE | /api/boards/:boardId/tasks/:taskId/assign/:userId | Unassign user |

---

## 📈 Scalability Considerations

1. **Database:** Replace SQLite with PostgreSQL (change connection string only). Add read replicas for heavy reads.

2. **WebSockets at scale:** Use Redis adapter for Socket.io so multiple Node instances share the same pub/sub. (`socket.io-redis`)

3. **Authentication:** Add refresh token rotation. Consider Redis for token revocation.

4. **File Uploads:** Add S3/Cloudflare R2 for task attachments.

5. **Background Jobs:** Move activity logging to a queue (BullMQ) to avoid blocking API responses.

6. **Caching:** Add Redis caching for board data with cache invalidation on writes.

7. **Horizontal Scaling:** The app is stateless (all state in DB/Redis), so it scales horizontally behind a load balancer.

---

## 🔧 Assumptions & Trade-offs

- **SQLite** chosen over PostgreSQL for zero-setup local dev. Production would use PostgreSQL.
- **No email verification** to reduce setup friction — add Nodemailer for production.
- **Drag-and-drop position** uses integer positions. A LexoRank string strategy would avoid frequent re-ordering writes.
- **File attachments** not implemented — would use S3 + pre-signed URLs.
- **No password reset** — intentional scope reduction for this assignment.
- **Activity log** written synchronously in API handlers — a message queue would be better at scale.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Zustand, React Router 6 |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable |
| HTTP Client | Axios |
| Real-time | Socket.io Client |
| Backend | Express.js, Node.js |
| Real-time Server | Socket.io |
| Database | SQLite3 (WAL mode) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Validation | express-validator |
| Testing | Jest, Supertest |


---

## ✅ Assignment Compliance Checklist

- ✔ Working frontend (SPA)
- ✔ Working backend (REST APIs)
- ✔ Real-time updates (WebSockets)
- ✔ Database schema design
- ✔ State management (Zustand)
- ✔ Activity history tracking
- ✔ Pagination and search
- ✔ API documentation
- ✔ Architecture explanation
- ✔ Demo credentials
- ✔ Local setup instructions
