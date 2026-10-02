# Donation Hub

Donation Hub is a full-stack community platform for sharing useful items. People can list donations, request items, discover nearby matches, coordinate a self-pickup, and confirm when an item has been received.

# Live Link ** https://frontend-eazs.onrender.com

## Features

- Account registration and login with short-lived JWT access tokens and HttpOnly refresh-token cookies.
- Donation listings with photos, search, category and condition filters.
- Requests for items and location-aware donation/request matching.
- AI-assisted category suggestions from item text and, for donations, an optional image.
- Categories stored in MongoDB with canonical names and aliases, such as `Bicycles` with aliases for `bike` and `cycle`.
- Existing-category recommendations, confidence bands, and user-confirmed creation when no existing category fits. AI never creates a category automatically.
- Transaction approval with protection against two recipients claiming the same donation.
- Recipient-proposed pickup scheduling; donors can accept, decline, or counter-propose. The recipient confirms receipt to complete the donation.
- Transaction chat with REST persistence and Socket.IO message delivery.
- Database-backed notifications, homepage impact counts, and admin moderation.
- Cloudinary image uploads, Helmet security headers, rate limiting, and an API health endpoint.

## Technology

- **Frontend:** React 19, Vite, React Router, Axios, Socket.IO client.
- **Backend:** Node.js, Express, MongoDB, Mongoose, JWT, Socket.IO.
- **AI:** Gemini through the backend provider abstraction in `backend/src/services/ai/providerClient.js`. The frontend never receives the AI API key.
- **Image storage:** Cloudinary.

## Project structure

```text
backend/
  src/
    controllers/       HTTP handlers
    middlewares/       Authentication, uploads, validation, rate limits
    models/            MongoDB/Mongoose models
    routes/            Express API routes
    scripts/           Admin and category setup commands
    services/ai/        Provider, category, image, embedding, and matching services
frontend/
  src/
    api/               Axios API modules
    components/        Shared UI components
    contexts/          Authentication and Socket.IO contexts
    pages/             Application screens
```

## Requirements

- Node.js 20 or newer is recommended.
- MongoDB connection string.
- Cloudinary credentials for photo uploads.
- An AI provider API key is optional. Without a working AI provider, users can still choose an existing category manually and create donations and requests.

## Configuration

There are no checked-in `.env.example` files. Create `backend/.env` and `frontend/.env` locally. Never commit either file or put the backend AI key in a `VITE_` variable.

### Backend environment

```dotenv
PORT=5000
NODE_ENV=development
FRONT_URL=http://localhost:5173
MONGO_URL=mongodb://127.0.0.1:27017/donationhub

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=replace-with-another-long-random-secret
REFRESH_TOKEN_EXPIRES_IN=7d

MATCH_DISTANCE_KM=25

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret

AI_PROVIDER=gemini
AI_API_KEY=your-gemini-api-key
AI_MODEL=gemini-3.5-flash-lite
VISION_MODEL=gemini-3.5-flash-lite
EMBEDDING_MODEL=gemini-embedding-2
AI_TIMEOUT_MS=100000
AI_HIGH_CONFIDENCE_THRESHOLD=0.82
AI_LOW_CONFIDENCE_THRESHOLD=0.62
```

For OpenAI, set `AI_PROVIDER=openai` and use model names supported by your OpenAI account. Gemini vision and text generation may have separate quota limits; an AI outage falls back to manual category selection.

### Frontend environment

```dotenv
VITE_API_BASE_URL=http://localhost:5000
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_GOOGLE_MAP_ID=your-google-map-id
```

The frontend variables are embedded into the browser build. Do not put private keys or secrets in them.

## Install and run

Install and run the backend in one terminal:

```powershell
cd backend
npm install
npm run dev
```

Install and run the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the frontend terminal, usually `http://localhost:5173`. The backend defaults to port `5000`; make sure that port is free and that `VITE_API_BASE_URL` matches the backend port. Run only one backend process on a given port.

Production frontend checks/build:

```powershell
cd frontend
npm run lint
npm run build
```

## First-time database setup

Seed the starter canonical categories after configuring the backend and MongoDB:

```powershell
cd backend
npm run seed-categories
```

This is safe to run again. It preserves existing categories and updates the starter aliases, including the `Bicycles` and `Backpacks / School Bags` canonical categories.

Create a user in the application first, then promote that account to admin when needed:

```powershell
cd backend
npm run make-admin -- user@example.com
```

## AI category flow

1. The user enters an item title/description and may attach a photo on the donation form.
2. The backend uses the configured provider to analyze the text and optional image, then compares the result against categories stored in MongoDB.
3. A canonical category with a high or medium confidence score is suggested. The user chooses whether to use it; the category dropdown remains available for manual selection.
4. If no existing category meets the low-confidence threshold, AI may propose a short canonical name and related tags. The backend checks the proposal against existing names, aliases, and embeddings for likely duplicates.
5. A genuinely new category is added only after the user confirms. Its related terms are stored as aliases so future items map to the same canonical category.
6. Missing keys, provider errors, quota limits, timeouts, or unusable responses leave the existing category dropdown available. They do not prevent donation or request creation.

Thresholds are configured with `AI_HIGH_CONFIDENCE_THRESHOLD` and `AI_LOW_CONFIDENCE_THRESHOLD`. Defaults are `0.82` and `0.62`. Categories and aliases are stored in `backend/src/models/Category.js`; suggestion and duplicate checks are in `backend/src/services/ai/categoryService.js`.

## Main API routes

All routes are mounted under `/api`. Most write and user-specific routes require an access token, except registration, login, refresh, logout, public category listing, and health.

| Area | Routes |
|---|---|
| Authentication | `POST /users/register`, `POST /users/login`, `POST /users/refresh`, `POST /users/logout`, `GET /users/authCheck` |
| Donations | `GET /donations`, `GET /donations/mine`, `POST /donations`, `GET /donations/:id` |
| Requests | `GET /requests`, `POST /requests`, `GET /requests/mine`, `GET /requests/:id/matches` |
| Categories | `GET /categories`, `POST /categories/suggest`, `POST /categories` |
| Transactions | `GET /transactions/mine`, `GET /transactions/approvals`, `POST /transactions`, `POST /transactions/offer`, `GET /transactions/:transactionId` |
| Transaction actions | `POST /transactions/:transactionId/respond`, `POST /transactions/:transactionId/pickup`, `POST /transactions/:transactionId/pickup/respond`, `POST /transactions/:transactionId/complete`, `POST /transactions/:transactionId/cancel` |
| Chat | `GET /messages/:transactionId`, `POST /messages/:transactionId`, `PATCH /messages/:transactionId/read` |
| Notifications | `GET /notifications`, `PATCH /notifications/:notificationId/read`, `DELETE /notifications/:notificationId` |
| Impact and health | `GET /impact`, `GET /health` |
| Admin | `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/:id/ban`, `GET /admin/donations` |

## Data and real-time behavior

REST endpoints and MongoDB are the source of truth for users, listings, requests, transactions, notifications, and messages. Socket.IO is used for real-time transaction chat delivery. Successful-donation impact counts are based on transactions marked `completed` after the recipient confirms receipt.

## Tests

The frontend provides `npm run lint` and `npm run build`. The backend package declares `npm test`, but this repository currently does not include the configured `backend/src/tests` directory, so automated backend tests are not available yet.
