begin;
create function public.ep_alert(p_action text) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.audit_log(actor,action) values('system',p_action);
$$;
revoke all on function public.ep_alert(text) from public,anon,authenticated;
grant execute on function public.ep_alert(text) to service_role;
commit;
