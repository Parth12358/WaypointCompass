# Complete Railway Deployment with MongoDB Setup

## 🚂 Railway + MongoDB Setup (Complete Guide)

### Prerequisites
- GitHub account with WaypointCompass repository
- Railway account (free)

---

## 📋 **Step-by-Step Deployment**

### **Step 1: Create Railway Account**
1. Go to https://railway.app
2. Click "Sign up with GitHub"
3. Authorize Railway to access your repositories

### **Step 2: Deploy Your App**
1. **Click "New Project"**
2. **Select "Deploy from GitHub repo"**
3. **Choose `WaypointCompass` repository**
4. Railway automatically:
   - Detects Node.js project
   - Installs dependencies
   - Starts building

### **Step 3: Add MongoDB Database**
1. **In your project dashboard, click "New Service"**
2. **Select "Database" → "Add MongoDB"**
3. **Railway creates:**
   - MongoDB instance
   - Username/password
   - Connection string
   - Sets `MONGODB_URL` environment variable

### **Step 4: Configure Environment Variables**
In Railway dashboard → Your App Service → Variables tab:

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=${MONGODB_URL}
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Step 5: Deploy and Test**
1. Railway automatically deploys after variable setup
2. You'll get a URL like: `https://waypointcompass-production-xxxx.up.railway.app`
3. Test endpoints:
   - Health: `https://your-url/health`
   - TTS: `https://your-url/api/tts/status`

---

## 🔧 **Alternative: MongoDB Atlas Setup**

If you prefer MongoDB's official cloud service:

### **Atlas Setup:**
1. **Go to https://mongodb.com/atlas**
2. **Create free account**
3. **Create M0 Sandbox cluster (free)**
4. **Create database user:**
   - Username: `waypointcompass`
   - Password: (generate strong password)
5. **Whitelist IP addresses:**
   - Add `0.0.0.0/0` (allow all) for Railway
6. **Get connection string:**
   ```
   mongodb+srv://waypointcompass:PASSWORD@cluster0.xxxxx.mongodb.net/waypointcompass?retryWrites=true&w=majority
   ```

### **Add to Railway Variables:**
```env
MONGODB_URI=mongodb+srv://waypointcompass:PASSWORD@cluster0.xxxxx.mongodb.net/waypointcompass?retryWrites=true&w=majority
NODE_ENV=production
PORT=3000
```

---

## 🗄️ **Database Collections Created Automatically**

Your app will automatically create these collections:
- `locations` - Saved waypoints and destinations
- `gpsdata` - GPS tracking history
- `sidequests` - Generated adventures

---

## 📱 **ESP32 Integration After Deployment**

Update your ESP32 code with the Railway URL:

```cpp
// Replace localhost with your Railway URL
const char* BACKEND_URL = "https://waypointcompass-production-xxxx.up.railway.app";
```

**Your ESP32 will now have:**
- ✅ **Global access** to TTS navigation system
- ✅ **Persistent database** for waypoints
- ✅ **Voice announcements** worldwide
- ✅ **Professional API** with HTTPS

---

## 🎯 **Testing Your Deployment**

### **Test Basic Connectivity:**
```bash
curl https://your-railway-url/health
```

### **Test TTS System:**
```bash
curl -X POST https://your-railway-url/api/tts/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Railway!", "type": "info"}'
```

### **Test Database:**
```bash
curl -X POST https://your-railway-url/api/locations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Location",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "category": "test"
  }'
```

---

## 💰 **Cost Breakdown**

### **Railway MongoDB (Recommended):**
- **Free tier:** 500 hours/month
- **Database:** Included in free tier
- **Perfect for:** Development and moderate usage

### **MongoDB Atlas:**
- **Free tier:** M0 Sandbox (512MB storage)
- **Railway:** 500 hours/month free
- **Perfect for:** Production apps with growth plans

---

## 🔍 **Monitoring Your Deployment**

Railway provides:
- **Real-time logs** for debugging
- **Resource usage** monitoring
- **Deployment history**
- **Environment variable** management
- **Database metrics** (if using Railway MongoDB)

---

## 🚨 **Common Issues & Solutions**

### **Connection Timeout:**
- Check MongoDB IP whitelist
- Verify connection string format

### **Environment Variables:**
- Ensure `MONGODB_URI` or `MONGODB_URL` is set
- Check Railway auto-generated variables

### **Build Failures:**
- Verify `package.json` dependencies
- Check Node.js version compatibility

---

## 🎉 **Success Indicators**

You'll know it's working when:
1. ✅ Railway deployment shows "Success"
2. ✅ Health endpoint returns `{"status": "healthy"}`
3. ✅ Database collections are created
4. ✅ TTS endpoints respond correctly
5. ✅ ESP32 can connect and send GPS data

---

## 🚀 **Next Steps After Deployment**

1. **Test ESP32 connection** with new URL
2. **Create first waypoint** via API
3. **Test navigation** with TTS announcements
4. **Enjoy global WaypointCompass!** 🧭

Your WaypointCompass system will now be available 24/7 with voice navigation!