# Railway Deployment Guide for WaypointCompass

## Quick Railway Setup (5 minutes!)

### Step 1: Prepare Your Project
Your project is already ready! The TTS system we just built will work perfectly on Railway.

### Step 2: Sign Up for Railway
1. Go to https://railway.app
2. Sign up with your GitHub account
3. Authorize Railway to access your repositories

### Step 3: Deploy Your Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `Parth12358/WaypointCompass`
4. Railway automatically detects Node.js and starts building

### Step 4: Add MongoDB Database
1. In your project dashboard, click "New Service"
2. Select "Database" → "Add MongoDB"
3. Railway creates a MongoDB instance and provides connection string
4. The `MONGODB_URL` environment variable is automatically set

### Step 5: Configure Environment Variables
In Railway dashboard → Variables tab, add:
```
NODE_ENV=production
PORT=3000
MONGODB_URI=${MONGODB_URL}
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 6: Get Your API URL
After deployment, Railway provides your API URL like:
```
https://waypointcompass-production-xxxx.up.railway.app
```

### Step 7: Update ESP32 Code
Replace your backend URL in ESP32:
```cpp
const char* BACKEND_URL = "https://your-railway-url.up.railway.app";
```

## Features That Work on Railway

✅ **All TTS Features**: Voice announcements work perfectly
✅ **MongoDB Integration**: Database fully functional  
✅ **GPS Tracking**: Real-time location updates
✅ **Navigation System**: Distance tracking and audio feedback
✅ **Safety System**: Location analysis and warnings
✅ **Sidequest Generation**: Adventure creation system
✅ **Auto-deployment**: Push to GitHub = instant updates

## Benefits of Railway Deployment

🚀 **Always Available**: Your ESP32 can connect 24/7
🔒 **HTTPS Secure**: Built-in SSL certificates
🌍 **Global CDN**: Fast response times worldwide
📈 **Scalable**: Automatically handles traffic spikes
🔧 **Zero Maintenance**: No server management needed
💰 **Cost Effective**: Free tier covers most usage

## ESP32 Integration Benefits

With Railway deployment, your ESP32 gets:
- **Stable API endpoint** (no more localhost issues)
- **HTTPS security** (required for production)
- **Global accessibility** (works from anywhere)
- **High uptime** (Railway's infrastructure)
- **Automatic TTS** (voice announcements always work)

## Alternative Quick Commands

If you prefer command line:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

## Monitoring and Logs

Railway provides:
- Real-time application logs
- Resource usage monitoring
- Deployment history
- Environment variable management
- Database metrics

## Custom Domain (Optional)

Later, you can add a custom domain:
1. Purchase domain (like waypointcompass.com)
2. In Railway: Settings → Domains → Add Custom Domain
3. Update DNS records as instructed
4. Get `https://api.waypointcompass.com`

## Estimated Deployment Time: 5-10 minutes!

Your WaypointCompass TTS system will be live and accessible globally!