# AIFSP - Page URLs

## 📄 Separate Pages

The system now has **4 completely separate pages** - no tabs or navigation menus!

---

## 🔗 Page URLs

### 1. **Entrance Display Page**
**URL:** `http://localhost:3000/`

**Purpose:** Display at campus entrance on a tablet/screen

**Features:**
- Large QR code for students to scan
- Step-by-step instructions
- Clean, fullscreen purple gradient design
- Auto-refreshes QR code every 30 seconds

**Who uses it:** Campus staff - keep this page open at entrance

---

### 2. **Student Registration Page**
**URL:** `http://localhost:3000/register?campus=<code>`

**Purpose:** Student's phone after scanning entrance QR

**Features:**
- Mobile-friendly registration form
- Instant token generation after registration
- Token displayed as QR code
- Screenshot-friendly design

**Who uses it:** Students automatically when they scan entrance QR

---

### 3. **Security Verification Page**
**URL:** `http://localhost:3000/security`

**Purpose:** Security staff to verify student tokens

**Features:**
- Large input field for token entry
- QR scanner support
- ✅ Access Granted (green) or ❌ Access Denied (red)
- Auto-reset after 5 seconds on success
- Dark theme for easy reading

**Who uses it:** Security staff at entrance

---

### 4. **Admin Dashboard Page**
**URL:** `http://localhost:3000/admin`

**Purpose:** Monitor campus visitors and statistics

**Features:**
- Real-time statistics (Total Students, Today's Visits, All-Time Visits)
- Two views: Today's Visitors | All Students
- Search functionality
- Auto-refresh every 30 seconds
- Clean data tables

**Who uses it:** Campus administrators

---

## 🚀 Quick Setup Guide

### **At Campus Entrance:**

1. **Display Device (Tablet/Screen):**
   - Open `http://localhost:3000/`
   - Put in fullscreen mode (F11)
   - Students scan this QR code

2. **Security Device (Tablet/Phone):**
   - Open `http://localhost:3000/security`
   - Enter/scan student tokens
   - Grant or deny access

### **In Admin Office:**

3. **Admin Computer:**
   - Open `http://localhost:3000/admin`
   - Monitor all activity
   - Search students
   - View statistics

---

## 📱 User Flow

```
┌──────────────────────────────────────────────────┐
│  ENTRANCE DISPLAY                                │
│  http://localhost:3000/                          │
│                                                  │
│  [Large QR Code displayed here]                 │
│                                                  │
│  Instructions: Scan to register                 │
└──────────────────────────────────────────────────┘
                     │
                     │ Student scans QR
                     ▼
┌──────────────────────────────────────────────────┐
│  STUDENT'S PHONE                                 │
│  http://localhost:3000/register?campus=xxx       │
│                                                  │
│  Registration Form:                              │
│  - Name                                          │
│  - Email                                         │
│  - Phone (optional)                              │
│  - Home Campus (optional)                        │
│                                                  │
│  [Register & Get Token]                          │
└──────────────────────────────────────────────────┘
                     │
                     │ Submits form
                     ▼
┌──────────────────────────────────────────────────┐
│  ACCESS TOKEN SCREEN                             │
│                                                  │
│  ✅ Registration Complete!                       │
│  Welcome, John Doe                               │
│                                                  │
│  [Token QR Code displayed]                       │
│                                                  │
│  Show this to security →                         │
└──────────────────────────────────────────────────┘
                     │
                     │ Shows token to security
                     ▼
┌──────────────────────────────────────────────────┐
│  SECURITY VERIFICATION                           │
│  http://localhost:3000/security                  │
│                                                  │
│  [Token Input Field]                             │
│  [Verify Button]                                 │
│                                                  │
│  Result: ✅ Access Granted                       │
│  - John Doe                                      │
│  - john@email.com                                │
│  - Valid for today                               │
└──────────────────────────────────────────────────┘
```

---

## 🎨 Page Designs

### **Entrance Page** (Purple gradient, white text, centered)
- Fullscreen, no navigation
- Large QR code with shadow
- Step-by-step instructions
- Auto-refreshing

### **Registration Page** (Mobile-optimized, clean white forms)
- Purple header
- White card with form
- Large submit button
- Token display after submission

### **Security Page** (Dark theme, high contrast)
- Black/gray gradient background
- Large input field
- Bold success/failure screens
- Auto-reset functionality

### **Admin Page** (Professional dashboard)
- White background
- Colored stat cards
- Data tables
- Search and filter
- Refresh button

---

## 🔧 Technical Details

### No Navigation Menus
Each page is completely standalone - no tabs or buttons to switch between pages. Users access pages directly via URL.

### URL Routing
Simple path-based routing:
- `/` → Entrance page
- `/register?campus=xxx` → Registration
- `/security` → Security verification
- `/admin` → Admin dashboard

### Auto-Refresh
- Entrance: Refreshes QR every 30s
- Admin: Refreshes data every 30s
- Security: Auto-resets after successful verification

---

## 💡 Usage Tips

**For Display Devices:**
- Use browser fullscreen mode (F11)
- Disable screensaver/sleep mode
- Keep device plugged in

**For Security Staff:**
- Bookmark `/security` page
- Can use external USB QR scanner
- Token entry works with keyboard

**For Admins:**
- Bookmark `/admin` page  
- Use search to find specific students
- Can export data (feature to be added)

---

**System is ready! Open the pages and test the complete flow.**
