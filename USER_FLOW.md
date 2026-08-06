# Tesano Campus Institute - User Flow Guide

## 🎯 New Simplified Flow

### **For Campus Staff:**

#### 1. Display Entrance QR Code
- Open `http://localhost:3000` (defaults to Entrance QR view)
- A large QR code is displayed prominently
- **Keep this page open at the entrance on a tablet/display**
- The QR code contains a link to the registration page

---

### **For Students:**

#### 2. Scan QR Code
- Use phone camera to scan the QR code at entrance
- Automatically opens registration page on phone
- URL format: `http://localhost:3000?campus=<unique-code>`

#### 3. Fill Registration Form
- **Required fields:**
  - Full Name
  - Email
- **Optional fields:**
  - Phone Number
  - Home Campus/Institution
- Click "Register & Get Access Token" button

#### 4. Receive Access Token
- **Immediately after registration**, student sees:
  - ✅ Success message
  - Welcome greeting with their name
  - **Large QR code** (their access token)
  - Token ID
  - Valid date (today only)
  - Instructions to show to security

- **Student should:**
  - Take a screenshot, OR
  - Keep the page open on their phone

---

### **For Security Staff:**

#### 5. Verify Token
- Switch to "Security Verify" tab
- Enter or scan the student's token
- Click "Verify Token"

#### 6. Grant/Deny Access
- **✅ Access Granted** (green):
  - Shows student name, email, home campus
  - Valid date confirmation
  - Let student enter

- **❌ Access Denied** (red):
  - Shows error (invalid or expired token)
  - Do not allow entry

---

### **For Administrators:**

#### 7. Monitor Campus
- Switch to "Admin Dashboard" tab
- View real-time statistics:
  - Total registered students
  - Today's visits
  - Total visits
  
- **Two views:**
  - **Today's Visitors**: See who's currently checked in
  - **All Students**: Complete registry

---

## 📱 The Complete Journey

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Campus displays QR at entrance                │
│  🖥️  http://localhost:3000 (Entrance QR tab)           │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Student scans QR code with phone              │
│  📱 Opens registration page automatically               │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Student fills registration form               │
│  📝 Name, Email, Phone, Home Campus                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Student receives access token instantly       │
│  ✅ QR code displayed on phone                          │
│  💾 Screenshot or keep page open                        │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 5: Security verifies token                       │
│  🔒 Scan/enter token → Grant access                     │
└─────────────────────────────────────────────────────────┘
```

## 🎨 Visual Layout

### Main Page (http://localhost:3000)
```
╔════════════════════════════════════════════════════╗
║     🏛️ Tesano Campus Institute                    ║
║   Religious Studies & Community Learning Center    ║
╠════════════════════════════════════════════════════╣
║  [Entrance QR] [Security Verify] [Admin Dashboard] ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║              🚪 Campus Entrance                    ║
║                                                    ║
║     ┌─────────────────────────────────┐           ║
║     │                                 │           ║
║     │        [QR CODE IMAGE]          │           ║
║     │                                 │           ║
║     └─────────────────────────────────┘           ║
║                                                    ║
║     📱 Instructions for Students:                  ║
║     1. Scan this QR code                          ║
║     2. Fill registration form                     ║
║     3. Get access token                           ║
║     4. Show to security                           ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

### Registration Page (Student's Phone)
```
╔════════════════════════════════════════════════════╗
║     🏛️ Tesano Campus Institute                    ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║         📝 Student Registration                    ║
║                                                    ║
║  Full Name *                                       ║
║  [___________________________________]             ║
║                                                    ║
║  Email *                                           ║
║  [___________________________________]             ║
║                                                    ║
║  Phone Number                                      ║
║  [___________________________________]             ║
║                                                    ║
║  Home Campus                                       ║
║  [___________________________________]             ║
║                                                    ║
║  [Register & Get Access Token]                    ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

### Access Token Page (After Registration)
```
╔════════════════════════════════════════════════════╗
║     🏛️ Tesano Campus Institute                    ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║                    ✅                              ║
║          Registration Complete!                    ║
║                                                    ║
║           Welcome, John Doe                        ║
║                                                    ║
║     ┌─────────────────────────────────┐           ║
║     │   Your Access Token             │           ║
║     │                                 │           ║
║     │    [TOKEN QR CODE IMAGE]        │           ║
║     │                                 │           ║
║     └─────────────────────────────────┘           ║
║                                                    ║
║  📱 Show this QR code to security at entrance     ║
║                                                    ║
║  Token ID: abc-123-xyz-789                        ║
║  Valid for today: July 14, 2026                   ║
║                                                    ║
║  💡 Take a screenshot or save this token          ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

## 🔑 Key Features

✅ **One-Time Registration**: Students only register once  
✅ **Instant Token**: Token generated immediately after registration  
✅ **Daily Validity**: Tokens valid for single day only  
✅ **QR Based**: Both entrance and token use QR codes  
✅ **Mobile Friendly**: Registration works on any phone  
✅ **Real-time Admin**: Dashboard updates live  

## 🚀 Getting Started

1. **Start the application:**
   ```cmd
   npm run dev
   ```

2. **Open on display at entrance:**
   - Navigate to `http://localhost:3000`
   - Shows entrance QR code by default

3. **Students scan QR code:**
   - Opens registration automatically
   - Fill form → Get token instantly

4. **Security verifies:**
   - Click "Security Verify" tab
   - Scan or enter student's token

5. **Admin monitors:**
   - Click "Admin Dashboard" tab
   - View all visitors and statistics

---

**Built for Tesano Campus Institute** 🏛️
