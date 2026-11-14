# VivAI Cloud – Image to Video

Mobile-first AI video generator. Upload any photo → get a video.
Powered by **Fal.ai** (Wan 2.2 · LTX 2.5 · MiniMax).

---

## Deploy to Vercel (5 minutes)

### Step 1 — Push to GitHub

1. Go to github.com → New Repository → name it `vivai-cloud` → Create
2. Run in terminal:

```bash
cd C:\Dev\vivai-cloud
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/vivai-cloud.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to **vercel.com** → Sign up / Log in with GitHub
2. Click **Add New Project**
3. Import your `vivai-cloud` repo
4. Click **Deploy** (no config needed — it auto-detects Next.js)

### Step 3 — Add Fal.ai API Key

1. Get your free key: **fal.ai/dashboard/keys** (sign up = $5 free credit)
2. In Vercel: **Project Settings → Environment Variables**
3. Add:
   ```
   Name:  FAL_API_KEY
   Value: fal_xxxxxxxxxxxxxxxx
   ```
4. Click **Save** → Go to **Deployments** → **Redeploy**

### Step 4 — Done!

Your app is live at: `https://vivai-cloud.vercel.app`

Share the URL — works on any browser, any phone, anywhere.

---

## Local Testing

```bash
cd C:\Dev\vivai-cloud

# Add your key to .env.local
# FAL_API_KEY=fal_xxxxxxxx

npm run dev
# Open http://localhost:3000
```

---

## Models

| Model | Speed | Quality | Best for |
|-------|-------|---------|----------|
| **Wan 2.2** (default) | Medium | ⭐⭐⭐⭐⭐ | Everything |
| **LTX 2.5** | Fast | ⭐⭐⭐⭐ | Quick previews |
| **MiniMax** | Slow | ⭐⭐⭐⭐⭐ | Cinematic shots |

---

## Cost (Fal.ai free tier)

- Free $5 credit on signup
- Wan 2.2 · 5s video ≈ $0.08
- **~60 free videos** on the free credit
- After that: pay-as-you-go, no subscription
