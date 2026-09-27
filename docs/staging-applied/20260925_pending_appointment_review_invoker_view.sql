-- Applied ONLY to staging-test Supabase project vbizuxxgjlwqotuegskq
-- via execute_sql on 2026-09-25. NOT a canonical migration and NOT recorded
-- in supabase_migrations history; requires reviewed reconciliation before release.
-- PostgreSQL 15+ security_invoker is critical: plain views can bypass RLS.
begin;
do $$ begin
 if current_setting('server_version_num')::int < 150000 then raise exception 'security_invoker view requires PostgreSQL 15+'; end if;
 if to_regclass('public.pending_appointment_review_inbox') is not null then raise exception 'pending review view already exists; reconcile before retry'; end if;
 if (select relrowsecurity from pg_class where oid='public.appointment_review_requests'::regclass) is distinct from true
 or (select relrowsecurity from pg_class where oid='public.appointment_review_decisions'::regclass) is distinct from true
 then raise exception 'underlying RLS required'; end if;
end $$;
create view public.pending_appointment_review_inbox with (security_invoker=true) as
select r.id,r.workspace_id,r.conversation_id,r.inbound_message_id,r.requested_at,r.customer_request,r.status,r.created_at
from public.appointment_review_requests r
where r.status='pending_review'
and not exists(
 select 1 from public.appointment_review_decisions d
 where d.review_request_id=r.id and d.workspace_id=r.workspace_id
);
revoke all on public.pending_appointment_review_inbox from public,anon,authenticated;
grant select on public.pending_appointment_review_inbox to authenticated;
do $$ begin
 if not exists(select 1 from pg_class c where c.oid='public.pending_appointment_review_inbox'::regclass
 and c.relkind='v' and 'security_invoker=true'=any(c.reloptions)) then raise exception 'security invoker view postflight failed'; end if;
 if has_table_privilege('anon','public.pending_appointment_review_inbox','SELECT') then raise exception 'anon view read must be denied'; end if;
 if has_table_privilege('authenticated','public.pending_appointment_review_inbox','INSERT')
 or has_table_privilege('authenticated','public.pending_appointment_review_inbox','UPDATE')
 or has_table_privilege('authenticated','public.pending_appointment_review_inbox','DELETE')
 then raise exception 'read-only view must reject client writes'; end if;
end $$;
commit;
