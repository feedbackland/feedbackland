// Synthetic reproductions for the accompanying design review. No real keys or user data.
// Install dependencies in a separate directory, then set REVIEW_DEPENDENCY_DIR to it.
// Run only against the isolated local test cluster described in the review.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

const dependencyDirectory = process.env.REVIEW_DEPENDENCY_DIR;
if (!dependencyDirectory) throw new Error('Set REVIEW_DEPENDENCY_DIR to the isolated dependency directory');
const require = createRequire(resolve(dependencyDirectory, 'package.json'));
const load = (name) => import(pathToFileURL(require.resolve(name)).href);
const { Pool, Client } = require('pg');
const { betterAuth } = await load('better-auth');
const { bearer } = await load('better-auth/plugins');
const { getMigrations } = await load('better-auth/db/migration');
const { streamText } = await load('ai');
const { createOpenAICompatible } = await load('@ai-sdk/openai-compatible');
const connectionString = 'postgres://review@127.0.0.1:55437/postgres';
const schema = 'review_' + randomBytes(6).toString('hex');
const pool = new Pool({ connectionString, options: '-c search_path=' + schema + ',public' });
const emit = (test, result) => console.log(JSON.stringify({ test, ...result }));
await pool.query('CREATE SCHEMA ' + schema);
const options = {
  database: pool,
  secret: 'synthetic-review-secret-012345678901234567890123456789',
  baseURL: 'http://localhost:3000', telemetry: { enabled: false },
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  user: { additionalFields: { role: { type: 'string', required: true, defaultValue: 'user', input: false } } },
  session: { modelName: 'auth_session', additionalFields: { scope: { type: 'string', required: false, defaultValue: 'first-party', input: false } } },
  account: { modelName: 'auth_account', accountLinking: { enabled: false } },
  verification: { modelName: 'auth_verification' }, plugins: [bearer({ requireSignature: true })],
  databaseHooks: {
    session: { create: { before: async (session, ctx) => {
      if (ctx?.headers?.get('x-feedbackland-scope') === 'embedded' || ctx?.context?.session?.session?.scope === 'embedded') return { data: { scope: 'embedded' } };
    } } },
    user: { update: { before: async (data, ctx) => ({ data: {
      ...data,
      image: ctx?.path?.startsWith('/callback/') && typeof data.image === 'string' && data.image.startsWith('https:') ? data.image : null,
    } }) } },
  },
};
let a, b;
try {
  await (await getMigrations(options)).runMigrations();
  const auth = betterAuth(options);
  const response = await auth.handler(new Request('http://localhost:3000/api/auth/sign-up/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', 'x-feedbackland-scope': 'embedded' },
    body: JSON.stringify({ name: 'Synthetic user', email: 'review@example.test', password: 'synthetic-password' }),
  }));
  const token = response.headers.get('set-auth-token');
  const user = (await response.json()).user;
  await pool.query('UPDATE "user" SET role=\'admin\', image=\'https://provider.example.test/avatar.png\' WHERE id=$1', [user.id]);
  const headers = new Headers({ Authorization: 'Bearer ' + token });
  const session = await auth.api.getSession({ headers });
  emit('embedded admin permission mapping', { role: session.user.role, scope: session.session.scope, existingEditDeletePredicate: session.user.role === 'admin', scopedAdminPredicate: session.user.role === 'admin' && session.session.scope === 'first-party' });
  await auth.api.updateUser({ body: { name: 'Renamed' }, headers });
  emit('name-only update with specified avatar hook', { image: (await pool.query('SELECT image FROM "user" WHERE id=$1', [user.id])).rows[0].image });

  const logs = [];
  const marker = 'SYNTHETIC-PRIVATE-CONTENT-review@example.test';
  const provider = createOpenAICompatible({ name: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', fetch: async () => new Response(JSON.stringify({ error: { message: 'Provider rejected: ' + marker } }), { status: 401, headers: { 'Content-Type': 'application/json' } }) });
  await streamText({ model: provider.chatModel('synthetic-model'), prompt: marker, maxRetries: 0, onError: ({ error }) => logs.push({ status: error.statusCode, message: error.message }) }).consumeStream();
  emit('status-and-message logging', { privateMarkerInMessage: JSON.stringify(logs).includes(marker) });

  const originalUrl = 'postgres://user:synthetic-password@db.example.test/feedback?ssl=true';
  const cleaned = new URL(originalUrl);
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslpassword', 'uselibpqcompat']) cleaned.searchParams.delete(key);
  emit('TLS mapping', { originalTls: new Client({ connectionString: originalUrl }).connectionParameters.ssl, specifiedTls: new Client({ connectionString: cleaned.href, ssl: false }).connectionParameters.ssl });

  await pool.query('CREATE TABLE posts(id int PRIMARY KEY, body text, embedding text, "updatedAt" timestamptz(3) NOT NULL DEFAULT now()); INSERT INTO posts(id,body) VALUES(1,\'initial\')');
  let collisions = 0;
  for (let i = 0; i < 100; i++) {
    const before = (await pool.query('UPDATE posts SET "updatedAt"=now() WHERE id=1 RETURNING "updatedAt"')).rows[0].updatedAt;
    const after = (await pool.query('UPDATE posts SET "updatedAt"=now() WHERE id=1 RETURNING "updatedAt"')).rows[0].updatedAt;
    if (before.getTime() === after.getTime()) collisions++;
  }
  emit('natural timestamp collisions', { pairs: 100, collisions });
  const seen = (await pool.query('UPDATE posts SET body=\'old edit\',"updatedAt"=now() WHERE id=1 RETURNING "updatedAt"')).rows[0].updatedAt;
  await pool.query('UPDATE posts SET body=\'new edit\',embedding=NULL,"updatedAt"=$1 WHERE id=1', [seen]);
  emit('stale embedding with equal admitted timestamps', { rows: (await pool.query('UPDATE posts SET embedding=\'vector for old edit\' WHERE id=1 AND "updatedAt"=$1 RETURNING body,embedding', [seen])).rows });

  a = await pool.connect(); b = await pool.connect();
  await a.query('BEGIN'); await a.query('SELECT now()');
  await new Promise((r) => setTimeout(r, 30));
  const newer = (await b.query('UPDATE posts SET "updatedAt"=now() WHERE id=1 RETURNING "updatedAt"')).rows[0].updatedAt;
  const later = (await a.query('UPDATE posts SET "updatedAt"=now() WHERE id=1 RETURNING "updatedAt"')).rows[0].updatedAt;
  await a.query('COMMIT');
  emit('later commit timestamp', { wentBackwards: later.getTime() < newer.getTime() });

  await pool.query('CREATE TABLE admins(id text PRIMARY KEY,role text); INSERT INTO admins VALUES(\'A\',\'admin\'),(\'B\',\'admin\')');
  await a.query('BEGIN'); await b.query('BEGIN');
  const ar = (await a.query('SELECT role FROM admins WHERE id=\'A\'')).rows[0].role;
  const br = (await b.query('SELECT role FROM admins WHERE id=\'B\'')).rows[0].role;
  if (ar === 'admin') await a.query('UPDATE admins SET role=\'user\' WHERE id=\'B\'');
  if (br === 'admin') await b.query('UPDATE admins SET role=\'user\' WHERE id=\'A\'');
  await a.query('COMMIT'); await b.query('COMMIT');
  emit('mutual admin demotion', { remainingAdmins: (await pool.query('SELECT count(*)::int AS n FROM admins WHERE role=\'admin\'')).rows[0].n });

  await pool.query('CREATE TABLE image_quota(id int PRIMARY KEY,bytes int); INSERT INTO image_quota VALUES(1,9)');
  await a.query('BEGIN'); await b.query('BEGIN');
  const qa = (await a.query('SELECT sum(bytes)::int AS n FROM image_quota')).rows[0].n;
  const qb = (await b.query('SELECT sum(bytes)::int AS n FROM image_quota')).rows[0].n;
  if (qa + 1 <= 10) await a.query('INSERT INTO image_quota VALUES(2,1)');
  if (qb + 1 <= 10) await b.query('INSERT INTO image_quota VALUES(3,1)');
  await a.query('COMMIT'); await b.query('COMMIT');
  emit('sum-then-insert quota', { cap: 10, actual: (await pool.query('SELECT sum(bytes)::int AS n FROM image_quota')).rows[0].n });

  await pool.query('CREATE TABLE runs(id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,status text)');
  await a.query('BEGIN'); await b.query('BEGIN');
  const ra = await a.query('SELECT id FROM runs WHERE status=\'running\'');
  const rb = await b.query('SELECT id FROM runs WHERE status=\'running\'');
  if (!ra.rowCount) await a.query('INSERT INTO runs(status) VALUES(\'running\')');
  if (!rb.rowCount) await b.query('INSERT INTO runs(status) VALUES(\'running\')');
  await a.query('COMMIT'); await b.query('COMMIT');
  emit('unconstrained insights singleton', { running: (await pool.query('SELECT count(*)::int AS n FROM runs WHERE status=\'running\'')).rows[0].n });

  await pool.query('CREATE TABLE parent_posts(id int PRIMARY KEY); CREATE TABLE parent_comments(id int PRIMARY KEY,"postId" int REFERENCES parent_posts(id) ON DELETE CASCADE,"parentCommentId" int REFERENCES parent_comments(id) ON DELETE CASCADE); INSERT INTO parent_posts VALUES(1),(2); INSERT INTO parent_comments VALUES(1,1,NULL),(2,2,1)');
  await pool.query('DELETE FROM parent_posts WHERE id=1');
  emit('cross-post parent cascade', { commentsLeftOnUnrelatedPost: (await pool.query('SELECT count(*)::int AS n FROM parent_comments WHERE "postId"=2')).rows[0].n });
  const keys = ['sk-or-v1-synthetic-A-00ab', 'sk-or-v1-synthetic-B-00ab'];
  emit('last-four identity collision', { sameLastFour: keys[0].slice(-4) === keys[1].slice(-4), sameSha256: createHash('sha256').update(keys[0]).digest('hex') === createHash('sha256').update(keys[1]).digest('hex') });
  const { getEncoding } = await load('js-tiktoken');
  const multilingualText = ('\u9f98 '.repeat(3000)).trim();
  emit('multilingual embedding token cap', { characters: multilingualText.length, tokens: getEncoding('cl100k_base').encode(multilingualText).length });
  const residuePattern = /(?<![\w./-])orgs?\b|orgid|orgname|orgurl|orgsubdomain|isclaimed|user_org|userorg|platform-?urls?|platformid|subdomain|maindomain|claimorg|createorg|getorg|updateorg|useorg|globalorgstate|organi[sz]ation|(?<!microsoft_)tenant(?!_?id)|isselfhosted|self_hosted|vercel|feedbackland\.com/i;
  emit('V6 versus required neutralisation', { requiredLiteral: 'VERCEL_URL', rejected: residuePattern.test('VERCEL_URL') });
  emit('retained proof schema', { schema });
} finally {
  if (a) { await a.query('ROLLBACK').catch(() => {}); a.release(); }
  if (b) { await b.query('ROLLBACK').catch(() => {}); b.release(); }
  await pool.end();
}
