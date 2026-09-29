-- Catalog metadata only: no table rows, OAuth tokens, or secrets are read.
-- Run unchanged on the disposable canonical-plus-overlay fixture and live
-- staging. Compare every object/section fingerprint, not only the aggregate.
with target as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity,
         c.relforcerowsecurity, c.reloptions, c.relowner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'appointment_review_requests',
      'appointment_review_decisions',
      'appointment_booking_approvals',
      'appointment_booking_attempts',
      'pending_appointment_review_inbox',
      'audit_events',
      'calendar_oauth_connections'
    )
), sections as (
  select t.relname, 'relation'::text as section,
         jsonb_build_object(
           'kind', t.relkind,
           'rls', t.relrowsecurity,
           'force_rls', t.relforcerowsecurity,
           'options', coalesce(to_jsonb(t.reloptions), '[]'::jsonb),
           'owner', pg_get_userbyid(t.relowner)
         ) as metadata
  from target t
  union all
  select t.relname, 'columns',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'name', a.attname,
             'type', format_type(a.atttypid, a.atttypmod),
             'not_null', a.attnotnull,
             'default', pg_get_expr(d.adbin, d.adrelid),
             'identity', a.attidentity,
             'generated', a.attgenerated,
             'collation', a.attcollation::regcollation::text
           ) order by a.attnum)
           from pg_attribute a
           left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
           where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
         ), '[]'::jsonb)
  from target t
  union all
  select t.relname, 'constraints',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'name', con.conname,
             'type', con.contype,
             'validated', con.convalidated,
             'deferrable', con.condeferrable,
             'deferred', con.condeferred,
             'definition', pg_get_constraintdef(con.oid, true)
           ) order by con.conname)
           from pg_constraint con where con.conrelid = t.oid
         ), '[]'::jsonb)
  from target t
  union all
  select t.relname, 'indexes',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'name', i.relname,
             'definition', pg_get_indexdef(i.oid)
           ) order by i.relname)
           from pg_index x join pg_class i on i.oid = x.indexrelid
           where x.indrelid = t.oid
         ), '[]'::jsonb)
  from target t
  union all
  select t.relname, 'policies',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'name', p.polname,
             'command', p.polcmd,
             'permissive', p.polpermissive,
             'roles', (
               select coalesce(jsonb_agg(coalesce(r.rolname, 'PUBLIC')
                                     order by coalesce(r.rolname, 'PUBLIC')), '[]'::jsonb)
               from unnest(p.polroles) as role_oid
               left join pg_roles r on r.oid = role_oid
             ),
             'using', pg_get_expr(p.polqual, p.polrelid),
             'check', pg_get_expr(p.polwithcheck, p.polrelid)
           ) order by p.polname)
           from pg_policy p where p.polrelid = t.oid
         ), '[]'::jsonb)
  from target t
  union all
  select t.relname, 'triggers',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'name', tr.tgname,
             'enabled', tr.tgenabled,
             'definition', pg_get_triggerdef(tr.oid, true)
           ) order by tr.tgname)
           from pg_trigger tr where tr.tgrelid = t.oid and not tr.tgisinternal
         ), '[]'::jsonb)
  from target t
  union all
  select t.relname, 'client_privileges',
         jsonb_build_object(
           'anon_select', has_table_privilege('anon', t.oid, 'SELECT'),
           'anon_insert', has_table_privilege('anon', t.oid, 'INSERT'),
           'anon_update', has_table_privilege('anon', t.oid, 'UPDATE'),
           'anon_delete', has_table_privilege('anon', t.oid, 'DELETE'),
           'authenticated_select', has_table_privilege('authenticated', t.oid, 'SELECT'),
           'authenticated_insert', has_table_privilege('authenticated', t.oid, 'INSERT'),
           'authenticated_update', has_table_privilege('authenticated', t.oid, 'UPDATE'),
           'authenticated_delete', has_table_privilege('authenticated', t.oid, 'DELETE')
         )
  from target t
  union all
  select t.relname, 'view_definition',
         to_jsonb(case when t.relkind = 'v' then pg_get_viewdef(t.oid, true) else '' end)
  from target t
)
select relname as object_name, section, md5(metadata::text) as fingerprint
from sections
order by relname, section;
