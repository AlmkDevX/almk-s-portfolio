'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');
const PORT = Number(process.env.PORT) || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hellofaabbccdd';
const ADMIN_SALT = crypto.randomBytes(16);
const ADMIN_HASH = crypto.scryptSync(ADMIN_PASSWORD, ADMIN_SALT, 64);

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_BLOCK_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 128 * 1024;

const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL ||
  'https://discord.com/api/webhooks/1570999696594567241/_6wszrxRHprX8otSXHthszc0EcI9BTYKLQmU_akryyrNAAbnX_RZrTGw5vbyVx23DKG_';
const CONTACT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_MAX_SUBMISSIONS = 4;
const WEBHOOK_TIMEOUT_MS = 8000;

const CATEGORIES = new Map([
  ['ai-development', 'AI Development'],
  ['thumbnail-design', 'Thumbnail Design'],
  ['web-development', 'Web Development'],
]);

const DEFAULT_ACCENT = '#5468FF';
const sessions = new Map();
const loginAttempts = new Map();
const contactAttempts = new Map();
let projects = [];
let writeQueue = Promise.resolve();

/* ---------- storage ---------- */

function seedProjects() {
  const now = Date.now();
  return [
    {
      id: 'p-aether',
      title: 'Aether',
      category: 'ai-development',
      year: '2026',
      description:
        'A voice-first AI assistant that plans, drafts and executes everyday tasks. Streaming responses, tool calling and a calm interface that stays out of the way.',
      tags: ['LLM', 'Realtime', 'Product'],
      link: '',
      cover: '',
      accent: '#5468FF',
      featured: true,
      createdAt: now - 1000 * 60 * 60 * 24 * 3,
    },
    {
      id: 'p-neuralforge',
      title: 'NeuralForge',
      category: 'ai-development',
      year: '2026',
      description:
        'Prompt-to-image studio with batch generation, style presets and a library that actually makes sense. Built around an opinionated, fast creative loop.',
      tags: ['Generative AI', 'Next.js', 'UX'],
      link: '',
      cover: '',
      accent: '#8B5CF6',
      featured: false,
      createdAt: now - 1000 * 60 * 60 * 24 * 9,
    },
    {
      id: 'p-clutch',
      title: 'Clutch Factor',
      category: 'thumbnail-design',
      year: '2026',
      description:
        'YouTube thumbnail for a Valorant clutch compilation. High-contrast composition, one focal subject and a title that reads in under a second on mobile.',
      tags: ['YouTube', 'Gaming', 'Photoshop'],
      link: '',
      cover: '',
      accent: '#F97316',
      featured: true,
      createdAt: now - 1000 * 60 * 60 * 24 * 14,
    },
    {
      id: 'p-ranked-pack',
      title: 'Ranked Grind Pack',
      category: 'thumbnail-design',
      year: '2025',
      description:
        'A reusable thumbnail system for a gaming channel — layered templates, expression presets and a colour language that keeps every upload on brand.',
      tags: ['Template', 'Branding', 'Esports'],
      link: '',
      cover: '',
      accent: '#EF4444',
      featured: false,
      createdAt: now - 1000 * 60 * 60 * 24 * 26,
    },
    {
      id: 'p-orbit',
      title: 'Orbit Analytics',
      category: 'web-development',
      year: '2026',
      description:
        'Analytics dashboard for small product teams. Dense data made calm: clear hierarchy, keyboard-friendly tables and charts that load instantly.',
      tags: ['React', 'Node', 'Data Viz'],
      link: '',
      cover: '',
      accent: '#22D3EE',
      featured: true,
      createdAt: now - 1000 * 60 * 60 * 24 * 34,
    },
    {
      id: 'p-kathmandu',
      title: 'Kathmandu Coffee Co.',
      category: 'web-development',
      year: '2025',
      description:
        'Brand site for a specialty coffee roaster in Kathmandu. Slow scroll storytelling, honest photography and a checkout flow with zero friction.',
      tags: ['Astro', 'GSAP', 'E-commerce'],
      link: '',
      cover: '',
      accent: '#84CC16',
      featured: false,
      createdAt: now - 1000 * 60 * 60 * 24 * 48,
    },
  ];
}

function normalizeProject(input, base) {
  const errors = [];
  const src = input && typeof input === 'object' ? input : {};

  const pick = (key, fallback) => (src[key] !== undefined ? src[key] : fallback);

  const title = String(pick('title', base.title || '')).trim();
  if (title.length < 1 || title.length > 120) errors.push('Title must be 1–120 characters.');

  const category = String(pick('category', base.category || '')).trim();
  if (!CATEGORIES.has(category)) errors.push('Category is not valid.');

  let year = String(pick('year', base.year || new Date().getFullYear())).trim();
  if (!/^(19|20)\d{2}$/.test(year)) errors.push('Year must be a 4-digit year.');

  const description = String(pick('description', base.description || '')).trim();
  if (description.length > 1200) errors.push('Description must be 1200 characters or fewer.');

  let tags = pick('tags', base.tags || []);
  if (typeof tags === 'string') tags = tags.split(',');
  if (!Array.isArray(tags)) tags = [];
  tags = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 8);
  if (tags.some((t) => t.length > 30)) errors.push('Each tag must be 30 characters or fewer.');

  const link = String(pick('link', base.link || '')).trim();
  if (link && !/^https?:\/\/\S+$/i.test(link)) errors.push('Link must be a full http(s) URL.');
  if (link.length > 600) errors.push('Link is too long.');

  const cover = String(pick('cover', base.cover || '')).trim();
  if (cover && !/^https?:\/\/\S+$/i.test(cover)) errors.push('Cover must be a full http(s) URL.');
  if (cover.length > 900) errors.push('Cover URL is too long.');

  let accent = String(pick('accent', base.accent || DEFAULT_ACCENT)).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) accent = DEFAULT_ACCENT;

  const featured = Boolean(pick('featured', base.featured || false));

  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.status = 400;
    err.details = errors;
    throw err;
  }

  return { title, category, year, description, tags, link, cover, accent: accent.toUpperCase(), featured };
}

function loadProjects() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    projects = seedProjects();
    persistNow();
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    projects = Array.isArray(parsed) ? parsed : Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch (err) {
    console.error('[data] projects.json is unreadable, starting empty:', err.message);
    projects = [];
  }
}

function persistNow() {
  const tmp = DATA_FILE + '.tmp';
  const payload = JSON.stringify(projects, null, 2);
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function persist() {
  writeQueue = writeQueue.then(() => persistNow()).catch((err) => {
    console.error('[data] failed to save projects:', err);
  });
  return writeQueue;
}

/* ---------- http helpers ---------- */

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function passwordMatches(candidate) {
  const hash = crypto.scryptSync(String(candidate || ''), ADMIN_SALT, 64);
  return crypto.timingSafeEqual(hash, ADMIN_HASH);
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function sessionToken(req) {
  return parseCookies(req).almk_admin || '';
}

function isAuthed(req) {
  const token = sessionToken(req);
  if (!token) return false;
  const expires = sessions.get(token);
  if (!expires) return false;
  if (Date.now() > expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function sessionCookie(req, token, maxAgeSeconds) {
  const secure = req.headers['x-forwarded-proto'] === 'https';
  return [
    `almk_admin=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function checkLoginRate(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { blocked: false };
  if (record.blockedUntil && now < record.blockedUntil) {
    return { blocked: true, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }
  if (record.blockedUntil && now >= record.blockedUntil) loginAttempts.delete(ip);
  else if (now - record.first > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  return { blocked: false };
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { first: now, count: 0 };
  if (now - record.first > LOGIN_WINDOW_MS) {
    record.first = now;
    record.count = 0;
  }
  record.count += 1;
  if (record.count >= LOGIN_MAX_FAILURES) record.blockedUntil = now + LOGIN_BLOCK_MS;
  loginAttempts.set(ip, record);
}

/* ---------- contact ---------- */

function checkContactRate(ip) {
  const now = Date.now();
  const record = contactAttempts.get(ip);
  if (!record || now - record.first > CONTACT_WINDOW_MS) return { blocked: false };
  if (record.count >= CONTACT_MAX_SUBMISSIONS) {
    return { blocked: true, retryAfter: Math.ceil((record.first + CONTACT_WINDOW_MS - now) / 1000) };
  }
  return { blocked: false };
}

function recordContactSubmission(ip) {
  const now = Date.now();
  const record = contactAttempts.get(ip);
  if (!record || now - record.first > CONTACT_WINDOW_MS) {
    contactAttempts.set(ip, { first: now, count: 1 });
  } else {
    record.count += 1;
  }
}

function normalizeInquiry(input) {
  const errors = [];
  const src = input && typeof input === 'object' ? input : {};
  const field = (key, max) => String(src[key] ?? '').trim().slice(0, max);

  const name = field('name', 80);
  if (name.length < 1 || name.length > 80) errors.push('Name must be 1–80 characters.');

  const email = field('email', 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Enter a valid email address.');

  const discord = field('discord', 80);
  const projectType = field('projectType', 80);
  const budget = field('budget', 60);
  const timeline = field('timeline', 60);

  const message = field('message', 2000);
  if (message.length < 10) errors.push('Tell me a little more — at least 10 characters.');

  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.status = 400;
    err.details = errors;
    throw err;
  }

  return { name, email, discord, projectType, budget, timeline, message };
}

function clip(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function sendInquiryToDiscord(inquiry) {
  if (!DISCORD_WEBHOOK_URL) {
    throw Object.assign(new Error('Inquiry delivery is not configured.'), { status: 503 });
  }

  const payload = {
    username: 'ALMK Portfolio',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'New project inquiry',
        color: 0x5468ff,
        timestamp: new Date().toISOString(),
        fields: [
          { name: 'Name', value: clip(inquiry.name, 1024), inline: true },
          { name: 'Email', value: clip(inquiry.email, 1024), inline: true },
          { name: 'Discord', value: clip(inquiry.discord || '—', 1024), inline: true },
          { name: 'Project type', value: clip(inquiry.projectType || '—', 1024), inline: true },
          { name: 'Budget', value: clip(inquiry.budget || '—', 1024), inline: true },
          { name: 'Timeline', value: clip(inquiry.timeline || '—', 1024), inline: true },
          { name: 'Message', value: clip(inquiry.message, 1000) },
        ],
        footer: { text: 'Sent from the Almk portfolio contact form' },
      },
    ],
  };

  let response;
  try {
    response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[contact] webhook request failed:', err.message);
    throw Object.assign(new Error('Could not deliver your inquiry right now. Please try Discord instead.'), { status: 502 });
  }

  if (!response.ok) {
    console.error(`[contact] webhook responded ${response.status}`);
    throw Object.assign(new Error('Could not deliver your inquiry right now. Please try Discord instead.'), { status: 502 });
  }
}

/* ---------- api ---------- */

async function handleApi(req, res, pathname) {
  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: 'Cross-origin request rejected.' });
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const rate = checkLoginRate(clientIp(req));
    if (rate.blocked) {
      return sendJson(res, 429, { error: `Too many attempts. Try again in ${rate.retryAfter}s.` }, { 'Retry-After': String(rate.retryAfter) });
    }
    const body = await readJsonBody(req);
    if (!passwordMatches(body.password)) {
      recordLoginFailure(clientIp(req));
      return sendJson(res, 401, { error: 'Incorrect password.' });
    }
    loginAttempts.delete(clientIp(req));
    const token = createSession();
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, token, SESSION_TTL_MS / 1000) });
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = sessionToken(req);
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return sendJson(res, 200, { authenticated: isAuthed(req) });
  }

  if (pathname === '/api/contact' && req.method === 'POST') {
    const ip = clientIp(req);
    const rate = checkContactRate(ip);
    if (rate.blocked) {
      return sendJson(
        res,
        429,
        { error: `Too many inquiries from this connection. Try again in ${rate.retryAfter}s.` },
        { 'Retry-After': String(rate.retryAfter) }
      );
    }

    const body = await readJsonBody(req);
    if (String(body.website ?? '').trim()) return sendJson(res, 200, { ok: true });

    const inquiry = normalizeInquiry(body);
    recordContactSubmission(ip);
    await sendInquiryToDiscord(inquiry);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/projects' && req.method === 'GET') {
    return sendJson(res, 200, { projects, categories: [...CATEGORIES].map(([value, label]) => ({ value, label })) });
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    if (!isAuthed(req)) return sendJson(res, 401, { error: 'Not signed in.' });
    const body = await readJsonBody(req);
    const clean = normalizeProject(body, {});
    const project = { id: crypto.randomUUID(), ...clean, createdAt: Date.now() };
    projects.unshift(project);
    await persist();
    return sendJson(res, 201, { project });
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]{1,64})$/);
  if (projectMatch) {
    if (!isAuthed(req)) return sendJson(res, 401, { error: 'Not signed in.' });
    const index = projects.findIndex((p) => p.id === projectMatch[1]);
    if (index === -1) return sendJson(res, 404, { error: 'Project not found.' });

    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const clean = normalizeProject(body, projects[index]);
      projects[index] = { ...projects[index], ...clean };
      await persist();
      return sendJson(res, 200, { project: projects[index] });
    }

    if (req.method === 'DELETE') {
      projects.splice(index, 1);
      await persist();
      return sendJson(res, 200, { ok: true });
    }
  }

  return sendJson(res, 404, { error: 'Not found.' });
}

/* ---------- static ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function siteOrigin(req) {
  const host = String(req.headers.host || '');
  const safeHost = /^[A-Za-z0-9.\-:[\]]{1,253}$/.test(host) ? host : `localhost:${PORT}`;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwarded === 'https' || req.socket.encrypted ? 'https' : 'http';
  return `${proto}://${safeHost}`;
}

function sendText(res, status, type, body, method) {
  const payload = Buffer.from(body, 'utf8');
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': payload.length,
    'Cache-Control': 'public, max-age=3600',
  });
  if (method === 'HEAD') return res.end();
  res.end(payload);
}

function serveSeo(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const origin = siteOrigin(req);

  if (pathname === '/robots.txt') {
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /adm',
      'Disallow: /adm/',
      'Disallow: /api/',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');
    return sendText(res, 200, 'text/plain; charset=utf-8', body, req.method);
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${origin}/</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '    <changefreq>monthly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
  return sendText(res, 200, 'application/xml; charset=utf-8', body, req.method);
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  let rel = decodeURIComponent(pathname);
  if (rel === '/' ) rel = '/index.html';
  if (rel === '/adm' || rel === '/adm/') rel = '/adm/index.html';
  if (rel.endsWith('/')) rel += 'index.html';

  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) || rel.includes('\0')) {
    return sendJson(res, 404, { error: 'Not found.' });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600';

    if (rel === '/index.html') {
      fs.readFile(filePath, 'utf8', (readErr, html) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('500 - Could not load page');
        }
        const origin = siteOrigin(req);
        const rendered = html
          .replace('<link rel="canonical" href="/" />', `<link rel="canonical" href="${origin}/" />`)
          .replaceAll('content="/assets/logo.jpg"', `content="${origin}/assets/logo.jpg"`)
          .replace(
            '<meta property="og:type" content="website" />',
            `<meta property="og:type" content="website" />\n  <meta property="og:url" content="${origin}/" />`
          );
        const payload = Buffer.from(rendered, 'utf8');
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': payload.length,
          'Cache-Control': cache,
        });
        if (req.method === 'HEAD') return res.end();
        res.end(payload);
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': cache,
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'sha256-vf+xBJXR9hXwqE8z0TuIHJvxyeZR3ItdOLQQpcbVIwk='; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
};

const server = http.createServer(async (req, res) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname === '/adm' || pathname.startsWith('/adm/') || pathname.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  try {
    if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
      serveSeo(req, res, pathname);
      return;
    }
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }
    serveStatic(req, res, pathname);
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, err.status || 500, { error: err.message || 'Server error.' });
    } else {
      res.end();
    }
    if (!err.status) console.error('[server]', err);
  }
});

/* ---------- boot ---------- */

loadProjects();

setInterval(() => {
  const now = Date.now();
  for (const [token, expires] of sessions) if (now > expires) sessions.delete(token);
  for (const [ip, record] of loginAttempts) {
    const stale = now - record.first > LOGIN_WINDOW_MS && (!record.blockedUntil || now > record.blockedUntil);
    if (stale) loginAttempts.delete(ip);
  }
  for (const [ip, record] of contactAttempts) {
    if (now - record.first > CONTACT_WINDOW_MS) contactAttempts.delete(ip);
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`\n  ALMK portfolio running`);
  console.log(`  Site   → http://localhost:${PORT}`);
  console.log(`  Admin  → http://localhost:${PORT}/adm\n`);
});
