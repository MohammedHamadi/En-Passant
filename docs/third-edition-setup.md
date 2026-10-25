**Tournament management setup and player upload**

Registration is handled by another platform. This application starts with a player roster uploaded by an organiser. There is no public registration route/API, registration deadline or opening/closing workflow, email outbox, confirmation-email sender, or email-worker configuration. Direct integration with the other platform is deferred.

Install dependencies with `pnpm install`, copy `.env.example` to `.env.local`, and configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, and `SITE_URL`. The session secret needs at least 32 characters. Run `pnpm hash-password` in an interactive terminal to generate a bcrypt hash without putting a password in shell history. Optional `ARBITER_EMAILS` can enter running-round results; only the main admin can upload/edit players or change tournament settings.

Keep `TRUST_PROXY=false` unless your hosting platform overwrites `X-Forwarded-For` with a trusted client address. Without that guarantee the application shares a lookup/login throttle bucket instead of trusting arbitrary forwarded headers. Production hosting needs HTTPS and the exact public origin in `SITE_URL`. Admin sessions last eight hours and use httpOnly, secure, SameSite=Strict cookies and Origin validation on writes.

Before changing a populated database, export it and rehearse on a copy. For a fresh project apply `database/schema.sql`, followed by these one-time migrations in order:

1. `database/migrations/001_third_edition.sql`
2. `database/migrations/002_lookup_and_audit.sql`
3. `database/migrations/003_operational_alerts.sql`

These migrations have not been applied to a live database in this session. Migration 001 preserves old player IDs and match relationships and retains `matches` as an archive. It copies games into the canonical model, maps solo byes to one point, paired double-absence flags to double forfeits, and single paired bye flags to forfeits. Review those legacy mappings before using real data. Unknown contact, institution and experience data stay empty. Existing seed/presence data are preserved. Existing invalid duplicate participation makes the migration abort rather than discarding data. Public database roles are denied direct access; the service role calls protected RPCs.

Run `pnpm dev` and open `http://localhost:1972/admin`. The tournament starts in check-in mode. Upload the roster, review/check in players, generate a private draft, review or swap pairings, publish, start the timer, enter results, and close the completed round before generating another. Round 1 publication permanently locks existing seed ratings. Walk-ins can still be added later at zero points and enter the next round after check-in; no points or byes are invented for missed rounds.

Use the admin **Upload players** panel to select a CSV, preview it, then upload. Download `/players-template.csv` for an example. Only `full_name` or `name` is required. Header aliases are case-insensitive and spaces/hyphens are normalized.

| Column | Meaning |
|---|---|
| `full_name`, `name`, `player_name` | Required player name |
| `seed_rating`, `elo`, `rating` | Final tournament seed, an integer from 0 to 3500; defaults to 1200 if no rating/level is supplied |
| `external_id`, `id`, `participant_id`, `registration_id` | Optional stable reference from the source export; never used as the local database primary ID |
| `code`, `player_code` | Optional unique code from 1000 to 9999; otherwise securely generated |
| `email`, `phone`, `student_id` | Optional private metadata; no emails are sent |
| `institution_type` | Optional `ensia` or `other` |
| `institution_name`, `school`, `university` | Optional school name; `ENSIA` is recognized automatically |
| `online_rating`, `rating_platform`, `rating_time_control` | Optional raw online rating; Lichess subtracts the configured offset of 100 when no explicit seed is supplied |
| `level` | Optional beginner/casual/intermediate/advanced/experienced; supplies 400/800/1200/1600/1900 when no rating is supplied |
| `checked_in`, `present`, `is_present` | Optional true/false, yes/no, or 1/0; defaults to false |
| `active`, `is_active` | Optional true/false, yes/no, or 1/0; defaults to true |

Explicit seed fields are already-calibrated tournament ratings. Use `online_rating` for platform conversion. Unsupported columns are listed in the preview and not saved. Standard quoted CSV, escaped quotes, CRLF, UTF-8 BOM and quoted line breaks are supported. Use comma-separated CSV, up to 750 KB and 5,000 rows. The configured tournament player limit defaults to 64 and can be raised in settings before a larger upload.

Duplicate handling uses external reference, normalized email or code when supplied. Without any of those identifiers, an exact case-insensitive name plus seed match is skipped. Include a stable identifier to distinguish same-named players or to make later uploads reliably repeatable. Two supplied identifiers pointing at different players are an error. Uploads only add or skip; they never silently edit existing records. If any row is invalid or the whole batch exceeds the player limit, the complete upload is rejected. Preview does not write data. Import commits are protected by a revision lock and unique indexes; retries revalidate against the latest roster.

Manual addition and player editing are available for corrections/walk-ins. Codes appear only in authenticated admin views and code-based lookup requests. Organisers can copy or regenerate them; regeneration immediately invalidates the old code and does not send a notification. Public `/me` accepts a code supplied by the organisers and shows only safe match details, table, colour, timer, history, score and rank. Incorrect lookups are limited to ten per minute followed by a sixty-second block. Public `/standings` and `/games` show published data only. Drafts and private fields, including external references, never appear in public projections. Public data use a three-second shared cache with write invalidation, and screens refresh every five seconds.

A changed player/result invalidates a pairing draft: delete and regenerate it. Main admins may correct a closed result, but corrections affecting later published pairings require explicit reconciliation acknowledgement. Published players are never silently rearranged. Withdrawals preserve history and forfeit an unfinished running match to the opponent. A player with games cannot be deleted.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. The native Node tests use production scoring, pairing, roster-import and API logic. They include 200 deterministic 60-player/six-round tournaments, explicit fallback and recovery cases, CSV validation/deduplication/atomicity, 1,000 unique codes, session checks, privacy and admin authorization. The API unit tests adapt framework responses/caching and database IO; they do not substitute for SQL or deployment tests.

For SQL integration, set `TEST_DATABASE_URL` to a fresh disposable database named **enpassant_test** and run `pnpm test:db`. The script refuses other database names or an existing players table, applies the actual baseline/migrations to legacy fixtures, and checks permissions, revision rollback, capacity, participant uniqueness, rate limits and imports. Use a database owner able to create the three Supabase roles. Drop/recreate only that disposable test database between runs.

See `implementation-verification.md` for the checks completed in the current environment. Full knockout management, broader content pages, live analytics, projector mode, exports, offline result queues, automatic backups and the live venue rehearsal remain separate work.
