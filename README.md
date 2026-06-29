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
API_PREFIX=""
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
PUBLIC_APP_URL="http://localhost:3000"
MOLLIE_TEST_API_KEY="test_xxx"
# MOLLIE_API_KEY="live_xxx"
```

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

The API runs at `http://localhost:4000`.

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

- `GET /health`

When `API_PREFIX="/api/v1"` is set in production, the same route becomes
`GET /api/v1/health`.

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

Users:

- `POST /users`
- `GET /users/me`
- `PATCH /users/me`
- `GET /users` - admin only
- `GET /users/:id` - admin only

Saved reports:

- `POST /saved-reports`
- `GET /saved-reports`
- `GET /saved-reports/:id`
- `DELETE /saved-reports/:id`

Invoices:

- `GET /invoices`
- `GET /invoices/:id`

Payments:

- `POST /payments/mollie/create`
- `GET /payments/mollie/return`
- `POST /payments/mollie/webhook`

Protected routes require:

```txt
Authorization: Bearer YOUR_JWT_TOKEN
```

## Curl Examples

Health:

```bash
curl http://localhost:4000/health
```

Register:

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "name": "Home Owner",
    "password": "password123"
  }'
```

Login:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "password": "password123"
  }'
```

Create a user profile:

```bash
curl -X POST http://localhost:4000/users \
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
curl http://localhost:4000/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Update current user:

```bash
curl -X PATCH http://localhost:4000/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+31612345678",
    "city": "Amsterdam"
  }'
```

Create a saved report:

```bash
curl -X POST http://localhost:4000/saved-reports \
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
curl http://localhost:4000/saved-reports \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

List invoices:

```bash
curl http://localhost:4000/invoices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Logout:

```bash
curl -X POST http://localhost:4000/auth/logout \
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
