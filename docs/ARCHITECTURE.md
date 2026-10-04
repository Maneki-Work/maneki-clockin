# Architecture

## The one-paragraph version

Maneki is a production Web3 job board (live at [maneki.work](https://www.maneki.work)
since May 2026: 2,500+ live jobs, 600+ companies, nightly multi-source scraping).
For CLOCK IN we built its **Seeker-native app**: a gamified, phone-first
experience served at `maneki.work/app`, wrapped in a Trusted Web Activity
APK, with a Solana layer written for this hackathon — **Mobile Wallet
Adapter sign-in (wallet = account), an SKR-gated pro tier, and the AI
matching agent surfaced in-app as "Deep Scan"**. This repo contains the app
surface, that Solana layer, and the Android wrapper. The platform behind it
(scraping pipeline, job normalization, AI matching engine) is Maneki's
production service, consumed over its HTTPS API — same trust model as any
app built on a backend service.

```
┌─────────────────────────────── Seeker device ───────────────────────────────┐
│                                                                             │
│  ┌───────────────┐   MWA intents    ┌──────────────────────────────┐        │
│  │ Wallet app    │◄────────────────►│ Maneki APK (TWA, this repo)  │        │
│  │ (Seed Vault…) │  signIn (SIWS)   │ chrome renders maneki.work/app        │
│  └───────────────┘                  └──────────────┬───────────────┘        │
└────────────────────────────────────────────────────┼────────────────────────┘
                                                     │ HTTPS
                        ┌────────────────────────────┼────────────────────────┐
                        │  maneki.work (Next.js on Vercel — private codebase) │
                        │                            │                        │
                        │  /api/auth (Supabase Web3: verifies SIWS message,   │
                        │             issues session — wallet = account)      │
                        │  /api/account/skr  ──► Solana RPC: SKR balance      │
                        │  /api/match/*      ──► AI matching engine (private) │
                        │  /app/*            ──► the app UI (in this repo)    │
                        └─────────────────────────────────────────────────────┘
```

## The game loop (what makes it an app, not a site)

The design bet: job hunting is a chore, so give the chore to the cat.
Everything below was built for this hackathon, mobile-first.

- **The scene** (`app/app/page.tsx`): the app opens on Maneki, not a list.
  The cat greets you, shows the streak, and presents **today's catch** — a
  continuous swipe deck (`components/app/CatchDeck.tsx`) ranked by your
  hunter profile. Swipe to judge (the cat reacts), tap and the card
  **expands in place** (FLIP-style morph, judgment and APPLY available
  from inside). Free hunters get a daily swipe cap; when it runs out, the
  cat is done for today — unless you wear the golden collar (SKR, below).
- **Streak & clock-in** (`lib/streak.ts`): daily return is the core loop —
  frictionless local clock-in, with the swipe-cap ledger riding on it.
- **Daily catch** (`lib/daily-catch.ts`): how the cat picks prey — hunter
  profile filters (roles, places, remote), followed-company boost, dedup
  against already-judged jobs.
- **Company hunt** (`app/app/companies/page.tsx`,
  `components/app/CompanyDeck.tsx`, `lib/company-hunt.ts`): a second deck
  for employers; follow a company and their new roles jump to the top of
  your catch.
- **Local-first state** (`lib/local-saves.ts`): stars and follows are
  written locally first and migrate into the wallet account at sign-in —
  nothing is lost crossing the auth boundary.
- **Onboarding** (`app/app/start/page.tsx`): the hunter card — three
  Tinder-style multi-select questions (roles, places, skills), then the
  reveal: your card, today's catch count, and the SKR verdict. Sign-in is
  Solana-only.

## The Solana layer

### 1. Sign in with Solana — the wallet is the account (`lib/solana-signin.ts`)

On a Seeker every user already has a wallet, so email login is friction we
can delete. The flow:

1. `SolanaMobileWalletAdapter` (from `@solana-mobile/wallet-adapter-mobile`)
   talks to the native wallet over MWA intents — works in Chrome and in our
   TWA, no injected `window.solana` needed. The SDK is preloaded at mount
   so the user gesture doesn't expire inside a dynamic import, and
   `appIdentity.uri` follows the serving origin.
2. The adapter's `signIn()` implements **Sign In With Solana** (EIP-4361
   style message: domain, URI, statement, timestamp), with an
   authorize+signMessage fallback for wallets that don't speak SIWS over MWA.
3. The signed output goes to **Supabase Auth's Web3 provider**
   (`auth.signInWithWeb3`), which validates the message structure, the
   ed25519 signature, the timestamp window and the domain, then issues a
   normal session.

No transaction, no fee, nothing stored on-chain. Saved jobs, follows and
the hunter profile attach to the wallet identity and follow the user
across reinstalls and devices.

Wallet accounts have no email, while parts of the platform key users by
email. `lib/wallet-user.ts` extracts the wallet address from every GoTrue
identity shape (top-level, `custom_claims`, `provider_id`, base58-validated)
and derives a stable, obviously-non-deliverable pseudo-identity
(`<address>@wallet.maneki.work`) so wallet users flow through the same
pipeline; every email-sending path filters that domain out.

### 2. SKR = the golden collar (`lib/skr.ts`, `app/api/account/skr/route.ts`)

Holding SKR *is* the membership — no subscription, no checkout:

- Server-side read of the wallet's SKR balance
  (`getTokenAccountsByOwner` on the verified mint
  `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`, summed across accounts).
- Balance ≥ threshold (default 1 SKR, configurable) → the golden collar:
  the daily swipe cap disappears and **Deep Scan** unlocks.
- RPC failure is kept distinct from a zero balance: we never lock a user
  out because *our* RPC call failed.

The check runs server-side on the session's wallet — the client can't spoof
it, and the wallet address itself came from a verified SIWS signature.

### 3. Deep Scan — AI matching in the app (`app/app/match/page.tsx`)

The pro feature SKR unlocks. Upload a resume (PDF, read once and discarded —
only the extracted profile is kept), and the matching engine scores it
against every live job with evidence-based LLM judgment. The engine predates
the hackathon and is the private part of the platform (`lib/match-llm`,
`lib/match-pipeline` are not in this repo); what's new here is the mobile
surface and the wallet+SKR gating in front of it.

## What is private, and why

The `maneki.work` codebase (scraping adapters, normalization, the matching
engine's prompts and pipeline) is the product's moat and stays closed —
the same way a hackathon project building on Stripe doesn't vendor Stripe.
The boundary is the HTTPS API, and everything hackathon-specific sits on
the open side of it, in this repo, verbatim from the production tree.
(This repo is a source showcase, not a standalone build: a few imports
point at private modules behind that boundary.)

## The Android wrapper (`twa/`)

Bubblewrap-generated Trusted Web Activity: `work.maneki.app`, start URL
`/app`, digital asset links verified against
`https://www.maneki.work/.well-known/assetlinks.json`. `twa/build.ps1`
reproduces the release APK (gradle → zipalign → apksigner); the signing
keystore and its password live outside the repo.
