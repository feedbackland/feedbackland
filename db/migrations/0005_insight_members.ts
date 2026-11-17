import "server-only";
import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await sql`
    create table insight_rollback_history (id bigint primary key, report jsonb not null);
    alter table insights add column version uuid not null default gen_random_uuid();
    create table insight_member (
      "insightId" uuid not null references insights(id) on delete cascade,
      ordinal integer not null,
      "postId" uuid not null,
      primary key ("insightId",ordinal),
      unique ("postId","insightId")
    );
    insert into insight_member
      select i.id,min(n),post::uuid from insights i cross join lateral unnest(i.ids) with ordinality m(post,n)
      where pg_input_is_valid(post,\'uuid\') group by i.id,post::uuid;
    create function refresh_insight_members() returns trigger language plpgsql as $$
    begin
      if tg_op = 'UPDATE' then
        if old.ids is not distinct from new.ids then return new; end if;
        delete from insight_member where "insightId"=new.id;
      end if;
      insert into insight_member
        select new.id,min(n),post::uuid from unnest(new.ids) with ordinality m(post,n)
        where pg_input_is_valid(post,\'uuid\') group by post::uuid;
      return new;
    end $$;
    create trigger insight_members after insert or update of ids on insights
      for each row execute function refresh_insight_members();
    create function version_insight() returns trigger language plpgsql as $$
    begin new.version=gen_random_uuid(); return new; end $$;
    create trigger insight_version before update of ids,"isArchived" on insights
      for each row execute function version_insight();
    create index user_upvote_insights_idx on user_upvote("contentId","createdAt" desc,"userId");
    create index comment_insights_activity_idx on comment("postId","createdAt" desc,id)
      where content not like 'Updated status to%';
  `.execute(db);
}
