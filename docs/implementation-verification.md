**Tournament-management verification**

Changes are on local branch `feat/en-passant-three-core`. Registration was removed at the user's request: the platform accepts organiser-uploaded player rosters and manages the tournament. Public signup, confirmation emails, the email outbox and email worker have been removed. Direct linking with the separate registration platform is deferred.

**Final offline result: 76 tests passed, 0 failed, 0 skipped.** All 50 TypeScript/TSX files parsed successfully, local source imports resolved, and the diff passed whitespace checks.

The native Node regression suite tests the production scoring/standings, weighted Swiss pairing, player CSV parsing and atomic intake, signed sessions, round permissions, and API handler. API tests adapt framework responses/caching and database IO; they do not establish PostgreSQL or deployed-cache correctness. In the restricted workspace, upstream Zod 3.24.2 was assembled temporarily under `/tmp` and preinstalled bcryptjs 2.4.3 was used. Those temporary validation dependencies are not application vendoring; a normal dependency installation runs the same suite with `pnpm test`.

The simulation exercises 200 reproducible tournaments, each with 60 players and six rounds. It checks completeness, unique participation, recovery-only rematches, no third consecutive colour, correct table order and bye limits. Dedicated tests also exercise the timeout/Blossom fallback and unavoidable recovery warnings. Import tests cover legacy and current CSV headers, quoted fields, identifier conflicts, duplicates, invalid-row rollback, supplied codes, optional contact data, source-reference privacy, and concurrent player-limit enforcement.

TypeScript/TSX syntax and local source imports are checked separately. Syntax parsing does not substitute for typecheck, lint, a Next.js production build, or a browser test.

Full dependency installation remains blocked by workspace proxy access and the absence of offline package metadata. The managed pnpm wrapper additionally tries to create its store outside the writable workspace; choosing a workspace store avoids that filesystem issue but not uncached dependency resolution. Build, typecheck and lint have not been verified, and a lockfile could not be generated.

SQL integration remains unverified: no database/server credentials were supplied and the sandbox denies access to the managed Docker socket. The guarded `scripts/db-integration-test.mjs` targets only a fresh disposable database named `enpassant_test`. Rehearse migrations on a copy before touching event data. Browser rendering/accessibility, deployed backup configuration and the 100-phone venue/load rehearsal also remain to be checked.

No live database or deployment has been changed. See `third-edition-setup.md` and `.env.example` for configuration and migration commands.
