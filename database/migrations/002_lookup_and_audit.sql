begin;
create function public.ep_lookup_code(p_code text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('player_id',(select id from public.players where code=p_code and deleted_at is null));
$$;
create function public.ep_audit() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(a)),'[]') from(select * from public.audit_log order by id desc limit 100) a;
$$;
revoke all on function public.ep_lookup_code(text),public.ep_audit() from public,anon,authenticated;
grant execute on function public.ep_lookup_code(text),public.ep_audit() to service_role;
commit;
