# Security notes

## No secrets in this repository — full-history audit

On Oct 12, 2026 the working tree **and the complete git history** (every
commit since `819c75a`) were audited for:

- JWTs (`eyJhbGciOi…`), Supabase `service_role` keys, AI-provider keys
  (`sk-…`, `AIza…`, `ghp_…`, `AKIA…`), private keys (`-----BEGIN`),
  base58/hex key material, Solana keypair byte arrays
- committed **or deleted** `.env*`, keystores (`.jks` / `.keystore` /
  `.p12` / `.pfx`), or any credential-named file

Result: **zero hits**. No credential has ever been committed to, or
deleted from, this repository.

What an automated scanner might flag here, and why it is not a leak:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (`app/app/job/[slugId]/page.tsx`) are environment-variable
  **references** — no value is in the repo. The Supabase *anon* key they
  resolve to at build time ships in every Supabase app's client bundle by
  design and is scoped by Row Level Security; it grants no admin, schema,
  or cross-user access.
- `SOLANA_RPC_URL` (`lib/skr.ts`) is server-only (not `NEXT_PUBLIC_`), so
  it is never bundled client-side; its sole consumer is the server route
  `app/api/account/skr/route.ts`.
- `twa/build.ps1` references `$env:MANEKI_KEYSTORE` /
  `$env:MANEKI_KEYSTORE_PASS` — variable **names** only. The signing
  keystore and its password have never been in the repo.

Reproduce the audit yourself from a clone (the pickaxe commands exclude
this document, which necessarily contains the needles it describes):

```sh
git log --all --name-only --format= | sort -u   # every path ever committed: no .env, no keystore
git log --all -p -S eyJhbGciOi --oneline -- . ':(exclude)SECURITY.md'    # JWTs: no output
git log --all -p -S service_role --oneline -- . ':(exclude)SECURITY.md'  # service-role keys: no output
git log --all -p -S -----BEGIN --oneline -- . ':(exclude)SECURITY.md'    # private keys: no output
```

## Wallet identity comes only from the verified SIWS identity

`lib/wallet-user.ts` derives the wallet address **exclusively from the
GoTrue `web3` identity** — the container GoTrue populates server-side
from the verified SIWS signature. Self-editable `user_metadata`
(`auth.updateUser`) is deliberately never a wallet source: otherwise a
signed-in user could claim an address they never proved ownership of and
pass the SKR pro check (`/api/account/skr`) with someone else's balance.

## APK ↔ repo ↔ site binding

- `Maneki-CLOCKIN-signed.apk` (GitHub Release): SHA-256
  `AE8D26CB179D039F906007967C53711B362AF0A1FCF3A2502A0D9E890E28DB4F`,
  946,346 bytes.
- Release signing-cert SHA-256 (from
  `apksigner verify --print-certs` on that APK):
  `6F:5C:4C:9F:57:95:E8:86:55:D1:BF:F3:E7:B8:00:89:96:5F:CB:0B:E5:59:20:78:4D:B9:3E:66:D7:68:49:90`
- The same fingerprint is what `work.maneki.app` is bound to at
  <https://www.maneki.work/.well-known/assetlinks.json> (verbatim copy:
  [`twa/assetlinks.json`](twa/assetlinks.json)) and is recorded in
  [`twa/twa-manifest.json`](twa/twa-manifest.json) (`fingerprints`).

Anyone can verify the full chain: hash the released APK, print its
signing cert, compare against the live asset links and this repo.
