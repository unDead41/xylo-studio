-- Run with an administration connection against the dedicated e-Instru project.
-- Test identities exist only inside this transaction and send no email.
begin;
select set_config('test.profile_owner', gen_random_uuid()::text, true),
       set_config('test.profile_other', gen_random_uuid()::text, true);
insert into auth.users (id) values (current_setting('test.profile_owner')::uuid),
                                  (current_setting('test.profile_other')::uuid);
insert into public.profiles (id, display_name)
values (current_setting('test.profile_other')::uuid, 'Other fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.profile_owner'), true),
       set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.profile_owner'),'role','authenticated')::text, true);
do $$
declare
  owner_id uuid := current_setting('test.profile_owner')::uuid;
  other_id uuid := current_setting('test.profile_other')::uuid;
  changed integer;
  command text;
begin
  insert into public.profiles (id,display_name,preferences) values (owner_id,'Owner fixture','{"theme":"system"}');
  if (select count(*) from public.profiles) <> 1 then raise exception 'SELECT exposed another profile'; end if;
  update public.profiles set display_name='Updated',preferences='{"theme":"dark"}' where id=owner_id;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Owner UPDATE failed'; end if;
  update public.profiles set display_name='Cross-user write' where id=other_id;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user UPDATE succeeded'; end if;
  foreach command in array array[
    format('insert into public.profiles (id) values (%L)',other_id),
    format('update public.profiles set id=%L where id=%L',other_id,owner_id),
    format('update public.profiles set created_at=now() where id=%L',owner_id),
    'delete from public.profiles'
  ] loop
    begin execute command; raise exception 'Expected denial: %',command;
    exception when insufficient_privilege then null; end;
  end loop;
  foreach command in array array[
    format('update public.profiles set display_name=repeat(''x'',81) where id=%L',owner_id),
    format('update public.profiles set preferences=''[]''::jsonb where id=%L',owner_id),
    format('update public.profiles set preferences=jsonb_build_object(''x'',repeat(''x'',4096)) where id=%L',owner_id)
  ] loop
    begin execute command; raise exception 'Expected constraint denial: %',command;
    exception when check_violation then null; end;
  end loop;
end;
$$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.profiles; raise exception 'Anonymous SELECT succeeded';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
select 'Profile RLS checks passed; fixtures rolled back' as result;
