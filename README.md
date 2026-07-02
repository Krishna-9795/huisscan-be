# HuisScan Backend

Clean Fastify + TypeScript backend for the HuisScan / HuisValue property report app.

## Tech Stack

- Fastify
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication
- Zod validation
- bcrypt password hashing

## Project Structure

```txt
src/
  app.ts                 # Creates and wires the Fastify app
  server.ts              # Starts the HTTP server

  config/                # Environment validation
  plugins/               # Fastify plugins: Prisma, CORS, sensible, JWT
  routes/                # Endpoint definitions only
  controllers/           # Request/response handling
  services/              # Business logic
  repositories/          # Prisma database queries
  models/                # TypeScript response/domain types
  schemas/               # Zod request validation
  helpers/               # Reusable utilities
  middlewares/           # Auth and admin checks
  types/                 # Fastify type augmentation

prisma/
  schema.prisma          # Database schema
```

## Setup

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Set `.env` values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="change-me"
PORT=4000
API_PREFIX="/api/v1"
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
PUBLIC_APP_URL="http://localhost:3000"
# Backend origin only. Do not include API_PREFIX here.
PUBLIC_API_URL="https://your-public-backend-url.example.com"
MOLLIE_TEST_API_KEY="test_xxx"
# MOLLIE_API_KEY="live_xxx"
```

For local development, `PUBLIC_API_URL="http://localhost:4000"` is enough for
Mollie return redirects. Webhooks are only sent to Mollie when the backend URL is
public HTTPS, because Mollie cannot reach `localhost` from its servers.

Generate Prisma client:

```bash
npm run db:generate
```

Run the first migration:

```bash
npm run db:migrate
```

Start the dev server:

```bash
npm run dev
```

The API runs at `http://localhost:4000/api/v1`.

For same-server production deployment behind an existing frontend, see
`deploy/same-server.md`. In that setup, use `API_PREFIX="/api/v1"` and proxy
`/api/*` to this backend.

## Running the App

Run in development mode:

```bash
npm run dev
```

Build the TypeScript project:

```bash
npm run build
```

Run the compiled production build:

```bash
npm start
```

Open Prisma Studio to inspect database records:

```bash
npm run db:studio
```

## Database Migration Commands

Generate the Prisma client after changing `prisma/schema.prisma`:

```bash
npm run db:generate
```

Create and apply a new local migration:

```bash
npm run db:migrate
```

Apply existing migrations in production or staging:

```bash
npm run db:deploy
```

## Scripts

- `npm run dev` - start development server with `tsx`
- `npm run build` - compile TypeScript
- `npm start` - run compiled JavaScript from `dist`
- `npm run db:generate` - generate Prisma client
- `npm run db:migrate` - run local Prisma migrations
- `npm run db:deploy` - apply migrations in production
- `npm run db:studio` - open Prisma Studio

## Endpoints

Health:

- `GET /api/v1/health`

First-party API routes are mounted under `API_PREFIX`, which defaults to
`/api/v1`.

Auth:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`

Users:

- `POST /api/v1/users`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/users` - admin only
- `GET /api/v1/users/:id` - admin only

Saved reports:

- `POST /api/v1/saved-reports`
- `GET /api/v1/saved-reports`
- `GET /api/v1/saved-reports/:id`
- `DELETE /api/v1/saved-reports/:id`

Invoices:

- `GET /api/v1/invoices?user_id=<userId>`
- `GET /api/v1/invoices/:id?user_id=<userId>`

Payments:

- `GET /api/v1/payments` - current user's payment history
- `POST /api/v1/payments/mollie/create`
- `GET /api/v1/payments/mollie/return`
- `POST /api/v1/payments/mollie/webhook`

Address search access:

- `GET /api/v1/address-searches` - current user's tracked address searches
- `GET /api/v1/address-searches/access?reportType=property-report&address=...` -
  returns whether the same paid address can be reused without payment inside
  the 24-hour access window

Protected routes require:

```txt
Authorization: Bearer YOUR_JWT_TOKEN
```

## Curl Examples

Health:

```bash
curl http://localhost:4000/api/v1/health
```

Register:

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "name": "Home Owner",
    "password": "password123"
  }'
```

Login:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "password": "password123"
  }'
```

Create a user profile:

```bash
curl -X POST http://localhost:4000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vinod",
    "email": "vinod@example.com",
    "phone": "+31612345678",
    "city": "Amsterdam",
    "avatarColor": "brand",
    "plan": "FREE",
    "preferences": {
      "budgetMin": 300000,
      "budgetMax": 600000,
      "preferredCities": ["Amsterdam", "Hoofddorp"],
      "propertyType": "HOUSE",
      "bedroomsMin": 2,
      "buyingStage": "SEARCHING"
    }
  }'
```

Get current user:

```bash
curl http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Update current user:

```bash
curl -X PATCH http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+31612345678",
    "city": "Amsterdam"
  }'
```

Create a saved report:

```bash
curl -X POST http://localhost:4000/api/v1/saved-reports \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "house-123",
    "address": "Keizersgracht 1, Amsterdam",
    "reportData": {
      "estimatedValue": 650000,
      "energyLabel": "A"
    }
  }'
```

List saved reports:

```bash
curl http://localhost:4000/api/v1/saved-reports \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

List invoices:

```bash
curl http://localhost:4000/api/v1/invoices?user_id=1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Logout:

```bash
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Architecture Notes

- Routes only define URLs and connect to controllers.
- Controllers validate request data and return responses.
- Services contain business logic and access rules.
- Repositories contain Prisma database queries.
- Models contain API-safe TypeScript types.
- Schemas contain Zod validation.
- Helpers contain reusable utilities.
- Middleware handles authentication and admin-only access.
- `passwordHash` is never returned from API responses.
