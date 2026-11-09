// Generates static, crawlable pages from public/shops.json + public/artists.json.
// Each page is a real URL so Google can index "tattoo shops chattanooga" and
// individual shop names. The Alpine app on / stays the interactive experience.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://chairside.ink'
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'))

const shops = read('public/shops.json')
const artists = read('public/artists.json')

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fullAddr = (s) => [s.address, `${s.city}, ${s.state}${s.zip ? ' ' + s.zip : ''}`].join(', ')
const svcLabel = (shop) => {
  const sv = shop.services || ['tattoo']
  if (sv.includes('tattoo') && sv.includes('piercing')) return 'Tattoo & Piercing'
  if (sv.includes('piercing')) return 'Piercing only'
  return 'Tattoo'
}
const artistsFor = (slug) => {
  const shop = shops.find((s) => s.slug === slug)
  return artists.filter((a) => a.org === shop.name || a.shop?.name === shop.name)
}

function page ({ title, description, path, body, schema }) {
  return `<!DOCTYPE html>
<html lang="en" class="h-full scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#0a0a0a">
  <link rel="canonical" href="${SITE}${path}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Chairside">
  <meta property="og:image" content="${SITE}/images/tattooing-bw.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="alternate icon" href="/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Pirata+One&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/src/main.css">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <script defer src="/_vercel/insights/script.js"></script>
</head>
<body class="flex h-full flex-col bg-ink-950 text-ink-100 antialiased font-sans">
  <header class="border-b border-ink-800">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <nav class="flex items-center justify-between py-5">
        <a href="/" class="flex items-center gap-2" aria-label="Chairside home">
          <span class="inline-block h-3 w-3 rounded-full bg-brass"></span>
          <span class="font-display text-3xl">Chairside</span>
        </a>
        <div class="hidden md:flex items-center gap-x-8 text-sm uppercase tracking-widest text-ink-200">
          <a href="/#browse" class="hover:text-white">Tattoos</a>
          <a href="/piercings.html" class="hover:text-white">Piercings</a>
          <a href="/chattanooga/shops/" class="hover:text-white">Shops</a>
          <a href="/aftercare.html" class="hover:text-white">Aftercare</a>
          <a href="/signup.html" class="hover:text-white">For Artists</a>
        </div>
        <a href="/chattanooga/shops/" class="md:hidden text-sm uppercase tracking-widest text-brass">Shops</a>
      </nav>
    </div>
  </header>
  <main class="flex-1">${body}</main>
  <footer class="border-t border-ink-800 py-10">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="inline-block h-2 w-2 rounded-full bg-brass"></span>
        <span class="font-display text-xl text-white">Chairside</span>
      </div>
      <div class="flex items-center gap-6 text-sm text-ink-500">
        <a href="/chattanooga/shops/" class="hover:text-white transition">Chattanooga shops</a>
        <a href="/aftercare.html" class="hover:text-white transition">Aftercare</a>
        <a href="/signup.html" class="hover:text-white transition">List your profile</a>
      </div>
      <p class="text-sm text-ink-500">&copy; ${new Date().getFullYear()} Chairside. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>
`
}

const claimBanner = (shopName, isEmpty, shop) => {
  const sv = (shop && shop.services) || ['tattoo']
  const piercingOnly = sv.includes('piercing') && !sv.includes('tattoo')
  const noun = piercingOnly ? 'piercer' : 'artist'
  const verb = piercingOnly ? 'pierce' : 'tattoo'
  const blurb = piercingOnly
    ? 'Chairside lists Chattanooga piercers by what they actually do, so someone after a curated ear or a septum can find the right person instead of calling around.'
    : 'Chairside lists Chattanooga artists by style, so clients can find the right person instead of scrolling hashtags.'
  return `
  <div class="mt-8 rounded-lg border border-dashed border-ink-700 bg-ink-900/50 px-6 py-6">
    <p class="font-display text-2xl text-white">${isEmpty ? `Be the first ${noun} from ${esc(shopName)} on Chairside` : `Also ${verb} at ${esc(shopName)}?`}</p>
    <p class="mt-2 text-sm text-ink-200 max-w-xl">${blurb} Your profile is free and links straight to your own Instagram.</p>
    <a href="/signup.html" class="mt-4 inline-block rounded-md bg-brass px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-brass-ink hover:bg-brass-dark transition">Get listed free</a>
  </div>`
}

// ---- individual shop pages -------------------------------------------------
const written = []
rmSync(resolve(ROOT, 'chattanooga'), { recursive: true, force: true })

for (const shop of shops) {
  const path = `/chattanooga/shops/${shop.slug}/`
  const roster = artistsFor(shop.slug)
  const title = `${shop.name} — Tattoo Shop in ${shop.city}, TN | Chairside`
  const description = `${shop.name} is a tattoo shop at ${fullAddr(shop)}.` +
    (roster.length ? ` ${roster.length} artist${roster.length > 1 ? 's' : ''} listed on Chairside.` : ' See location, contact and artists on Chairside.')

  const detail = [
    shop.url && `<a href="${esc(shop.url)}" target="_blank" rel="noopener" class="text-brass hover:text-white">Website &rarr;</a>`,
    shop.instagram && `<a href="${esc(shop.instagram)}" target="_blank" rel="noopener" class="text-brass hover:text-white">Instagram &rarr;</a>`,
    shop.phone && `<span class="text-ink-200">${esc(shop.phone)}</span>`,
  ].filter(Boolean).join('<span class="text-ink-700">&middot;</span>')

  const rosterHtml = roster.length
    ? `<h2 class="mt-12 text-xs uppercase tracking-widest text-ink-500">${(shop.services || ['tattoo']).includes('tattoo') ? 'Artists at this shop' : 'Piercers at this studio'}</h2>
       <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">` + roster.map((a) => `
        <div class="rounded-lg border border-ink-800 bg-ink-900 p-5">
          <p class="font-display text-2xl text-white">${esc(a.name)}</p>
          <div class="mt-2 flex flex-wrap gap-2">${[...(a.styles || []), ...(a.piercings || [])].map((s) => `<span class="style-pill">${esc(s)}</span>`).join('')}</div>
          ${a.socials?.instagram ? `<a href="${esc(a.socials.instagram)}" target="_blank" rel="noopener" class="mt-3 inline-block text-sm text-brass hover:text-white">Instagram &rarr;</a>` : ''}
        </div>`).join('') + `</div>`
    : ''  // nothing to say; the claim banner below carries it

  const body = `
  <section class="container mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
    <nav class="text-xs uppercase tracking-widest text-ink-500">
      <a href="/" class="hover:text-brass">Chairside</a> <span class="text-ink-700">/</span>
      <a href="/chattanooga/shops/" class="hover:text-brass">Chattanooga Shops</a>
    </nav>
    <h1 class="mt-4 font-display text-5xl sm:text-6xl text-white">${esc(shop.name)}</h1>
    <p class="mt-3 text-ink-200">${esc(fullAddr(shop))}</p>
    <p class="mt-1 text-xs uppercase tracking-widest text-brass">${svcLabel(shop)}</p>
    ${detail ? `<div class="mt-4 flex flex-wrap items-center gap-4 text-sm">${detail}</div>` : ''}
    ${rosterHtml}
    ${claimBanner(shop.name, roster.length === 0, shop)}
  </section>`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TattooParlor',
    name: shop.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: shop.address,
      addressLocality: shop.city,
      addressRegion: shop.state,
      ...(shop.zip ? { postalCode: shop.zip } : {}),
      addressCountry: 'US',
    },
    ...(shop.url ? { url: shop.url } : {}),
    ...(shop.phone ? { telephone: shop.phone } : {}),
    ...(shop.instagram ? { sameAs: [shop.instagram] } : {}),
  }

  const out = resolve(ROOT, `chattanooga/shops/${shop.slug}/index.html`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, page({ title, description, path, body, schema }))
  written.push(path)
}

// ---- shops index -----------------------------------------------------------
const rows = shops.map((s) => {
  const n = artistsFor(s.slug).length
  return `
    <a href="/chattanooga/shops/${s.slug}/" class="group block rounded-lg border border-ink-800 bg-ink-900 p-5 hover:border-brass transition">
      <div class="flex items-baseline justify-between gap-3">
        <p class="font-display text-2xl text-white group-hover:text-brass transition">${esc(s.name)}</p>
        ${n ? `<span class="shrink-0 text-xs uppercase tracking-widest text-brass">${n} artist${n > 1 ? 's' : ''}</span>` : ''}
      </div>
      <p class="mt-2 text-sm text-ink-200">${esc(fullAddr(s))}</p>
    </a>`
}).join('')

const indexBody = `
  <section class="container mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
    <nav class="text-xs uppercase tracking-widest text-ink-500"><a href="/" class="hover:text-brass">Chairside</a></nav>
    <h1 class="mt-4 font-display text-5xl sm:text-7xl text-white">Tattoo Shops in Chattanooga</h1>
    <p class="mt-4 max-w-2xl text-ink-200">Every tattoo shop in the Chattanooga area, with addresses and contact details. Browsing for a specific style instead? <a href="/#browse" class="text-brass hover:text-white">Search artists by style</a>.</p>
    <p class="mt-6 text-sm text-ink-500">${shops.length} shops listed</p>
    <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">${rows}</div>
  </section>`

const indexSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Tattoo Shops in Chattanooga, TN',
  numberOfItems: shops.length,
  itemListElement: shops.map((s, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: { '@type': 'TattooParlor', name: s.name, url: `${SITE}/chattanooga/shops/${s.slug}/` },
  })),
}

const idxOut = resolve(ROOT, 'chattanooga/shops/index.html')
mkdirSync(dirname(idxOut), { recursive: true })
writeFileSync(idxOut, page({
  title: `Tattoo Shops in Chattanooga, TN (${shops.length} Studios) | Chairside`,
  description: `A complete directory of tattoo shops in Chattanooga and the surrounding area, with addresses, websites and the artists working at each.`,
  path: '/chattanooga/shops/',
  body: indexBody,
  schema: indexSchema,
}))
written.unshift('/chattanooga/shops/')

// ---- sitemap ---------------------------------------------------------------
const urls = [
  { loc: '/', pri: '1.0', freq: 'weekly' },
  { loc: '/chattanooga/shops/', pri: '0.9', freq: 'weekly' },
  ...shops.map((s) => ({ loc: `/chattanooga/shops/${s.slug}/`, pri: '0.8', freq: 'monthly' })),
  { loc: '/piercings.html', pri: '0.9', freq: 'weekly' },
  { loc: '/aftercare.html', pri: '0.7', freq: 'monthly' },
  { loc: '/signup.html', pri: '0.6', freq: 'monthly' },
]
writeFileSync(resolve(ROOT, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url>\n    <loc>${SITE}${u.loc}</loc>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`).join('\n') +
  `\n</urlset>\n`)

console.log(`generated ${written.length} pages, sitemap has ${urls.length} urls`)
