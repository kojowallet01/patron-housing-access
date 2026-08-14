# 🚀 Quick Start - Go Live in 10 Minutes!

## Option 1: Local Campus Network (FASTEST) ⚡

Perfect for immediate use on your campus network.

### Step 1: Get Your Computer's IP Address

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter (e.g., `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
```

### Step 2: Allow Firewall Access

**Windows:**
- Windows Defender Firewall → Allow an app
- Allow Node.js on Private networks

**Mac:**
- System Preferences → Security & Privacy → Firewall
- Add Node to allowed apps

### Step 3: Start the Application

```cmd
npm run dev
```

You should see:
```
Server running on http://localhost:3001
Vite dev server running on http://localhost:3000
```

### Step 4: Test from Another Device

On your phone (connected to same WiFi):
- Open: `http://YOUR-IP:3000`
- Replace YOUR-IP with the address from Step 1
- Example: `http://192.168.1.100:3000`

### Step 5: Setup Campus Devices

**Entrance Display (Tablet/Monitor):**
1. Open: `http://YOUR-IP:3000/`
2. Press F11 for fullscreen
3. Disable sleep mode in device settings

**Security Station (Tablet):**
1. Open: `http://YOUR-IP:3000/security`
2. Bookmark the page

**Admin Dashboard (Computer):**
1. Open: `http://YOUR-IP:3000/admin`
2. Bookmark the page

### ✅ You're Live!

Students can now:
1. Scan the entrance QR code
2. Register and get their token
3. Show token to security

---

## Option 2: Cloud Deployment (Railway - FREE)

For access from anywhere, not just campus network.

### Step 1: Push to GitHub

```cmd
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/tesano-campus.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Railway auto-detects settings
7. Click "Deploy"

### Step 3: Get Your URL

Railway provides a URL like: `tesano-campus-production.up.railway.app`

### Step 4: Test

Open the Railway URL and test the complete flow.

### ✅ You're Live Globally!

Access from anywhere:
- Entrance: `https://your-app.railway.app/`
- Security: `https://your-app.railway.app/security`
- Admin: `https://your-app.railway.app/admin`

---

## 🆘 Troubleshooting

### "Can't connect from other devices"
- Verify devices are on same WiFi network
- Check firewall settings
- Try turning off VPN
- Restart the dev server

### "QR code doesn't scan"
- Ensure good lighting
- Try different phone cameras
- Increase QR code size if needed
- Use a QR scanner app

### "Registration fails"
- Check server is running (terminal shows no errors)
- Verify API connection
- Check browser console for errors
- Try a different browser

### "Database not saving"
- Check `db.json` file exists
- Verify write permissions
- Don't run from read-only location

---

## 📱 Device Recommendations

### Minimum Requirements:
- **Entrance Display:** Any tablet/monitor with browser (10"+ recommended)
- **Security Station:** Phone or tablet
- **Admin Dashboard:** Any computer with modern browser

### Tested On:
- ✅ Windows 10/11
- ✅ macOS
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ iPad
- ✅ Amazon Fire Tablet

---

## 🎯 Next Steps

Once running successfully:

1. **Backup Your Data**
   - Copy `db.json` regularly
   - Consider cloud backup

2. **Train Your Staff**
   - Show security how to verify tokens
   - Train admin on dashboard

3. **Monitor Usage**
   - Check admin dashboard daily
   - Watch for any issues

4. **Plan Upgrades**
   - Consider cloud deployment
   - Add features as needed
   - Upgrade database if needed

---

## 💡 Tips for Success

**Entrance Display:**
- Place at eye level
- Good lighting for QR scanning
- Add instructional sign
- Keep display on during hours

**Security Station:**
- Keep device charged
- Have backup device ready
- Train all security staff
- Create quick reference card

**Admin Dashboard:**
- Check multiple times daily
- Export data regularly (future feature)
- Monitor for patterns
- Share insights with management

---

## 🎓 Need Help?

Check these files:
- `DEPLOYMENT_GUIDE.md` - Full deployment options
- `README.md` - Complete system overview
- `USER_FLOW.md` - How the system works
- `PAGES.md` - Page-by-page breakdown

---

## ✅ Success Checklist

- [ ] Server starts without errors
- [ ] Can access from localhost
- [ ] Can access from another device (campus network)
- [ ] QR code scans successfully
- [ ] Registration works
- [ ] Token displays after registration
- [ ] Security verification works
- [ ] Admin dashboard loads and updates
- [ ] All devices positioned and configured
- [ ] Staff trained
- [ ] Backup plan in place

---

**🎉 Congratulations! You're live!**

Your campus now has a modern, efficient sign-in system.

---

**Questions or Issues?**
Document them for your IT team or reach out to your developer.

**Built for AIFSP** 🏛️
