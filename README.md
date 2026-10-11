# Zoon

## Home repairs, handled in one conversation.

Zoon connects homeowners with trusted local professionals for everyday repairs. Describe what went wrong in natural language, share your location, and follow the job from the first message to payment and review.

Built for homeowners and service professionals in Kerala.

## What you can do with Zoon

### For homeowners

- Explain a repair in your own words through FixBot.
- Find nearby professionals for plumbing, electrical work, AC service, carpentry, and more.
- Share photos, voice notes, and your service location.
- Track requests, appointments, messages, pricing, and payments in one place.
- Pay securely and rate the completed service.

### For professionals

- Create a professional profile and submit verification documents.
- Receive nearby service requests that match your skills.
- Accept or decline jobs, schedule visits, and message customers.
- Update job progress, share a final price, and track earnings.

## How it works

1. Tell Zoon what needs fixing.
2. Confirm your service location and details.
3. Choose a matched professional.
4. Follow the visit and conversation in real time.
5. Approve the price, pay securely, and leave a review.

## Product highlights

- Chat-first service requests
- Location-aware professional matching
- Real-time updates with Socket.IO
- Appointment scheduling and live visit tracking
- Secure Razorpay payments
- Photo and voice-note attachments
- Professional verification workflow
- Separate homeowner, professional, and admin workspaces
- Light and dark themes with a shared Zoon brand system

## Run Zoon locally

### Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer
- A Razorpay test account for payment testing

### Install dependencies

From the repository root:

```bash
npm run install:all
```

### Configure the backend

Create `backend/.env` with values for your local environment:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/zoon"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=5000
CLIENT_URL="http://localhost:3000"
RAZORPAY_KEY_ID="rzp_test_your_key"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
```

Optional integrations such as AWS storage, identity checks, email, and AI responses can be configured through the backend service environment variables when those features are enabled.

### Configure the frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key
```

### Prepare the database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### Start the app

Use two terminals:

```bash
# Terminal 1
npm run dev:backend
```

```bash
# Terminal 2
npm run dev:frontend
```

Then open [http://localhost:3000](http://localhost:3000).

## Project layout

```text
Zoon/
├── backend/     Express API, Prisma schema, services, payments, and sockets
├── frontend/    Next.js application, pages, components, and client state
├── .github/     Deployment workflow configuration
├── package.json Shared local development commands
└── README.md    Project documentation
```

## Production notes

- Set strong production secrets for JWT, database access, payments, storage, and external services.
- Run Prisma migrations with `npm run db:deploy` from `backend`.
- Deploy the frontend to a Next.js-compatible host such as Vercel.
- Set `CLIENT_URL` and the frontend API/socket URLs to the deployed domains.
- Never commit `.env`, `.env.local`, payment secrets, or private identity documents.

## License

This project is currently maintained as a private application codebase.
