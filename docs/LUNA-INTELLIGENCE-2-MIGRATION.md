# Bounded tool continuation — Intelligence 2.0

Prepared migration: `20261018100000_luna_intelligence_bounded_tool_continuation.sql`.

## Purpose and callers

The existing provider/accounting boundary permits two provider attempts. A bounded lookup → action → final answer needs up to three. Only an Intelligence chat operation may use the third call. Tarot/report/deep-analysis paths retain two. Every attempt is independently reserved/settled under the existing global budget and the same operation/lease. One successful conversation turn consumes one included or purchased reply, never three.

`guardedProviderTransport` → `luna40_reserve_ai_attempt` (admin/purchased quota) or `luna32_reserve_ai_attempt` → existing attempt ledger. The admin wrapper forwards call index unchanged. Other applications do not call this Luna-prefixed function/table. No execution privileges, RLS, SECURITY DEFINER, money rules, monthly cap or data are changed.

## Preflight / apply

1. Verify exact project ID and current backend, no outstanding unknown usage; snapshot function definition, constraint and ACL/RLS. Production requires a fresh encrypted Luna backup with isolated restore checks.
2. Match reviewed function MD5 `c2cb634567bb7e8d6bc4dafcefff9de2` and the named 1–2 call constraint. The migration rejects unknown drift, runs atomically with short lock/statement timeouts and is idempotent.
3. Test isolated PostgreSQL, including reapply, three attempts/one quota, fourth denial, non-chat third denial, simultaneous reservations, no held-cost leaks, forged anon/authenticated and other-app sentinel.
4. Apply only this migration to staging, verify the full authenticated pipeline. Production only after all release gates. Deploy backend then frontend once; automatic migrations stay OFF.

## Nondestructive rollback

Disable the Intelligence feature / use the previous verified backend (two-attempt runtime). Restore only the reviewed function's original guard using a checked inverse replacement:

```sql
begin;
set local lock_timeout='3s';
do $rollback$
declare f text; original text;
begin
 f:=pg_get_functiondef('public.luna32_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer)'::regprocedure);
 original:=replace(f,'(p_call not between 1 and 3 or (p_call=3 and p_operation not like ''chat:%'')) or','p_call not between 1 and 2 or');
 if md5(original)<>'c2cb634567bb7e8d6bc4dafcefff9de2' then raise exception 'Rollback definition drift';end if;
 execute original;
end $rollback$;
commit;
```

Keep the storage constraint at 1–3: historical third-attempt cost records must never be removed or invalidated. The old runtime and restored RPC reject new third calls. Existing records and all costs remain readable; no data restoration or financial reversal is needed. For a schema-only rollback before any third row exists, the original check can be restored after separately verifying `count(*) where call_index=3 = 0`.

Status: staging `funvzpmpbgazsisehiru` and production `vkcdtasbdoeilgfucoax` applied and verified. Production application completed 2026-10-18 ~11:32 UTC, after the 59-call finite staging run and fresh encrypted backup/two restores. Post-apply function hash `8836efeea0118ad26759621e58fa48a5`; SECURITY INVOKER and empty search_path retained; anon/authenticated EXECUTE denied, service_role allowed. Attempt table RLS and FORCE RLS remain enabled, ACL remains postgres/service_role only. All 108 shared relations / 86 functions compared: only this function guard and named check constraint changed. User/balance/payment/ledger/settings fingerprints and other application objects unchanged. Isolated PostgreSQL reapply, safe inverse/reapply and all 59 regression checks PASS. Real staged application turns settled usage and free reopening correctly; live successful turns needed at most two attempts, while the third-attempt boundary is independently covered by native database/runtime tests. No production test charge or user-data modification.
