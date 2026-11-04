# 🚀 Setting Up Passwords on Render

Your code has been pushed to GitHub, but the `.env` file (with passwords) is NOT pushed for security reasons.

You need to manually configure the passwords as **Environment Variables** on Render.

---

## 📋 Step-by-Step Guide

### **Step 1: Access Your Render Dashboard**
1. Go to: https://dashboard.render.com
2. Log in to your account
3. Find your **patron-housing-access** service
4. Click on it to open the service details

---

### **Step 2: Open Environment Variables**
1. In your service page, look for the **Environment** tab on the left sidebar
2. Click **Environment**
3. You'll see a list of environment variables

---

### **Step 3: Add Password Environment Variables**

Click **Add Environment Variable** and add each of these:

#### **Required Variables:**

**1. Super Admin Password:**
```
Key:   SUPER_ADMIN_TOKEN
Value: REPLACE_WITH_UNIQUE_SUPER_ADMIN_SECRET
```

**2. Global Admin Fallback:**
```
Key:   ADMIN_TOKEN
Value: REPLACE_WITH_UNIQUE_ADMIN_SECRET
```

**3. Global Security Fallback:**
```
Key:   SECURITY_TOKEN
Value: REPLACE_WITH_UNIQUE_SECURITY_SECRET
```

**4. Campus Admin Passwords (JSON format):**
```
Key:   CAMPUS_ADMIN_TOKENS
Value: {"TESANO CAMPUS":"REPLACE_WITH_UNIQUE_TESANO_ADMIN_SECRET","CANTOMENT CAMPUS":"REPLACE_WITH_UNIQUE_CANTOMENT_ADMIN_SECRET","ASHIAMAN CAMPUS":"REPLACE_WITH_UNIQUE_ASHIAMAN_ADMIN_SECRET","LEGON CAMPUS":"REPLACE_WITH_UNIQUE_LEGON_ADMIN_SECRET","TEMA CAMPUS":"REPLACE_WITH_UNIQUE_TEMA_ADMIN_SECRET"}
```

**5. Campus Security Passwords (JSON format):**
```
Key:   CAMPUS_SECURITY_TOKENS
Value: {"TESANO CAMPUS":"REPLACE_WITH_UNIQUE_TESANO_SECURITY_SECRET","CANTOMENT CAMPUS":"REPLACE_WITH_UNIQUE_CANTOMENT_SECURITY_SECRET","ASHIAMAN CAMPUS":"REPLACE_WITH_UNIQUE_ASHIAMAN_SECURITY_SECRET","LEGON CAMPUS":"REPLACE_WITH_UNIQUE_LEGON_SECURITY_SECRET","TEMA CAMPUS":"REPLACE_WITH_UNIQUE_TEMA_SECURITY_SECRET"}
```

---

### **Step 4: Add Other Required Variables**

**6. Campus Configuration:**
```
Key:   CAMPUS_INSTITUTE_NAME
Value: ACCRA INSTITUTE FACULTY STUDENT PORTAL
```

```
Key:   DEFAULT_CAMPUS
Value: TESANO CAMPUS
```

**7. Production Settings:**
```
Key:   NODE_ENV
Value: production
```

**8. CORS (Replace with your Render URL):**
```
Key:   ALLOWED_ORIGINS
Value: https://your-app-name.onrender.com
```

**9. Frontend URL (Replace with your Render URL):**
```
Key:   FRONTEND_URL
Value: https://your-app-name.onrender.com
```

---

### **Step 5: Keep Your Existing Supabase Variables**

Make sure these are still set (they should already be there):
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

---

### **Step 6: Save and Redeploy**

1. After adding all variables, click **Save Changes**
2. Render will automatically redeploy your service
3. Wait 2-5 minutes for the deployment to complete
4. Check the **Logs** tab to see if deployment was successful

---

## ✅ Testing Your Production Passwords

### **Step 1: Find Your Render URL**
Your app URL will be something like:
```
https://patron-housing-access.onrender.com
```

### **Step 2: Test Super Admin Login**
1. Go to: `https://your-app-name.onrender.com/admin/login`
2. Select: **Super Admin**
3. Choose: Any campus
4. Password: `REPLACE_WITH_UNIQUE_SUPER_ADMIN_SECRET`
5. Click: **Sign In**

### **Step 3: Test Campus Admin Login**
1. Go to login page
2. Select: **Admin**
3. Choose: **TESANO CAMPUS**
4. Password: `REPLACE_WITH_UNIQUE_TESANO_ADMIN_SECRET`
5. Click: **Sign In**

### **Step 4: Test Security Login**
1. Go to: `https://your-app-name.onrender.com/security`
2. Select: **Security**
3. Choose: **TESANO CAMPUS**
4. Password: `REPLACE_WITH_UNIQUE_TESANO_SECURITY_SECRET`
5. Click: **Sign In**

---

## 🔐 Security Best Practices for Production

### **Before Going Live:**

1. **Change Default Passwords:**
   - Log in as Super Admin
   - Go to Security tab
   - Change all default passwords to stronger ones

2. **Use Strong Passwords:**
   ```
   Example format: Campus@Admin#2024!Secure
   Minimum 12 characters
   Mix of upper/lowercase, numbers, symbols
   ```

3. **Document Production Passwords:**
   - Store in password manager (LastPass, 1Password, etc.)
   - Never store in Git
   - Share securely with authorized staff only

4. **Set Up HTTPS:**
   - Render provides HTTPS automatically ✅
   - Ensure all URLs use `https://` not `http://`

---

## 🚨 Troubleshooting

### **Problem: "Authentication required" error**
**Solution:**
- Check environment variables are saved on Render
- Verify no extra spaces in password values
- Check JSON format for CAMPUS_ADMIN_TOKENS and CAMPUS_SECURITY_TOKENS
- Redeploy if you just added variables

### **Problem: "Invalid credentials"**
**Solution:**
- Double-check password spelling (case-sensitive!)
- Make sure correct campus is selected
- Try Super Admin password first to verify system works
- Check Render logs for authentication errors

### **Problem: Variables not working**
**Solution:**
1. Go to Render Dashboard
2. Check Environment tab
3. Make sure all variables are there
4. Click "Manual Deploy" → "Deploy latest commit"
5. Wait for deployment to finish

### **Problem: JSON format errors**
**Solution:**
- Ensure no line breaks in JSON values
- Use double quotes `"` not single quotes `'`
- Validate JSON at: https://jsonlint.com/
- Copy-paste exact values from this guide

---

## 📋 Quick Copy-Paste Format

For easy setup, copy this entire block and add each line as a separate environment variable:

```
SUPER_ADMIN_TOKEN=REPLACE_WITH_UNIQUE_SUPER_ADMIN_SECRET
ADMIN_TOKEN=REPLACE_WITH_UNIQUE_ADMIN_SECRET
SECURITY_TOKEN=REPLACE_WITH_UNIQUE_SECURITY_SECRET
CAMPUS_ADMIN_TOKENS={"TESANO CAMPUS":"REPLACE_WITH_UNIQUE_TESANO_ADMIN_SECRET","CANTOMENT CAMPUS":"REPLACE_WITH_UNIQUE_CANTOMENT_ADMIN_SECRET","ASHIAMAN CAMPUS":"REPLACE_WITH_UNIQUE_ASHIAMAN_ADMIN_SECRET","LEGON CAMPUS":"REPLACE_WITH_UNIQUE_LEGON_ADMIN_SECRET","TEMA CAMPUS":"REPLACE_WITH_UNIQUE_TEMA_ADMIN_SECRET"}
CAMPUS_SECURITY_TOKENS={"TESANO CAMPUS":"REPLACE_WITH_UNIQUE_TESANO_SECURITY_SECRET","CANTOMENT CAMPUS":"REPLACE_WITH_UNIQUE_CANTOMENT_SECURITY_SECRET","ASHIAMAN CAMPUS":"REPLACE_WITH_UNIQUE_ASHIAMAN_SECURITY_SECRET","LEGON CAMPUS":"REPLACE_WITH_UNIQUE_LEGON_SECURITY_SECRET","TEMA CAMPUS":"REPLACE_WITH_UNIQUE_TEMA_SECURITY_SECRET"}
CAMPUS_INSTITUTE_NAME=ACCRA INSTITUTE FACULTY STUDENT PORTAL
DEFAULT_CAMPUS=TESANO CAMPUS
NODE_ENV=production
```

---

## 🎯 Verification Checklist

After setting up on Render:

- [ ] All environment variables added
- [ ] Service redeployed successfully
- [ ] Can access production URL
- [ ] Super Admin login works
- [ ] Can switch between campuses
- [ ] Campus admin login works
- [ ] Security portal login works
- [ ] Password change feature works
- [ ] All 5 campuses accessible

---

## 📞 Support

**If you need help:**
1. Check Render logs for error messages
2. Verify environment variables are correctly formatted
3. Try redeploying manually
4. Test with Super Admin password first

**Common issues:**
- Missing environment variables
- Incorrect JSON formatting
- Extra spaces in passwords
- Wrong campus selection

---

## 🎉 Success!

Once you can log in with Super Admin on your Render URL, your production passwords are working!

**Remember to:**
- Change default passwords through the web interface
- Document new passwords securely
- Test all user roles
- Train staff on new passwords

---

**Last Updated:** October 15, 2024  
**Deployment:** Render.com Production  
**Status:** Ready for Password Setup
