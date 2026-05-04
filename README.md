# 🏠 HomeFix — AI-Powered Smart Home Services Platform

A full-stack, chat-first home services platform connecting homeowners with nearby service professionals (plumber, electrician, AC technician, carpenter). Users describe issues in natural language, the AI detects intent, matches workers based on skill + location, and manages the full service lifecycle.

---

## ✨ Features

| Feature | Details |
|---|---|
| 💬 Chat-First UI | Describe problems in plain language, AI understands |
| 🤖 Intent Detection | Auto-detects service type, urgency, and cancel/confirm intent |
| 📍 Location Matching | Haversine distance scoring for nearest worker |
| 🔄 Real-time Updates | Socket.io for instant status changes |
| 💰 Razorpay Payments | Secure UPI/card/netbanking payments |
| ⭐ Rating System | Post-service worker ratings |
| 👥 Role-Based Access | User / Worker / Admin separation |
| 🔐 JWT Auth | Secure token-based authentication |

---

## 🗂️ Project Structure

```
homefix/
├── backend/          # Node.js + Express + Prisma
│   ├── prisma/       # Schema & migrations
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── routes/
│       ├── middlewares/
│       ├── socket/
│       ├── lib/
│       └── utils/
└── frontend/         # Next.js 14 + TypeScript + Tailwind
    └── src/
        ├── app/      # App Router pages
        ├── components/
        ├── store/    # Redux slices
        ├── services/ # API clients
        ├── hooks/
        └── utils/
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A [Razorpay](https://razorpay.com) test account

---

### 1. Clone & Install

```bash
git clone <your-repo>
cd homefix

# Install backend deps
cd backend
npm install

# Install frontend deps
cd ../frontend
npm install
```

---

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASS@localhost:5432/homefix"
JWT_SECRET="change-this-to-something-long-and-random"
RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
PORT=5000
CLIENT_URL="http://localhost:3000"
```

---

### 3. Setup Database

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed demo data
node src/prisma/seed.js
```

---

### 4. Configure Frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

---

### 5. Run Development Servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Demo Accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | admin@homefix.com | password123 |
| User | user@homefix.com | password123 |
| Plumber | plumber@homefix.com | password123 |
| Electrician | electric@homefix.com | password123 |
| AC Tech | ac@homefix.com | password123 |
| Carpenter | carpenter@homefix.com | password123 |

---

## 💬 Chat Flow — How It Works

```
User: "My bathroom pipe is leaking badly"
Bot:  Detects → PLUMBER, HIGH urgency
Bot:  "Sounds like you need a plumber! Share your location."

User: "Kozhikode, Kerala" (or shares GPS coords)
Bot:  Creates ServiceRequest → finds nearest available plumber
Bot:  "Found Suresh (~1.2 km away)! Notifying him..."

[Worker gets notified via Socket.io]
Worker: Accepts the job
Bot → User: "Suresh accepted! He's on his way."

Worker: Marks IN_PROGRESS, then COMPLETED
Worker: Sets price ₹500
Bot → User: "Suresh has proposed ₹500. Approve? (Yes/No)"

User: "Yes"
Bot:  Creates Razorpay order → Shows Pay button
User: Completes payment via Razorpay popup
Bot:  "Payment confirmed! Please rate your experience."

User: Submits 5-star rating → Request COMPLETED
```

---

## 🌐 API Reference

### Auth
```
POST /api/auth/register    — Register user/worker
POST /api/auth/login       — Login
GET  /api/auth/me          — Get profile
```

### Chat (User only)
```
POST /api/chat/message          — Send message (main engine)
POST /api/chat/session          — Create new session
GET  /api/chat/sessions         — List sessions
GET  /api/chat/session/:id      — Get session + messages
```

### Requests
```
GET  /api/requests/my           — User's requests
GET  /api/requests/:id          — Get single request
POST /api/requests/:id/cancel   — Cancel request
GET  /api/requests              — All (Admin only)
```

### Workers
```
GET  /api/workers               — List workers (public)
POST /api/workers/availability  — Toggle availability
GET  /api/workers/requests      — Worker's jobs
POST /api/workers/requests/:id/accept    — Accept job
POST /api/workers/requests/:id/reject    — Reject job
PATCH /api/workers/requests/:id/status  — Update status
POST /api/workers/requests/:id/price    — Set price
```

### Payments
```
POST /api/payments/create-order — Create Razorpay order
POST /api/payments/verify       — Verify & confirm payment
GET  /api/payments/:requestId   — Get payment details
```

### Ratings
```
POST /api/ratings               — Submit rating (1–5)
GET  /api/ratings/worker/:id    — Worker's ratings
```

---

## 🔌 Socket.io Events

| Event | Direction | Payload |
|---|---|---|
| `request:assigned` | Server → Worker | `{ requestId, serviceType, description }` |
| `request:accepted` | Server → User | `{ requestId, workerName }` |
| `request:rejected` | Server → User | `{ requestId }` |
| `request:status` | Server → User | `{ requestId, status }` |
| `request:price-set` | Server → User | `{ requestId, price, workerName }` |
| `payment:completed` | Server → Both | `{ requestId, amount }` |
| `worker:location` | Worker → Server | `{ lat, lon }` |

---

## 🔧 Environment Variables

### Backend
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key |
| `PORT` | Server port (default: 5000) |
| `CLIENT_URL` | Frontend URL for CORS |

### Frontend
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.io server URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key |

---

## 🚢 Production Deployment

### Backend (Railway / Render / EC2)
```bash
npm run build  # Not needed for JS
npm start
```

Set `NODE_ENV=production` and all env vars.

### Frontend (Vercel)
```bash
npm run build
```

Push to GitHub → connect to Vercel → add env vars → deploy.

### Database
- Use [Neon](https://neon.tech) or [Supabase](https://supabase.com) for managed PostgreSQL
- Run `npx prisma migrate deploy` for production migrations

---

## 📐 Key Design Decisions

1. **Chat is source of truth for UX** — all user interactions happen through the chatbot
2. **ServiceRequest is source of truth for data** — backend always verifies state
3. **Worker controls price** — user can only approve or decline
4. **Payment is a separate entity** — never embedded in requests
5. **Haversine matching** — distance-weighted scoring (50% distance + 30% rating + 20% workload)

---

## 🛠️ Tech Stack

**Backend:** Node.js · Express.js · Prisma ORM · PostgreSQL · Socket.io · JWT · Razorpay · Winston

**Frontend:** Next.js 14 (App Router) · TypeScript · TailwindCSS · Redux Toolkit · Socket.io-client · Framer Motion ready

---

Built with ❤️ for Kerala homeowners 🏠
