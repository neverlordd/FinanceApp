# Finance Tracker & Forecaster

A web application and Telegram Mini App for monthly budgeting and savings forecasts.

## Features

- monthly income, expenses, and payment status;
- balance and savings forecasts;
- transaction conversion to USD;
- separate data for every Telegram user;
- an isolated, secure session when opened in a regular browser;
- persistent MySQL or PostgreSQL storage.

## Local Development

```bash
npm install
npm run dev
```

Without a database configuration, the development server uses temporary in-memory storage and clearly marks it in the interface. This data is cleared after a restart. Configure MySQL or PostgreSQL in `.env.local` if you need persistent development data.

## Environment Variables

Copy `.env.example` and configure:

- `DATABASE_URL` — a MySQL or PostgreSQL connection string;
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` — an alternative way to configure Hostinger MySQL;
- `BOT_TOKEN` — Telegram bot token from `@BotFather`;
- `SESSION_SECRET` — a long random value used to sign browser sessions;
- `PORT` — optional HTTP port;
- `DATABASE_SSL` — set to `true` if your provider requires explicit TLS configuration.

Production startup is blocked unless a persistent database is configured. The `finance_user_data` table is created automatically, and every successful edit is written to it before the interface displays **Saved**.

## Hosting

Standard Node.js configuration:

```text
Build command: npm ci && npm run build
Start command: npm start
Health check: /api/health
```

A `Dockerfile` is also included. The server must be available over HTTPS and connected to persistent MySQL or PostgreSQL storage. User data is never stored in local files.

### Hostinger

1. Create a MySQL database in hPanel.
2. Add its credentials using either a `mysql://` `DATABASE_URL` or the five `MYSQL_*` variables shown in `.env.example`. On Hostinger managed hosting, the database host is normally `localhost` and the port is `3306`.
3. Deploy the GitHub repository as a Node.js Web App with `npm ci && npm run build` as the build command and `npm start` as the start command.
4. Open `/api/health` and confirm that it reports `"persistent": true` before entering real data.

## Telegram Mini App Setup

1. Create or open your bot in `@BotFather`.
2. Open **Configure Mini App** in the bot settings and enter the public HTTPS application URL.
3. Add `BOT_TOKEN`, persistent database settings, and `SESSION_SECRET` to your hosting environment.
4. Open the Mini App from the bot menu or profile.

The client sends `Telegram.WebApp.initData` with every API request. The server validates its HMAC signature and age before identifying the user. `initDataUnsafe` is not used for authorization.

## Verification

```bash
npm run lint
npm run build
npm start
```
