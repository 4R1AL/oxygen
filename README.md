# ⚔ Oxygen Duel Web Integration & Dashboard

Modern, esports-themed web integration for the **Oxygen Minecraft Duel Plugin**, deployed on **Cloudflare Pages** for domain [`mcnp.network`](https://mcnp.network) and connected to your **Pterodactyl MySQL Database (Petro DB)** and **Pterodactyl Minecraft Server**.

---

## 🏗 Architecture Overview

```
                        ┌───────────────────────────────────────┐
                        │      mcnp.network           │
                        │    (Cloudflare Pages CDN)             │
                        │   - Live Leaderboard (Elo, Wins)      │
                        │   - Kits & Arenas Showcase            │
                        │   - Player Profile Lookup             │
                        │   - Real-time Server Status & Ping    │
                        └──────────────────┬────────────────────┘
                                           │  REST API Calls
                                           ▼
                        ┌───────────────────────────────────────┐
                        │       api.mcnp.network      │
                        │      (Oxygen REST API Backend)        │
                        │   - Node.js / Express / TypeScript    │
                        │   - Server List Ping (SLP) Socket     │
                        └──────────┬─────────────────┬──────────┘
                                   │                 │
             Direct MySQL Queries  │                 │ Live Player Count
                                   ▼                 ▼
             ┌─────────────────────────┐   ┌──────────────────────────┐
             │    Pterodactyl DB       │   │    Pterodactyl Server    │
             │     (MySQL/MariaDB)     │   │   (Paper MC + Oxygen)    │
             │   - oxygen_players      │   │ - Auto-syncs matches     │
             │   - oxygen_kits         │   │ - Writes Elo & stats     │
             │   - oxygen_arenas       │   │ - play.samratnagarkoti...│
             └─────────────────────────┘   └──────────────────────────┘
```

---

## 📁 Repository Structure

```
oxygen-duels/
├── backend/                  # Standalone REST API backend
│   ├── src/
│   │   ├── db.ts             # MySQL pool & queries for Oxygen tables
│   │   ├── ping.ts           # Real-time Minecraft server ping
│   │   ├── seed.ts           # DB schema initializer & sample seeder
│   │   ├── server.ts         # Express server & CORS configuration
│   │   └── routes/           # REST endpoints (/status, /leaderboard, /player, etc.)
│   ├── .env.example          # Environment variable template
│   ├── Dockerfile            # Container deployment
│   ├── ecosystem.config.cjs  # PM2 process configuration
│   └── package.json
│
├── frontend/                 # Static website ready for Cloudflare Pages
│   ├── index.html            # Main rankings, search, modal profiles
│   ├── kits.html             # Official kits showcase
│   ├── arenas.html           # Arenas showcase
│   ├── css/style.css         # Cyberpunk/Neon esports dark UI
│   ├── js/config.js          # Client configuration & API domain
│   ├── js/app.js             # Live API client with auto-refresh
│   ├── _headers              # Cloudflare security & cache headers
│   └── _redirects            # Clean URL routing
│
├── plugin-config/
│   └── config.yml            # Pre-configured Oxygen plugin database settings
└── README.md
```

---

## 🚀 Quick Setup Guide

### 1. Pterodactyl Database (Petro DB)
1. Go to your Pterodactyl Panel $\rightarrow$ **Databases** tab.
2. Click **New Database** (e.g. named `oxygen` or `duels`).
3. Note down the **Host / Endpoint**, **Port** (e.g., `3306`), **Database Name**, **Username**, and **Password**.

### 2. Configure the Oxygen Plugin on your Pterodactyl Server
Open `/plugins/Oxygen/config.yml` on your server and update the `database:` block:

```yaml
database:
  enabled: true
  type: "MYSQL"
  pool-size: 4
  max-queue: 10000
  mysql:
    host: "YOUR_PETRO_DB_HOST"        # e.g. 127.0.0.1 or mysql.host.com
    port: 3306
    database: "YOUR_PETRO_DB_NAME"    # e.g. s1_oxygen_db
    username: "YOUR_PETRO_DB_USER"    # e.g. u1_oxygen
    password: "YOUR_PETRO_DB_PASSWORD"
    ssl: false
    verify-server-certificate: false
    allow-public-key-retrieval: true
```
Save and restart the server (or run `/oxygen reload`). The plugin will automatically create the tables:
- `oxygen_players`
- `oxygen_player_kit_elo`
- `oxygen_kits`
- `oxygen_arenas`
- `oxygen_custom_kits` *(strictly excluded from public web listings)*

### 3. Run the Backend API
1. Navigate to `backend`:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Edit `.env` with your Petro DB credentials:
   ```env
   PORT=3001
   CORS_ORIGIN=https://mcnp.network,https://*.pages.dev,*
   DB_HOST=YOUR_PETRO_DB_HOST
   DB_PORT=3306
   DB_USER=YOUR_PETRO_DB_USER
   DB_PASSWORD=YOUR_PETRO_DB_PASSWORD
   DB_NAME=YOUR_PETRO_DB_NAME
   MINECRAFT_HOST=mcnp.network
   MINECRAFT_PORT=25565
   ```
3. Test seeding (optional, creates initial test records if starting fresh):
   ```bash
   npm run seed
   ```
4. Start the server:
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

### 4. Deploy Frontend to Cloudflare Pages
1. Push this Git repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete oxygen duel website & backend integration"
   git remote add origin https://github.com/YOUR_USERNAME/oxygen-duels.git
   git push -u origin main
   ```
2. In the **Cloudflare Dashboard**:
   - Go to **Workers & Pages** $\rightarrow$ **Create Application** $\rightarrow$ **Pages** $\rightarrow$ **Connect to Git**.
   - Select your repository.
   - **Build Settings**:
     - Framework preset: `None`
     - Build command: *(leave blank)*
     - Build output directory: `frontend`
   - Click **Save and Deploy**.
3. Under **Custom Domains** in Cloudflare Pages:
   - Add `mcnp.network` (and `www.mcnp.network`).
4. Set your API domain:
   - In `frontend/js/config.js`, verify `apiBaseUrl` points to `https://api.mcnp.network`.

---

## 🌐 Cloudflare DNS Configuration

In your Cloudflare DNS tab for `mcnp.network`:

| Type | Name | Content / Target | Proxy Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `@` | `<your-project>.pages.dev` | Proxied (Orange Cloud) | Cloudflare Pages Frontend |
| **A / CNAME**| `api` | Your API server IP / hostname | Proxied (Orange Cloud) | Oxygen REST API Backend |
| **A** | `play` | Pterodactyl Server Node IP | DNS Only (Grey Cloud) | Minecraft Server IP |
| **SRV** *(if non-25565)* | `_minecraft._tcp` | Priority 0, Weight 5, Port XXXX, Target `play` | DNS Only | MC Port Forwarding |

---

## 🔒 Security & Fair Play
- **Custom Kits Exclusion**: Player-created custom kits are permanently excluded from web leaderboards and public kit lists.
- **Connection Pooling**: Uses bounded MySQL connection pools with keepalives to prevent Pterodactyl connection starvation.
- **Fallback Mechanism**: The frontend includes graceful offline fallbacks and caching so the website always loads instantly even during server maintenance.
