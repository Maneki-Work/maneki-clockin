# Maneki — CLOCK IN (Solana Mobile Hackathon)

**Maneki** is the job board for the onchain economy — and this is its Seeker-native app.
Built for [CLOCK IN](https://solanamobile.radiant.nexus/), the Solana Mobile hackathon.

> Find your next Web3 job on the device made for Web3. Your Seeker wallet is your
> account, your SKR unlocks your AI career agent.

## What it does

- **For You feed** — a personal job feed built from a 30-second onboarding
  (role · level · region), across 2,500+ live Web3 jobs from 600+ companies.
- **Sign in with Solana** — Mobile Wallet Adapter + SIWS: the wallet already on
  the Seeker *is* the account. Saved jobs and preferences follow the wallet,
  no email required.
- **SKR = Seeker Pro** — holding SKR unlocks the pro tier: no subscription,
  no checkout, the balance is the membership.
- **AI matching** — the pro feature: upload a resume once, get every live job
  scored against you with evidence, not vibes.

## What's in this repo

The **Solana layer** built for this hackathon, verbatim from the production
tree, plus the Android wrapper. The platform behind it (scraping, job
normalization, the AI matching engine) is Maneki's production service,
consumed over its API — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the full picture and the public/private boundary.

```
src/
  solana-signin.ts       Mobile Wallet Adapter → Supabase signInWithWeb3 (SIWS)
  SolanaSignInButton.tsx the one-tap sign-in surface (Android/TWA only)
  wallet-user.ts         wallet identity helpers (address, pseudo-identity)
  skr.ts                 SKR balance read on the verified mint → pro tier
  api-skr-route.ts       GET /api/account/skr — server-side pro check
  app-match-page.tsx     AI Match in the app, gated by wallet + SKR
twa/
  twa-manifest.json      Bubblewrap TWA config (work.maneki.app → maneki.work/app)
  build.ps1              reproducible release build (secrets from env, not repo)
docs/
  ARCHITECTURE.md        how the pieces fit, what's private and why
```

## Try it

- **Web (any phone):** https://www.maneki.work/app
- **APK:** TWA wrapper over the same URL — Solana dApp Store listing in progress.
- On Android, "Sign in with Solana" opens your MWA wallet; holding 1+ SKR
  unlocks AI Match.

## Status

Work in progress — hackathon deadline Oct 8, 2026.

## Stack

Next.js (App Router) · Supabase (Postgres + Auth, Web3/Solana provider) ·
Mobile Wallet Adapter (`@solana-mobile/wallet-adapter-mobile`) · Solana RPC ·
TWA (Bubblewrap) for the Android APK · Vercel.
