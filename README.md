# Tesano Campus Institute - QR Code Sign-In System

A complete web-based QR code sign-in system for managing student access to Tesano Campus Institute.

## Features

- **Student Registration**: Pre-register students with personal details
- **QR Code Entry**: Students scan entrance QR to get daily access token
- **Access Tokens**: Single-day valid tokens displayed as QR codes
- **Security Verification**: Security staff can verify tokens at entrance
- **Admin Dashboard**: Real-time monitoring of campus visitors and statistics

## How It Works

### **The Complete Flow:**

1. **Campus displays QR code at entrance** (on a tablet or screen)
2. **Student scans QR code** → automatically opens registration page on their phone
3. **Student registers** → fills name, email, and optional details
4. **Student receives access token** → immediately displayed as QR code on their phone
5. **Student shows token to security** → security scans/verifies token
6. **Access granted!** → student enters campus

### **Key Benefits:**
- ✅ Students register and get token in one seamless flow
- ✅ No need to remember credentials or come back later
- ✅ Token displayed immediately after registration
- ✅ Valid for single day (automatic expiry)
- ✅ Admin can monitor all visitors in real-time

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm

### Setup

1. Install dependencies:
```cmd
npm install
```

2. Start the application:
```cmd
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend on `http://localhost:3000`

3. Open your browser to `http://localhost:3000`

## Usage

### Setup at Campus Entrance

1. **Start the application**
   ```cmd
   npm run dev
   ```

2. **Display Entrance QR Code**
   - Open `http://localhost:3000` on a tablet/screen at entrance
   - The entrance QR code is shown by default
   - Keep this displayed for students to scan

### For Students

1. **Scan the QR Code**
   - Use phone camera to scan entrance QR
   - Registration page opens automatically

2. **Register**
   - Fill in your details (Name and Email required)
   - Click "Register & Get Access Token"

3. **Receive Your Token**
   - Access token with QR code appears instantly
   - Take a screenshot or keep page open
   - Show this to security at entrance

### For Security Staff

1. **Verify Student Tokens**
   - Click "Security Verify" tab
   - Scan or manually enter student's token
   - System shows ✅ Access Granted or ❌ Access Denied

### For Administrators

1. **Monitor Campus Activity**
   - Click "Admin Dashboard" tab
   - View real-time statistics
   - See today's visitors
   - Access complete student registry

## Database

The system uses SQLite database (`tesano-campus.db`) with three tables:
- `students` - Student registration info
- `access_tokens` - Daily access tokens
- `campus_qr` - Campus entrance QR code

## Technology Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **QR Codes**: qrcode library
- **Styling**: Custom CSS

## Security Features

- Tokens are valid for single day only
- Unique tokens per student per day
- Email-based student verification
- Secure token generation with UUID

## Future Enhancements

- SMS notifications for token delivery
- Check-out system
- Capacity management
- Visitor analytics and reports
- Mobile app version
- Multi-campus support

## Support

For issues or questions, contact campus administration.

---

Built for Tesano Campus Institute - Religious Studies & Community Learning Center

## CI / Docker

This repository includes a `Dockerfile` and a GitHub Actions workflow that builds and publishes a Docker image to GitHub Container Registry (GHCR) on pushes to `main`.

- To publish on push, push your branch to `main`. The workflow uses the repository's `GITHUB_TOKEN` to push to `ghcr.io`.
- The image will be available as `ghcr.io/<owner>/<repo>:latest` and also tagged with the commit SHA.

If you prefer Docker Hub, replace the login and tags in `.github/workflows/docker-publish.yml` accordingly.
