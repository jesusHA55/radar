# Running Radar on a Raspberry Pi

Everything here is Pi-specific and self-contained — Mac dev (`npm run dev`) is
unaffected. Radar runs as three **systemd** units on Raspberry Pi OS:

| Unit | What it does |
| --- | --- |
| `radar-app.service` | the built Next.js app (`next start`) |
| `radar-tunnel.service` | a Cloudflare **quick tunnel** → a public HTTPS URL |
| `radar-poller.service` + `.timer` | hourly monitoring pass via `/api/cron/poll` |

Assumes **Raspberry Pi OS Bookworm (64-bit)** on a Pi 4/5. An **SSD** is strongly
recommended over an SD card (Postgres writes).

## 1. Install the tooling

```bash
# Node 22 (>= 20.9 required)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql

# cloudflared (Cloudflare's apt repo)
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

> Already running Postgres for something else? Reuse it — skip the install and
> just create a dedicated role/database in step 3.

## 2. Get the code

```bash
sudo mkdir -p /opt/radar && sudo chown "$USER:$USER" /opt/radar
git clone <your-repo-url> /opt/radar
cd /opt/radar
```

## 3. Create the database

```bash
RADAR_DB_PASSWORD='a-strong-password' ./pi/postgres-setup.sh
```

It prints the `DATABASE_URL` to paste into `.env.local` (next step).

## 4. Configure

```bash
cp pi/env.example .env.local
nano .env.local
```

At minimum set `DATABASE_URL`, `CRON_SECRET` (a long random string), and your
Gmail `SMTP_USER`/`SMTP_PASS` (see below). `PORT` can be changed if 3000 is
taken.

**Gmail:** enable 2‑Step Verification on the Google account → create an **App
Password** → set `SMTP_USER` to the address and `SMTP_PASS` to the 16‑character
password. A dedicated/secondary account is recommended.

## 5. Build, migrate, and bootstrap your account

```bash
npm ci
npm run build
npm run db:migrate

# Give yourself (and friends) access:
npm run invite -- you@gmail.com friend@example.com
```

## 6. Install the services

```bash
sudo ./pi/install.sh
```

This renders the units with your paths/user, enables and starts them, and creates
`/var/lib/radar`. Check:

```bash
systemctl status radar-app radar-tunnel
systemctl list-timers radar-poller.timer
```

## Finding the public URL

Quick-tunnel URLs are random and **change on every restart**. To find the current
one:

```bash
cat /var/lib/radar/tunnel-url.txt
# or, once you're in: open /settings on the Pi → "Public URL (tunnel)"
# or: journalctl -u radar-tunnel | grep trycloudflare
```

`GET /api/tunnel-url` (authenticated) returns it as JSON too.

## Updating

```bash
cd /opt/radar
git pull
./pi/deploy.sh          # npm ci → build → migrate → restart radar-app
```

## Running alongside other services

- Radar uses **`PORT`** (default `3000`) and a database named `radar`. Change
  `PORT` if something else claims it; reuse your existing Postgres if you have one.
- Services run as your install user by default. To isolate, create a dedicated
  user and pass `RADAR_USER=`:
  ```bash
  sudo useradd --system --create-home radar
  sudo chown -R radar:radar /opt/radar
  sudo RADAR_USER=radar ./pi/install.sh
  ```
- The app idles at ~150–300 MB RAM and near-zero CPU; the hourly poll is a quick
  one-shot. Pi 5 / 8 GB has plenty of headroom.
- Optional: `sudo systemctl disable --now radar-tunnel` and use Tailscale/named
  tunnel instead if you prefer a stable hostname.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 502 / connection refused | `journalctl -u radar-app -f`; is `PORT` free? Is the DB up? |
| URL file empty | `journalctl -u radar-tunnel -f` — waiting for cloudflared |
| New URL after reboot | expected for quick tunnels; re-share the link |
| Sign-in link goes to `http://…` | tunnel must be up; `x-forwarded-proto` comes from Cloudflare |
| No emails | `/settings` → "Email & hosting"; try **Send test email**; verify App Password |
| Polls 401 | `CRON_SECRET` mismatch between `.env.local` and the running app |

Health check: `curl -fsS http://127.0.0.1:3000/api/health`.

## Uninstall

```bash
sudo ./pi/uninstall.sh
```
