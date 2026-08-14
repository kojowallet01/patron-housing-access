# ✅ Go-Live Checklist

## Pre-Launch Tasks

### Technical Setup
- [ ] **Install dependencies:** `npm install`
- [ ] **Test locally:** `npm run dev`
- [ ] **Verify all pages load:**
  - [ ] `http://localhost:3000/` (Entrance)
  - [ ] `http://localhost:3000/register` (Registration)
  - [ ] `http://localhost:3000/security` (Security)
  - [ ] `http://localhost:3000/admin` (Admin)
- [ ] **Test complete user flow:**
  - [ ] Scan QR → Register → Get Token → Verify
- [ ] **Check database:** `db.json` file created and updating
- [ ] **Mobile test:** Access from phone on same network

### Network Setup (Local Deployment)
- [ ] **Find server IP address:** `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- [ ] **Configure firewall:** Allow Node.js connections
- [ ] **Test external access:** Connect from phone/tablet
- [ ] **Verify WiFi:** All devices on same network
- [ ] **Internet speed check:** Adequate for multiple devices

### Device Preparation

#### Entrance Display
- [ ] **Device selected:** Tablet/Monitor (10"+ screen)
- [ ] **Mounting:** Secured at entrance
- [ ] **Power:** Plugged in, no sleep mode
- [ ] **Browser:** Chrome/Edge installed
- [ ] **Bookmark created:** Entrance page URL
- [ ] **Fullscreen tested:** F11 works
- [ ] **QR code visible:** Clear and scannable
- [ ] **Lighting:** Adequate for QR scanning
- [ ] **Signage:** Instructions posted nearby

#### Security Station
- [ ] **Device selected:** Tablet or phone
- [ ] **Charging:** Charger nearby
- [ ] **Browser:** Updated and tested
- [ ] **Bookmark created:** Security page URL
- [ ] **Backup device:** Available if primary fails
- [ ] **Position:** Convenient for staff
- [ ] **QR scanner:** Optional USB scanner if needed

#### Admin Dashboard
- [ ] **Computer setup:** Desktop/laptop ready
- [ ] **Browser:** Modern browser installed
- [ ] **Bookmark created:** Admin page URL
- [ ] **Screen size:** Large enough to view data
- [ ] **Location:** Admin office or secure area
- [ ] **Printer access:** For reports (future)

### Staff Training

#### Security Staff
- [ ] **System overview:** Explained complete flow
- [ ] **Hands-on practice:** Verify test tokens
- [ ] **Success/failure:** Understand both responses
- [ ] **Troubleshooting:** Know who to contact
- [ ] **Quick reference card:** Created and distributed
- [ ] **Backup procedures:** Manual verification plan

#### Admin Staff
- [ ] **Dashboard walkthrough:** All features explained
- [ ] **Reports understanding:** Today's visitors vs All students
- [ ] **Search function:** How to find specific students
- [ ] **Data interpretation:** Understand statistics
- [ ] **Backup procedures:** When to backup data
- [ ] **Issue escalation:** Know who handles tech problems

#### Campus Staff
- [ ] **System overview:** Purpose and benefits
- [ ] **Student assistance:** How to help students register
- [ ] **Device monitoring:** Check displays are on
- [ ] **Basic troubleshooting:** Restart procedures
- [ ] **Contact list:** IT support numbers

### Documentation
- [ ] **User guides created:**
  - [ ] Student registration guide
  - [ ] Security verification guide
  - [ ] Admin dashboard guide
- [ ] **Troubleshooting document:** Common issues and fixes
- [ ] **Contact list:** IT support, administrators
- [ ] **System credentials:** Documented (if added)
- [ ] **Backup schedule:** Defined and communicated

### Security & Backup
- [ ] **Data backup plan:** Regular `db.json` backups
- [ ] **Backup location:** Cloud or external drive
- [ ] **Recovery procedure:** Documented
- [ ] **Access control:** Admin dashboard security (future)
- [ ] **Privacy compliance:** Student data handling reviewed
- [ ] **Backup internet:** Mobile hotspot available

### Communication
- [ ] **Students notified:** Announcement sent
- [ ] **Signage installed:** At entrance and key locations
- [ ] **Email announcement:** To campus community
- [ ] **Social media:** Posted if applicable
- [ ] **FAQ prepared:** Common questions answered
- [ ] **Support contact:** Published and accessible

---

## Launch Day

### Morning Setup (1 hour before)
- [ ] **Start server:** `npm run dev`
- [ ] **Verify server running:** Check terminal for errors
- [ ] **Test all URLs:** Entrance, Security, Admin
- [ ] **Check entrance display:** QR code visible
- [ ] **Test with phone:** Scan QR from entrance
- [ ] **Complete test registration:** Full flow works
- [ ] **Security station ready:** Device on and accessible
- [ ] **Admin dashboard open:** Monitoring ready
- [ ] **Staff present:** Security and admin on site

### First Hour Monitoring
- [ ] **First registration:** Assisted and successful
- [ ] **First verification:** Security checked first student
- [ ] **Admin dashboard:** Shows first visitor
- [ ] **Staff comfortable:** No major confusion
- [ ] **Students adapting:** Using system successfully
- [ ] **QR scanning:** Working reliably
- [ ] **No errors:** System stable

### Throughout the Day
- [ ] **Regular checks:** Every 2 hours
- [ ] **Device status:** All displays still on
- [ ] **Server status:** No crashes or errors
- [ ] **Data collection:** Students registering
- [ ] **Staff feedback:** Collecting issues/suggestions
- [ ] **Student feedback:** How is experience?

---

## End of Day 1

### Review
- [ ] **Total registrations:** Count in admin dashboard
- [ ] **Issues encountered:** Document all problems
- [ ] **Staff feedback:** Collect and document
- [ ] **Student feedback:** Survey or informal
- [ ] **System uptime:** Any crashes or downtime?
- [ ] **Data backup:** Save `db.json` copy

### Adjustments
- [ ] **Fix critical issues:** Address urgent problems
- [ ] **Minor tweaks:** UI/UX improvements
- [ ] **Staff retraining:** If needed
- [ ] **Communication updates:** Send status to leadership

---

## First Week Goals

- [ ] **Daily monitoring:** Check system health
- [ ] **Daily backups:** Save database
- [ ] **Issue log:** Track and resolve problems
- [ ] **Usage statistics:** Monitor adoption
- [ ] **Staff check-ins:** Ensure comfortable with system
- [ ] **Optimization:** Improve based on feedback
- [ ] **Documentation updates:** Fix errors in guides

---

## Success Metrics

Track these KPIs:

- **Registration rate:** % of visitors who register
- **System uptime:** % of time system available
- **Average registration time:** How long it takes
- **Staff satisfaction:** Security and admin happiness
- **Student satisfaction:** User experience feedback
- **Error rate:** Failed registrations/verifications
- **Token validity issues:** Expired or invalid tokens

---

## Contingency Plans

### If Server Crashes:
1. Restart: `Ctrl+C` then `npm run dev`
2. Check error messages
3. Restore from backup if needed
4. Contact IT support if persists

### If Internet Fails:
1. Check router/modem
2. Restart network equipment
3. Use mobile hotspot as backup
4. Manual registration as fallback

### If Device Fails:
1. Switch to backup device
2. Load bookmarked page
3. Continue operations
4. Fix/replace device later

### If Database Corrupts:
1. Stop server
2. Restore from latest backup
3. Restart server
4. Verify data integrity

### Manual Fallback:
- Paper sign-in sheets ready
- Manual verification process
- Data entry into system later

---

## 30-Day Review

- [ ] **System performance:** Evaluate uptime and speed
- [ ] **User adoption:** Check registration numbers
- [ ] **Staff feedback:** Comprehensive survey
- [ ] **Student feedback:** Survey or focus group
- [ ] **Data analysis:** Look for patterns
- [ ] **Cost assessment:** Server costs (if cloud)
- [ ] **Feature requests:** Compile wish list
- [ ] **Security review:** Any vulnerabilities?
- [ ] **Backup effectiveness:** Test restore procedure
- [ ] **Documentation accuracy:** Update guides

---

## Future Enhancements to Consider

- [ ] Upgrade to SQLite or PostgreSQL database
- [ ] Add admin authentication
- [ ] Export reports to Excel/CSV
- [ ] SMS token delivery
- [ ] Check-out tracking
- [ ] Capacity management
- [ ] Visitor analytics dashboard
- [ ] Multi-campus support
- [ ] Mobile app version
- [ ] Automated backups to cloud
- [ ] Email notifications
- [ ] Print token option
- [ ] Integration with existing systems

---

## Sign-Off

**Technical Lead:**
- Name: _________________
- Date: _________________
- Signature: _________________

**Security Supervisor:**
- Name: _________________
- Date: _________________
- Signature: _________________

**Administration:**
- Name: _________________
- Date: _________________
- Signature: _________________

---

## Emergency Contacts

**IT Support:**
- Name: _________________
- Phone: _________________
- Email: _________________

**System Administrator:**
- Name: _________________
- Phone: _________________
- Email: _________________

**Campus Management:**
- Name: _________________
- Phone: _________________
- Email: _________________

---

**Built for AIFSP** 🏛️

**Launch Date:** _________________

**System Version:** 1.0.0

**Last Updated:** August 5, 2026
