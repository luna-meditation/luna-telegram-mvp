-- Narrow compatibility dependency discovered in the older isolated staging schema.
-- Also safe on databases that already received the canonical personalization field.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.luna_personal_profiles
 add column if not exists display_name text check (char_length(display_name)<=60);
notify pgrst,'reload schema';
commit;
-- Rollback: disable personal_memory; leave this nullable additive column in place.
-- Do not drop populated columns or revert existing consent/profile rows.
