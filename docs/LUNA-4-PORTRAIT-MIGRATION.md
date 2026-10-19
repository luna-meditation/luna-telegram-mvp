# Saved portrait migration — operational review

Local file: `20261019031355_luna4_private_portrait_snapshots.sql` (Supabase CLI).
SHA-256: `1e407767ab242bcb9be545692eb6e5d2c099aee113bf45cd6b5f1a8ccd6548e3`.

## Exact scope

- Two new private tables: `luna4_portrait_state`, `luna4_portrait_snapshots`.
- Four new SECURITY INVOKER routines with qualified source tables and bounded
  search path; PUBLIC/anon/authenticated execution revoked, service_role only.
- Four source invalidation triggers on Luna memory/profile/birth/chart tables.
- One users trigger limited to a changed `ai_memory_enabled` flag.
- No UPDATE of existing profiles, balances, payment records or catalog settings.
- No changes to grants or function bodies belonging to another application.

Both tables force RLS and expose no client policies. Telegram HMAC remains the
HTTP authentication boundary; the server, never a request body, selects owner.
The same current per-owner state row serializes writes and invalidation. A
snapshot computed before a source change is rejected rather than resurrected.
Corrections, deletion and consent changes purge all derived private copies.
Revision counters remain monotonic. Retention is bounded to 30 valid snapshots;
unchanged projection sections have stable digests and reopening uses the cache.
Date-only Sun ranges and numerology are deterministic, not AI personality facts.

## Verified environments

- Isolated native PostgreSQL: production schema metadata only, synthetic records,
  10 tests passed (apply/reapply, 12-way races, RLS, forged claims, correction,
  deletion, revocation, owner isolation, existing writes and safe rollback).
- Existing staging `funvzpmpbgazsisehiru`: dependency checks passed, PostgreSQL
  17.11. Applied via the authenticated Safari SQL Editor after the migration
  connector twice returned `Invalid or expired requestState`. Each failed
  attempt was independently checked: no objects/history entry had appeared.
- DDL result and RLS/EXECUTE privileges subsequently verified through the
  independent read-only connector. Migration history repaired with the exact
  local version/name/hash in `created_by`; `statements` is explicitly NULL,
  not a fabricated replay script. Canonical SQL is the file above.
- Production `vkcdtasbdoeilgfucoax`: NOT APPLIED.

## Application and rollback

Production prerequisites, NOT yet satisfied for this full program: current
encrypted backup/restore verification, full financial policy integration,
representative real-provider evaluation and final mobile checks. Recheck
project ID, dependency columns and exact migration hash before applying.

Apply the canonical file in one transaction; lock timeout 5s, statement timeout
30s. Compare only the listed new objects and triggers against the preflight.
Verify current application source writes still work and direct anon/authenticated
RPC/table reads fail. Check a synthetic authorized account, never modify a real
wallet or create a real invoice to test this migration.

Preferred application rollback is fix-forward to the previous backend/frontend
code while leaving this additive migration and privacy triggers in place. Old
code does not read these tables, and its source writes were tested with the new
triggers. Do not disable invalidation while retaining readable cached copies.

If new entrypoints need to be closed, a narrow, reversible server-only rollback:

```sql
revoke execute on function
 public.luna4_portrait_epoch(bigint),
 public.luna4_save_portrait_snapshot(bigint,bigint,text,date,jsonb),
 public.luna4_open_portrait_discussion(bigint,uuid,uuid,uuid,bigint,text,text,text,jsonb)
from service_role;
```

Keep `luna4_invalidate_portrait` executable so corrections/deletions continue to
purge derived data. Restore the three EXECUTE grants only after review. Never
drop user tables or truncate originals. No billing rollback is needed: this
migration cannot charge, credit, grant Premium, or call any AI provider.
