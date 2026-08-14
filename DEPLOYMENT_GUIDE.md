# 🚀 Deployment Guide - AIFSP Sign-In System

## ✅ Pre-Deployment Checklist

Your application is **production-ready**! Here's what you need to consider:

### Current Status:
- ✅ Full-stack application built and tested
- ✅ Docker configuration ready
- ✅ GitHub Actions CI/CD pipeline configured
- ✅ Mobile-responsive design
- ✅ JSON file database (simple, but works)

---

## 🎯 Deployment Options

### **Option 1: Quick Local Network Deployment** ⭐ RECOMMENDED FOR CAMPUS
**Best for:** Running on campus network, accessed by devices on same network

**Steps:**

1. **Find Your Computer's IP Address**
   ```cmd
   ipconfig
   ```
   Look for your IPv4 Address (e.g., `192.168.1.100`)

2. **Update Server Configuration**
   - The server needs to accept connections from all network interfaces
   - Your current setup should work, but verify server listens on `0.0.0.0`

3. **Start the Application**
   ```cmd
   npm run dev
   ```

4. **Access from Campus Devices**
   - Entrance Display: `http://192.168.1.100:3000/`
   - Security Tablet: `http://192.168.1.100:3000/security`
   - Admin Dashboard: `http://192.168.1.100:3000/admin`

5. **Important: Update Frontend API Calls**
   - Replace `localhost:3001` with your server IP in all React files
   - OR use a proxy/environment variable

**Pros:**
- Free and immediate
- No hosting costs
- Full control
- Fast and private

**Cons:**
- Computer must stay on
- Only works on campus network
- No internet access from outside

---

### **Option 2: Cloud Deployment (Professional)**
**Best for:** Access from anywhere, reliable uptime, professional setup

#### **A. Railway.app** (Easiest, Free Tier Available)

1. **Sign up at [railway.app](https://railway.app)**

2. **Deploy from GitHub:**
   - Connect your GitHub repository
   - Railway auto-detects Node.js
   - Set environment variables if needed
   - Deploy!

3. **Configuration:**
   ```
   Build Command: npm run build
   Start Command: node server/index.js
   Port: 3001 (Railway provides public URL)
   ```

4. **Persistent Storage:**
   - Add Railway Volume for `db.json`
   - Or upgrade to PostgreSQL/MongoDB

**Cost:** Free tier available, ~$5/month for production

---

#### **B. Heroku** (Popular, Easy Setup)

1. **Install Heroku CLI**
   ```cmd
   npm install -g heroku
   ```

2. **Login and Create App**
   ```cmd
   heroku login
   heroku create aifsp-portal
   ```

3. **Deploy**
   ```cmd
   git push heroku main
   ```

4. **Add Persistent Storage:**
   - Heroku filesystem is ephemeral
   - Add PostgreSQL addon or use cloud storage

**Cost:** ~$7/month (Eco dynos)

---

#### **C. DigitalOcean / AWS / Azure** (Full Control)

1. **Create a VPS/Droplet** ($6-12/month)

2. **Install Node.js and dependencies**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone and Setup**
   ```bash
   git clone <your-repo>
   cd attendance
   npm install
   npm run build
   ```

4. **Use PM2 for Process Management**
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name tesano-signin
   pm2 startup
   pm2 save
   ```

5. **Setup Nginx as Reverse Proxy**

6. **Add SSL Certificate** (Let's Encrypt - Free)

**Cost:** $6-12/month + domain name

---

### **Option 3: Docker Deployment**
**Best for:** Any platform that supports Docker

1. **Build Docker Image**
   ```cmd
   docker build -t aifsp-portal .
   ```

2. **Run Container**
   ```cmd
   docker-compose up -d
   ```

3. **Deploy to:**
   - Docker Hub
   - Google Cloud Run
   - AWS ECS
   - Azure Container Instances
   - Your own server with Docker

---

## ⚠️ Critical Production Updates Needed

### 1. **Database Migration**
**Current:** JSON file (`db.json`)  
**Problem:** Not scalable, no concurrent writes protection

**Solutions:**

**A. SQLite (Recommended for Campus)**
- Already in your README but not implemented
- Install: `npm install better-sqlite3`
- Minimal changes needed
- Perfect for small-medium usage

**B. PostgreSQL (Professional)**
- Cloud-hosted (Railway, Heroku, Supabase)
- Scalable and reliable
- Free tiers available

**C. MongoDB (NoSQL Alternative)**
- Good for flexible schema
- Free tier on MongoDB Atlas
- Easy to set up

### 2. **Environment Variables**

Create `.env` file:
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=<your-database-url>
FRONTEND_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://admin.your-domain.com
```

Update server to use environment variables:
```javascript
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
```

### 3. **Update API URLs in Frontend**

Instead of hardcoded `http://localhost:3001`, use:

**Create `src/config.js`:**
```javascript
export const API_URL = import.meta.env.PROD 
  ? '/api'  // Production uses proxy
  : 'http://localhost:3001/api';
```

**Update all fetch calls:**
```javascript
import { API_URL } from '../config';

fetch(`${API_URL}/register`, ...)
```

### 4. **Security Enhancements**

Add to server:
```javascript
// Rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Helmet for security headers
import helmet from 'helmet';
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
```

### 5. **SSL/HTTPS**
- **Critical for production!**
- Use Let's Encrypt (free)
- Most cloud platforms provide SSL automatically
- Required for QR code scanning on some devices

---

## 📋 Deployment Steps Summary

### For Campus Network (Quick Start):

1. **Prepare the Code**
   ```cmd
   npm install
   npm run build
   ```

2. **Find Your IP**
   ```cmd
   ipconfig
   ```

3. **Update API URLs** (create config file)

4. **Start Server**
   ```cmd
   npm run dev
   ```

5. **Test Access** from another device on campus WiFi

6. **Setup Devices:**
   - Entrance Tablet: Open entrance page, fullscreen (F11)
   - Security Tablet: Open security page
   - Admin Computer: Open admin dashboard

---

### For Cloud Deployment:

1. **Choose Platform** (Railway recommended for easiest)

2. **Upgrade Database** (SQLite or PostgreSQL)

3. **Add Environment Variables**

4. **Update API URLs** in frontend

5. **Push to GitHub** (if using CI/CD)

6. **Deploy** from platform dashboard

7. **Configure Custom Domain** (optional)

8. **Enable SSL/HTTPS**

9. **Test Everything**

---

## 💰 Cost Comparison

| Option | Monthly Cost | Best For |
|--------|-------------|----------|
| Local Network | $0 | Campus only access |
| Railway.app | $0-5 | Small scale, easy setup |
| Heroku | $7+ | Medium scale |
| DigitalOcean | $6-12 | Full control |
| AWS/Azure | $10-50+ | Enterprise scale |

---

## 🔧 Recommended Production Setup

**For AIFSP:**

1. **Phase 1: Start Local (Today)**
   - Deploy on campus network
   - Test with staff and students
   - Gather feedback

2. **Phase 2: Cloud Migration (Week 2)**
   - Migrate to Railway or Heroku
   - Upgrade to SQLite/PostgreSQL
   - Add custom domain
   - Enable SSL

3. **Phase 3: Optimize (Month 1)**
   - Add monitoring (UptimeRobot)
   - Set up backups
   - Add analytics
   - Performance optimization

---

## 📱 Device Setup Recommendations

### **Entrance Display**
- **Device:** Tablet or small monitor (10-15")
- **Mount:** Wall mount or stand
- **Power:** Keep plugged in
- **Browser:** Chrome/Edge, fullscreen mode
- **Settings:** Disable sleep mode

### **Security Station**
- **Device:** Tablet (iPad, Android tablet)
- **Accessories:** Optional USB QR scanner
- **Mount:** Desk stand or handheld
- **Browser:** Any modern browser

### **Admin Dashboard**
- **Device:** Desktop or laptop
- **Location:** Admin office
- **Browser:** Chrome/Edge (for best performance)
- **Display:** Large screen recommended

---

## 🆘 Support & Troubleshooting

### Common Issues:

**1. "Network Error" when registering**
- Check if server is running
- Verify firewall allows connections
- Update API URLs in frontend

**2. QR codes not scanning**
- Ensure good lighting
- Use high-resolution display
- Test with multiple phone cameras

**3. Students can't access from phones**
- Check campus WiFi allows device-to-device connections
- Verify IP address is correct
- Test with different devices

**4. Database not persisting**
- Check db.json file permissions
- Ensure server has write access
- Consider upgrading to SQLite

---

## 🎓 Training Materials Needed

Create quick guides for:
1. **Students:** "How to Register" (with screenshots)
2. **Security:** "How to Verify Tokens"
3. **Admin:** "Dashboard Overview"
4. **IT Staff:** "Troubleshooting Guide"

---

## ✅ Go-Live Checklist

- [ ] Choose deployment method
- [ ] Update API URLs in code
- [ ] Add environment variables
- [ ] Test on all target devices
- [ ] Verify QR codes work on phones
- [ ] Train security staff
- [ ] Train admin staff
- [ ] Create backup of database
- [ ] Set up monitoring
- [ ] Create support contact process
- [ ] Prepare rollback plan
- [ ] Document everything

---

## 🚀 Ready to Deploy?

**Choose your path:**

1. **Quick Start (Campus Network):** Run on local machine - Ready in 10 minutes
2. **Professional (Cloud):** Deploy to Railway - Ready in 30 minutes
3. **Enterprise (VPS):** Full control setup - Ready in 2-3 hours

Need help with any specific deployment? Let me know!

---

**Built for AIFSP**  
*Simplifying campus access, one QR code at a time* 🏛️
