# Donation Hub

Donation Hub connects people who want to donate useful items with people who
need those items. Donate something you no longer need, or ask the
community for something you're looking for - Donation Hub matches by
category, condition, and distance, and handles the rest of the flow from
approval through self pickup.

## Features

- User authentication with persistent login (short-lived access tokens +
  long-lived refresh tokens)
- Donation management: list items with photos, browse, filter, search
- Request management: post what you need, browse open requests
- Location-based matching (category → condition → availability → distance)
- Transaction approval flow with double-booking protection
- Donor ↔ recipient real-time chat (Socket.IO), persisted via REST
- Self pickup scheduling
- Database-backed notifications
- Homepage impact counter, driven only by completed transactions
- Cloudinary image storage
- Minimal admin moderation (view users, ban/unban)
- **Dynamic, AI-assisted item categories** - no hardcoded category list
  anywhere in the code; categories live in MongoDB and grow as users
  (with AI help) describe new kinds of items
- **AI category suggestion** from free text and/or a photo (OpenAI GPT
  vision + text embeddings), with the user always able to accept, pick a
  different category, or create a new one
- **Semantic donation ↔ request matching** - requests are matched against
  donations by meaning (embedding similarity), not just exact category
  equality, blended with category/location/condition/recency
- Rate limiting, Helmet security headers, and a `/api/health` endpoint

## Tech stack

- **Frontend:** React (Vite), React Router, Axios, Socket.IO client
- **Backend:** Node.js, Express, MongoDB (Mongoose), Socket.IO, JWT,
  Cloudinary, Helmet, express-rate-limit
- **AI:** OpenAI (`gpt-4o-mini` for vision/text, `text-embedding-3-small`
  for embeddings) via a provider-abstracted service layer

## Architecture

```
React Frontend
      │
 ┌────┴─────┐
 │          │
REST     Socket.IO
 │          │
 │      Donor ↔ Recipient Chat only
 │
Express → Controllers → Mongoose → MongoDB
```

- **REST is the source of truth** for every piece of data: users,
  donations, requests, transactions, messages, and notifications are all
  read and written over plain HTTP endpoints.
- **Socket.IO's only job is real-time chat delivery.** It authenticates
  each connection from the same JWT access token used for REST calls, and
  pushes newly-sent messages to the other participant in a transaction's
  chat room. It never carries notifications, matching results, or the
  homepage counter.
- **Notifications are MongoDB records delivered over REST.** Transaction
  requests/responses, pickup proposals, and completions each create a
  `Notification` document that the frontend polls via `GET /api/notifications`.
- **Authentication** uses a short-lived JWT access token (kept in frontend
  memory only) and a long-lived, HttpOnly-cookie-based refresh token
  (only its hash is stored in the database, in a `Session` collection).
  This is what makes login survive a browser refresh without ever putting
  a long-lived token in `localStorage`.

## Dynamic category system

Categories are **never** hardcoded in frontend or backend code. They live in
the `Category` collection (`backend/src/models/Category.js`) and are always
fetched by the frontend from `GET /api/categories`.

- A user describes an item/request in free text (and, for donations,
  optionally a photo).
- `POST /api/categories/suggest` embeds that text (and classifies the photo,
  if given) and compares it against every existing category's embedding
  using cosine similarity - run in application code, since this project
  targets plain/self-hosted MongoDB rather than Atlas Vector Search. If
  Atlas Vector Search becomes available, `services/ai/embeddingService.js`'s
  `rankBySimilarity` is the only place that would need to change to a
  `$vectorSearch` aggregation.
- Above a high-confidence threshold, the match is suggested prominently;
  below a low-confidence threshold, the AI instead proposes a brand-new
  category name.
- The user always makes the final call (accept / choose another / create
  new) - the AI never silently assigns a category.
- Before any new category is actually inserted, `getOrCreateCategory`
  checks for a near-duplicate (exact slug match, or ≥0.9 embedding
  similarity) so "Baby Equipment", "Baby Gear", and "Baby items" collapse
  into one category instead of three.
- `npm run seed-categories` (backend) optionally seeds a small starter set
  so a brand-new deployment isn't an empty dropdown on day one - this is a
  one-time convenience script, not something the application logic depends
  on, and the taxonomy grows from there.

Confidence bands (tunable via `AI_HIGH_CONFIDENCE_THRESHOLD` /
`AI_LOW_CONFIDENCE_THRESHOLD`):

| Band   | Cosine similarity | Behavior                                   |
|--------|--------------------|---------------------------------------------|
| High   | ≥ 0.82 (default)   | Suggestion shown prominently, one-click accept |
| Medium | 0.62 – 0.82        | Suggestion shown, easy to override           |
| Low    | < 0.62             | AI instead proposes a new category name      |

## AI architecture

```
React (DonationForm / RequestForm)
        │  text + optional photo (data: URI)
        ▼
POST /api/categories/suggest   (authenticated, rate-limited)
        │
services/ai/categoryService.js ──────────┐
        │                                  │
services/ai/imageClassificationService.js  │  services/ai/embeddingService.js
        │ (vision)                         │  (cosine similarity, pure JS)
        ▼                                  ▼
services/ai/providerClient.js  (the ONLY file that calls the OpenAI SDK)
        │
     OpenAI API
```

- The frontend never talks to OpenAI directly, and `AI_API_KEY` is never
  sent to the client.
- Every AI call is wrapped so a failure (missing key, timeout, provider
  outage) returns `{ aiAvailable: false }` rather than a 500. Donation and
  request creation, search, and manual category selection all keep working
  with AI fully down - AI is an enhancement, not a dependency.
- Semantic matching (`services/ai/matchingService.js`) scores
  donation/request pairs as a documented weighted sum: **semantic
  similarity 45%, category match 25%, location 15%, condition 10%,
  recency 5%**. If either side is missing an embedding (created while AI
  was down), the semantic weight is redistributed across the remaining
  signals instead of zeroing the match out.

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in MONGO_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, CLOUDINARY_*
npm run dev            # http://localhost:5000
```

To create your first admin user (the API never accepts `isAdmin` from a
client, so this has to be done directly):

```bash
npm run make-admin -- someone@example.com
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # fill in VITE_API_BASE_URL, VITE_GOOGLE_MAPS_API_KEY, VITE_GOOGLE_MAP_ID
npm run dev            # http://localhost:5173
```

### Environment variables

**Backend**
```
MONGO_URL
PORT
NODE_ENV
FRONT_URL

JWT_SECRET
JWT_EXPIRES_IN

REFRESH_TOKEN_SECRET
REFRESH_TOKEN_EXPIRES_IN

MATCH_DISTANCE_KM

CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

# AI - optional; every feature degrades gracefully without these set
AI_PROVIDER=openai
AI_API_KEY
AI_MODEL=gpt-4o-mini
VISION_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
AI_TIMEOUT_MS=10000
AI_HIGH_CONFIDENCE_THRESHOLD=0.82
AI_LOW_CONFIDENCE_THRESHOLD=0.62
```

Run `npm run seed-categories` once after setting `MONGO_URL` (and ideally
`AI_API_KEY`, so the starter categories get embeddings immediately).

**Frontend**
```
VITE_API_BASE_URL
VITE_GOOGLE_MAPS_API_KEY
VITE_GOOGLE_MAP_ID
```

## API overview

```
POST   /api/users/register
POST   /api/users/login
POST   /api/users/refresh
POST   /api/users/logout
GET    /api/users/authCheck
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id

GET    /api/donations
GET    /api/donations/mine
POST   /api/donations
GET    /api/donations/:id

GET    /api/requests
POST   /api/requests
GET    /api/requests/mine
GET    /api/requests/:id/matches

GET    /api/categories
POST   /api/categories
POST   /api/categories/suggest

GET    /api/health

GET    /api/transactions/mine
GET    /api/transactions/approvals
POST   /api/transactions
POST   /api/transactions/offer
GET    /api/transactions/:transactionId
POST   /api/transactions/:transactionId/respond
POST   /api/transactions/:transactionId/pickup
POST   /api/transactions/:transactionId/complete
POST   /api/transactions/:transactionId/cancel

GET    /api/messages/:transactionId
POST   /api/messages/:transactionId
PATCH  /api/messages/:transactionId/read

GET    /api/notifications
PATCH  /api/notifications/:notificationId/read
DELETE /api/notifications/:notificationId

GET    /api/impact

GET    /api/admin/stats
GET    /api/admin/users
PATCH  /api/admin/users/:id/ban
GET    /api/admin/donations
```

## Known limitations / suggested next steps

This pass focused on: fixing the pickup-notification bug, core API
security (Helmet, rate limiting, body limits), and the full dynamic
category + AI layer (suggestion, image classification, semantic
matching). Deliberately left for a follow-up phase, in priority order:

1. **Automated tests** - no Jest/Mocha suite exists yet, including the
   concurrency test for simultaneous donation claims. The underlying
   atomic `findOneAndUpdate` logic was verified by code inspection, not
   by an automated concurrent-request test.
2. **Real-time donation/transaction feed** - Socket.IO is still scoped to
   chat only; `donationCreated`/`transactionUpdated` push events aren't
   implemented, so browsing/transaction-status views rely on REST
   refresh rather than live push.
3. **Trust & safety** - reporting, blocking, and community guidelines
   pages don't exist yet.
4. **Atlas Vector Search** - category/matching similarity runs in Node
   (cosine similarity over a `.lean()` query) because this deployment
   targets plain MongoDB. Fine at the scale a starter category list and a
   few thousand items implies; revisit if the catalog grows much larger.
5. **UI redesign** - the visual design itself (Part 46 of the original
   brief) hasn't been touched in this pass; only the category/AI UX was
   added, using the app's existing design tokens.
