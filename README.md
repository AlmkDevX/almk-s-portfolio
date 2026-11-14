# ALMK — Portfolio

A dark, editorial portfolio for **Almk** — AI developer, thumbnail designer and web developer from Nepal. Ships with a private admin console for managing the selected work, and runs on a zero-dependency Node.js server.

## Run

```bash
node server.js
```

or

```bash
npm start
```

| Surface | URL |
| --- | --- |
| Portfolio | http://localhost:3000 |
| Admin | http://localhost:3000/adm |

The server uses no npm packages — Node 18+ is the only requirement.

## Admin

- Password: `hellofaabbccdd`
- Set a custom password before launch with the `ADMIN_PASSWORD` environment variable:

```powershell
$env:ADMIN_PASSWORD = "your-strong-password"; node server.js
```

The console supports creating, editing, deleting and featuring projects. Every change is validated on the server and written to `data/projects.json`, then reflected on the site immediately.

## Work inquiries

The **Work with me** buttons open the inquiry dialog on the portfolio. Submissions are validated on the server, rate limited (4 per IP per 10 minutes) and delivered to Discord as an embed with name, email, Discord handle, project type, budget, timeline and message. A hidden honeypot field rejects bots without alerting them.

Set a different destination with `DISCORD_WEBHOOK_URL` (the repo ships with a fallback webhook for Almk):

```powershell
$env:DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/..."; node server.js
```

The backend returns `503` if no webhook is configured and `502` if Discord rejects the delivery.

## SEO

- `/robots.txt` and `/sitemap.xml` are generated from the request host, so the production domain does not need to be hard-coded.
- Admin and API routes send `X-Robots-Tag: noindex, nofollow, noarchive` and are disallowed in `robots.txt`.
- The homepage has canonical, Open Graph, Twitter card and JSON-LD (`Person`, `WebSite`, `ProfilePage`) metadata for **Almk / Almkxd**.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `ADMIN_PASSWORD` | `hellofaabbccdd` | Admin panel password |
| `DISCORD_WEBHOOK_URL` | Almk's webhook | Inquiry delivery endpoint |

## Structure

```
server.js              Zero-dependency HTTP server, auth, JSON API, static files
package.json
public/
  index.html           Portfolio page
  styles.css           Design system and layout
  app.js               Project rendering, filters, dialog, motion
  adm/
    index.html         Admin console
    admin.css
    admin.js
  assets/              Logo (hero, nav, touch icon)
data/
  projects.json        Project data (created on first run)
```

## Design

- Palette: near-black surfaces, electric indigo accent `#5468FF`, lavender highlight `#A9A3FF` — drawn from the logo.
- Type: Archivo (display), Space Grotesk (body), JetBrains Mono (labels).
- Project covers are generated from each project's accent colour unless a cover image URL is provided.
- Motion respects `prefers-reduced-motion`; all interactive targets are keyboard accessible.

## Security notes

- Admin password is hashed with scrypt in memory; login comparisons are timing-safe.
- Sessions are `HttpOnly`, `SameSite=Strict` cookies with a 12-hour lifetime.
- Login attempts are rate limited (5 failures / 10 minutes → 10-minute block).
- Inquiries are rate limited (4 / IP / 10 minutes) and protected by a honeypot; no submission data is stored on the server.
- API mutations require same-origin requests; CSP, `nosniff` and frame protections are set server-wide.
- The inline JSON-LD block is allowed by a SHA-256 hash in the CSP. If you edit the JSON-LD in `public/index.html`, recompute the hash and update `SECURITY_HEADERS` in `server.js`.
- `data/projects.json` is the only writable state and is written atomically.

For production, put the app behind HTTPS, set `ADMIN_PASSWORD`, and add a process manager (e.g. `pm2`, `systemd`, or a container) instead of running the raw process.
