// Synthetic checks of revision-4 SQL/package contracts, not application integration tests.
// Uses only the disposable loopback cluster/dependencies described in the review.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!process.env.REVIEW_DEPENDENCY_DIR) throw new Error('Set REVIEW_DEPENDENCY_DIR');
const require = createRequire(resolve(process.env.REVIEW_DEPENDENCY_DIR, 'package.json'));
const { Pool } = require('pg');
const { getEncoding } = require('js-tiktoken');
const load = (name) => import(pathToFileURL(require.resolve(name)).href);
const { betterAuth } = await load('better-auth');
const { APIError } = await load('better-auth/api');
const { getMigrations } = await load('better-auth/db/migration');
const schema = 'review_v4_' + randomBytes(8).toString('hex');
assert.match(schema, /^review_v4_[a-f0-9]{16}$/);
const pool = new Pool({ connectionString: 'postgres://review@127.0.0.1:55437/postgres', max: 8,
  options: '-c search_path=' + schema + ',public' });
const emit = (test, details = {}) => console.log(JSON.stringify({ test, passed: true, ...details }));
const tx = async (fn) => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
let created = false;
try {
  await pool.query('CREATE SCHEMA ' + schema); created = true;
  await pool.query(`CREATE TABLE content(id integer PRIMARY KEY, body text, revision bigint NOT NULL DEFAULT 1, embedding text);
    INSERT INTO content(id,body) VALUES(1,'old');
    CREATE TABLE members(id integer PRIMARY KEY, role text NOT NULL);
    INSERT INTO members VALUES(1,'admin'),(2,'admin');
    CREATE TABLE image_bytes(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, size integer NOT NULL);
    INSERT INTO image_bytes(size) VALUES(9);
    CREATE TABLE reports(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, status text NOT NULL);
    CREATE UNIQUE INDEX one_running ON reports ((1)) WHERE status='running';
    CREATE TABLE posts(id integer PRIMARY KEY); INSERT INTO posts VALUES(1),(2);
    CREATE TABLE replies(id integer PRIMARY KEY, post integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      parent integer, UNIQUE(id,post), FOREIGN KEY(parent,post) REFERENCES replies(id,post) ON DELETE CASCADE);
    INSERT INTO replies VALUES(1,1,NULL),(2,2,NULL);
    CREATE TABLE config(id integer PRIMARY KEY, revision bigint NOT NULL, token text, enabled boolean, verdict text);
    INSERT INTO config VALUES(1,1,'old',NULL,NULL);
    CREATE TABLE leases(name text PRIMARY KEY, holder text NOT NULL, until timestamptz NOT NULL, fence bigint NOT NULL);
    CREATE TABLE budget(key text PRIMARY KEY, count integer NOT NULL);`);

  const saved = await Promise.all([1,2].map((i) => pool.query(
    'UPDATE content SET body=$1,revision=revision+1 WHERE id=1 AND revision=1 RETURNING revision', ['edit-' + i])));
  assert.equal(saved.reduce((n,x) => n+x.rowCount,0), 1);
  assert.equal((await pool.query("UPDATE content SET embedding='stale' WHERE id=1 AND revision=1")).rowCount,0);
  assert.equal((await pool.query('SELECT revision FROM content')).rows[0].revision,'2');
  emit('integer revision CAS and stale embedding', { competingSaves:2, accepted:1, staleWrites:0 });

  let adminTrials = 0;
  for (let trial=0; trial<10; trial++) {
    await pool.query("UPDATE members SET role='admin'");
    await Promise.all([[1,2],[2,1]].map(([actor,target]) => tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(4702111234474983748)');
      const role=(await c.query('SELECT role FROM members WHERE id=$1',[actor])).rows[0].role;
      const count=Number((await c.query("SELECT count(*) FROM members WHERE role='admin'")).rows[0].count);
      if (role==='admin' && count>1) await c.query("UPDATE members SET role='user' WHERE id=$1",[target]);
    })));
    assert.equal(Number((await pool.query("SELECT count(*) FROM members WHERE role='admin'")).rows[0].count),1);
    adminTrials++;
  }
  emit('serialized mutual admin demotion', { trials:adminTrials, survivingAdmins:1 });

  const uploads=await Promise.all(Array.from({length:20},() => tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(4702111234474983749)');
    const size=Number((await c.query('SELECT coalesce(sum(size),0) AS size FROM image_bytes')).rows[0].size);
    if(size+1>10) return false;
    await c.query('INSERT INTO image_bytes(size) VALUES(1)'); return true;
  })));
  assert.equal(uploads.filter(Boolean).length,1);
  assert.equal(Number((await pool.query('SELECT sum(size) AS size FROM image_bytes')).rows[0].size),10);
  emit('serialized image quota', { contenders:20, admitted:1, bytes:10, cap:10 });

  const runs=await Promise.all(Array.from({length:20},() => tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(4702111234474983751)');
    const current=await c.query("SELECT id FROM reports WHERE status='running'");
    if(current.rowCount) return current.rows[0].id;
    return (await c.query("INSERT INTO reports(status) VALUES('running') RETURNING id")).rows[0].id;
  })));
  assert.equal(new Set(runs).size,1);
  await assert.rejects(pool.query("INSERT INTO reports(status) VALUES('running')"),e=>e.code==='23505');
  emit('singleton insight start and structural backstop', { contenders:20, uniqueRunIds:1 });

  await assert.rejects(pool.query('INSERT INTO replies VALUES(3,2,1)'), e=>e.code==='23503');
  await pool.query('INSERT INTO replies VALUES(4,2,2); DELETE FROM posts WHERE id=1');
  assert.equal(Number((await pool.query('SELECT count(*) FROM replies WHERE post=2')).rows[0].count),2);
  emit('composite reply parent foreign key', { crossPostRejected:true, unrelatedCommentsSurvive:2 });

  const digest=(v)=>createHash('sha256').update(v).digest('hex');
  const oldKey='synthetic-key-A-aaaa', newKey='synthetic-key-B-aaaa';
  assert.equal(oldKey.slice(-4),newKey.slice(-4)); assert.notEqual(digest(oldKey),digest(newKey));
  await pool.query("UPDATE config SET revision=revision+1,token='new',enabled=false WHERE id=1");
  const late=await pool.query("UPDATE config SET enabled=true,verdict='pass' WHERE id=1 AND revision=1 AND token='old' AND enabled IS NULL");
  assert.equal(late.rowCount,0);
  emit('full key identity and delayed enable fence', { sameSuffix:true, distinctDigest:true, lateWrites:0 });

  await pool.query("INSERT INTO leases VALUES('ai','A',clock_timestamp()-interval '1 second',1)");
  const acquired=await pool.query("UPDATE leases SET holder='B',fence=fence+1,until=clock_timestamp()+interval '90 seconds' WHERE name='ai' AND until<clock_timestamp() RETURNING fence");
  assert.equal(acquired.rows[0].fence,'2');
  const oldRenew=await pool.query("UPDATE leases SET until=clock_timestamp()+interval '90 seconds' WHERE name='ai' AND holder='A' AND fence=1 AND until>clock_timestamp()");
  assert.equal(oldRenew.rowCount,0);
  emit('lease takeover fences expired holder', { newFence:'2', oldRenewals:0 });

  await pool.query("INSERT INTO budget VALUES('day',6)");
  const reserve=async(n,cap)=>{
    if(n>cap) return false;
    return Boolean((await pool.query('INSERT INTO budget(key,count) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET count=budget.count+$2 WHERE budget.count+$2<=$3 RETURNING count',['day',n,cap])).rowCount);
  };
  assert.equal(await reserve(3,8),false); // two chunks + one merge cannot fit
  assert.equal(await reserve(2,8),true);
  assert.equal(await reserve(1,8),false);
  assert.equal(await reserve(1,10),true); assert.equal(await reserve(1,10),true);
  assert.equal(await reserve(1,10),false);
  emit('chunk plus merge reservation protects moderation share', { startingCount:6, nonModerationCap:8, mergePlanRefused:true, finalCount:10 });

  const tokenizer=getEncoding('cl100k_base');
  const multilingual=Array(3000).fill('\u9f98').join(' ');
  const points=Array.from(multilingual); let lo=0,hi=points.length;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(tokenizer.encode(points.slice(0,mid).join('')).length<=8000)lo=mid;else hi=mid-1;}
  const prepared=points.slice(0,lo).join('');
  assert.equal(tokenizer.encode(multilingual).length,8999);
  assert.ok(tokenizer.encode(prepared).length<=8000);
  emit('multilingual embedding token preparation', { originalCharacters:multilingual.length, originalTokens:8999, preparedTokens:tokenizer.encode(prepared).length });

  const authOptions={database:pool,secret:'synthetic-only-random-shaped-secret-123456789012345678901234567890',
    baseURL:'http://localhost:3000',telemetry:{enabled:false},emailAndPassword:{enabled:true},
    databaseHooks:{user:{update:{before:async(data,ctx)=>{
      if(data.image === undefined) return {data};
      if(!ctx?.path?.startsWith('/callback/')) throw APIError.fromStatus('BAD_REQUEST',{code:'FIELD_NOT_ALLOWED',message:'Field not allowed'});
      return {data:{...data,image:typeof data.image==='string'&&new URL(data.image).protocol==='https:'?data.image:null}};
    }}}}};
  await (await getMigrations(authOptions)).runMigrations();
  const auth=betterAuth(authOptions);
  const response=await auth.handler(new Request('http://localhost:3000/api/auth/sign-up/email',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000'},
    body:JSON.stringify({name:'Test',email:'v4@example.test',password:'synthetic-password'})}));
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const user=(await response.json()).user;
  await pool.query('UPDATE "user" SET image=$1 WHERE id=$2',['https://provider.example.test/avatar.png',user.id]);
  await auth.api.updateUser({body:{name:'Renamed'},headers:new Headers({Cookie:cookie})});
  await assert.rejects(auth.api.updateUser({body:{image:'https://tracker.example.test/pixel'},headers:new Headers({Cookie:cookie})}),e=>e.status==='BAD_REQUEST');
  assert.equal((await pool.query('SELECT image FROM "user" WHERE id=$1',[user.id])).rows[0].image,'https://provider.example.test/avatar.png');
  emit('undefined-image avatar hook against Better Auth 1.7.6', { retained:true, trackingUpdateRejected:true });

  const plan=readFileSync(new URL('../specs/2026-09-13-self-hosted-single-tenant-design.md',import.meta.url),'utf8');
  const start=plan.indexOf('        umask 077\n');
  assert.ok(start>0);
  const end=plan.indexOf('        while true;',start);
  const validation=plan.slice(start,end).split('\n').map(l=>l.replace(/^        /,'')).join('\n').replaceAll('$$','$');
  const shell=process.env.REVIEW_SHELL || (process.platform==='win32'?'C:/Program Files/Git/usr/bin/sh.exe':'/bin/sh');
  const cases=[['0','14'],['-1','14'],['1.5','14'],['abc','14'],['169','14'],['01','14'],['24','0'],['24','366'],['24','1e2'],['999999999999999999999','14']];
  for(const [hours,keep] of cases){
    const result=spawnSync(shell,['-c',validation+'\nprintf validated\n'],{env:{...process.env,BACKUP_INTERVAL_HOURS:hours,BACKUP_KEEP:keep},encoding:'utf8'});
    assert.equal(result.error,undefined); assert.notEqual(result.status,0); assert.ok(!result.stdout.includes('validated'));
  }
  for(const [hours,keep] of [['1','1'],['24','14'],['168','365']]){
    const result=spawnSync(shell,['-c',validation+'\nprintf validated\n'],{env:{...process.env,BACKUP_INTERVAL_HOURS:hours,BACKUP_KEEP:keep},encoding:'utf8'});
    assert.equal(result.status,0); assert.equal(result.stdout,'validated');
  }
  emit('actual plan backup shell validation', { rejectedCases:cases.length, acceptedBoundaries:3 });

  // Prototype of the specified byte/encoding contract, not an application helper.
  const decodeCode=(input)=>{
    const value=input.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g,'');
    let bytes;
    if(/^[a-fA-F0-9]{64}$/.test(value)) bytes=Buffer.from(value,'hex');
    else if(/^[A-Za-z0-9+/]{43}=$/.test(value)){
      bytes=Buffer.from(value,'base64');
      if(bytes.toString('base64')!==value) throw new Error('NONCANONICAL_CODE');
    }else throw new Error('INVALID_CODE');
    assert.equal(bytes.length,32);
    for(let period=1;period<=16;period++)
      if([...bytes].every((b,i)=>b===bytes[i%period])) throw new Error('WEAK_CODE');
    for(const direction of [1,-1])
      if([...bytes].every((b,i)=>b===((bytes[0]+direction*i)%256+256)%256)) throw new Error('WEAK_CODE');
    return bytes;
  };
  const fresh=randomBytes(32), hex=fresh.toString('hex'), base64=fresh.toString('base64');
  assert.deepEqual(decodeCode(hex),fresh); assert.deepEqual(decodeCode(hex.toUpperCase()),fresh);
  assert.deepEqual(decodeCode(' \t'+base64+'\r\n'),fresh);
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const alias=base64.slice(0,42)+alphabet[alphabet.indexOf(base64[42])|1]+'=';
  assert.throws(()=>decodeCode(alias),/NONCANONICAL_CODE/);
  for(const weak of ['0'.repeat(64),'A'.repeat(43)+'=',Buffer.from(Array.from({length:32},(_,i)=>i)).toString('hex'),hex.slice(0,-1),'not-a-random-code'])
    assert.throws(()=>decodeCode(weak));
  emit('setup code byte identity and canonical platform encodings', { bytes:32, hexCaseIndependent:true, base64RoundTrips:true, noncanonicalAliasRejected:true, weakOrMalformedRejected:5 });
} finally {
  if(created) await pool.query('DROP SCHEMA '+schema+' CASCADE');
  await pool.end();
}
