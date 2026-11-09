# AIFSP - QR Code Sign-In System

A complete web-based QR code sign-in system for managing student access to AIFSP.

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
3. **Student registers** → chooses a class, enters date of birth, name, phone,
   and purpose
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

## SMS

Arkesel and Termii are supported. Configure `SMS_ENABLED=true`, `SMS_PROVIDER`,
`SMS_API_KEY`, and `SMS_SENDER_ID` in the server environment. The Retention page
supports editable broadcasts to all members or a selected retention segment,
with `{name}` and `{campus}` placeholders. SMS history records provider-accepted,
failed, and skipped attempts with masked phone numbers; provider acceptance does
not confirm delivery to a handset.

For an existing Supabase project, run `supabase/sms-logs-migration.sql` in the
Supabase SQL Editor if the SMS history table has not been created yet. To enable
the retention campaign, opt-out, scheduling, and delivery tracking additions,
run `supabase/retention-features-migration.sql` as well. New projects can use the
updated `supabase/schema.sql`.
For existing projects, run `supabase/date-of-birth-migration.sql` to add the date
of birth field and update the atomic class-registration function. New projects
can use the updated `supabase/schema.sql`.

The Retention page supports per-campus drip templates, a 1–90 day repeat-send
cooldown (7 days by default), an eligible-recipient preview, scheduling in
Africa/Accra time, and an admin-managed SMS opt-out. Existing saved phone
numbers remain eligible unless an admin opts a member out. Configure provider
STOP/opt-out handling in the provider account and reflect opt-outs in the
member's SMS preference in Retention; this app does not receive inbound SMS.

Campaign history shows provider acceptance separately from confirmed handset
delivery. For delivery updates, set `SMS_DELIVERY_WEBHOOK_TOKEN` on the server
and configure a provider callback or trusted webhook relay to POST
`provider_message_id` and `delivery_status` (`delivered`, `failed`,
`undelivered`, `expired`, or `rejected`) to `/api/sms/delivery` with the token in
the `x-sms-webhook-token` header. The app captures provider message IDs when
they are included in send responses. Return-visit metrics count verified visits
after an accepted campaign message; they show association, not proof that the
SMS caused the return.

## Class timetable and attendance

Class bookings are separate from campus access. Students use `/classes` to view
the active campus timetable and book an occurrence using their campus-registered
name and phone number. First-time registration requires at least one class
selection; the student and selected bookings are validated and created together.
First-time visitors provide their date of birth after selecting a class.
Returning students continue to use Quick Pass and can manage class bookings
separately. A booking creates no campus access token; students still use the
existing entrance QR and daily 4-digit access verification. Class attendance is
a separate record and is only marked by an authorized admin.
Absences are not automatic: an admin may mark a student absent after the class
end time, or mark attendance present. Campus-entry reports and class attendance
reports remain separate.

Admins manage academic terms and recurring weekly classes from
`/admin/classes`. A class includes its day, time, room, capacity, and optional
instructor. A new database is seeded with the initial weekly timetable at each
campus; seed classes use a one-hour duration and can be changed in the dashboard.
Only a published class in the active term is bookable. Same-room overlapping
classes are rejected; concurrent classes in different rooms are allowed.
Existing bookings store a snapshot of the class details. Rescheduling flags
upcoming bookings for rebooking; cancelling a class invalidates its upcoming
bookings. Students can book the same date again after rebooking or after an
administrator reopens registration; each booking keeps its own schedule
snapshot and history. When SMS is configured, affected students are sent a
change notice unless opted out; each provider acceptance, skip, or failure is
recorded with the booking. Provider acceptance does not confirm handset
delivery.

Students can add a booking to Google Calendar or Outlook, or download an ICS
invite with 2-day, 1-day, and 1-hour reminders where supported. The system
records that a calendar option was selected, not that an external calendar
successfully synced or delivered a reminder. Admins can filter class attendance
by class and date, search by student name or phone, and export a CSV that keeps
campus check-in and class attendance as separate fields. A date-range analytics
panel summarizes registrations, attendance, capacity utilization, class
popularity, daily trends, and students with repeated absences.

For an existing Supabase project, run `supabase/class-schedule-migration.sql`
after the base schema. It adds class tables, indexes, RLS restrictions,
database-side booking functions, calendar-selection tracking, and constraints
that preserve rebooking history while limiting active duplicate bookings.
After the migration succeeds, restart the server; it creates and activates the
initial term and seeds the editable starter timetable for campuses without an
existing term. If a campus already has terms but none is active, an admin must
activate one in `/admin/classes`. New projects can use the updated
`supabase/schema.sql`.

## Security hardening

For an existing Supabase project, run `supabase/security-hardening-migration.sql`
after the base schema. It enables Row Level Security and removes direct
`anon`/`authenticated` table access; the server must continue using the
Supabase `service_role` key, which must never be exposed to the browser.

In Render, set `ALLOWED_ORIGINS` to the exact deployed website origin (for
example, `https://your-site.onrender.com`; do not include a path). Add other
trusted origins as a comma-separated list. Unset means cross-origin browser
requests are denied. `ALLOW_UNAUTHENTICATED=true` is ignored in production.
Configure strong server-side `ADMIN_TOKEN`, `SECURITY_TOKEN`, and
`SUPER_ADMIN_TOKEN` values (or the campus-specific environment maps) before
deploying.

Staff login sessions are stored in `HttpOnly`, `SameSite=Strict` cookies and
are not exposed to browser JavaScript. Existing saved campus passwords are
upgraded to salted scrypt hashes when next used; password settings are
write-only through the admin API. New passwords must contain at least 12
characters. Access-code requests remain phone-only, with per-IP and per-phone
throttling; staff should verify each student's identity when checking a code.

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

Built for AIFSP - Religious Studies & Community Learning Center

## CI / Docker

This repository includes a `Dockerfile` and a GitHub Actions workflow that builds and publishes a Docker image to GitHub Container Registry (GHCR) on pushes to `main`.

- To publish on push, push your branch to `main`. The workflow uses the repository's `GITHUB_TOKEN` to push to `ghcr.io`.
- The image will be available as `ghcr.io/<owner>/<repo>:latest` and also tagged with the commit SHA.

If you prefer Docker Hub, replace the login and tags in `.github/workflows/docker-publish.yml` accordingly.
