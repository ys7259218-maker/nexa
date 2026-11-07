-- Catalog metadata only: no table rows, token values, or secrets are read.
-- Run unchanged on the disposable canonical-plus-overlay fixture and live
-- staging. Compare names, installed versions, and extension schemas.
select e.extname as extension_name,
       e.extversion as installed_version,
       n.nspname as extension_schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;
