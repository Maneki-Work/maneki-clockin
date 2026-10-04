# Maneki — CLOCK IN (Solana Mobile Hackathon)

**The cat hunts for you.** Maneki is the job board for the onchain economy —
and this is its Seeker-native app: a gamified job hunt where the lucky cat
catches roles for you every day, your wallet is your account, and your SKR
is the golden collar that sets the cat loose.

Built for [CLOCK IN](https://solanamobile.radiant.nexus/), the Solana Mobile hackathon.

## What it does

- **The daily hunt** — open the app, Maneki has caught today's prey: a swipe
  deck of live Web3 jobs picked for your hunter profile. Swipe to judge,
  tap to expand the full card, apply without leaving the flow.
- **Hunter card onboarding** — 30 seconds, Tinder-style: what you hunt
  (roles), where (regions/remote), your skills. No forms, no email —
  **sign-in is Solana-only**, via Mobile Wallet Adapter and the wallet
  already on the Seeker.
- **Streak** — come back daily, the cat remembers. Clock in, keep the
  streak alive, the hunt refreshes every day.
- **SKR = the golden collar** — free hunters get a daily swipe cap. Holding
  SKR removes it (∞ hunt) and unlocks **Deep Scan**: the AI matching agent
  reads your resume once and scores every live job against you with
  evidence, not vibes.
- **Company hunt** — a second deck for employers: swipe right to follow a
  company and their new roles jump to the top of your daily catch.

2,500+ live jobs from 600+ Web3 companies, scraped and normalized nightly
by the production platform behind the app.

## Built mobile-first, not wrapped

The `/app` experience in this repo was designed and built for this
hackathon as a phone-native product — swipe gestures, FLIP card morphs,
thumb-zone tab bar, safe-area handling, one-shot gesture tutorial — and
ships as a Trusted Web Activity APK. The Solana layer is native Android
plumbing: Mobile Wallet Adapter intents to the Seed Vault wallet, SIWS
sign-in, on-chain SKR reads. It is a different product from the
maneki.work website, sharing only the platform API behind it.

## What's in this repo

The mobile app surface and the Solana layer, verbatim from the production
tree, plus the Android wrapper:

```
app/app/                 the app itself (App Router segment served at /app)
  page.tsx               the Maneki scene: cat, streak, daily catch deck
  start/page.tsx         hunter-card onboarding (Solana-only sign-in)
  companies/page.tsx     the company hunt deck (follow → boosted catch)
  match/page.tsx         Deep Scan (AI matching, SKR-gated)
  profile/page.tsx       hunter card, golden collar, streak, account
  board/ saved/ search/ job/[slugId]/   classic surfaces, app-skinned
app/api/account/skr/     GET /api/account/skr — server-side pro check
components/app/          CatchDeck, CompanyDeck, AppJobCard, HuntTutorial,
                         AppTabBar, theme/splash/service-worker glue
components/              SolanaSignInButton, AppSplash
lib/
  solana-signin.ts       Mobile Wallet Adapter → Supabase signInWithWeb3 (SIWS)
  wallet-user.ts         wallet identity helpers (address, pseudo-identity)
  skr.ts                 SKR balance read on the verified mint → pro tier
  streak.ts              daily clock-in, swipe cap, koban ledger
  daily-catch.ts         how the cat picks today's prey
  company-hunt.ts        follow state → catch ranking boost
  local-saves.ts         anonymous stars that migrate into the account on sign-in
  app-prefs.ts           hunter profile (roles, places, skills)
twa/
  twa-manifest.json      Bubblewrap TWA config (work.maneki.app → maneki.work/app)
  build.ps1              reproducible release build (secrets from env, not repo)
docs/
  ARCHITECTURE.md        how the pieces fit, what's private and why
```

The AI matching engine itself (`lib/match-llm`, `lib/match-pipeline`)
predates the hackathon and is the platform's private core — the app
consumes it over the API. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the boundary.

## Try it

- **Web (any phone):** https://www.maneki.work/app
- **APK:** TWA over the same URL — Solana dApp Store listing in progress.
- On Android, sign-in opens your MWA wallet (Seed Vault on Seeker, Phantom
  elsewhere); holding 1+ SKR puts on the golden collar.

## Status

Work in progress — hackathon deadline Oct 8, 2026.

## Stack

Next.js (App Router) · Supabase (Postgres + Auth, Web3/Solana provider) ·
Mobile Wallet Adapter (`@solana-mobile/wallet-adapter-mobile`) · Solana RPC ·
TWA (Bubblewrap) for the Android APK · Vercel.
