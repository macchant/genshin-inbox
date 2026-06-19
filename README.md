# Akasa Support System

A modern, serverless support system for games - built with Node.js for Vercel deployment.

## Features

- 🌐 **Landing Page** - Professional support homepage
- 📝 **Submit Form** - Players send requests (name + UID + message)
- 📬 **Inbox** - Players check responses with their UID
- 🔐 **Admin Dashboard** - Manage & reply to messages
- 📱 **Mobile Friendly** - Works on all devices
- ⚡ **Serverless** - Deploys to Vercel for free

## Pages

| Page | File | Purpose |
|------|------|---------|
| Home | `public/index.html` | Landing page with info |
| Submit | `public/form.html` | Send support request |
| Inbox | `public/inbox.html` | Check messages by UID |
| Admin | `public/admin.html` | Dashboard (password protected) |

## Quick Deploy to Vercel

### 1. Push to GitHub
```bash
cd game-support-bot-nodejs
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/akasa-support.git
git push -u origin main
```

### 2. Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repo
4. Click "Deploy"

### 3. Set Environment Variables (Optional)
In Vercel dashboard → Settings → Environment Variables:
- `ADMIN_TOKEN` = your-admin-password
- `TELEGRAM_BOT_TOKEN` = your-telegram-bot-token
- `TELEGRAM_ADMIN_ID` = your-telegram-chat-id

## Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Or use Vercel CLI
npx vercel dev
```

## How It Works

```
Player → index.html → clicks "Submit Request"
              ↓
         form.html: Name + UID + Message
              ↓
         API saves to db.json
              ↓
         You check admin.html → reply
              ↓
         Player checks inbox.html → enters UID → sees reply
```

## Player Flow

1. Visit site → click "Submit Request"
2. Enter: In-game name, UID, Message
3. Submit → get reference ID
4. Wait for response
5. Visit "Check Messages" → enter UID → see reply

## Admin Access

URL: `your-site.vercel.app/admin.html`

Token: `akasa-admin-2026-secure`

(Change this in environment variables after deployment)

## API Actions

| Action | Description |
|--------|-------------|
| `submit` | Submit new message |
| `get_messages` | Get all messages (admin) |
| `get_messages_by_uid` | Get messages for player |
| `reply` | Reply to a message |
| `get_stats` | Get dashboard stats |
| `resolve` | Mark message resolved |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_TOKEN` | Yes | Password for admin dashboard |
| `TELEGRAM_BOT_TOKEN` | No | Send notifications to Telegram |
| `TELEGRAM_ADMIN_ID` | No | Your Telegram Chat ID |

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js (Vercel Serverless Functions)
- **Database**: JSON file (db.json)
- **Hosting**: Vercel (free)

## File Structure

```
├── api/
│   └── index.js        # Serverless API handler
├── public/
│   ├── index.html      # Landing page
│   ├── form.html       # Submit form
│   ├── inbox.html      # Check messages
│   └── admin.html     # Admin dashboard
├── vercel.json         # Vercel config
├── package.json         # Dependencies
└── README.md           # This file
```

## Security

- Admin dashboard requires token
- No personal data stored (only name + UID)
- Messages are private per UID
- HTTPS enforced by Vercel

---

Built with ❤️ for Akasa
