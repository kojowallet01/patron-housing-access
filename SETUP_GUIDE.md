# 🏛️ Tesano Campus Institute - Complete Setup Guide

## ✅ System Is Running!

Your sign-in system is **live** at `http://localhost:3000`

---

## 📱 The 3 Separate Pages

### **1. ENTRANCE DISPLAY** 
**URL:** `http://localhost:3000/`

![Purple gradient fullscreen page with large QR code]

**Setup:**
- Open on a tablet or screen at the entrance
- Press F11 for fullscreen mode
- Position so students can easily scan

**What students see:**
- Large QR code to scan
- Instructions on how to register
- Professional campus branding

---

### **2. SECURITY VERIFICATION**
**URL:** `http://localhost:3000/security`

![Dark themed page with token input]

**Setup:**
- Open on security staff's device (tablet/phone/computer)
- Bookmark this page for quick access
- Can use external USB QR scanner

**How to use:**
1. Student shows their token QR code
2. Security scans or types token
3. Click "Verify"
4. Screen shows ✅ GREEN (allow entry) or ❌ RED (deny entry)
5. Auto-resets in 5 seconds

---

### **3. ADMIN DASHBOARD**
**URL:** `http://localhost:3000/admin`

![Clean white dashboard with statistics]

**Setup:**
- Open on administrator's computer
- Bookmark for easy access
- Auto-refreshes every 30 seconds

**Features:**
- View real-time statistics
- See who's on campus today
- Search student records
- Export data (coming soon)

---

## 🎯 Complete Student Flow

```
STEP 1: STUDENT ARRIVES AT ENTRANCE
├─ Sees QR code on display
└─ Opens phone camera and scans QR

STEP 2: REGISTRATION PAGE OPENS ON PHONE
├─ Fills in: Name, Email, Phone (optional), Home Campus (optional)
├─ Clicks "Register & Get Token"
└─ Instant token appears on phone

STEP 3: TOKEN DISPLAYED
├─ ✅ "Registration Complete!"
├─ Large QR code shown
├─ Token ID visible
└─ Instructions to show security

STEP 4: SHOWS TOKEN TO SECURITY
├─ Security scans/enters token
├─ System verifies validity
└─ ✅ Access Granted or ❌ Access Denied

STEP 5: ENTERS CAMPUS
└─ Admin dashboard automatically updated
```

---

## 🖥️ Physical Setup Recommendations

### **Entrance Station:**

**Device:** Tablet (10" or larger) or Small Display
- **Page:** http://localhost:3000/
- **Mount:** On stand or wall at entrance
- **Height:** Eye level for easy scanning
- **Settings:** 
  - Fullscreen mode (F11)
  - Disable sleep/screensaver
  - Keep plugged in
  - Brightness: High

### **Security Station:**

**Device:** Tablet or Laptop
- **Page:** http://localhost:3000/security
- **Position:** Next to security guard
- **Optional:** USB QR scanner for faster verification
- **Settings:**
  - Bookmarked for quick access
  - Keep screen on

### **Admin Office:**

**Device:** Desktop Computer or Laptop
- **Page:** http://localhost:3000/admin  
- **Position:** Admin's desk
- **Settings:**
  - Bookmarked
  - Second monitor recommended for continuous monitoring

---

## 📊 Page Details

### **Entrance Page Features:**
- ✅ Large, scannable QR code (400x400px)
- ✅ Auto-refreshes QR every 30 seconds
- ✅ Step-by-step instructions for students
- ✅ Purple gradient branding
- ✅ Fullscreen-optimized
- ✅ No navigation or clutter

### **Registration Page Features:**
- ✅ Mobile-optimized form
- ✅ Simple fields (Name, Email required)
- ✅ Instant token generation
- ✅ Token displayed as QR code
- ✅ Screenshot-friendly
- ✅ One-time registration (email unique)

### **Security Page Features:**
- ✅ Large token input field
- ✅ Supports typed or scanned tokens
- ✅ Clear visual feedback (green/red)
- ✅ Shows student details on success
- ✅ Auto-resets after 5 seconds
- ✅ Dark theme for easy reading

### **Admin Page Features:**
- ✅ Real-time statistics
- ✅ Today's visitors table
- ✅ All students registry
- ✅ Search functionality
- ✅ Auto-refresh every 30 seconds
- ✅ Manual refresh button

---

## 🔐 Security Features

- ✅ **Unique tokens per student per day**
- ✅ **Tokens expire at midnight** (single-day validity)
- ✅ **Email-based registration** (prevents duplicates)
- ✅ **Campus code verification** (prevents fake registrations)
- ✅ **Token validation** (checks date and authenticity)

---

## 🎨 Design Highlights

### **Color Scheme:**
- **Entrance:** Purple gradient (#667eea to #764ba2)
- **Security:** Dark theme (Black to gray)
- **Admin:** Clean white with purple accents
- **Registration:** White cards on light background

### **Typography:**
- Large, readable fonts
- Clear headings
- High contrast for accessibility

### **Responsive:**
- Works on phones, tablets, and desktops
- Touch-friendly buttons
- Mobile-first forms

---

## 🛠️ Testing the System

### **Test Flow (Do This Now!):**

1. **Open Entrance Page:**
   ```
   http://localhost:3000/
   ```
   - You should see a large QR code

2. **Simulate Student Scan:**
   - Copy the URL shown under the QR code
   - Open in a new tab (or on your phone)
   - Fill the registration form
   - Submit and see your token

3. **Test Security Verification:**
   ```
   http://localhost:3000/security
   ```
   - Copy your token from step 2
   - Paste into security page
   - Click Verify
   - Should see ✅ Access Granted

4. **Check Admin Dashboard:**
   ```
   http://localhost:3000/admin
   ```
   - Should see your registration in "Today's Visitors"
   - Statistics should show 1 student, 1 visit

---

## 📝 Daily Operations

### **Morning Routine:**
1. Turn on entrance display device
2. Open http://localhost:3000/ (fullscreen)
3. Turn on security device  
4. Open http://localhost:3000/security
5. Open admin dashboard (if monitoring)

### **During the Day:**
- **Entrance:** Display stays on, showing QR
- **Students:** Scan, register, show token
- **Security:** Verify tokens continuously
- **Admin:** Monitor visitor count

### **Evening Routine:**
- Admin can review day's visitors
- Export data if needed
- Devices can be closed/locked

### **Next Day:**
- System automatically generates new tokens
- Yesterday's tokens expire automatically
- Returning students use same credentials, get new token

---

## 💡 Pro Tips

### **For Entrance Display:**
- Use a stand or wall mount
- Position QR code at chest height
- Add physical signage: "Scan to Register"
- Test scanning from 1-2 meters away

### **For Security:**
- Train staff on the verify process
- Keep device charged
- Consider USB QR scanner for speed
- Have backup device ready

### **For Admin:**
- Check dashboard periodically
- Use search to find specific students
- Monitor total count vs capacity
- Export data weekly for records

### **For Students:**
- Encourage screenshots of token
- Tokens valid all day
- Lost token? Register with same email
- One token per day

---

## 🚨 Troubleshooting

### **QR Code Won't Scan:**
- Increase screen brightness
- Clean tablet screen
- Check phone camera focus
- Try typing URL manually

### **Registration Failed:**
- Email already registered? Use same email to get new token
- Network error? Check server running
- Invalid campus code? Scan entrance QR again

### **Token Invalid:**
- Token from previous day? Student must register again
- Wrong token entered? Ask student to show again
- Network issue? Check connection

### **Dashboard Not Updating:**
- Click refresh button manually
- Check network connection
- Reload page (Ctrl+R)

---

## 📞 Support

**For technical issues:**
- Check server is running (`npm run dev`)
- Check browser console for errors
- Verify network connectivity

**For operational questions:**
- See USER_FLOW.md for detailed process
- See PAGES.md for URL reference

---

## 🎉 You're All Set!

**The system is ready to use. Open these URLs:**

- **Entrance:** http://localhost:3000/
- **Security:** http://localhost:3000/security  
- **Admin:** http://localhost:3000/admin

**Test the complete flow with a sample registration!**

---

Built for **Tesano Campus Institute** 🏛️  
Religious Studies & Community Learning Center
