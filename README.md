# Wolf Pack AI

> AI sales automation for home-services businesses — answers leads in 3 seconds, books appointments on your calendar, and works the pipeline while you sleep.

**Live:** [thewolfpack.ai](https://thewolfpack.ai)

---

## What it does

Wolf Pack AI is an end-to-end sales automation platform built for electricians, HVAC contractors, plumbers, and roofers. One lead comes in and the system handles everything from first-touch to booked appointment without the owner lifting a finger:

- **AI SMS/iMessage agent** replies to new leads in under 3 seconds, qualifies them, handles objections, and books onto the owner's calendar.
- **AI outbound caller** (Retell + Twilio) dials through contact lists, runs real voice conversations, and logs outcomes back to the pipeline.
- **Email assistant** connects to Gmail via IMAP, parses inbound email, and drafts or auto-sends replies with Anthropic-powered reasoning.
- **Pipeline, CRM, and analytics** — contacts, deals, conversations, calendar, and owner dashboard all in one app.
- **Google Business Profile scoring tool** (`/score`, `/gbp-score`) runs a headless browser audit of any GBP listing and returns an opportunity report — shareable as a lead magnet.
- **Affiliate program** with click tracking, payouts, and a partner portal.
- **Per-vertical marketing sites** (`/electrician`, `/hvac`, `/plumber`, `/roofing`) with conversion-tuned copy and booking flows.

## Tech stack

| Area | Stack |
| ---- | ----- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Auth | Clerk |
| Database | Neon Postgres + Drizzle ORM |
| Billing | Stripe (subscriptions, portal, webhooks) |
| Voice AI | Retell SDK + Twilio (inbound bridge, programmable voice) |
| Email | AWS SES (outbound), ImapFlow + mailparser (inbound), Nodemailer |
| LLM | Anthropic Claude (agent reasoning, email drafting, follow-up generation) |
| Browser automation | Playwright + Puppeteer + @sparticuz/chromium (GBP scraping on Vercel serverless) |
| PDF | @react-pdf/renderer (owner reports, contracts) |
| Deploy | Vercel (serverless + cron) |

## Architecture highlights

- **Cron-driven background work.** Seven scheduled jobs in [vercel.json](vercel.json) handle AI follow-ups, reminders, email warmup (send/reply/bounce), GBP review processing, and monthly affiliate payouts.
- **Webhook hardening.** Inbound webhooks from Clerk, Twilio (SMS/voice/recording), SES, Facebook, Google, and Loop all go through an idempotency layer ([lib/webhook-idempotency.ts](lib/webhook-idempotency.ts)) so retries and replays never double-process.
- **Rate limiting.** Zero-dep in-memory limiter ([lib/rate-limit.ts](lib/rate-limit.ts)) protects AI endpoints and the public scoring tool from abuse.
- **Multi-tenant workspaces.** Every request is scoped to a workspace id resolved from the Clerk session ([lib/workspace.ts](lib/workspace.ts)), so a single deployment serves many home-services businesses.
- **Agent loop.** The AI agent (`lib/ai-agent*`, `lib/loop/`) runs a learn → act → follow-up cycle with per-lead memory, pulling context from the conversation history and CRM state.

## Running locally

```bash
npm install
# create .env.local with keys for: Clerk, Neon (DATABASE_URL), Stripe,
# Retell, Twilio, AWS SES, Anthropic, and Gmail IMAP
npm run dev
```

Migrations live in [migrations/](migrations/) and are run via `drizzle-kit`.

## License

All rights reserved. This repo is public for portfolio review; it is not open source and is not licensed for reuse.
