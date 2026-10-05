-- Run once in the project's SQL editor. No customer records go in this file.
begin;
grant usage on schema public to authenticated;

create table public.dispensing_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.dispensing_members enable row level security;
revoke all on public.dispensing_members from anon, authenticated;
grant select on public.dispensing_members to authenticated;
create policy "Read own membership" on public.dispensing_members
  for select to authenticated using (user_id = (select auth.uid()));

create table public.dispensing_documents (
  user_id uuid primary key references public.dispensing_members(user_id) on delete cascade,
  version bigint not null check (version > 0 and version < 9007199254740991),
  payload jsonb not null check (coalesce(
    jsonb_typeof(payload) = 'object'
    and payload @> '{"version":1}'::jsonb
    and jsonb_typeof(payload->'entries') = 'array'
    and jsonb_array_length(payload->'entries') <= 10000
    and jsonb_typeof(payload->'key') = 'object'
    and octet_length(payload::text) <= 10000000
  , false))
);
alter table public.dispensing_documents enable row level security;
revoke all on public.dispensing_documents from anon, authenticated;
grant select, insert, update on public.dispensing_documents to authenticated;
create policy "Read own document" on public.dispensing_documents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own document" on public.dispensing_documents
  for insert to authenticated with check (
    user_id = (select auth.uid()) and version = 1
    and exists (select 1 from public.dispensing_members m where m.user_id = (select auth.uid()))
  );
create policy "Update own document" on public.dispensing_documents
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Enforce advancing revisions even if a caller bypasses the normal client.
create function public.dispensing_check_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id or new.version <> old.version + 1 then
    raise exception 'Document revision must advance by one';
  end if;
  return new;
end;
$$;
create trigger dispensing_version before update on public.dispensing_documents
  for each row execute function public.dispensing_check_version();
revoke all on function public.dispensing_check_version() from public, anon, authenticated;

commit;
