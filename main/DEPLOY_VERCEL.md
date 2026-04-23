# Deploy to Vercel (Safe Setup)

This guide keeps your current app behavior unchanged and only configures hosting.

## 1. Prepare locally

Run from `main`:

```bash
npm ci
npx prisma generate
npx tsc --noEmit
```

## 2. Create Vercel project

1. Import your GitHub repo into Vercel.
2. Set **Root Directory** to `main`.
3. Keep framework as **Next.js**.

`vercel.json` is already included with safe defaults:
- install: `npm ci`
- build: `npm run build`

## 3. Add environment variables in Vercel

Copy variables from `.env.example` and set real values:

- `DATABASE_URL` (production Postgres)
- `JWT_SECRET`
- `GEMINI_API_KEY` (optional, enables Gemini explanations)
- optional integrations only if used:
  - `BASE_URL`
  - `AI_SERVICE_URL`
  - `SMTP_HOST`
  - `SENDGRID_API_KEY`
  - `RESEND_API_KEY`
  - `MAILGUN_API_KEY`

## 4. Database schema sync (one-time per environment)

Before first production use, apply schema to your production DB.

If you are using schema push flow:

```bash
DATABASE_URL="your_production_database_url" npx prisma db push
```

If you move to migrations later, use:

```bash
npx prisma migrate deploy
```

## 5. Seed demo data (optional)

Only do this if you want demo accounts in production:

```bash
DATABASE_URL="your_production_database_url" npx prisma db seed
```

## 6. Deploy

Trigger deploy from Vercel UI or push to your connected branch.

## 7. Post-deploy smoke checks

1. Open `/login` and test admin/student/supervisor login.
2. Verify student onboarding saves and redirects correctly.
3. Verify project save, keywords, and find-supervisor page.
4. Confirm API routes work with no `500` errors in Vercel logs.

## Notes

- Do **not** put real secrets in Git.
- Keep `.env` local and use Vercel environment variables for hosted environments.
- If local works but Vercel fails, check Vercel logs first for missing env vars or DB connectivity.
