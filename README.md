# WolfLink

**Stay Connected.**

WolfLink is a one-to-one real-time chat app, built phase by phase as a beginner-friendly portfolio project. Its visual direction follows your supplied references: deep greens, restrained gold accents, warm off-white surfaces, and a responsive conversation-first layout.

## Project structure

- `client/` — React, Vite, and Tailwind CSS frontend
- `server/` — Express API and Mongoose database connection
- `architecher.md` — project architecture, data flow, deployment option, and interview guide

## Requirements

- Node.js 20.19+ (the Vite version in use requires this or newer supported Node releases)
- npm
- MongoDB for database-backed API readiness

## Local setup

1. Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI` in `server/.env` to a local or hosted MongoDB connection string. The example uses `127.0.0.1` to avoid local IPv6 resolution surprises.
3. Set independent random values for `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `OTP_HASH_SECRET` (each at least 32 characters). Generate them locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Keep the values private and separate from production credentials.
4. Install dependencies from each app folder:

   ```sh
   cd server
   npm install
   cd ../client
   npm install
   ```

5. Start the API and frontend in separate terminals, from their respective folders:

   Server terminal: `cd server` then `npm run dev`
   Client terminal: `cd client` then `npm run dev`

6. Open the Vite URL printed by the frontend (normally `http://localhost:5173`). The frontend proxies `/api` and `/socket.io` requests to the local API.

The API exposes `GET /api/health` for liveness and `GET /api/ready` for readiness. Readiness returns HTTP 503 until MongoDB connects. Email verification is optional during signup: users can skip it and verify later in Account Settings. An unverified account cannot use conversation features. SMTP delivery is optional for local startup; without working mail delivery, signup remains available and verification can be retried from Settings.

## Commands

Run commands from the named folder:

| Command | Purpose | Requirements |
|---|---|---|
| `server: npm run dev` | Start Express API and Socket.IO with watch mode | `server/.env`; MongoDB for data routes |
| `client: npm run dev` | Start Vite frontend | `client/.env` optional |
| `client: npm run build` | Create the production frontend bundle in `client/dist` | No running services |
| `server: npm test` | Run offline security, validation, and configuration unit checks | No MongoDB |
| `server: npm run test:integration` | Run auth, OTP, privacy, conversation, message, and socket integration checks | MongoDB reachable at `MONGODB_URI`; tests create and drop uniquely named test databases |
| `server: npm start` | Start the API and Socket.IO server for a deployment host | `server/.env`; MongoDB |

The unit suite is intentionally separate from integration tests so contributors can run fast checks without credentials or local infrastructure.

## Environment variables

| Variable | Package | Purpose |
|---|---|---|
| `NODE_ENV` | Server | Runtime mode (`development` locally) |
| `PORT` | Server | API listening port |
| `CLIENT_ORIGIN` | Server | Exact allowed browser origin for credentialed CORS |
| `MONGODB_URI` | Server | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` | Server | Private signing secret for short-lived access cookies |
| `REFRESH_TOKEN_SECRET` | Server | Separate private signing secret for rotating refresh cookies |
| `OTP_HASH_SECRET` | Server | Private HMAC key used to hash purpose-bound OTPs at rest |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Server | SMTP delivery configuration for verification email |
| `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` / `SMTP_PASS` | Server | Optional SMTP TLS/authentication settings; either password name is accepted |
| `COOKIE_SAME_SITE` | Server | `lax` by default; use `none` only for a cross-site HTTPS deployment |
| `COOKIE_SECURE` | Server | Defaults to false locally and true in production; production must use secure cookies |
| `VITE_API_URL` | Client | Public API base URL; can stay unset locally to use the Vite proxy |
| `VITE_SOCKET_URL` | Client | Optional Socket.IO origin override; defaults to the API origin or current page origin |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Server | Optional, configure all three to enable signed profile photo uploads |

Do not put secrets in client variables. Real `.env` files are ignored by Git; only placeholder examples belong in version control.

## Authentication

Registration requires a unique username, display name, email, and password. Signup also asks for confirm password and validates it in the browser; that confirmation is never sent to the API. Phone stays optional. Sign-in accepts one identifier field containing the account email, username, or full international phone number. Registration creates an account and session and, when SMTP delivery works, sends a six-digit email-verification code. Users can skip verification and verify later in Account Settings, but must verify before using conversation features. The code is HMAC-hashed at rest with a server-only key, expires after 10 minutes, allows five attempts, and can be consumed once. Password-reset and email-verification OTPs use distinct purpose-specific fields and hashes. Configure `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM`; authenticated delivery accepts either `SMTP_USER` + `SMTP_PASSWORD` or `SMTP_USER` + `SMTP_PASS`. Partial credentials and conflicting password aliases are configuration errors. From `server/`, run `npm run check:smtp` to test SMTP connection/auth only; it never sends an email. Real mailbox delivery still needs to be confirmed separately.

Phone numbers are optional and normalized to E.164 strings. They remain private by default; exact phone search returns a match only when its owner explicitly enables public phone visibility. Username and display-name search do not expose phone numbers. The existing-data username dry run found no accounts needing backfill. For future migration checks, run `npm run backfill:usernames` from `server/` for a dry-run summary, then add `-- --apply` only when records need repair. The script does not print duplicate phone values and refuses to apply indexes while duplicate phone values remain.

Users receive HTTP-only authentication cookies; tokens never enter localStorage or Redux. The access cookie lasts 15 minutes and the refresh cookie lasts 7 days. Refresh tokens are stored as hashes, rotated on use, and revoked on logout or password reset. V1 keeps one active refresh session per account, so a new login replaces the previous session. API route groups and architecture are in [`architecher.md`](architecher.md).

## Current status

The buildable V1 includes auth and account settings, private-by-default phone discovery, one-to-one conversations, REST message history, authenticated Socket.IO live messaging, quiet browser message notifications, public profiles, password changes, Cloudinary avatar and image-message upload support, own-message deletion, block/report controls, sent/read check marks, delivery retry, conversation search, mute/pin, a dark theme, responsive layouts, and toast feedback. Message emoji/reaction controls and message sounds are intentionally omitted. Run the server and client in separate terminals for local development; Vite proxies both `/api` and `/socket.io` requests to the API. Presence is single-process memory state in V1 and will not coordinate multiple server instances. The API route groups and architecture are described in [`architecher.md`](architecher.md). Unit and database-backed integration tests are available; run them in the configured environment before relying on their results. Production hosting has not been selected or completed. Group chat, voice/video calls, end-to-end encryption, feeds, AI, and payments remain excluded by the supplied “Not Add in V1” scope.

No production host has been selected or deployed. See [`architecher.md`](architecher.md) for a simple deployment option and its limitations.
