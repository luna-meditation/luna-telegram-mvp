export const journeyStatusMigration = `
alter table public.users
  add column if not exists journey_status_rank smallint not null default -1,
  add column if not exists journey_status_unlocked_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_journey_status_rank_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_journey_status_rank_check
      check (journey_status_rank between -1 and 9);
  end if;
end
$$;

comment on column public.users.journey_status_rank is
  'Highest permanently unlocked Journey status rank. -1 means no status has been earned yet.';
`;
