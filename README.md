![En Passant](screenshots/cover.avif)

# En Passant — Tournament Management

En Passant manages the tournament after players register on a separate platform. Organisers upload a player CSV, check players in, generate and publish Swiss rounds, record results, and follow the standings. Connecting directly to the registration platform is deferred; this repository has no public registration form, registration API, confirmation emails, or email worker.

The current version includes:

- Admin-only CSV preview and atomic upload, with validation and duplicate handling.
- Manual player addition, editing, check-in, withdrawal, and player-code management.
- Swiss scoring: win 1, draw 0.5, loss 0, bye 1; explicit forfeits and double forfeits.
- Standings ordered by score, Buchholz, direct encounter, fewer byes, and recorded Armageddon resolution.
- Score brackets, balanced colours, table assignment, private pairing drafts, manual swaps, publication, timers, and round closure.
- Public `/standings`, `/games`, and code-based `/me` views refreshed automatically.
- Hashed admin login, protected server APIs, audit history, and server-only database access.

Full knockout/bracket progression, live analytics, exports, projector mode, and offline result queues remain separate work.

## Player upload

Open `/admin`, choose **Upload players**, select a CSV, review the preview, and upload. `name,elo` and `full_name,seed_rating` exports are supported. Only a name is required; a missing seed defaults to 1200. Contact details are optional. Uploads preserve supplied four-digit player codes or allocate unique codes for the organisers to distribute.

Download the template from `/players-template.csv`. See [upload format and setup](docs/third-edition-setup.md) for supported columns, deduplication rules, and migration instructions. Imports add players; they never overwrite existing results or player history.

## Run locally

Use Node 24 or newer.

```bash
pnpm install
cp .env.example .env.local
pnpm hash-password
pnpm dev
```

Set the server variables described in `.env.example`, apply the documented database migrations, and open `http://localhost:1972`. The original `/dashboard` and `/leaderboard` paths remain compatible with `/admin` and `/standings`.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

For migration and SQL verification, `pnpm test:db` requires a fresh disposable database named `enpassant_test`. It refuses to overwrite an existing players table. The [verification record](docs/implementation-verification.md) distinguishes completed offline tests from the build, database, and browser checks blocked by the current environment.

The stack is Next.js, React, TypeScript, Tailwind, and PostgreSQL/Supabase accessed through server-only RPCs. The weighted matching implementation is vendored with its MIT license.
