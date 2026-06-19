# Support Inbox

A simple support system — players send messages, you reply, they check back with their UID.

## What It Does

- 🌐 **Landing page** - Friendly intro page
- 📝 **Send form** - Players submit (name + UID + message)
- 📬 **Inbox** - Players check responses with their UID
- 🔐 **Admin** - You manage and reply to messages

## Quick Setup

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git push
```

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Import your repo
3. Click **Deploy**

### 3. Set Password
In Vercel → Settings → Environment Variables:
- `ADMIN_TOKEN` = your-password

## How It Works

```
Player visits site → fills form → you get notified → you reply → player checks inbox
```

## URLs After Deploy

| Page | File |
|------|------|
| Home | `/` |
| Send | `/form.html` |
| Check | `/inbox.html` |
| Admin | `/admin.html` |

## Tech

- HTML/CSS/JS (static files)
- Node.js API (Vercel serverless)
- JSON storage
- Vercel hosting (free)

---

Made for players, by players. ✌️
