-- Run after stopping every application replica and before starting P09.
begin;
select pg_advisory_xact_lock(4702111234474983751);
lock table insight_reports in access exclusive mode;
update insight_reports set status='failed',stage='complete',error='stale-run',
  "finishedAt"=clock_timestamp() where status='running';
update insight_reports set "inputSnapshot"=null,"requestPlan"=null
  where "inputSnapshot" is not null or "requestPlan" is not null;
-- P09 reads the newest row as a successful summary. Keep failed-run metadata
-- separately so even an instance with no previous success reads correctly.
with moved as (
  delete from insight_reports where status='failed' returning *
) insert into insight_rollback_history(id,report)
  select id,to_jsonb(moved)-'inputSnapshot'-'requestPlan' from moved
  on conflict (id) do update set report=excluded.report;
delete from job_lease where name like 'insight:%';
commit;
