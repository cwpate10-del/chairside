import { put } from '@vercel/blob';

// Where the "you have a signup" notice goes. Resend will only deliver to the
// account address until chairside.ink is verified, which needs Namecheap access.
const NOTIFY_TO = 'cwpate10@gmail.com';
const NOTIFY_FROM = 'onboarding@resend.dev';

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Every field the signup form posts. Anything not on this list is ignored, so a
// new form field has to be added here deliberately rather than arriving silently.
const FIELDS = [
  'plan', 'service', 'name', 'email', 'social', 'website', 'booking',
  'city', 'shop', 'experience', 'gender', 'styles', 'piercings', 'bio', 'notes',
];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'artist';

// Must be exported as a `fetch` object. A bare default-exported function is
// read as the legacy (req, res) Node signature, and returning a Response from
// that never writes to res, so the request hangs until the platform kills it.
export default { fetch: handler };

async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Send this as a POST.' }, 405);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'We could not read that submission.' }, 400);
  }

  // Bots fill hidden fields. Answer as if it worked so they stop retrying.
  if ((form.get('_honey') || '').toString().trim()) {
    return json({ ok: true, id: 'ignored' });
  }

  const read = (n) => (form.get(n) ?? '').toString().trim();
  const fields = Object.fromEntries(FIELDS.map((f) => [f, read(f)]));

  const missing = ['name', 'email', 'city'].filter((f) => !fields[f]);
  if (missing.length) {
    return json({ error: `Missing ${missing.join(', ')}.` }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    return json({ error: 'That email address does not look right.' }, 400);
  }

  // Timestamp alone collides if two submissions land in the same millisecond,
  // and these paths overwrite, so the random tail is what stops a silent loss.
  const id = `${slug(fields.name)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  // Photos go up first. If one fails the whole submission fails loudly here,
  // before anything is recorded, rather than leaving a half-saved artist.
  const photos = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('attachment')) continue;
    if (typeof value === 'string' || !value.size) continue;
    if (photos.length >= MAX_PHOTOS) break;
    if (!value.type.startsWith('image/')) continue;
    if (value.size > MAX_PHOTO_BYTES) continue;

    const ext = (value.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const blob = await put(`submissions/${id}/photo-${photos.length + 1}.${ext}`, value, {
      access: 'private',
      addRandomSuffix: false,
      contentType: value.type,
    });
    photos.push({ pathname: blob.pathname, bytes: value.size, type: value.type });
  }

  const record = {
    id,
    received: new Date().toISOString(),
    status: 'new',
    ...fields,
    photos,
    source: request.headers.get('referer') || '',
  };

  // The record is written before we try to email. An artist is "received" the
  // moment this resolves, whether or not the notification ever arrives.
  await put(`submissions/${id}.json`, JSON.stringify(record, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
  });

  // A dead mail provider must not turn a saved submission into a failed one.
  let notified = false;
  let notifyError = null;
  try {
    await notify(record);
    notified = true;
  } catch (err) {
    notifyError = err?.message || String(err);
    console.error('signup saved but notification failed', { id, error: notifyError });
  }

  // A native form post (JavaScript disabled or broken) asks for HTML, not
  // JSON. Send those to the confirmation page rather than a wall of braces.
  if ((request.headers.get('accept') || '').includes('text/html')) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/signup.html?submitted=1', 'Cache-Control': 'no-store' },
    });
  }

  return json({ ok: true, id, photos: photos.length, notified, notifyError });
}

async function notify(record) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');

  const line = (label, value) => (value ? `${label}: ${value}\n` : '');
  const body =
    `${record.name} just signed up for Chairside.\n\n` +
    line('Plan', record.plan) +
    line('Does', record.service) +
    line('Email', record.email) +
    line('City', record.city) +
    line('Shop', record.shop) +
    line('Styles', record.styles) +
    line('Piercings', record.piercings) +
    line('Experience', record.experience) +
    line('Social', record.social) +
    line('Website', record.website) +
    line('Books via', record.booking) +
    line('Gender', record.gender) +
    (record.bio ? `\nBio:\n${record.bio}\n` : '') +
    (record.notes ? `\nNotes for you:\n${record.notes}\n` : '') +
    `\nPhotos: ${record.photos.length}\n` +
    `Record: submissions/${record.id}.json\n`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: [NOTIFY_TO],
      reply_to: record.email,
      subject: `${record.plan === 'featured' ? 'FEATURED' : 'New'} signup: ${record.name}`,
      text: body,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend returned ${res.status}: ${await res.text()}`);
  }
}
