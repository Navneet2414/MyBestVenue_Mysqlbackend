const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { ensureAdminsTable } = require('../models/table_admin');
// const { ensureVenuesTable } = require('../models/table_venues');

const EMAIL_REGEX = /^[a-zA-Z0-9](\.?[a-zA-Z0-9_-])*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const registerAdmin = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    if (!EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    await ensureAdminsTable({ query });

    const [existingRows] = await query('SELECT id FROM table_admins WHERE email = ? LIMIT 1', [email]);
    if (existingRows.length > 0) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    const [result] = await query(
      `INSERT INTO table_admins (name, email, phone, password, role, otp, otpExpires, isVerified)
       VALUES (?, ?, ?, ?, 'admin', ?, ?, 0)`,
      [name, email, phone || null, hashedPassword, otp, otpExpires]
    );

    return res.status(201).json({
      message: 'Admin registered successfully. Verify OTP to activate account.',
      id: result.insertId,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('registerAdmin error:', error);
    return res.status(500).json({ message: 'Error registering admin', error: error.message || String(error) });
  }
};

const verifyAdminOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: 'email and otp are required' });
    }

    await ensureAdminsTable({ query });

    const [rows] = await query(
      'SELECT id, name, email, phone, role, isVerified, otp, otpExpires FROM table_admins WHERE email = ? LIMIT 1',
      [email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const admin = rows[0];
    if (Number(admin.isVerified) === 1) {
      return res.status(400).json({ message: 'Admin already verified' });
    }

    const otpMatches = String(otp).trim() === String(admin.otp || '').trim();
    const otpExpired = !admin.otpExpires || Number(admin.otpExpires) < Date.now();
    if (!otpMatches || otpExpired) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    await query('UPDATE table_admins SET isVerified = 1, otp = NULL, otpExpires = NULL WHERE id = ?', [admin.id]);

    return res.status(200).json({
      message: 'Admin verified successfully',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isVerified: 1,
      },
    });
  } catch (error) {
    console.error('verifyAdminOtp error:', error);
    return res.status(500).json({ message: 'Error verifying admin OTP', error: error.message || String(error) });
  }
};

const resendAdminOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    await ensureAdminsTable({ query });

    const [rows] = await query('SELECT id, isVerified FROM table_admins WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (Number(rows[0].isVerified) === 1) {
      return res.status(400).json({ message: 'Admin already verified' });
    }

    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;
    await query('UPDATE table_admins SET otp = ?, otpExpires = ? WHERE id = ?', [otp, otpExpires, rows[0].id]);

    return res.status(200).json({
      message: 'New admin OTP generated successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('resendAdminOtp error:', error);
    return res.status(500).json({ message: 'Error resending admin OTP', error: error.message || String(error) });
  }
};

const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    await ensureAdminsTable({ query });

    const [rows] = await query(
      'SELECT id, name, email, phone, role, isVerified, password FROM table_admins WHERE email = ? AND role = ? LIMIT 1',
      [email, 'admin']
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (Number(admin.isVerified) === 0) {
      return res.status(403).json({ message: 'your registerotp is not verified' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET is not configured' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role || 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isVerified: admin.isVerified,
      },
    });
  } catch (error) {
    console.error('loginAdmin error:', error);
    return res.status(500).json({ message: 'Error logging in admin', error: error.message || String(error) });
  }
};

// Verify Registered Venue
const approveVenue = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json({ message: 'Venue id is required' });
    }

    // await ensureVenuesTable({ query });

    const [rows] = await query('SELECT venue_id AS id, isApproved FROM tbl_venue WHERE venue_id = ? LIMIT 1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    if (Number(rows[0].isApproved) === 1) {
      return res.status(400).json({ message: 'Venue is already approved' });
    }

    await query('UPDATE tbl_venue SET isApproved = 1 WHERE venue_id = ?', [rows[0].id]);

    return res.status(200).json({
      message: 'Venue approved successfully',
    });
  } catch (error) {
    console.error('approveVenue error:', error);
    return res.status(500).json({ message: 'Error approving venue', error: error.message || String(error) });
  }
};

module.exports = {
  registerAdmin,
  verifyAdminOtp,
  resendAdminOtp,
  loginAdmin,
  approveVenue,
};
