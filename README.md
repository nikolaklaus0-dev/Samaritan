<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>
<h1 align="center"> 𝐊𝐋𝐀𝐔𝐒-𝐗𝐌𝐃 𝐕𝐄𝐑𝐒𝐈𝐎𝐍 𝟓.𝟎.𝟎 </h1>

<p align="center">
  <strong>A Multi-Device WhatsApp Bot built by KLAUS.</strong><br/>
  Fast • Modular • Feature-Rich • Open Source
</p>

---

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

<p align="center">
<a href="https://github.com/nikolaklaus0-dev"><img title="GITHUB" src="https://img.shields.io/badge/GITHUB-KLAUS-red.svg?style=for-the-badge&logo=github"></a>
</p>
<p align="center">
<a href="https://github.com/nikolaklaus0-dev?tab=followers"><img title="Followers" src="https://img.shields.io/github/followers/nikolaklaus0-dev?label=Followers&style=social"></a>
<a href="https://github.com/nikolaklaus0-dev/Samaritan/stargazers/"><img title="STARS" src="https://img.shields.io/github/stars/nikolaklaus0-dev/Samaritan?&style=social"></a>
<a href="https://github.com/nikolaklaus0-dev/Samaritan/network/members"><img title="Forks" src="https://img.shields.io/github/forks/nikolaklaus0-dev/Samaritan?style=social"></a>
<a href="https://github.com/nikolaklaus0-dev/Samaritan/watchers"><img title="Watching" src="https://img.shields.io/github/watchers/nikolaklaus0-dev/Samaritan?label=Watching&style=social"></a>
</p>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

---

## 𝟏. 𝐒𝐄𝐓 𝐔𝐏

**👇 FORK THE REPO (REQUIRED)**

<details>
<summary>CLICK HERE</summary>

Forking gives you your own safe, deployable copy of the bot — required for all hosting platforms below.

<a href="https://github.com/nikolaklaus0-dev/Samaritan/fork"><img src="https://img.shields.io/badge/FORK%20REPO-purple" alt="Fork KLAUS-XMD" width="150"></a>

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

## 𝟐. 𝐋𝐈𝐍𝐊 𝐖𝐈𝐓𝐇 𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏

<details>
<summary>GET YOUR SESSION_ID</summary>

<a href="https://klausxmdpair.pairsite.space"><img src="https://img.shields.io/badge/GET%20SESSION%20ID-green" alt="Pairing Code" width="200"></a>

- Visit the pairing site above
- Scan the QR code with the WhatsApp account you want the bot to live in
- Copy the returned session ID

> ⚠️ **Session ID must start with `Klaus~`** — anything else will be rejected.

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

## 𝟑. 𝐃𝐄𝐏𝐋𝐎𝐘𝐌𝐄𝐍𝐓

### (A) HEROKU

<details>
<summary>TAP TO OPEN</summary>

<a href="https://signup.heroku.com/login"><img src="https://img.shields.io/badge/HEROKU%20SIGNUP-white" alt="Heroku Signup" width="150"></a>

<a href="https://dashboard.heroku.com/new?template=https://github.com/nikolaklaus0-dev/Samaritan"><img src="https://img.shields.io/badge/DEPLOY%20NOW-red" alt="Deploy on Heroku" width="150"></a>

- PostgreSQL is **auto-provisioned** via the `heroku-postgresql:essential-0` addon — no manual setup needed.
- All environment variables are pre-filled from `app.json`. Just add your `SESSION_ID`.

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

### (B) RENDER

<details>
<summary>TAP TO OPEN</summary>

<a href="https://dashboard.render.com/signup"><img src="https://img.shields.io/badge/RENDER%20SIGNUP-green" alt="Render Signup" width="150"></a>

<a href="https://render.com/deploy"><img src="https://img.shields.io/badge/DEPLOY%20NOW-blue" alt="Deploy on Render" width="150"></a>

**Steps:**
1. Fork this repo, then go to [render.com](https://render.com) and sign in.
2. Click **New → Blueprint** and connect your forked repo.
3. Render reads `render.yaml` and **auto-provisions a free PostgreSQL** database linked to your bot.
4. Fill in `SESSION_ID` when prompted. All other vars have defaults.
5. Click **Apply** — done.

> **Note:** Render's free PostgreSQL lasts 90 days. After that, use a free external DB from [neon.tech](https://neon.tech) and paste the URL as `DATABASE_URL`. If left blank the bot falls back to SQLite automatically.

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

### (C) RAILWAY

<details>
<summary>TAP TO OPEN</summary>

<a href="https://railway.app/login"><img src="https://img.shields.io/badge/RAILWAY%20SIGNUP-black" alt="Railway Signup" width="150"></a>

<a href="https://railway.app/new/template"><img src="https://img.shields.io/badge/DEPLOY%20NOW-purple" alt="Deploy on Railway" width="150"></a>

**Steps:**
1. Fork this repo and go to [railway.app](https://railway.app).
2. Click **New Project → Deploy from GitHub repo** and select your fork.
3. In your project dashboard, click **+ New → Database → PostgreSQL**.
4. Railway auto-links `DATABASE_URL` to your service — no copy-paste needed.
5. Go to your service **Variables** tab and add:
   - `SESSION_ID` → your `Klaus~` session ID
   - `MODE` → `public`
   - `TIME_ZONE` → e.g. `Africa/Nairobi`
6. Railway detects the `Dockerfile` and `railway.toml` automatically and deploys.

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

### (D) KOYEB

<details>
<summary>TAP TO OPEN</summary>

<a href="https://app.koyeb.com/auth/signup"><img src="https://img.shields.io/badge/KOYEB%20SIGNUP-purple" alt="Koyeb Signup" width="150"></a>

<a href="https://app.koyeb.com/services/deploy/?type=git&repository=github.com%2Fnikolaklaus0-dev%2FSamaritan&branch=main&name=klaus-xmd&builder=dockerfile&env%5BSESSION_ID%5D=your%20sessionid%20here"><img src="https://img.shields.io/badge/DEPLOY%20NOW-black" alt="Deploy on Koyeb" width="150"></a>

**Steps:**
1. Fork this repo and sign in to [koyeb.com](https://koyeb.com).
2. Click **Deploy Now** above (or Create App → GitHub → select your fork).
3. Koyeb has no built-in database — get a **free PostgreSQL** from one of:
   - [neon.tech](https://neon.tech) ← recommended
   - [supabase.com](https://supabase.com)
4. Paste the connection URL as `DATABASE_URL` in your Koyeb service environment variables.
5. Set `SESSION_ID`, `MODE`, `TIME_ZONE` in the same env vars section.
6. Koyeb uses the `Dockerfile` and `koyeb.yaml` config automatically.

> **Tip:** If you skip `DATABASE_URL` the bot will use SQLite on the local disk — data resets on each redeploy. Use a remote DB for persistence.

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

### (E) VPS / SELF-HOSTED

<details>
<summary>TAP TO OPEN</summary>

> Requires a Linux VPS (Ubuntu 20.04+ recommended) with Node.js 20+ and Git installed.

**1. Clone the repo**
```bash
git clone https://github.com/nikolaklaus0-dev/Samaritan.git
cd Samaritan
```

**2. Install dependencies**
```bash
npm install
```

**3. Set environment variables**

Create a `.env` file in the project root:
```env
SESSION_ID=Klaus~your_session_id_here
MODE=public
TIME_ZONE=Africa/Nairobi
AUTO_LIKE_STATUS=true
AUTO_READ_STATUS=true
DATABASE_URL=              # leave blank to use SQLite, or paste a PostgreSQL URL
```

**4. Install FFmpeg** (required for media commands)
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y ffmpeg

# CentOS / RHEL
sudo yum install -y ffmpeg
```

**5. Start the bot**
```bash
npm start   # uses PM2 internally
# OR for direct dev mode:
npm run dev
```

**6. Keep it running with PM2** (recommended)
```bash
npm install -g pm2
pm2 start index.js --name klaus-xmd
pm2 save
pm2 startup
```

**7. (Optional) Free PostgreSQL**

If you want a persistent database instead of SQLite, get a free connection URL from [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com) and paste it as `DATABASE_URL` in your `.env`.

**8. Update the bot**
```bash
git pull
npm install
pm2 restart klaus-xmd
```

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

---

## 𝟒. 𝐔𝐏𝐃𝐀𝐓𝐄𝐒 & 𝐒𝐔𝐏𝐏𝐎𝐑𝐓

<details>
<summary>CLICK HERE</summary>

- **Get your Session ID from [PAIRING SITE](https://klausxmdpair.pairsite.space)**
- **Join [WHATSAPP GROUP](https://chat.whatsapp.com/DLIhTyJBeOn0TEhfwf1y66) for Updates**
- **Report bugs via [GitHub Issues](https://github.com/nikolaklaus0-dev/Samaritan/issues)**

</details>

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

## 𝟓. 𝐑𝐄𝐏𝐎 𝐒𝐓𝐀𝐑 𝐇𝐈𝐒𝐓𝐎𝐑𝐘

[![KLAUS-XMD](https://api.star-history.com/svg?repos=nikolaklaus0-dev/Samaritan&type=Timeline)](#)

<a><img src='https://i.imgur.com/LyHic3i.gif'/></a>

---

## 📝 License

MIT — free to use, modify, and distribute. Attribution appreciated but not required.

## ⚠️ Disclaimer

This bot is not affiliated with WhatsApp. Use responsibly and in accordance with WhatsApp's Terms of Service. The author is not liable for any account bans or misuse.
