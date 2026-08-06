# 🔧 Fix: "Site Cannot Be Reached" When Scanning QR Code

## Problem
When students scan the entrance QR code with their phone, they get "site cannot be reached" error.

## Why This Happens
The QR code contains `localhost` or `127.0.0.1` which only works on the computer running the server. When a phone scans it, the phone tries to access its own localhost (which doesn't have your server).

## ✅ Solution (3 Steps)

### Step 1: Restart Your Server

The code has been updated. Restart the server:

1. **Stop the current server:** Press `Ctrl+C` in the terminal
2. **Start it again:** 
   ```cmd
   npm run dev
   ```

### Step 2: Find Your Computer's IP Address

**Windows:**
```cmd
ipconfig
```

**Look for:**
```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 192.168.1.100
```

Your IP will be something like: `192.168.1.XXX` or `10.0.0.XXX`

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
```

### Step 3: Access Using Your IP Address

**On the computer running the server:**
- Open: `http://YOUR-IP:3000`
- Example: `http://192.168.1.100:3000`

**The QR code will now automatically contain your IP address!**

---

## 📱 Test It

1. **On your computer:** Open `http://YOUR-IP:3000/`
2. **On your phone:** 
   - Connect to same WiFi
   - Open browser: `http://YOUR-IP:3000/`
   - Should work!
3. **Scan the QR code:** Should now open the registration page

---

## Common Issues & Fixes

### Issue 1: "Still says localhost in QR code"

**Fix:**
- Make sure you're accessing with your IP (not localhost)
- Hard refresh the page: `Ctrl+F5`
- Clear browser cache

### Issue 2: "Connection refused" or "Cannot connect"

**Fix:**
- Check Windows Firewall:
  1. Windows Defender Firewall → Advanced Settings
  2. Inbound Rules → New Rule
  3. Port → TCP → 3000 and 3001
  4. Allow the connection
  
Or simply:
- Search "Allow an app through Windows Firewall"
- Find Node.js and enable for Private networks

### Issue 3: "Works on computer but not phone"

**Fix:**
- Verify both devices on same WiFi network
- Disable VPN on either device
- Check router settings (some routers block device-to-device)
- Try different phone (test if it's phone-specific)

### Issue 4: "QR code won't scan"

**Fix:**
- Increase brightness on display
- Ensure good lighting
- Hold phone steady
- Try QR scanner app instead of camera
- Make QR code larger (edit CSS if needed)

---

## 🔍 Verify Setup

Run these checks:

### ✅ Check 1: Server is listening on all interfaces
When you start the server, you should see:
```
Server running on http://localhost:3001
🌐 Network Access:
   Use your computer's IP address to access from other devices
```

### ✅ Check 2: Can access from computer
Open in browser: `http://YOUR-IP:3000`
Should load the entrance page.

### ✅ Check 3: Can access from phone
On phone browser: `http://YOUR-IP:3000`
Should load the entrance page.

### ✅ Check 4: QR code contains correct URL
On the entrance page, the QR code should contain:
`http://YOUR-IP:3000/register?campus=...`
(NOT `localhost`)

---

## 🎯 Quick Fix Commands

**1. Find your IP:**
```cmd
ipconfig | findstr IPv4
```

**2. Test if server is accessible:**
```cmd
curl http://YOUR-IP:3001/api/campus-qr
```

**3. Allow through firewall:**
```cmd
netsh advfirewall firewall add rule name="Node.js Server" dir=in action=allow protocol=TCP localport=3000-3001
```

---

## 📋 Network Requirements

**For Local Network Access:**
- ✅ All devices on same WiFi network
- ✅ Router allows device-to-device communication
- ✅ Windows Firewall allows Node.js
- ✅ No VPN blocking connections
- ✅ Correct IP address used

**For Internet Access:**
- ❌ Not possible with current setup
- ✅ Need cloud deployment (Railway, Heroku, etc.)
- ✅ See DEPLOYMENT_GUIDE.md for cloud options

---

## 🔄 Updated Flow

### Old (Broken):
```
Entrance Display: http://localhost:3000
         ↓
QR Code contains: http://localhost:3000/register
         ↓
Student scans with phone
         ↓
❌ Phone tries to access localhost (doesn't work)
```

### New (Working):
```
Entrance Display: http://192.168.1.100:3000
         ↓
QR Code contains: http://192.168.1.100:3000/register
         ↓
Student scans with phone
         ↓
✅ Phone accesses server computer (works!)
```

---

## 💡 Pro Tips

**For Production:**
1. **Static IP:** Assign static IP to server computer
   - Prevents IP from changing
   - More reliable

2. **Cloud Deployment:** For internet access
   - See DEPLOYMENT_GUIDE.md
   - Railway.app recommended (free tier)

3. **Print QR Code:** As backup
   - Screenshot and print the QR code
   - Use if digital display fails

4. **Multiple Displays:** Can show same QR everywhere
   - All point to same registration URL
   - Students can scan from multiple locations

---

## 🚀 Alternative: Use ngrok (Temporary Testing)

If you want to test with internet access right now:

1. **Install ngrok:**
   - Download from [ngrok.com](https://ngrok.com)
   
2. **Run ngrok:**
   ```cmd
   ngrok http 3000
   ```

3. **Use the ngrok URL:**
   - ngrok gives you a public URL like: `https://abc123.ngrok.io`
   - Access your site: `https://abc123.ngrok.io`
   - QR code will contain this URL
   - Works from anywhere (even over mobile data!)

**Note:** Free ngrok URLs change every time you restart.

---

## ✅ Success Checklist

- [ ] Server restarted with updated code
- [ ] Found computer's IP address
- [ ] Can access from computer using IP
- [ ] Can access from phone using IP
- [ ] QR code contains IP (not localhost)
- [ ] Phone can scan and open registration page
- [ ] Registration works from phone
- [ ] Token displays on phone after registration
- [ ] Firewall allows connections

---

## 🆘 Still Not Working?

### Last Resort Troubleshooting:

1. **Test with specific IP in code:**
   - Edit server code to hardcode your IP
   - Restart server

2. **Use mobile hotspot:**
   - Create hotspot from your computer
   - Connect phone to that hotspot
   - Try again

3. **Check router settings:**
   - Some routers have "AP Isolation" enabled
   - Disable it in router admin panel

4. **Try different network:**
   - Test on different WiFi network
   - Could be router configuration issue

5. **Deploy to cloud:**
   - Fastest fix: Deploy to Railway.app
   - See DEPLOYMENT_GUIDE.md
   - Works from anywhere

---

## 📞 Need More Help?

Check these files:
- `QUICK_START.md` - Complete setup guide
- `DEPLOYMENT_GUIDE.md` - Cloud deployment options
- `README.md` - System overview

---

**The fix has been applied. Restart your server and access using your IP address!** 🚀
