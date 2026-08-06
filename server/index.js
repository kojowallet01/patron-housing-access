import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import QRCode from 'qrcode';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3001;
const DB_FILE = 'db.json';

app.use(cors());
app.use(express.json());


// Simple JSON file database helpers
async function readDB() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { students: [], access_tokens: [], campus_qr: null };
  }
}

async function writeDB(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// Initialize database
let db = await readDB();
if (!db.campus_qr) {
  db.campus_qr = uuidv4();
  await writeDB(db);
  console.log('Campus entrance QR code generated:', db.campus_qr);
}

// Helper function to generate 4-digit token
function generateShortToken() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // Generates 1000-9999
}

// Register new student
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, purpose } = req.body;
    
    if (!name || !phone || !purpose) {
      return res.status(400).json({ error: 'Name, phone, and purpose are required' });
    }

    db = await readDB();
    
    // Check if phone already exists
    const existing = db.students.find(s => s.phone === phone);
    if (existing) {
      return res.status(400).json({ error: 'Phone already registered' });
    }

    const student = {
      id: uuidv4(),
      name,
      phone,
      purpose,
      created_at: new Date().toISOString()
    };

    db.students.push(student);
    await writeDB(db);

    res.json({ success: true, message: 'Registration successful', studentId: student.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get campus entrance QR code
app.get('/api/campus-qr', async (req, res) => {
  try {
    db = await readDB();
    
    // Get the host from the request
    const host = req.get('host');
    const protocol = req.protocol;
    
    // Build base URL from actual request
    let baseUrl;
    if (host.includes(':3001')) {
      // Request came to backend, construct frontend URL
      baseUrl = `${protocol}://${host.replace(':3001', ':3000')}`;
    } else {
      // Request came through frontend proxy or direct frontend URL
      baseUrl = `${protocol}://${host}`;
    }
    
    const registrationUrl = `${baseUrl}/register?campus=${db.campus_qr}`;

    // Prefer a manually supplied campus QR image in /public/custom-campus-qr.png
    const customImagePath = path.join(process.cwd(), 'public', 'custom-campus-qr.png');
    try {
      await fs.access(customImagePath);
      const imageUrl = `${baseUrl}/custom-campus-qr.png`;
      return res.json({ qrCodeUrl: imageUrl, code: db.campus_qr, registrationUrl });
    } catch (e) {
      // Fall back to generating a QR data URL
      const qrDataURL = await QRCode.toDataURL(registrationUrl);
      return res.json({ qrCodeUrl: qrDataURL, code: db.campus_qr, registrationUrl });
    }
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// New endpoint: Generate token immediately after registration
app.post('/api/generate-token', async (req, res) => {
  try {
    const { phone, campusCode } = req.body;
    
    db = await readDB();
    
    // Verify campus code
    if (campusCode !== db.campus_qr) {
      return res.status(400).json({ error: 'Invalid campus code' });
    }

    // Find student
    const student = db.students.find(s => s.phone === phone);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if student already has a valid token for today
    const today = new Date().toISOString().split('T')[0];
    let tokenData = db.access_tokens.find(
      t => t.student_id === student.id && t.valid_date === today
    );

    if (!tokenData) {
      // Generate new token - 4 digits
      tokenData = {
        id: uuidv4(),
        student_id: student.id,
        token: generateShortToken(),
        valid_date: today,
        created_at: new Date().toISOString(),
        used_at: new Date().toISOString()
      };
      db.access_tokens.push(tokenData);
      await writeDB(db);
    }

    // Generate QR code for token
    const tokenQR = await QRCode.toDataURL(tokenData.token);

    res.json({
      success: true,
      student: { name: student.name, phone: student.phone },
      token: tokenData.token,
      tokenQR: tokenQR,
      validDate: tokenData.valid_date
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate access token' });
  }
});

// Scan campus QR and generate access token
app.post('/api/scan-entry', async (req, res) => {
  try {
    const { qrCode, phone } = req.body;
    
    db = await readDB();
    
    // Verify campus QR code
    if (qrCode !== db.campus_qr) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }

    // Find student
    const student = db.students.find(s => s.phone === phone);
    if (!student) {
      return res.status(404).json({ error: 'Student not registered. Please register first.' });
    }

    // Check if student already has a valid token for today
    const today = new Date().toISOString().split('T')[0];
    let tokenData = db.access_tokens.find(
      t => t.student_id === student.id && t.valid_date === today
    );

    if (!tokenData) {
      // Generate new token - 4 digits
      tokenData = {
        id: uuidv4(),
        student_id: student.id,
        token: generateShortToken(),
        valid_date: today,
        created_at: new Date().toISOString(),
        used_at: new Date().toISOString()
      };
      db.access_tokens.push(tokenData);
      await writeDB(db);
    }

    // Generate QR code for token
    const tokenQR = await QRCode.toDataURL(tokenData.token);

    res.json({
      success: true,
      student: { name: student.name, phone: student.phone },
      token: tokenData.token,
      tokenQR: tokenQR,
      validDate: tokenData.valid_date
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to generate access token' });
  }
});

// Verify access token (for security to scan)
app.post('/api/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    db = await readDB();
    const today = new Date().toISOString().split('T')[0];
    const tokenData = db.access_tokens.find(
      t => t.token === token && t.valid_date === today
    );

    if (!tokenData) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired token' });
    }

    const student = db.students.find(s => s.id === tokenData.student_id);

    res.json({
      valid: true,
      student: {
        name: student.name,
        phone: student.phone,
        purpose: student.purpose
      },
      validDate: tokenData.valid_date
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Admin: Get all students on campus today
app.get('/api/admin/today', async (req, res) => {
  try {
    db = await readDB();
    const today = new Date().toISOString().split('T')[0];
    const todayTokens = db.access_tokens.filter(t => t.valid_date === today);
    
    const students = todayTokens.map(token => {
      const student = db.students.find(s => s.id === token.student_id);
      return {
        name: student.name,
        phone: student.phone,
        purpose: student.purpose,
        used_at: token.used_at
      };
    });

    res.json({ date: today, count: students.length, students });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Admin: Get all registered students
app.get('/api/admin/students', async (req, res) => {
  try {
    db = await readDB();
    res.json({ count: db.students.length, students: db.students });
  } catch (error) {
    console.error('Admin query error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Admin: Get statistics
app.get('/api/admin/stats', async (req, res) => {
  try {
    db = await readDB();
    const totalStudents = db.students.length;
    const today = new Date().toISOString().split('T')[0];
    const todayVisits = db.access_tokens.filter(t => t.valid_date === today).length;
    const totalVisits = db.access_tokens.length;

    res.json({ totalStudents, todayVisits, totalVisits });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`\n🌐 Network Access:`);
  console.log(`   Use your computer's IP address to access from other devices`);
  console.log(`   Example: http://192.168.1.XXX:${PORT}`);
  console.log(`\n📱 To find your IP address:`);
  console.log(`   Windows: Run "ipconfig" in command prompt`);
  console.log(`   Look for "IPv4 Address" under your active network`);
});

// Serve built frontend when available (production)
const distDir = path.join(process.cwd(), 'dist');
try {
  const stat = await fs.stat(distDir).catch(() => null);
  if (stat && stat.isDirectory()) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
    console.log('Serving production frontend from', distDir);
  }
} catch (e) {
  // ignore if dist doesn't exist yet
}
