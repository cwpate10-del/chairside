import { list, get, put } from '@vercel/blob';

// One function for the whole admin surface. Vercel reuses the instance across
// these routes, which it cannot do if each one is its own file.
//
//   GET  ?key=            list every submission, newest first
//   GET  ?key=&photo=     stream one private photo
//   POST ?key=            { id, status } to mark a submission handled
//
// The key is the password. Vercel's real password protection is a paid add-on,
// so anyone holding this URL has access. See admin.html for the same warning.

const STATUSES = ['new', 'added', 'skipped'];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Constant time, so the key can't be guessed a character at a time by timing.
function keyMatches(given) {
  const want = process.env.ADMIN_KEY || '';
  if (!want || typeof given !== 'string' || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

async function readRecord(pathname) {
  // useCache:false because these records get rewritten when a status changes,
  // and a cached read can serve the pre-edit version for up to a minute. An
  // admin page showing stale statuses is worse than a slightly slower one.
  const res = await get(pathname, { access: 'private', useCache: false });
  if (res?.statusCode !== 200) return null;
  try {
    return JSON.parse(await new Response(res.stream).text());
  } catch {
    return { id: pathname, broken: true, pathname };
  }
}

async function handler(request) {
  const url = new URL(request.url);

  if (!process.env.ADMIN_KEY) {
    return json({ error: 'ADMIN_KEY is not set on this deployment.' }, 503);
  }
  if (!keyMatches(url.searchParams.get('key'))) {
    return json({ error: 'Nope.' }, 401);
  }

  // Stream a single private photo through the function, since the store is
  // private and the browser cannot fetch from it directly.
  const photo = url.searchParams.get('photo');
  if (photo) {
    if (!photo.startsWith('submissions/')) return json({ error: 'Bad path.' }, 400);
    const res = await get(photo, { access: 'private' });
    if (res?.statusCode !== 200) return json({ error: 'Not found.' }, 404);
    return new Response(res.stream, {
      headers: {
        'Content-Type': res.blob.contentType || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache',
      },
    });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Send JSON.' }, 400);
    }
    if (!body?.id || !STATUSES.includes(body.status)) {
      return json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400);
    }
    const pathname = `submissions/${body.id}.json`;
    const record = await readRecord(pathname);
    if (!record) return json({ error: 'No such submission.' }, 404);

    record.status = body.status;
    record.statusChanged = new Date().toISOString();
    await put(pathname, JSON.stringify(record, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true, // this path exists by definition; we are editing it
      contentType: 'application/json',
    });
    return json({ ok: true, id: body.id, status: record.status });
  }

  if (request.method !== 'GET') return json({ error: 'GET or POST.' }, 405);

  const { blobs } = await list({ prefix: 'submissions/', limit: 1000 });
  const records = (
    await Promise.all(
      blobs
        .filter((b) => b.pathname.endsWith('.json'))
        .map((b) => readRecord(b.pathname).catch(() => null)),
    )
  ).filter(Boolean);

  records.sort((a, b) => String(b.received).localeCompare(String(a.received)));
  return json({ ok: true, count: records.length, submissions: records });
}

export default { fetch: handler };
