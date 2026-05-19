# Derived.co.in — CSIR UGC NET Coaching Platform

A full-stack coaching website for **derived.co.in**, modelled after Unacademy's CSIR UGC NET goal page.

---

## Project Structure

```
derived-csir-ugc-net/
├── index.html      ← Frontend (single-file, no build step needed)
├── server.js       ← Backend REST API + static site (Node.js + Express)
├── package.json
├── README.md
└── lib/            ← API data & routes (used by server.js)
```

---

## Frontend (`index.html`)

Pure HTML + CSS + vanilla JS. No framework or bundler required.

**Sections:**
- Sticky nav with call CTA and auth buttons
- Goal tabs (Get started, Educators, Batches…)
- Hero with animated stats and feature cards
- Features grid (8 features)
- Subjects (5 CSIR NET streams)
- Educators (4 top educators with stats)
- Subscription plans (Free / Plus / Pro Annual)
- Testimonials (3 success stories)
- FAQ with accordion
- CTA banner + lead registration form
- AI doubt form
- Footer with social links

**Run (API required for live data):**
```bash
npm install
npm start
```
Open **http://localhost:3001**

Or static-only preview (fallback content in HTML until API loads):
```bash
npx serve .
```
Use `npm start` for full API-driven sections.

---

## Backend (`server.js`)

Express REST API with the following endpoints:

| Method | Endpoint              | Description                        |
|--------|-----------------------|------------------------------------|
| GET    | /api/health           | Health check                       |
| GET    | /api/goal/stats       | Hero stats (learners, educators…)  |
| GET    | /api/subjects         | All 5 CSIR NET subjects            |
| GET    | /api/subjects/:slug   | Single subject by slug             |
| GET    | /api/educators        | All educators (filter by ?subject) |
| GET    | /api/educators/:id    | Single educator                    |
| GET    | /api/plans            | Subscription plans                 |
| GET    | /api/plans/:id        | Single plan                        |
| GET    | /api/testimonials     | Student success stories            |
| GET    | /api/faqs             | FAQ list                           |
| POST   | /api/leads            | Lead capture / registration        |
| POST   | /api/subscribe        | Create subscription order          |
| POST   | /api/doubts           | AI doubt resolution (placeholder)  |

**Install & run:**
```bash
npm install
npm run dev       # development (nodemon)
npm start         # production
```

API and site run on **http://localhost:3001** by default (`PORT` env to override).

Leads are persisted to `data/leads.json`.

---

## Production Checklist

- [ ] Replace JSON file store with PostgreSQL or MongoDB
- [ ] Add JWT authentication (`/api/auth/login`, `/api/auth/register`)
- [ ] Integrate Razorpay for subscription payments
- [ ] Connect `/api/doubts` to Anthropic Claude or OpenAI API
- [ ] Add email service (SendGrid / Resend) for lead nurturing
- [ ] Deploy frontend to Vercel / Netlify (or keep single Node service)
- [ ] Deploy backend to Railway / Render / AWS
- [ ] Add SSL and set `NODE_ENV=production`
