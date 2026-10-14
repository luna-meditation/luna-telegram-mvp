# Luna 2.0 reviewed release

## Scope and release gate

Existing branch: `agent/luna-2-phase-2-ui`. Use a pull request, never a direct push to main. The owner approved a conditional production release and separately approved one neutral Tarot QA reading for their existing QA account, at most USD 0.01, with no balance, entitlement or profile changes.

The production database is shared. Changes are restricted to Luna tables and four individually reviewed migrations. Never run every migration directory automatically. Application startup no longer performs DDL.

## Backup and evidence

A private local OpenPGP archive contains 22 Luna application tables, schema, constraints, indexes, policies and grants. Two independent isolated PostgreSQL 17.6 restores matched exact row hashes and metadata. Referenced user avatar originals were separately encrypted and restored with matching hashes. This is not a provider-wide Auth/Storage/PITR backup; unrelated applications and credentials are deliberately excluded. Backup keys are outside this repository and must never be committed or uploaded with the archive.

Refresh the encrypted snapshot immediately before production DDL. Preserve previous verified archives. If schema drifts, backup restoration fails, or non-Luna dependencies appear, stop the rollout.

## Deployment order

1. Complete Node.js 22 tests, lint, TypeScript, builds, all 78 asset checks, and local mobile checks in both themes/languages.
2. Merge the reviewed PR with cloud preview builds skipped. Deploy the existing Railway backend with new feature flags and QA maintenance disabled, and `RUN_MIGRATIONS=false`.
3. Verify `/health` reports the exact source commit, Node.js 22, production project `vkcdtasbdoeilgfucoax`, and disabled feature flags. Verify existing public plans and protected endpoints. Do not alter bot identity, webhook, prices or credentials.
4. Refresh and restore the backup, compare schema, then apply only:
   - `20261014034527_luna_garden_atomic_mutations.sql`
   - `20261014035512_luna_personalization_foundation.sql`
   - `20261014041334_luna_tarot_ai_reading_history.sql`
5. Apply `20261013061155_luna_security_boundary_hardening.sql` only after the compatible backend is live and legitimate service-role callers are verified.
6. Verify schema/grants/RLS and unaffected application fingerprints. Enable only garden atomic mutations, personalization, AI modes, Tarot history and Tarot AI. Unfinished features stay off. Reuse the Railway build for configuration-only redeployment.
7. Run the explicit owner-authorized server-only QA job once. The fixed client reading UUID and database reservation prevent another generation after retries/restarts. The job uses no personal context, no fake Telegram credentials, standard-tier GPT-5-mini, output at most 1,600 tokens, a conservative sub-cent request ceiling, and no automatic provider retry. It saves usage, reopens the result, repeats the cached request and verifies user/garden/profile fingerprints. No public maintenance endpoint exists. Disable the opt-in afterwards.
8. Build with `LUNA_RELEASE_PROFILE=luna2`, the exact reviewed migration-hash report, explicit approved frontend flags and the merged commit SHA. Deploy the prebuilt frontend once to existing Netlify site `55baedc0-02e4-45ad-a0d5-0bd76ef4ce97`. Do not package staging functions.
9. Verify deployment Ready, runtime/assets/production health, EN/RU and both themes. Physical iPhone Telegram behavior remains a separate owner verification; do not claim browser emulation proves it.

## Recovery

- For a new-feature regression, disable only the corresponding feature flags and reuse the tested backend image. Keep new tables, reading history, purchase ledger and counters; never drop or reset data.
- The security-only emergency rollback in `phase-1-security-hardening.md` was executed and re-applied in isolated testing. It restores the previous operational permission baseline and must be used only if the narrow grants cause a verified regression. Re-check live permissions first; never execute an unrelated broad rollback.
- Do not restore an old backend image that runs automatic migrations. Do not replay the complete backup into live production or overwrite subsequent user activity.
- Netlify failed builds do not publish. For a published frontend regression, stop the rollout and use the platform-supported fix-forward process; no additional production deployment without owner authorization.

## Cost evidence

Official standard GPT-5-mini rates checked 2026-10-14: input $0.25, cached input $0.025, output $2.00 per million tokens. Provider usage is recorded for the one QA reading; estimated cost is computed from actual tokens, not a historical per-answer assumption. Invoice settlement is separate from the estimate. Source: https://developers.openai.com/api/docs/pricing
