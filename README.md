# Finance Tracker & Forecaster

A web application and Telegram Mini App for monthly budgeting and savings forecasts.

## Features

- monthly income, expenses, and payment status;
- balance and savings forecasts;
- transaction conversion to USD;
- separate data for every Telegram user;
- an isolated, secure session when opened in a regular browser;
- persistent PostgreSQL storage.

## Local Development

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, the development server uses temporary in-memory storage. This data is cleared after a restart. Configure PostgreSQL in `.env.local` if you need persistent development data.

## Environment Variables

Copy `.env.example` and configure:

- `DATABASE_URL` — PostgreSQL connection string; required in production;
- `BOT_TOKEN` — Telegram bot token from `@BotFather`;
- `SESSION_SECRET` — a long random value used to sign browser sessions;
- `PORT` — optional HTTP port;
- `DATABASE_SSL` — set to `true` if your provider requires explicit TLS configuration.

The `finance_user_data` table is created automatically on startup.

## Hosting

Standard Node.js configuration:

```text
Build command: npm ci && npm run build
Start command: npm start
Health check: /api/health
```

A `Dockerfile` is also included. The server must be available over HTTPS and connected to persistent PostgreSQL storage. User data is never stored in local files.

## Telegram Mini App Setup

1. Create or open your bot in `@BotFather`.
2. Open **Configure Mini App** in the bot settings and enter the public HTTPS application URL.
3. Add `BOT_TOKEN`, `DATABASE_URL`, and `SESSION_SECRET` to your hosting environment.
4. Open the Mini App from the bot menu or profile.

The client sends `Telegram.WebApp.initData` with every API request. The server validates its HMAC signature and age before identifying the user. `initDataUnsafe` is not used for authorization.

## Verification

```bash
npm run lint
npm run build
npm start
```
