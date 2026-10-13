# Luna 2.0 Phase 1 security hardening

## Scope and caller review

The production review found three Luna-owned objects with permissions that were broader than their legitimate callers require:

- `public.playback_sessions`
- `public.increment_meditation_play_count(uuid)`
- `public.reserve_luna_chat_request(bigint, text, integer, uuid)`

All three are called only by the Luna backend. The backend creates one Supabase client with `SUPABASE_SERVICE_ROLE_KEY`; the frontend does not create a Supabase client or call either RPC directly. The required production role for these objects is therefore `service_role`. `anon` and `authenticated` are not legitimate callers.

The shared-project review also found `public.claim_legacy_workspace(uuid)` and `public.reserve_usage_event(...)` as `SECURITY DEFINER` functions owned by the other application. Both already use an empty `search_path` and restrict execution to `service_role`; this migration deliberately leaves them unchanged.

## Prepared migration

`supabase/migrations/20261013061155_luna_security_boundary_hardening.sql`:

1. Fails closed if any of the three expected Luna objects is missing.
2. Enables RLS on `public.playback_sessions`.
3. Removes table privileges from `PUBLIC`, `anon`, and `authenticated`; limits `service_role` to the `SELECT`, `INSERT`, and `UPDATE` operations used by the backend.
4. Adds an explicit deny policy for `anon` and `authenticated`.
5. Sets an empty `search_path` on both Luna `SECURITY DEFINER` functions.
6. Removes direct and inherited execute access from `PUBLIC`, `anon`, and `authenticated`, and explicitly grants execution to `service_role`.
7. Does not update rows or touch unrelated schemas, tables, functions, policies, or grants.

The migration is prepared only. It must not be executed in production until separately approved.

## Verification after an approved execution

Run the migration through the reviewed production migration workflow, then verify in one transaction/session:

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'playback_sessions';

select p.oid::regprocedure::text as function_name,
       p.prosecdef,
       p.proconfig,
       p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('increment_meditation_play_count', 'reserve_luna_chat_request');
```

Then run backend RPC integration tests with a dedicated non-production QA user. Verify that playback start/heartbeat/completion and one Luna AI reservation still succeed through the backend. Verify that `anon` and `authenticated` receive permission errors when calling either RPC or accessing `playback_sessions` directly.

## Emergency rollback (do not run routinely)

The following restores the previous operational access for `anon`, `authenticated`, and `service_role` while intentionally leaving generic `PUBLIC` execution revoked. It deliberately reopens the audited client-role risks and should be used only if an approved production rollout causes a confirmed backend outage and the safer forward fix cannot be applied quickly.

```sql
drop policy if exists "Playback sessions are server managed" on public.playback_sessions;
alter table public.playback_sessions disable row level security;
grant all privileges on table public.playback_sessions to anon, authenticated, service_role;

alter function public.increment_meditation_play_count(uuid)
  set search_path = public, pg_temp;
grant execute on function public.increment_meditation_play_count(uuid) to anon, authenticated, service_role;

alter function public.reserve_luna_chat_request(bigint, text, integer, uuid)
  set search_path = public, pg_temp;
grant execute on function public.reserve_luna_chat_request(bigint, text, integer, uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
```

After rollback, capture the error, restore service through a corrected forward migration, and reapply the least-privilege state. No data rollback is required because the hardening migration changes no rows.
