const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getConnection } = require('../config/db');
// const { ensureVenuesTable } = require('../models/table_venues');
const { ensureSpacetypeTable } = require('../models/table_spacetype');

// Lazy-load email service so the rest of the app keeps working even if nodemailer isn't installed yet.
const getMailer = () => require('../services/emailService');

const sendOtpEmail = async ({ to, otp, purpose }) => {
  try {
    const { sendMail } = getMailer();
    const appName = process.env.APP_NAME || 'MyBestVenue';
    const title = purpose ? String(purpose) : 'OTP';

    await sendMail({
      to,
      subject: `${appName} - ${title}`,
      text: `Your OTP is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your OTP is <b>${otp}</b>.</p><p>It expires in 10 minutes.</p>`,
    });
    console.log("OTP sent Successfully to:", to);
  } catch (err) {
    // Best-effort: don't break existing flows if SMTP isn't configured.
    console.warn('sendOtpEmail error:', err?.message || err);
  }
};

const EMAIL_REGEX = /^[a-zA-Z0-9](\.?[a-zA-Z0-9_-])*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;

const toBoolInt = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  if (value === false || value === 'false' || value === 0 || value === '0') return 0;
  return null;
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const parsePositiveInt = (value) => {
  const num = Number(String(value ?? '').trim());
  if (!Number.isFinite(num)) return null;
  const intVal = Math.trunc(num);
  return intVal > 0 ? intVal : null;
};

const parseNonNegativeInt = (value) => {
  const num = Number(String(value ?? '').trim());
  if (!Number.isFinite(num)) return null;
  const intVal = Math.trunc(num);
  return intVal >= 0 ? intVal : null;
};

const ensureOccasionsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS tbl_occasion (
      occasion_id INT(11) NOT NULL AUTO_INCREMENT,
      occasion_name VARCHAR(150) NOT NULL,
      active TINYINT(1) DEFAULT 0,
      PRIMARY KEY (occasion_id),
      UNIQUE KEY uq_occasion_name (occasion_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const ensureAmenitiesTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS tbl_amenities (
      amenity_id INT(11) NOT NULL AUTO_INCREMENT,
      amenity_name VARCHAR(150) NOT NULL,
      active TINYINT(1) DEFAULT 0,
      PRIMARY KEY (amenity_id),
      UNIQUE KEY uq_amenity_name (amenity_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const ensureVenueRelationTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS tbl_venue_amenities (
      id INT(11) NOT NULL AUTO_INCREMENT,
      venue_id INT(11) NOT NULL,
      amenity_id INT(11) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_venue_amenity (venue_id, amenity_id),
      KEY idx_va_venue (venue_id),
      KEY idx_va_amenity (amenity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tbl_venue_occasion (
      id INT(11) NOT NULL AUTO_INCREMENT,
      venue_id INT(11) NOT NULL,
      occasion_id INT(11) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_venue_occasion (venue_id, occasion_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const ensureVenueSpacesTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS tbl_venue_spaces (
      space_id INT(11) NOT NULL AUTO_INCREMENT,
      venue_id INT(11) NOT NULL,
      space_name VARCHAR(255) NOT NULL,
      spacetype_id INT(11) DEFAULT NULL,
      seating_capacity INT(11) DEFAULT 0,
      floating_capacity INT(11) DEFAULT 0,
      description TEXT DEFAULT NULL,
      image VARCHAR(255) DEFAULT NULL,
      status TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (space_id),
      KEY idx_vs_venue (venue_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const parseIdList = (value) => {
  if (value === undefined) return null;
  if (value === null) return [];

  let normalized = value;
  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) normalized = parsed;
      } catch (_) {
        // keep original string
      }
    }
  }

  const arr = Array.isArray(normalized) ? normalized : String(normalized).split(',');
  const ids = arr
    .map((v) => Number(String(v).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  return [...new Set(ids)];
};

const parseFlexibleIdList = (value) => {
  if (value === undefined) return null;
  if (value === null) return [];

  let normalized = value;
  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        normalized = JSON.parse(trimmed);
      } catch (_) {
        // keep original string
      }
    }
  }

  if (Array.isArray(normalized)) {
    const extracted = normalized.map((item) => {
      if (item && typeof item === 'object') {
        return (
          item.id ??
          item.city_id ??
          item.cityId ??
          item.service_id ??
          item.serviceId ??
          item.amenity_id ??
          item.amenityId ??
          item.occasion_id ??
          item.occasionId
        );
      }
      return item;
    });
    return parseIdList(extracted);
  }

  if (normalized && typeof normalized === 'object') {
    const candidate =
      normalized.ids ??
      normalized.id ??
      normalized.city_id ??
      normalized.cityId ??
      normalized.service_ids ??
      normalized.serviceIds;

    if (candidate !== undefined) return parseFlexibleIdList(candidate);
  }

  return parseIdList(normalized);
};

const parseFoodPricingInput = (value) => {
  if (value === undefined) return null;
  if (value === null) return [];

  let normalized = value;
  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        normalized = JSON.parse(trimmed);
      } catch (_) {
        // keep original string
      }
    }
  }

  const items = [];

  if (Array.isArray(normalized)) {
    for (const entry of normalized) {
      if (!entry || typeof entry !== 'object') return { ok: false, message: 'Invalid food pricing format' };

      const cuisineId = entry.cuisine_id ?? entry.cuisineId ?? entry.id ?? null;
      const cuisineName = entry.cuisine ?? entry.name ?? null;
      const rawPrice = entry.price ?? entry.amount ?? null;

      const price = parseNonNegativeInt(rawPrice);
      if (price === null) return { ok: false, message: 'Invalid cuisine price' };

      if (cuisineId !== null && cuisineId !== undefined) {
        const id = parsePositiveInt(cuisineId);
        if (!id) return { ok: false, message: 'Invalid cuisine ID' };
        items.push({ cuisine_id: id, price });
        continue;
      }

      if (cuisineName) {
        items.push({ cuisine_name: String(cuisineName).trim(), price });
        continue;
      }

      return { ok: false, message: 'Cuisine ID or name is required for food pricing' };
    }

    return { ok: true, items };
  }

  if (normalized && typeof normalized === 'object') {
    for (const [key, rawPrice] of Object.entries(normalized)) {
      const price = parseNonNegativeInt(rawPrice);
      if (price === null) return { ok: false, message: 'Invalid cuisine price' };

      const maybeId = parsePositiveInt(key);
      if (maybeId) {
        items.push({ cuisine_id: maybeId, price });
      } else {
        items.push({ cuisine_name: String(key).trim(), price });
      }
    }

    return { ok: true, items };
  }

  return { ok: false, message: 'Invalid food pricing format' };
};

const parseTransportationInput = (value) => {
  if (value === undefined) return null;
  if (value === null) return { ok: true, items: [] };

  let normalized = value;
  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        normalized = JSON.parse(trimmed);
      } catch (_) {
        return { ok: false, message: 'Invalid transportation format' };
      }
    } else {
      return { ok: false, message: 'Invalid transportation format' };
    }
  }

  if (!Array.isArray(normalized)) return { ok: false, message: 'Invalid transportation format' };

  const items = [];
  for (const entry of normalized) {
    if (!entry || typeof entry !== 'object') return { ok: false, message: 'Invalid transportation format' };

    const modeRaw = entry.mode ?? entry.type ?? null;
    const nameRaw = entry.name ?? entry.station ?? entry.place ?? null;
    const distanceRaw = entry.distance ?? entry.km ?? entry.distance_km ?? null;

    const mode = modeRaw === null || modeRaw === undefined ? null : String(modeRaw).trim() || null;
    const name = nameRaw === null || nameRaw === undefined ? null : String(nameRaw).trim() || null;

    let distance = null;
    if (distanceRaw !== null && distanceRaw !== undefined && String(distanceRaw).trim() !== '') {
      const n = Number(String(distanceRaw).trim());
      if (!Number.isFinite(n) || n < 0) return { ok: false, message: 'Invalid transportation distance' };
      distance = Math.round(n * 100) / 100;
    }

    if (!mode && !name && distance === null) continue;

    items.push({ mode, name, distance });
  }

  return { ok: true, items };
};

const normalizeCsvTextList = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  let normalized = value;
  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        normalized = parsed;
      } catch (_) {
        // treat as normal csv string
        normalized = trimmed;
      }
    } else {
      normalized = trimmed;
    }
  }

  let items;
  if (Array.isArray(normalized)) {
    items = normalized.map((v) => String(v ?? '').trim());
  } else {
    items = String(normalized ?? '')
      .split(',')
      .map((v) => String(v).trim());
  }

  const toSlug = (text) =>
    String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');

  items = items.map(toSlug).filter(Boolean);
  if (items.length === 0) return null;

  const seen = new Set();
  const deduped = [];
  for (const slug of items) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    deduped.push(slug);
  }

  return deduped.join(',');
};

const registerVenue = async (req, res) => {
  const { businessName, businessType, contactName, email, phone, password } = req.body;

  try {
    const normalizedBusinessType = String(businessType || 'venue').toLowerCase();

    if (!businessName || !businessType || !contactName || !email || !phone || !password) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // if (normalizedBusinessType !== 'venue') {
    //   return res.status(400).json({ message: 'businessType must be venue' });
    // }

    // if (!venueType) {
    //   return res.status(400).json({ message: 'venueType is required' });
    // }

    if (!EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    // await ensureVenuesTable({ query });

    const [emailRows] = await query('SELECT venue_id AS id FROM tbl_venue WHERE email = ? LIMIT 1', [email]);
    if (emailRows.length > 0) {
      return res.status(400).json({ message: 'Venue already exists' });
    }

    const [nameRows] = await query('SELECT venue_id AS id FROM tbl_venue WHERE businessName = ? LIMIT 1', [businessName]);
    if (nameRows.length > 0) {
      return res.status(400).json({ message: 'Business name already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    const profilePicture = req.imageUrl || null;
    const city = req.body.city_id || req.body.city || null;
    const state = req.body.state_id || req.body.state || null;
    const country = req.body.country_id || req.body.country || 1;
    const pinCode = req.body.pinCode || null;
    const address = req.body.address || null;
    const nearLocation = req.body.nearLocation || null;

    const insertSql = `
      INSERT INTO tbl_venue (
        businessName, businessType, contactName, email, phone, password,
        profilePicture, city_id, state_id, country_id, pinCode, address, nearLocation,
        isVerified, status, otp, otpExpires
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      businessName,
      normalizedBusinessType,
      contactName,
      email,
      phone,
      hashedPassword,
      profilePicture,
      city,
      state,
      country,
      pinCode,
      address,
      nearLocation,
      0,
      1,
      otp,
      otpExpires,
    ];

    const [result] = await query(insertSql, params);

    await sendOtpEmail({ to: email, otp, purpose: 'Verify OTP' });

    return res.status(201).json({
      message: 'Venue registered successfully. Verify OTP to activate account.',
      id: result.insertId,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('registerVendor error:', error);
    return res.status(500).json({ message: 'Error registering vendor', error: error.message || String(error) });
  }
};

const verifyVenueOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: 'email and otp are required' });
    }

    // await ensureVenuesTable({ query });

    const [rows] = await query(
      'SELECT venue_id AS id, businessName, businessType, contactName, email, phone, profilePicture, isVerified, otp, otpExpires, status FROM tbl_venue WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    const vendor = rows[0];
    if (Number(vendor.isVerified) === 1) {
      return res.status(400).json({ message: 'Venue already verified' });
    }

    const otpMatches = String(otp).trim() === String(vendor.otp || '').trim();
    const otpExpired = !vendor.otpExpires || Number(vendor.otpExpires) < Date.now();

    if (!otpMatches || otpExpired) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    await query('UPDATE tbl_venue SET isVerified = 1, otp = NULL, otpExpires = NULL WHERE venue_id = ?', [vendor.id]);

    try {
      const { sendMail } = getMailer();
      const appName = process.env.APP_NAME || 'MyBestVenue';
      await sendMail({
        to: email,
        subject: `${appName} - Account Verified`,
        text: 'Your account has been verified successfully.',
        html: '<p>Your account has been verified successfully.</p>',
      });
    } catch (err) {
      console.warn('verifyVenueOtp email error:', err?.message || err);
    }

    return res.status(200).json({
      message: 'Vendor verified successfully',
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        businessType: vendor.businessType,
        contactName: vendor.contactName,
        email: vendor.email,
        phone: vendor.phone,
        profilePicture: vendor.profilePicture,
        status: vendor.status,
        isVerified: 1,
      },
    });
  } catch (error) {
    console.error('verifyVendorOtp error:', error);
    return res.status(500).json({ message: 'Error verifying OTP', error: error.message || String(error) });
  }
};

const resendVenueOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    // await ensureVenuesTable({ query });

    const [rows] = await query('SELECT venue_id AS id, isVerified FROM tbl_venue WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (Number(rows[0].isVerified) === 1) {
      return res.status(400).json({ message: 'Vendor already verified' });
    }

    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    await query('UPDATE tbl_venue SET otp = ?, otpExpires = ? WHERE venue_id = ?', [otp, otpExpires, rows[0].id]);
    await sendOtpEmail({ to: email, otp, purpose: 'Verify OTP' });

    return res.status(200).json({
      message: 'New OTP generated successfully',
      email,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('resendVendorOtp error:', error);
    return res.status(500).json({ message: 'Error resending OTP', error: error.message || String(error) });
  }
};

const resendpasswordResetOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    // await ensureVenuesTable({ query });

    const [rows] = await query('SELECT venue_id AS id FROM tbl_venue WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No vendor found with this email' });
    }

    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    await query(
      'UPDATE tbl_venue SET resetPasswordOtp = ?, resetPasswordOtpExpires = ? WHERE venue_id = ?',
      [otp, otpExpires, rows[0].id]
    );

    await sendOtpEmail({ to: email, otp, purpose: 'Password Reset OTP' });

    return res.status(200).json({
      message: 'Password reset OTP generated successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('resendpasswordResetOtp error:', error);
    return res.status(500).json({ message: 'Error resending password reset OTP', error: error.message || String(error) });
  }
};

// Forgot password: generate OTP and send via email (nodemailer).
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const [rows] = await query('SELECT venue_id AS id, email FROM tbl_venue WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No vendor found with this email' });
    }

    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    await query(
      'UPDATE tbl_venue SET resetPasswordOtp = ?, resetPasswordOtpExpires = ? WHERE venue_id = ?',
      [otp, otpExpires, rows[0].id]
    );

    const { sendMail } = getMailer();
    await sendMail({
      to: email,
      subject: 'Password Reset OTP',
      text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your password reset OTP is <b>${otp}</b>.</p><p>It expires in 10 minutes.</p>`,
    });

    return res.status(200).json({
      message: 'Password reset OTP sent successfully',
      email,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.status(500).json({ message: 'Error sending password reset OTP', error: error.message || String(error) });
  }
};

// Reset password: verify OTP and update password.
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'email, otp and newPassword are required' });
    }

    const [rows] = await query(
      'SELECT venue_id AS id, resetPasswordOtp, resetPasswordOtpExpires FROM tbl_venue WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const vendor = rows[0];
    const otpMatches = String(otp).trim() === String(vendor.resetPasswordOtp || '').trim();
    const otpExpired = !vendor.resetPasswordOtpExpires || Number(vendor.resetPasswordOtpExpires) < Date.now();

    if (!otpMatches || otpExpired) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 12);

    await query(
      'UPDATE tbl_venue SET password = ?, resetPasswordOtp = NULL, resetPasswordOtpExpires = NULL WHERE venue_id = ?',
      [hashedPassword, vendor.id]
    );

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('resetPassword error:', error);
    return res.status(500).json({ message: 'Error updating password', error: error.message || String(error) });
  }
};

const loginVenue = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    // await ensureVenuesTable({ query });

    const [rows] = await query(
      'SELECT venue_id AS id, businessName, businessType, contactName, email, phone, profilePicture, isApproved, status, isVerified, password FROM tbl_venue WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const vendor = rows[0];
    const isMatch = await bcrypt.compare(password, vendor.password || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (Number(vendor.isVerified) === 0) {
      return res.status(403).json({ message: 'your registerotp is not verified' });
    }

    if (Number(vendor.isApproved) === 0) {
      return res.status(403).json({ message: 'You are not approved by admin' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET is not configured' });
    }

    const token = jwt.sign(
      { id: vendor.id, email: vendor.email, role: 'venue' },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await query('UPDATE tbl_venue SET status = ? WHERE venue_id = ?', [1, vendor.id]);

    return res.status(200).json({
      message: 'Login successful',
      token,
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        businessType: vendor.businessType,
        contactName: vendor.contactName,
        email: vendor.email,
        phone: vendor.phone,
        isApproved: vendor.isApproved,
        isVerified: vendor.isVerified,
        status: 1,
        profilePicture: vendor.profilePicture || '',
      },
    });
  } catch (error) {
    console.error('loginVenue error:', error);
    return res.status(500).json({ message: 'Error logging in', error: error.message || String(error) });
  }
};

// Portfolio Images (tbl_venue_images)
const uploadPortfolioImage = async (req, res) => {
  try {
    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId =
        parsePositiveInt(req.body?.venueId ?? req.query?.venueId) || null;
    } else {
      // Venues can only upload to their own portfolio (ignore any passed venueId)
      venueId = parsePositiveInt(auth.id) || null;
    }

    const uploadedFiles = Array.isArray(req.uploadedFiles) && req.uploadedFiles.length > 0 ? req.uploadedFiles : null;
    const fileUrls = Array.isArray(req.fileUrls) && req.fileUrls.length > 0 ? req.fileUrls : null;
    const singleFileUrl = req.fileUrl ? String(req.fileUrl) : '';

    const totalUploads = uploadedFiles?.length || fileUrls?.length || (singleFileUrl ? 1 : 0);
    if (!totalUploads) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Venue ID is required' });
    }

    const [venueRows] = await query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const [statsRows] = await query(
      'SELECT COALESCE(MAX(display_order), -1) AS maxOrder, COUNT(*) AS total FROM tbl_venue_images WHERE venue_id = ?',
      [venueId]
    );
    const currentTotal = Number(statsRows?.[0]?.total || 0);
    const nextOrder = Number(statsRows?.[0]?.maxOrder || -1) + 1;

    const description = String(req.body?.description || '').trim();

    const uploads = uploadedFiles
      ? uploadedFiles.map((f) => ({ url: f.url, originalName: f.originalName }))
      : fileUrls
        ? fileUrls.map((u) => ({ url: u, originalName: '' }))
        : [{ url: singleFileUrl, originalName: req.file?.originalname || '' }];

    if (uploads.length > 8) {
      return res.status(400).json({ success: false, message: 'Maximum 8 images allowed' });
    }

    const insertedImages = [];
    for (let idx = 0; idx < uploads.length; idx += 1) {
      const uploadItem = uploads[idx];
      const originalName = String(uploadItem.originalName || '').trim();
      const baseName = originalName ? originalName.replace(/\.[^/.]+$/, '') : '';
      const title = baseName || `Portfolio Image ${currentTotal + idx + 1}`;
      const displayOrder = nextOrder + idx;

      const [result] = await query(
        'INSERT INTO tbl_venue_images (venue_id, image_url, title, description, display_order) VALUES (?, ?, ?, ?, ?)',
        [venueId, uploadItem.url, title, description || null, displayOrder]
      );

      const [imageRows] = await query(
        'SELECT image_id, venue_id, image_url AS url, title, description, display_order, createdAt FROM tbl_venue_images WHERE image_id = ? LIMIT 1',
        [result.insertId]
      );

      if (imageRows?.[0]) insertedImages.push(imageRows[0]);
    }

    return res.status(200).json({
      success: true,
      message: 'Portfolio image uploaded successfully',
      images: insertedImages,
    });
  } catch (error) {
    console.error('uploadPortfolioImage error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during portfolio image upload',
      error: error.message || String(error),
    });
  }
};

const getPortfolioImages = async (req, res) => {
  try {
    const venueId = parsePositiveInt(req.params.venueId);
    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Invalid venue ID' });
    }

    const [venueRows] = await query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const [rows] = await query(
      `SELECT image_id, image_url AS url, title, description, display_order, createdAt
       FROM tbl_venue_images
       WHERE venue_id = ?
       ORDER BY display_order ASC, image_id ASC`,
      [venueId]
    );

    return res.status(200).json({ success: true, images: rows || [] });
  } catch (error) {
    console.error('getPortfolioImages error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  }
};

const deletePortfolioImage = async (req, res) => {
  try {
    const imageId = parsePositiveInt(req.params.imageId);
    if (!imageId) {
      return res.status(400).json({ success: false, message: 'Invalid image ID' });
    }

    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.query?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    const [imageRows] = await query(
      'SELECT image_id, venue_id, image_url, title, description, display_order, createdAt FROM tbl_venue_images WHERE image_id = ? LIMIT 1',
      [imageId]
    );

    if (!imageRows || imageRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const image = imageRows[0];
    if (venueId && Number(image.venue_id) !== Number(venueId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to delete this image' });
    }

    await query('DELETE FROM tbl_venue_images WHERE image_id = ?', [imageId]);

    return res.status(200).json({ success: true, message: 'Image deleted successfully', deletedImage: image });
  } catch (error) {
    console.error('deletePortfolioImage error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  }
};

// Portfolio Videos (tbl_venue_videos)
const uploadPortfolioVideo = async (req, res) => {
  try {
    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.body?.venueId ?? req.query?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    const uploadedFiles = Array.isArray(req.uploadedFiles) && req.uploadedFiles.length > 0 ? req.uploadedFiles : null;
    const fileUrls = Array.isArray(req.fileUrls) && req.fileUrls.length > 0 ? req.fileUrls : null;
    const singleFileUrl = req.fileUrl ? String(req.fileUrl) : '';

    const totalUploads = uploadedFiles?.length || fileUrls?.length || (singleFileUrl ? 1 : 0);
    if (!totalUploads) {
      return res.status(400).json({ success: false, message: 'No video uploaded' });
    }

    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Venue ID is required' });
    }

    const [venueRows] = await query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const [statsRows] = await query(
      'SELECT COALESCE(MAX(display_order), -1) AS maxOrder, COUNT(*) AS total FROM tbl_venue_videos WHERE venue_id = ?',
      [venueId]
    );
    const currentTotal = Number(statsRows?.[0]?.total || 0);
    const nextOrder = Number(statsRows?.[0]?.maxOrder || -1) + 1;

    const description = String(req.body?.description || '').trim();

    const uploads = uploadedFiles
      ? uploadedFiles.map((f) => ({ url: f.url, originalName: f.originalName }))
      : fileUrls
        ? fileUrls.map((u) => ({ url: u, originalName: '' }))
        : [{ url: singleFileUrl, originalName: req.file?.originalname || '' }];

    if (uploads.length > 8) {
      return res.status(400).json({ success: false, message: 'Maximum 8 videos allowed' });
    }

    const insertedVideos = [];
    for (let idx = 0; idx < uploads.length; idx += 1) {
      const uploadItem = uploads[idx];
      const originalName = String(uploadItem.originalName || '').trim();
      const baseName = originalName ? originalName.replace(/\.[^/.]+$/, '') : '';
      const title = baseName || `Portfolio Video ${currentTotal + idx + 1}`;
      const displayOrder = nextOrder + idx;

      const [result] = await query(
        'INSERT INTO tbl_venue_videos (venue_id, video_url, title, description, display_order) VALUES (?, ?, ?, ?, ?)',
        [venueId, uploadItem.url, title, description || null, displayOrder]
      );

      const [videoRows] = await query(
        'SELECT video_id, venue_id, video_url AS url, title, description, display_order, createdAt FROM tbl_venue_videos WHERE video_id = ? LIMIT 1',
        [result.insertId]
      );

      if (videoRows?.[0]) insertedVideos.push(videoRows[0]);
    }

    return res.status(200).json({
      success: true,
      message: 'Portfolio video uploaded successfully',
      videos: insertedVideos,
    });
  } catch (error) {
    console.error('uploadPortfolioVideo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during portfolio video upload',
      error: error.message || String(error),
    });
  }
};

const getPortfolioVideos = async (req, res) => {
  try {
    const venueId = parsePositiveInt(req.params.venueId);
    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Invalid venue ID' });
    }

    const [venueRows] = await query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const [rows] = await query(
      `SELECT video_id, video_url AS url, title, description, display_order, createdAt
       FROM tbl_venue_videos
       WHERE venue_id = ?
       ORDER BY display_order ASC, video_id ASC`,
      [venueId]
    );

    return res.status(200).json({ success: true, videos: rows || [] });
  } catch (error) {
    console.error('getPortfolioVideos error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  }
};

const deletePortfolioVideo = async (req, res) => {
  try {
    const videoId = parsePositiveInt(req.params.videoId);
    if (!videoId) {
      return res.status(400).json({ success: false, message: 'Invalid video ID' });
    }

    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.query?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    const [videoRows] = await query(
      'SELECT video_id, venue_id, video_url, title, description, display_order, createdAt FROM tbl_venue_videos WHERE video_id = ? LIMIT 1',
      [videoId]
    );

    if (!videoRows || videoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const video = videoRows[0];
    if (venueId && Number(video.venue_id) !== Number(venueId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to delete this video' });
    }

    await query('DELETE FROM tbl_venue_videos WHERE video_id = ?', [videoId]);

    return res.status(200).json({ success: true, message: 'Video deleted successfully', deletedVideo: video });
  } catch (error) {
    console.error('deletePortfolioVideo error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  }
};

const deleteVenueTransportation = async (req, res) => {
  try {
    const transportationId = parsePositiveInt(req.params.transportationId ?? req.params.id);
    if (!transportationId) {
      return res.status(400).json({ success: false, message: 'Invalid transportation ID' });
    }

    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.query?.venueId ?? req.body?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    const [rows] = await query(
      'SELECT id, venue_id, mode, name, distance, created_at, updated_at FROM table_venue_transportation WHERE id = ? LIMIT 1',
      [transportationId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transportation not found' });
    }

    const record = rows[0];
    if (venueId && Number(record.venue_id) !== Number(venueId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to delete this transportation' });
    }

    await query('DELETE FROM table_venue_transportation WHERE id = ?', [transportationId]);

    return res.status(200).json({
      success: true,
      message: 'Transportation deleted successfully',
      deletedTransportation: record,
    });
  } catch (error) {
    console.error('deleteVenueTransportation error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  }
};

const upsertVenuePolicies = async (req, res) => {
  let conn;
  try {
    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId =
        parsePositiveInt(req.params?.venueId) ||
        parsePositiveInt(req.body?.venueId ?? req.query?.venueId) ||
        null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Venue ID is required' });
    }

    const body = req.body || {};
    const policyColumns = [
      { column: 'booking_policy', value: body.booking_policy ?? body.bookingPolicy },
      { column: 'cancellation_policy', value: body.cancellation_policy ?? body.cancellationPolicy },
      { column: 'refund_policy', value: body.refund_policy ?? body.refundPolicy },
      { column: 'reschedule_policy', value: body.reschedule_policy ?? body.reschedulePolicy },
      { column: 'outside_decorator_policy', value: body.outside_decorator_policy ?? body.outsideDecoratorPolicy },
      { column: 'outside_photographer_policy', value: body.outside_photographer_policy ?? body.outsidePhotographerPolicy },
      { column: 'terms_conditions', value: body.terms_conditions ?? body.termsConditions },
      { column: 'disclaimer', value: body.disclaimer },
    ];

    const provided = policyColumns.filter((p) => p.value !== undefined);
    if (provided.length === 0) {
      return res.status(400).json({ success: false, message: 'No policy fields provided for update' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [venueRows] = await conn.query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const [existing] = await conn.query('SELECT id FROM tbl_venue_policies WHERE venue_id = ? LIMIT 1', [venueId]);

    if (!existing || existing.length === 0) {
      const columns = ['venue_id'];
      const placeholders = ['?'];
      const values = [venueId];

      for (const p of provided) {
        columns.push(p.column);
        placeholders.push('?');
        values.push(p.value);
      }

      await conn.query(
        `INSERT INTO tbl_venue_policies (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      );
    } else {
      const sets = [];
      const values = [];
      for (const p of provided) {
        sets.push(`${p.column} = ?`);
        values.push(p.value);
      }
      sets.push('updatedAt = CURRENT_TIMESTAMP');
      values.push(venueId);

      await conn.query(`UPDATE tbl_venue_policies SET ${sets.join(', ')} WHERE venue_id = ?`, values);
    }

    const [rows] = await conn.query(
      `SELECT booking_policy, cancellation_policy, refund_policy, reschedule_policy,
              outside_decorator_policy, outside_photographer_policy, terms_conditions, disclaimer,
              createdAt, updatedAt
       FROM tbl_venue_policies WHERE venue_id = ? LIMIT 1`,
      [venueId]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Policies saved successfully',
      venue_id: venueId,
      policies: rows?.[0] || null,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('upsertVenuePolicies error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const deleteVenuePolicies = async (req, res) => {
  let conn;
  try {
    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId =
        parsePositiveInt(req.params?.venueId) ||
        parsePositiveInt(req.query?.venueId ?? req.body?.venueId) ||
        null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Venue ID is required' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id FROM tbl_venue_policies WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!rows || rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Policies not found for this venue' });
    }

    await conn.query('DELETE FROM tbl_venue_policies WHERE venue_id = ?', [venueId]);
    await conn.commit();

    return res.status(200).json({ success: true, message: 'Policies deleted successfully', venue_id: venueId });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('deleteVenuePolicies error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const createVenueServicePackages = async (req, res) => {
  let conn;
  try {
    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId =
        parsePositiveInt(req.body?.venueId ?? req.query?.venueId ?? req.params?.venueId) ||
        null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Venue ID is required' });
    }

    const body = req.body || {};
    const packagesInput = body.packages ?? body.service_packages ?? body.servicePackages ?? body.package ?? body;
    const packages = Array.isArray(packagesInput) ? packagesInput : [packagesInput];

    const sanitized = packages
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({
        package_name: p.package_name ?? p.packageName,
        description: p.description,
        service_type: p.service_type ?? p.serviceType,
        price: p.price,
        offer_price: p.offer_price ?? p.offerPrice,
      }));

    if (sanitized.length === 0) {
      return res.status(400).json({ success: false, message: 'No packages provided' });
    }

    for (const p of sanitized) {
      const name = String(p.package_name ?? '').trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'package_name is required for each package' });
      }
      p.package_name = name;

      if (p.description !== undefined && p.description !== null) p.description = String(p.description);
      if (p.service_type !== undefined) p.service_type = normalizeCsvTextList(p.service_type);

      if (p.price !== undefined) {
        if (p.price === null || String(p.price).trim() === '') {
          p.price = null;
        } else {
          const parsed = parseNonNegativeInt(p.price);
          if (parsed === null) {
            return res.status(400).json({ success: false, message: 'Invalid price for package' });
          }
          p.price = parsed;
        }
      } else {
        p.price = null;
      }

      if (p.offer_price !== undefined) {
        if (p.offer_price === null || String(p.offer_price).trim() === '') {
          p.offer_price = null;
        } else {
          const parsed = parseNonNegativeInt(p.offer_price);
          if (parsed === null) {
            return res.status(400).json({ success: false, message: 'Invalid offer_price for package' });
          }
          p.offer_price = parsed;
        }
      } else {
        p.offer_price = null;
      }
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [venueRows] = await conn.query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    // Prevent duplicate package_name (case-insensitive) for same venue_id
    const incomingNameKeys = sanitized.map((p) => p.package_name.toLowerCase());
    const incomingSeen = new Set();
    for (const key of incomingNameKeys) {
      if (incomingSeen.has(key)) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Duplicate package_name in request is not allowed' });
      }
      incomingSeen.add(key);
    }

    const [existingNameRows] = await conn.query(
      `SELECT id, package_name
       FROM tbl_venue_service_packages
       WHERE venue_id = ? AND LOWER(TRIM(package_name)) IN (${incomingNameKeys.map(() => '?').join(',')})
       LIMIT 1`,
      [venueId, ...incomingNameKeys]
    );

    if (existingNameRows && existingNameRows.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'package_name already exists for this venue' });
    }

    const insertedIds = [];
    for (const p of sanitized) {
      const [result] = await conn.query(
        `INSERT INTO tbl_venue_service_packages (venue_id, package_name, description, service_type, price, offer_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [venueId, p.package_name, p.description ?? null, p.service_type ?? null, p.price, p.offer_price]
      );
      insertedIds.push(Number(result.insertId));
    }

    const [rows] = await conn.query(
      `SELECT id, venue_id, package_name, description, service_type, price, offer_price, created_at, updated_at
       FROM tbl_venue_service_packages
       WHERE id IN (${insertedIds.map(() => '?').join(',')})
       ORDER BY id ASC`,
      insertedIds
    );

    await conn.commit();
    return res.status(201).json({
      success: true,
      message: 'Service packages created successfully',
      venue_id: venueId,
      packages: rows || [],
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('createVenueServicePackages error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const updateVenueServicePackage = async (req, res) => {
  let conn;
  try {
    const packageId = parsePositiveInt(req.params.packageId ?? req.params.id);
    if (!packageId) {
      return res.status(400).json({ success: false, message: 'Invalid package ID' });
    }

    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.query?.venueId ?? req.body?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    const body = req.body || {};
    const update = {
      package_name: body.package_name ?? body.packageName,
      description: body.description,
      service_type: body.service_type ?? body.serviceType,
      price: body.price,
      offer_price: body.offer_price ?? body.offerPrice,
    };

    const fields = [];
    const values = [];

    if (update.package_name !== undefined) {
      const name = update.package_name === null ? '' : String(update.package_name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'package_name cannot be empty' });
      }
      fields.push('package_name = ?');
      values.push(name);
    }

    if (update.description !== undefined) {
      fields.push('description = ?');
      values.push(update.description === null ? null : String(update.description));
    }

    if (update.service_type !== undefined) {
      fields.push('service_type = ?');
      values.push(update.service_type === null ? null : normalizeCsvTextList(update.service_type));
    }

    if (update.price !== undefined) {
      if (update.price === null || String(update.price).trim() === '') {
        fields.push('price = ?');
        values.push(null);
      } else {
        const parsed = parseNonNegativeInt(update.price);
        if (parsed === null) return res.status(400).json({ success: false, message: 'Invalid price' });
        fields.push('price = ?');
        values.push(parsed);
      }
    }

    if (update.offer_price !== undefined) {
      if (update.offer_price === null || String(update.offer_price).trim() === '') {
        fields.push('offer_price = ?');
        values.push(null);
      } else {
        const parsed = parseNonNegativeInt(update.offer_price);
        if (parsed === null) return res.status(400).json({ success: false, message: 'Invalid offer_price' });
        fields.push('offer_price = ?');
        values.push(parsed);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [existingRows] = await conn.query(
      `SELECT id, venue_id, package_name, description, service_type, price, offer_price, created_at, updated_at
       FROM tbl_venue_service_packages WHERE id = ? LIMIT 1`,
      [packageId]
    );

    if (!existingRows || existingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    const existing = existingRows[0];
    if (venueId && Number(existing.venue_id) !== Number(venueId)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'You do not have access to update this package' });
    }

    // Prevent duplicate package_name (case-insensitive) for same venue_id
    if (update.package_name !== undefined) {
      const incomingNameKey = String(update.package_name ?? '').trim().toLowerCase();
      const [dupRows] = await conn.query(
        `SELECT id FROM tbl_venue_service_packages
         WHERE venue_id = ? AND LOWER(TRIM(package_name)) = ? AND id <> ?
         LIMIT 1`,
        [existing.venue_id, incomingNameKey, packageId]
      );
      if (dupRows && dupRows.length > 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'package_name already exists for this venue' });
      }
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(packageId);

    await conn.query(`UPDATE tbl_venue_service_packages SET ${fields.join(', ')} WHERE id = ?`, values);

    const [updatedRows] = await conn.query(
      `SELECT id, venue_id, package_name, description, service_type, price, offer_price, created_at, updated_at
       FROM tbl_venue_service_packages WHERE id = ? LIMIT 1`,
      [packageId]
    );

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: 'Service package updated successfully',
      package: updatedRows?.[0] || null,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('updateVenueServicePackage error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const deleteVenueServicePackage = async (req, res) => {
  let conn;
  try {
    const packageId = parsePositiveInt(req.params.packageId ?? req.params.id);
    if (!packageId) {
      return res.status(400).json({ success: false, message: 'Invalid package ID' });
    }

    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.query?.venueId ?? req.body?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, venue_id, package_name, description, service_type, price, offer_price, created_at, updated_at
       FROM tbl_venue_service_packages WHERE id = ? LIMIT 1`,
      [packageId]
    );

    if (!rows || rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    const record = rows[0];
    if (venueId && Number(record.venue_id) !== Number(venueId)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'You do not have access to delete this package' });
    }

    await conn.query('DELETE FROM tbl_venue_service_packages WHERE id = ?', [packageId]);
    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Service package deleted successfully',
      deletedPackage: record,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('deleteVenueServicePackage error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const createVenueFaqs = async (req, res) => {
  let conn;
  try {
    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.body?.venueId ?? req.query?.venueId ?? req.params?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Venue ID is required' });
    }

    const body = req.body || {};
    const faqsInput = body.faqs ?? body.venue_faqs ?? body.venueFaqs ?? body.faq ?? body;
    const faqs = Array.isArray(faqsInput) ? faqsInput : [faqsInput];

    const sanitized = faqs
      .filter((f) => f && typeof f === 'object')
      .map((f) => ({
        question: f.question,
        answer: f.answer,
        status: f.status,
      }));

    if (sanitized.length === 0) {
      return res.status(400).json({ success: false, message: 'No FAQs provided' });
    }

    for (const f of sanitized) {
      const question = String(f.question ?? '').trim();
      const answer = String(f.answer ?? '').trim();
      if (!question) return res.status(400).json({ success: false, message: 'question is required for each FAQ' });
      if (!answer) return res.status(400).json({ success: false, message: 'answer is required for each FAQ' });
      f.question = question;
      f.answer = answer;

      const statusParsed = f.status === undefined ? 1 : toBoolInt(f.status);
      if (statusParsed === null) {
        return res.status(400).json({ success: false, message: 'Invalid status for FAQ' });
      }
      f.status = statusParsed;
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [venueRows] = await conn.query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const questionKeys = sanitized.map((f) => f.question.toLowerCase());
    const seen = new Set();
    for (const key of questionKeys) {
      if (seen.has(key)) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Duplicate question in request is not allowed' });
      }
      seen.add(key);
    }

    const [existingRows] = await conn.query(
      `SELECT id FROM tbl_venue_faqs
       WHERE venue_id = ? AND LOWER(TRIM(question)) IN (${questionKeys.map(() => '?').join(',')})
       LIMIT 1`,
      [venueId, ...questionKeys]
    );

    if (existingRows && existingRows.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Question already exists for this venue' });
    }

    const insertedIds = [];
    for (const f of sanitized) {
      const [result] = await conn.query(
        `INSERT INTO tbl_venue_faqs (venue_id, question, answer, status)
         VALUES (?, ?, ?, ?)`,
        [venueId, f.question, f.answer, f.status]
      );
      insertedIds.push(Number(result.insertId));
    }

    const [rows] = await conn.query(
      `SELECT id, venue_id, question, answer, status, created_at, updated_at
       FROM tbl_venue_faqs
       WHERE id IN (${insertedIds.map(() => '?').join(',')})
       ORDER BY id ASC`,
      insertedIds
    );

    await conn.commit();
    return res.status(201).json({
      success: true,
      message: 'FAQs created successfully',
      venue_id: venueId,
      faqs: rows || [],
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('createVenueFaqs error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const updateVenueFaq = async (req, res) => {
  let conn;
  try {
    const faqId = parsePositiveInt(req.params.faqId ?? req.params.id);
    if (!faqId) {
      return res.status(400).json({ success: false, message: 'Invalid FAQ ID' });
    }

    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.query?.venueId ?? req.body?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    const body = req.body || {};
    const questionRaw = body.question;
    const answerRaw = body.answer;
    const statusRaw = body.status;

    const fields = [];
    const values = [];

    if (questionRaw !== undefined) {
      const q = questionRaw === null ? '' : String(questionRaw).trim();
      if (!q) return res.status(400).json({ success: false, message: 'question cannot be empty' });
      fields.push('question = ?');
      values.push(q);
    }

    if (answerRaw !== undefined) {
      const a = answerRaw === null ? '' : String(answerRaw).trim();
      if (!a) return res.status(400).json({ success: false, message: 'answer cannot be empty' });
      fields.push('answer = ?');
      values.push(a);
    }

    if (statusRaw !== undefined) {
      const parsed = toBoolInt(statusRaw);
      if (parsed === null) return res.status(400).json({ success: false, message: 'Invalid status' });
      fields.push('status = ?');
      values.push(parsed);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [existingRows] = await conn.query(
      `SELECT id, venue_id, question, answer, status, created_at, updated_at
       FROM tbl_venue_faqs WHERE id = ? LIMIT 1`,
      [faqId]
    );

    if (!existingRows || existingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    const existing = existingRows[0];
    if (venueId && Number(existing.venue_id) !== Number(venueId)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'You do not have access to update this FAQ' });
    }

    if (questionRaw !== undefined) {
      const questionKey = String(questionRaw ?? '').trim().toLowerCase();
      const [dupRows] = await conn.query(
        `SELECT id FROM tbl_venue_faqs
         WHERE venue_id = ? AND LOWER(TRIM(question)) = ? AND id <> ?
         LIMIT 1`,
        [existing.venue_id, questionKey, faqId]
      );
      if (dupRows && dupRows.length > 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Question already exists for this venue' });
      }
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(faqId);
    await conn.query(`UPDATE tbl_venue_faqs SET ${fields.join(', ')} WHERE id = ?`, values);

    const [updatedRows] = await conn.query(
      `SELECT id, venue_id, question, answer, status, created_at, updated_at
       FROM tbl_venue_faqs WHERE id = ? LIMIT 1`,
      [faqId]
    );

    await conn.commit();
    return res.status(200).json({ success: true, message: 'FAQ updated successfully', faq: updatedRows?.[0] || null });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('updateVenueFaq error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const deleteVenueFaq = async (req, res) => {
  let conn;
  try {
    const faqId = parsePositiveInt(req.params.faqId ?? req.params.id);
    if (!faqId) {
      return res.status(400).json({ success: false, message: 'Invalid FAQ ID' });
    }

    const auth = req.user || req.auth || {};
    const role = String(auth.role || '').toLowerCase();

    let venueId;
    if (role === 'admin' || role === 'salesteam') {
      venueId = parsePositiveInt(req.query?.venueId ?? req.body?.venueId) || null;
    } else {
      venueId = parsePositiveInt(auth.id) || null;
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, venue_id, question, answer, status, created_at, updated_at
       FROM tbl_venue_faqs WHERE id = ? LIMIT 1`,
      [faqId]
    );

    if (!rows || rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    const record = rows[0];
    if (venueId && Number(record.venue_id) !== Number(venueId)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'You do not have access to delete this FAQ' });
    }

    await conn.query('DELETE FROM tbl_venue_faqs WHERE id = ?', [faqId]);
    await conn.commit();

    return res.status(200).json({ success: true, message: 'FAQ deleted successfully', deletedFaq: record });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('deleteVenueFaq error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const getVenueFaqs = async (req, res) => {
  try {
    const venueId = parsePositiveInt(req.params.venueId ?? req.params.id ?? req.query?.venueId);
    if (!venueId) {
      return res.status(400).json({ success: false, message: 'Invalid venue ID' });
    }

    const [venueRows] = await query('SELECT venue_id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [venueId]);
    if (!venueRows || venueRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const [rows] = await query(
      `SELECT id, venue_id, question, answer, status, created_at, updated_at
       FROM tbl_venue_faqs
       WHERE venue_id = ?
       ORDER BY id ASC`,
      [venueId]
    );

    return res.status(200).json({ success: true, venue_id: venueId, faqs: rows || [] });
  } catch (error) {
    console.error('getVenueFaqs error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message || String(error) });
  }
};

// Update Venue profile 
const updateVenueProfile = async (req, res) => {
  let conn;
  try {
    const vendorId = req.params.id;
    if (!vendorId) {
      return res.status(400).json({ message: 'Venue ID is required' });
    }

    // await ensureVenuesTable({ query });
    await ensureOccasionsTable();
    await ensureAmenitiesTable();
    await ensureVenueRelationTables();

    const body = req.body || {};
    const hasAmenityUpdate = body.amenity_ids !== undefined || body.amenityIds !== undefined;
    const hasOccasionUpdate = body.occasion_ids !== undefined || body.occasionIds !== undefined;
    const hasServiceUpdate =
      body.service_ids !== undefined || body.serviceIds !== undefined || body.services !== undefined;
    const hasServiceAreaUpdate =
      body.service_area_city_ids !== undefined ||
      body.serviceAreaCityIds !== undefined ||
      body.service_areas !== undefined ||
      body.serviceAreas !== undefined;
    const hasTransportationUpdate =
      body.transportation !== undefined || body.transportations !== undefined || body.venue_transportation !== undefined;

    const amenityIds = parseIdList(body.amenity_ids ?? body.amenityIds);
    const occasionIds = parseIdList(body.occasion_ids ?? body.occasionIds);
    const serviceIds = parseFlexibleIdList(body.service_ids ?? body.serviceIds ?? body.services);
    const serviceAreaCityIds = parseFlexibleIdList(
      body.service_area_city_ids ?? body.serviceAreaCityIds ?? body.service_areas ?? body.serviceAreas
    );

    const explicitFoodPricingInput =
      body.food_pricing ?? body.foodPricing ?? body.cuisinePricing ?? body.cuisinesPricing ?? body.cuisine_pricing;

    let hasFoodPricingUpdate = explicitFoodPricingInput !== undefined;
    let foodPricingParsed = parseFoodPricingInput(explicitFoodPricingInput);

    if (!hasFoodPricingUpdate && body.cuisines !== undefined) {
      const trial = parseFoodPricingInput(body.cuisines);
      if (trial?.ok === true) {
        hasFoodPricingUpdate = true;
        foodPricingParsed = trial;
      }
    }

    const transportationParsed = parseTransportationInput(
      body.transportation ?? body.transportations ?? body.venue_transportation
    );

    const fields = [];
    const values = [];

    const setIfPresent = (column, value) => {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value);
      }
    };

    const boolField = (column, value) => {
      const parsed = toBoolInt(value);
      if (parsed !== null) {
        fields.push(`${column} = ?`);
        values.push(parsed);
      }
    };

    setIfPresent('businessName', body.businessName);
    if (body.businessType !== undefined) setIfPresent('businessType', String(body.businessType).toLowerCase());

    setIfPresent('contactName', body.contactName);
    setIfPresent('description', body.description);
    setIfPresent('businessExperience', body.businessExperience);
    setIfPresent('email', body.email);
    setIfPresent('phone', body.phone);
    setIfPresent('address', body.address);
    setIfPresent('city_id', body.city_id ?? body.city);
    setIfPresent('state_id', body.state_id ?? body.state);
    setIfPresent('country_id', body.country_id ?? body.country);
    setIfPresent('pinCode', body.pinCode);
    setIfPresent('nearLocation', body.nearLocation);
    setIfPresent('metaTitle', body.metaTitle);
    setIfPresent('metaDescription', body.metaDescription);
    setIfPresent('metaKeywords', body.metaKeywords);
    setIfPresent('venue_website_url', body.website || body.venue_website_url);
    setIfPresent('venue_facebook_url', body.venue_facebook_url);
    setIfPresent('venue_instagram_url', body.venue_instagram_url);
    setIfPresent('venue_linkedIn_url', body.venue_linkedIn_url);
    setIfPresent('venue_youtube_url', body.venue_youtube_url);
    setIfPresent('venueCapacity', body.venueCapacity);
    setIfPresent('accountManager', body.accountManager);
    setIfPresent('leadCommitment', body.leadCommitment);
    setIfPresent('musicSystem', body.musicSystem);
    setIfPresent('parking', body.parking);
    setIfPresent('gstNumber', body.gstNumber);
    setIfPresent('gstDocument', body.gstDocument);
    setIfPresent('bookingEngineURL', body.bookingEngineURL);
    setIfPresent('veg_price', body.veg_price);
    setIfPresent('non_veg_price', body.non_veg_price);
    setIfPresent('veg_imfl_price', body.veg_imfl_price);
    setIfPresent('non_veg_imfl_price', body.non_veg_imfl_price);
    setIfPresent('halfday_rental_price', body.halfday_rental_price);
    setIfPresent('fullday_rental_price', body.fullday_rental_price);
    boolField('advancePaymentRequired', body.advancePaymentRequired);
    boolField('alcoholServed', body.alcoholServed);
    boolField('barServiceAvailable', body.barServiceAvailable);
    boolField('danceFloor', body.danceFloor);
    boolField('liveMusicAllowed', body.liveMusicAllowed);
    boolField('outsideLiquorPermitted', body.outsideLiquorPermitted);
    boolField('isApproved', body.isApproved);
    boolField('isVerified', body.isVerified);
    boolField('isPremium', body.isPremium);
    boolField('isTrusted', body.isTrusted);

    if (req.imageUrl) {
      setIfPresent('profilePicture', req.imageUrl);
    }

    if (fields.length === 0) {
      if (
        !hasAmenityUpdate &&
        !hasOccasionUpdate &&
        !hasServiceUpdate &&
        !hasServiceAreaUpdate &&
        !hasFoodPricingUpdate &&
        !hasTransportationUpdate
      ) {
        return res.status(400).json({ message: 'No valid fields provided for update' });
      }
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT venue_id AS id FROM tbl_venue WHERE venue_id = ? LIMIT 1', [vendorId]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Venue not found' });
    }

    if (fields.length > 0) {
      fields.push('updatedAt = CURRENT_TIMESTAMP');
      const sql = `UPDATE tbl_venue SET ${fields.join(', ')} WHERE venue_id = ?`;
      values.push(vendorId);
      await conn.query(sql, values);
    }

    if (hasAmenityUpdate) {
      if (amenityIds === null) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid amenity IDs format' });
      }

      if (amenityIds.length > 0) {
        const [validAmenities] = await conn.query(
          `SELECT amenity_id FROM tbl_amenities WHERE amenity_id IN (${amenityIds.map(() => '?').join(',')})`,
          amenityIds
        );
        if (validAmenities.length !== amenityIds.length) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more amenity IDs are invalid' });
        }
      }

      await conn.query('DELETE FROM tbl_venue_amenities WHERE venue_id = ?', [vendorId]);
      if (amenityIds.length > 0) {
        const amenityValues = amenityIds.map((id) => [Number(vendorId), id]);
        await conn.query('INSERT INTO tbl_venue_amenities (venue_id, amenity_id) VALUES ?', [amenityValues]);
      }
    }

    if (hasOccasionUpdate) {
      if (occasionIds === null) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid occasion IDs format' });
      }

      if (occasionIds.length > 0) {
        const [validOccasions] = await conn.query(
          `SELECT occasion_id FROM tbl_occasion WHERE occasion_id IN (${occasionIds.map(() => '?').join(',')})`,
          occasionIds
        );
        if (validOccasions.length !== occasionIds.length) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more occasion IDs are invalid' });
        }
      }

      await conn.query('DELETE FROM tbl_venue_occasion WHERE venue_id = ?', [vendorId]);
      if (occasionIds.length > 0) {
        const occasionValues = occasionIds.map((id) => [Number(vendorId), id]);
        await conn.query('INSERT INTO tbl_venue_occasion (venue_id, occasion_id) VALUES ?', [occasionValues]);
      }
    }

    if (hasServiceUpdate) {
      if (serviceIds === null) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid service IDs format' });
      }

      if (serviceIds.length > 0) {
        const [validServices] = await conn.query(
          `SELECT service_id FROM tbl_services WHERE service_id IN (${serviceIds.map(() => '?').join(',')})`,
          serviceIds
        );
        if (validServices.length !== serviceIds.length) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more service IDs are invalid' });
        }
      }

      await conn.query('DELETE FROM tbl_venue_service_map WHERE venue_id = ?', [vendorId]);
      if (serviceIds.length > 0) {
        const serviceValues = serviceIds.map((id) => [Number(vendorId), id]);
        await conn.query('INSERT INTO tbl_venue_service_map (venue_id, service_id) VALUES ?', [serviceValues]);
      }
    }

    if (hasServiceAreaUpdate) {
      if (serviceAreaCityIds === null) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid service area city IDs format' });
      }

      if (serviceAreaCityIds.length > 0) {
        const [validCities] = await conn.query(
          `SELECT city_id, city_name FROM tbl_city WHERE city_id IN (${serviceAreaCityIds.map(() => '?').join(',')})`,
          serviceAreaCityIds
        );

        if (validCities.length !== serviceAreaCityIds.length) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more city IDs are invalid for service areas' });
        }

        const cityNameById = new Map(validCities.map((row) => [Number(row.city_id), row.city_name]));

        await conn.query('DELETE FROM tbl_venue_service_areas_cities WHERE venue_id = ?', [vendorId]);
        const areaValues = serviceAreaCityIds.map((cityId) => [
          Number(vendorId),
          cityId,
          cityNameById.get(Number(cityId)) || '',
        ]);
        await conn.query(
          'INSERT INTO tbl_venue_service_areas_cities (venue_id, city_id, city_name) VALUES ?',
          [areaValues]
        );
      } else {
        await conn.query('DELETE FROM tbl_venue_service_areas_cities WHERE venue_id = ?', [vendorId]);
      }
    }

    if (hasFoodPricingUpdate) {
      if (!foodPricingParsed || foodPricingParsed.ok !== true) {
        await conn.rollback();
        return res.status(400).json({ message: foodPricingParsed?.message || 'Invalid food pricing format' });
      }

      const items = foodPricingParsed.items;
      const cuisineIdsFromBody = items
        .map((it) => it.cuisine_id)
        .filter((id) => Number.isInteger(id) && id > 0);

      const cuisineNames = items
        .map((it) => it.cuisine_name)
        .filter((name) => typeof name === 'string' && name.trim().length > 0)
        .map((name) => name.trim());

      const cuisineIdByLowerName = new Map();
      if (cuisineNames.length > 0) {
        const uniqueLowerNames = [...new Set(cuisineNames.map((n) => n.toLowerCase()))];
        const [rows] = await conn.query(
          `SELECT id, name FROM tbl_cuisines WHERE LOWER(name) IN (${uniqueLowerNames.map(() => '?').join(',')})`,
          uniqueLowerNames
        );
        for (const row of rows) {
          cuisineIdByLowerName.set(String(row.name).toLowerCase(), Number(row.id));
        }
        if (rows.length !== uniqueLowerNames.length) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more cuisines are invalid' });
        }
      }

      const resolved = items.map((it) => {
        if (it.cuisine_id) return { cuisine_id: it.cuisine_id, price: it.price };
        const resolvedId = cuisineIdByLowerName.get(String(it.cuisine_name).toLowerCase());
        return { cuisine_id: resolvedId, price: it.price };
      });

      const dedupedByCuisine = new Map();
      for (const row of resolved) {
        if (!row.cuisine_id) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more cuisines are invalid' });
        }
        dedupedByCuisine.set(Number(row.cuisine_id), Number(row.price));
      }
      const finalRows = [...dedupedByCuisine.entries()].map(([cuisine_id, price]) => ({ cuisine_id, price }));

      const uniqueCuisineIds = [...new Set([...cuisineIdsFromBody, ...finalRows.map((r) => r.cuisine_id)].filter(Boolean))];
      if (uniqueCuisineIds.length > 0) {
        const [validCuisineRows] = await conn.query(
          `SELECT id FROM tbl_cuisines WHERE id IN (${uniqueCuisineIds.map(() => '?').join(',')})`,
          uniqueCuisineIds
        );
        if (validCuisineRows.length !== uniqueCuisineIds.length) {
          await conn.rollback();
          return res.status(400).json({ message: 'One or more cuisine IDs are invalid' });
        }
      }

      await conn.query('DELETE FROM tbl_venue_foodpricing WHERE venue_id = ?', [vendorId]);
      if (finalRows.length > 0) {
        const foodValues = finalRows.map((row) => [Number(vendorId), Number(row.cuisine_id), Number(row.price)]);
        await conn.query('INSERT INTO tbl_venue_foodpricing (venue_id, cuisine_id, price) VALUES ?', [foodValues]);
      }
    }

    if (hasTransportationUpdate) {
      if (!transportationParsed || transportationParsed.ok !== true) {
        await conn.rollback();
        return res.status(400).json({ message: transportationParsed?.message || 'Invalid transportation format' });
      }

      await conn.query('DELETE FROM table_venue_transportation WHERE venue_id = ?', [vendorId]);
      if (transportationParsed.items.length > 0) {
        const rows = transportationParsed.items.map((t) => [Number(vendorId), t.mode, t.name, t.distance]);
        await conn.query('INSERT INTO table_venue_transportation (venue_id, mode, name, distance) VALUES ?', [rows]);
      }
    }

    const [updatedRows] = await conn.query(
      'SELECT venue_id AS id, businessName, businessType, contactName, email, phone, businessExperience, isPremium, profilePicture, address, city_id AS city, state_id AS state, country_id AS country, pinCode, nearLocation, status, updatedAt FROM tbl_venue WHERE venue_id = ? LIMIT 1',
      [vendorId]
    );

    const [amenityRows] = await conn.query(
      `SELECT a.amenity_id, a.amenity_name, a.active
       FROM tbl_venue_amenities va
       INNER JOIN tbl_amenities a ON a.amenity_id = va.amenity_id
       WHERE va.venue_id = ?
       ORDER BY a.amenity_name ASC`,
      [vendorId]
    );

    const [occasionRows] = await conn.query(
      `SELECT o.occasion_id, o.occasion_name, o.active
       FROM tbl_venue_occasion vo
       INNER JOIN tbl_occasion o ON o.occasion_id = vo.occasion_id
       WHERE vo.venue_id = ?
       ORDER BY o.occasion_name ASC`,
      [vendorId]
    );

    const [serviceRows] = await conn.query(
      `SELECT s.service_id, s.service_name
       FROM tbl_venue_service_map vsm
       INNER JOIN tbl_services s ON s.service_id = vsm.service_id
       WHERE vsm.venue_id = ?
       ORDER BY s.service_name ASC`,
      [vendorId]
    );

    const [serviceAreaRows] = await conn.query(
      `SELECT city_id, city_name
       FROM tbl_venue_service_areas_cities
       WHERE venue_id = ?
       ORDER BY city_name ASC`,
      [vendorId]
    );

    const [foodPricingRows] = await conn.query(
      `SELECT c.id AS cuisine_id, c.name AS cuisine, vf.price
       FROM tbl_venue_foodpricing vf
       INNER JOIN tbl_cuisines c ON c.id = vf.cuisine_id
       WHERE vf.venue_id = ?
       ORDER BY c.name ASC`,
      [vendorId]
    );

    const [transportationRows] = await conn.query(
      `SELECT id, mode, name, distance
       FROM table_venue_transportation
       WHERE venue_id = ?
       ORDER BY id ASC`,
      [vendorId]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      vendor: updatedRows[0],
      amenities: amenityRows,
      occasions: occasionRows,
      services: serviceRows,
      service_areas: serviceAreaRows,
      food_pricing: foodPricingRows,
      transportation: transportationRows,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
    }
    console.error('updateVendorProfile error:', error);
    return res.status(500).json({ message: 'Failed to update profile', error: error.message || String(error) });
  } finally {
    if (conn) conn.release();
  }
};

const deleteVenue = async (req, res) => {
  const vendorId = req.params.id || req.params.vendorId;

  try {
    if (!vendorId) {
      return res.status(400).json({ message: 'Vendor ID is required' });
    }

    // await ensureVenuesTable({ query });
    const [result] = await query('DELETE FROM tbl_venue WHERE venue_id = ?', [vendorId]);

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    return res.status(200).json({ message: 'Venue deleted successfully' });
  } catch (error) {
    console.error('deleteVenue error:', error);
    return res.status(500).json({ message: 'Error deleting venue', error: error.message || String(error) });
  }
};

// Get vendor details by id (fetch only required fields for faster query).
const getVenueById = async (req, res) => {
  const vendorId = req.params.id || req.params.vendorId;

  try {
    if (!vendorId) {
      return res.status(400).json({ message: 'Venue ID is required' });
    }

    const [rows] = await query(
      `SELECT
        v.venue_id AS id, v.businessName, v.businessType, v.contactName, v.email, v.phone,
        v.businessExperience, v.profilePicture, v.address,
        v.city_id, c.city_name AS city,
        v.state_id, s.state_name AS state,
        v.country_id, co.country_name AS country,
        v.pinCode,
        COALESCE(l.locality_name, v.nearLocation) AS nearLocation,
        v.description, v.status, v.isVerified, v.isApproved, v.isPremium, v.isTrusted,
        v.venueCapacity, v.views, v.faqContent, v.metaTitle, v.metaKeywords, v.metaDescription,
        v.venue_website_url, v.venue_facebook_url, v.venue_instagram_url,
        v.venue_linkedIn_url, v.venue_youtube_url,
        v.createdAt, v.updatedAt
       FROM tbl_venue v
       LEFT JOIN tbl_city c ON c.city_id = v.city_id
       LEFT JOIN tbl_state s ON s.state_id = v.state_id
       LEFT JOIN tbl_country co ON co.country_id = v.country_id
       LEFT JOIN tbl_locality l ON v.nearLocation REGEXP '^[0-9]+$' AND l.locality_id = CAST(v.nearLocation AS UNSIGNED)
       WHERE v.venue_id = ? LIMIT 1`,
      [vendorId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const venue = rows[0];

    // Run all related queries in parallel
    const [
      [amenities],
      [occasions],
      [foodPricing],
      [rentalPricing],
      [foodBeverage],
      [foodCategories],
      [alcoholPolicy],
      [entertainmentServices],
      [staffServices],
      [dietaryOptions],
      [services],
      [additionalServices],
      [policies],
      [payment],
      [paymentMethods],
      [operatingDetails],
      [parking],
      [transportation],
      [gstDetails],
      [contacts],
      [serviceAreas],
      [images],
      [videos],
    ] = await Promise.all([
      // amenities
      query(
        `SELECT a.amenity_id, a.amenity_name
         FROM tbl_venue_amenities va
         INNER JOIN tbl_amenities a ON a.amenity_id = va.amenity_id
         WHERE va.venue_id = ? ORDER BY a.amenity_name ASC`,
        [vendorId]
      ),
      // occasions
      query(
        `SELECT o.occasion_id, o.occasion_name
         FROM tbl_venue_occasion vo
         INNER JOIN tbl_occasion o ON o.occasion_id = vo.occasion_id
         WHERE vo.venue_id = ? ORDER BY o.occasion_name ASC`,
        [vendorId]
      ),
      // food pricing (per cuisine)
      query(
        `SELECT c.name AS cuisine, vf.price
         FROM tbl_venue_foodpricing vf
         INNER JOIN tbl_cuisines c ON c.id = vf.cuisine_id
         WHERE vf.venue_id = ? ORDER BY c.name ASC`,
        [vendorId]
      ),
      // rental pricing
      query(
        `SELECT rt.name AS rental_type, vr.price
         FROM tbl_venue_rentalpricing vr
         INNER JOIN tbl_rental_types rt ON rt.id = vr.type_id
         WHERE vr.venue_id = ? ORDER BY rt.name ASC`,
        [vendorId]
      ),
      // food & beverage policy
      query(
        `SELECT catering_policy, soft_drink, beverage_options
         FROM tbl_venue_food_beverage WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // food categories with price
      query(
        `SELECT fct.name AS category, vfc.price
         FROM tbl_venue_food_category vfc
         INNER JOIN tbl_food_categories_types fct ON fct.id = vfc.category_id
         WHERE vfc.venue_id = ? ORDER BY fct.name ASC`,
        [vendorId]
      ),
      // alcohol policy
      query(
        `SELECT alcohol_served, outside_liquor_permitted, bar_service_available
         FROM tbl_venue_alcohol_policy WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // entertainment services
      query(
        `SELECT dj_available, live_music_allowed, dance_floor_available, music_system_available
         FROM tbl_venue_entertainment_services WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // staff services
      query(
        `SELECT professional_staff, event_manager, service_staff, security_personnel,
                waiters, chef_team, housekeeping, technical_support, security, coordinator, cleaning
         FROM tbl_venue_staff_services WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // dietary options
      query(
        `SELECT dt.name AS dietary_type
         FROM tbl_venue_dietary_options vdo
         INNER JOIN tbl_dietary_types dt ON dt.id = vdo.dietary_type_id
         WHERE vdo.venue_id = ? ORDER BY dt.name ASC`,
        [vendorId]
      ),
      // services
      query(
        `SELECT s.service_id, s.service_name
         FROM tbl_venue_service_map vsm
         INNER JOIN tbl_services s ON s.service_id = vsm.service_id
         WHERE vsm.venue_id = ? ORDER BY s.service_name ASC`,
        [vendorId]
      ),
      // additional services
      query(
        `SELECT ads.service_name, vas.is_available
         FROM tbl_venue_additional_services vas
         INNER JOIN tbl_additional_services ads ON ads.id = vas.service_id
         WHERE vas.venue_id = ? ORDER BY ads.service_name ASC`,
        [vendorId]
      ),
      // policies
      query(
        `SELECT booking_policy, cancellation_policy, refund_policy, reschedule_policy,
                outside_decorator_policy, outside_photographer_policy, terms_conditions, disclaimer
         FROM tbl_venue_policies WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // payment (advance + method booleans)
      query(
        `SELECT advance_payment_required, advance_percentage,
                cash, upi, bank_transfer, cheque, credit_card
         FROM tbl_venue_payment WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // payment methods mapping (accepted / not accepted)
      query(
        `SELECT pm.method_name, vpm.is_accepted
         FROM tbl_venue_payment_methods vpm
         INNER JOIN tbl_payment_methods pm ON pm.id = vpm.payment_method_id
         WHERE vpm.venue_id = ? ORDER BY pm.id ASC`,
        [vendorId]
      ),
      // operating details & slots
      query(
        `SELECT open_time, close_time, operating_days,
                slot_morning, slot_evening, slot_full_day
         FROM tbl_venue_operating_details WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // parking
      query(
        `SELECT two_wheeler, four_wheeler, total_capacity, available_capacity, is_free, price_per_hour
         FROM table_venue_parking WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // transportation
      query(
        `SELECT mode, name, distance
         FROM table_venue_transportation WHERE venue_id = ? ORDER BY id ASC`,
        [vendorId]
      ),
      // GST details
      query(
        `SELECT gst_number, gst_document, gst_verified
         FROM tbl_venue_gst_details WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // contacts
      query(
        `SELECT manager_name, manager_number1, manager_number2,
                owner_name, owner_number1, owner_number2,
                accountant_name, accountant_number1, accountant_number2
         FROM table_venue_contacts WHERE venue_id = ? LIMIT 1`,
        [vendorId]
      ),
      // service areas
      query(
        `SELECT city_id, city_name
         FROM tbl_venue_service_areas_cities
         WHERE venue_id = ? ORDER BY city_name ASC`,
        [vendorId]
      ),
      // images
      query(
        `SELECT image_url, title, display_order
         FROM tbl_venue_images WHERE venue_id = ? ORDER BY display_order ASC`,
        [vendorId]
      ),
      // videos
      query(
        `SELECT video_url, title, display_order
         FROM tbl_venue_videos WHERE venue_id = ? ORDER BY display_order ASC`,
        [vendorId]
      ),
    ]);

    const slug = (value, fallback) =>
      String(value || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    const seoUrl = `/${slug(venue.city, 'location')}/${slug(venue.businessType, 'vendor')}/${slug(venue.businessName, 'business')}-in-${slug(venue.nearLocation, 'area')}`;

    return res.status(200).json({
      message: 'Venue found successfully',
      venue: {
        ...venue,
        seoUrl,
        amenities,
        occasions,
        food_pricing: foodPricing,
        rental_pricing: rentalPricing,
        food_beverage: foodBeverage[0] || null,
        food_categories: foodCategories,
        alcohol_policy: alcoholPolicy[0] || null,
        entertainment_services: entertainmentServices[0] || null,
        staff_services: staffServices[0] || null,
        dietary_options: dietaryOptions,
        services,
        additional_services: additionalServices,
        policies: policies[0] || null,
        payment: payment[0] || null,
        payment_methods: paymentMethods,
        operating_details: operatingDetails[0] || null,
        parking: parking[0] || null,
        transportation,
        gst_details: gstDetails[0] || null,
        contacts: contacts[0] || null,
        images,
        videos,
        service_areas: serviceAreas,
      },
    });
  } catch (error) {
    console.error('getVendorById error:', error);
    return res.status(500).json({ message: 'Error getting vendor', error: error.message || String(error) });
  }
};


// get Country List Api
const getCountryList = async (req, res) => {
  try {
    const [rows] = await query('SELECT country_id, country_name, active FROM tbl_country ORDER BY country_name ASC');
    return res.status(200).json({ message: 'Country list fetched successfully', countryList: rows });
  } catch (error) {
    console.error('getCountryList error:', error);
    return res.status(500).json({ message: 'Error getting country list', error: error.message || String(error) });
  }
};
// get stateList Api
const getStateList = async (req, res) => {
  try {
    const { countryId } = req.params;
    let rows;

    if (countryId) {
      [rows] = await query(
        'SELECT state_id, state_name, country_id, active FROM tbl_state WHERE country_id = ? ORDER BY state_name ASC',
        [countryId]
      );
    } else {
      [rows] = await query('SELECT state_id, state_name, country_id, active FROM tbl_state ORDER BY state_name ASC');
    }

    return res.status(200).json({ message: 'State list fetched successfully', stateList: rows });
  } catch (error) {
    console.error('getStateList error:', error);
    return res.status(500).json({ message: 'Error getting state list', error: error.message || String(error) });
  }
};

// get cityList Api
const getCityList = async (req, res) => {
  try {
    const { stateId } = req.params;
    let rows;

    if (stateId) {
      [rows] = await query(
        'SELECT city_id, city_name, state_id, active FROM tbl_city WHERE state_id = ? ORDER BY city_name ASC',
        [stateId]
      );
    } else {
      [rows] = await query('SELECT city_id, city_name, state_id, active FROM tbl_city ORDER BY city_name ASC');
    }

    return res.status(200).json({ message: 'City list fetched successfully', cityList: rows });
  } catch (error) {
    console.error('getCityList error:', error);
    return res.status(500).json({ message: 'Error getting city list', error: error.message || String(error) });
  }
};

// get locality list by city id
const getLocalityList = async (req, res) => {
  try {
    const cityId = req.params.city_id || req.params.cityId;
    let rows;

    if (cityId) {
      [rows] = await query(
        `SELECT l.locality_id, l.locality_name, cl.city_id, l.active
         FROM tbl_city_locality cl
         INNER JOIN tbl_locality l ON l.locality_id = cl.locality_id
         WHERE cl.city_id = ?
         ORDER BY l.locality_name ASC`,
        [cityId]
      );
    } else {
      [rows] = await query(
        `SELECT l.locality_id, l.locality_name, cl.city_id, l.active
         FROM tbl_city_locality cl
         INNER JOIN tbl_locality l ON l.locality_id = cl.locality_id
         ORDER BY cl.city_id ASC, l.locality_name ASC`
      );
    }

    return res.status(200).json({ message: 'Locality list fetched successfully', localityList: rows });
  } catch (error) {
    console.error('getLocalityList error:', error);
    return res.status(500).json({ message: 'Error getting locality list', error: error.message || String(error) });
  }
};


// Add Occassions  List Api 

const addOccassions = async (req, res) => {
  const occasionName = String(req.body?.occasion_name || '').trim();
  try {
    await ensureOccasionsTable();

    if (!occasionName) {
      return res.status(400).json({ message: 'Occasion name is required' });
    }

    const [rows] = await query(
      'SELECT occasion_id, occasion_name FROM tbl_occasion WHERE LOWER(occasion_name) = LOWER(?) LIMIT 1',
      [occasionName]
    );

    if (rows.length > 0) {
      return res.status(400).json({ message: 'Occasion already exists' });
    }

    const [result] = await query('INSERT INTO tbl_occasion (occasion_name, active) VALUES (?, ?)', [occasionName, 1]);
    return res.status(201).json({ message: 'Occasion added successfully', occasion_id: result.insertId });
  } catch (error) {
    console.error('addOccassions error:', error);
    return res.status(500).json({ message: 'Error adding occasion', error: error.message || String(error) });
  }
};

// Get occassion List Api
const getOccassions = async (req, res) => {
  try {
    const [rows] = await query('SELECT occasion_id, occasion_name, active FROM tbl_occasion ORDER BY occasion_name ASC');
    return res.status(200).json({ message: 'Occasion list fetched successfully', occasionList: rows });
  } catch (error) {
    console.error('getOccassions error:', error);
    return res.status(500).json({ message: 'Error getting occasion list', error: error.message || String(error) });
  }
}
// Update occassion 
const updateOccassions = async (req, res) => {
  const { occasionId } = req.params;
  const { occasionName } = req.body;

  try {


    if (!occasionName) {
      return res.status(400).json({ message: 'Occasion name is required' });
    }

    const [rows] = await query(
      'SELECT occasion_id, occasion_name FROM tbl_occasion WHERE LOWER(occasion_name) = LOWER(?) LIMIT 1',
      [occasionName]
    );

    if (rows.length > 0 && rows[0].occasion_id !== Number(occasionId)) {
      return res.status(400).json({ message: 'Occasion already exists' });
    }

    await query('UPDATE tbl_occasion SET occasion_name = ? WHERE occasion_id = ?', [occasionName, occasionId]);
    return res.status(200).json({ message: 'Occasion updated successfully' });
  } catch (error) {
    console.error('updateOccassions error:', error);
    return res.status(500).json({ message: 'Error updating occasion', error: error.message || String(error) });
  }
};

// Delete occassions 
const deleteOccassions = async (req, res) => {
  const { occasionId } = req.params;

  try {
    await query('DELETE FROM tbl_occasion WHERE occasion_id = ?', [occasionId]);
    return res.status(200).json({ message: 'Occasion deleted successfully' });
  } catch (error) {
    console.error('deleteOccassions error:', error);
    return res.status(500).json({ message: 'Error deleting occasion', error: error.message || String(error) });
  }
}

// add amenities 
const addAmenities = async (req, res) => {
  const amenityName = String(req.body?.amenityName || req.body?.amenity_name || '').trim();

  try {
    await ensureAmenitiesTable();

    if (!amenityName) {
      return res.status(400).json({ message: 'Amenity name is required' });
    }

    const [rows] = await query(
      'SELECT amenity_id, amenity_name FROM tbl_amenities WHERE LOWER(amenity_name) = LOWER(?) LIMIT 1',
      [amenityName]
    );

    if (rows.length > 0) {
      return res.status(400).json({ message: 'Amenity already exists' });
    }

    const [result] = await query('INSERT INTO tbl_amenities (amenity_name, active) VALUES (?, ?)', [amenityName, 1]);
    return res.status(201).json({ message: 'Amenity added successfully', amenity_id: result.insertId });
  } catch (error) {
    console.error('addAmenities error:', error);
    return res.status(500).json({ message: 'Error adding amenity', error: error.message || String(error) });
  }
};

// Get amenities list Api
const getAmenities = async (req, res) => {
  try {
    await ensureAmenitiesTable();
    const [rows] = await query('SELECT amenity_id, amenity_name, active FROM tbl_amenities ORDER BY amenity_name ASC');
    return res.status(200).json({ message: 'Amenity list fetched successfully', amenityList: rows });
  } catch (error) {
    console.error('getAmenities error:', error);
    return res.status(500).json({ message: 'Error getting amenity list', error: error.message || String(error) });
  }
};

// Update amenity
const updateAmenities = async (req, res) => {
  const { amenityId } = req.params;
  const amenityName = String(req.body?.amenityName || req.body?.amenity_name || '').trim();
  const statusValue = req.body?.status ?? req.body?.active;

  try {
    await ensureAmenitiesTable();

    if (!amenityName) {
      return res.status(400).json({ message: 'Amenity name is required' });
    }

    const [existingById] = await query('SELECT amenity_id FROM tbl_amenities WHERE amenity_id = ? LIMIT 1', [amenityId]);
    if (existingById.length === 0) {
      return res.status(404).json({ message: 'Amenity not found' });
    }

    const [rows] = await query(
      'SELECT amenity_id FROM tbl_amenities WHERE LOWER(amenity_name) = LOWER(?) LIMIT 1',
      [amenityName]
    );

    if (rows.length > 0 && Number(rows[0].amenity_id) !== Number(amenityId)) {
      return res.status(400).json({ message: 'Amenity already exists' });
    }

    const parsedStatus =
      statusValue === undefined || statusValue === null
        ? null
        : (statusValue === true || statusValue === 'true' || statusValue === 1 || statusValue === '1' ? 1 : 0);

    if (parsedStatus === null) {
      await query('UPDATE tbl_amenities SET amenity_name = ? WHERE amenity_id = ?', [amenityName, amenityId]);
    } else {
      await query('UPDATE tbl_amenities SET amenity_name = ?, active = ? WHERE amenity_id = ?', [amenityName, parsedStatus, amenityId]);
    }

    const [updatedRows] = await query(
      'SELECT amenity_id, amenity_name, active FROM tbl_amenities WHERE amenity_id = ? LIMIT 1',
      [amenityId]
    );

    return res.status(200).json({
      message: 'Amenity updated successfully',
      amenity: updatedRows[0] || null
    });
  } catch (error) {
    console.error('updateAmenities error:', error);
    return res.status(500).json({ message: 'Error updating amenity', error: error.message || String(error) });
  }
};

// Delete amenity
const deleteAmenities = async (req, res) => {
  const { amenityId } = req.params;

  try {
    await ensureAmenitiesTable();

    const [result] = await query('DELETE FROM tbl_amenities WHERE amenity_id = ?', [amenityId]);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: 'Amenity not found' });
    }

    return res.status(200).json({ message: 'Amenity deleted successfully' });
  } catch (error) {
    console.error('deleteAmenities error:', error);
    return res.status(500).json({ message: 'Error deleting amenity', error: error.message || String(error) });
  }
};

// get All Venue List Api 

const escapeLike = (value) => String(value).replace(/[\\%_]/g, '\\$&');

const getAllVenues = async (req, res) => {
  const pageRaw = Number(req.query?.page ?? 1);
  const limitRaw = Number(req.query?.limit ?? 10);
  const searchRaw = req.query?.search ?? req.query?.businessName ?? '';

  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10;
  const offset = (page - 1) * limit;

  const search = String(searchRaw || '').trim();
  const where = [];
  const params = [];

  if (search) {
    where.push('v.businessName LIKE ? ESCAPE \'\\\\\'');
    params.push(`%${escapeLike(search)}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [countRows] = await query(
      `SELECT COUNT(*) AS total
       FROM tbl_venue v
       ${whereSql}`,
      params
    );

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const [rows] = await query(
      `SELECT
         v.venue_id AS id,
         v.businessName,
         v.businessType,
         v.contactName,
         v.email,
         v.phone,
         v.profilePicture,
         v.status,
         v.address,
         v.city_id,
         v.state_id,
         v.country_id,
         v.pinCode,
         v.nearLocation,
         v.isApproved,
         v.isVerified,
         v.isPremium,
         v.isTrusted,
         v.venueCapacity,
         v.createdAt,
         v.updatedAt
       FROM tbl_venue v
       ${whereSql}
       ORDER BY v.venue_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      message: 'Venue list fetched successfully',
      pagination: { page, limit, total, totalPages },
      venues: rows,
    });
  } catch (error) {
    console.error('getAllVenues error:', error);
    return res.status(500).json({ message: 'Error getting venue list', error: error.message || String(error) });
  }
};


// get Similar venue List Api 
const getSimilarVenues = async (req, res) => {
  const venueIdRaw = req.params.id;
  const limitRaw = Number(req.query?.limit ?? 10);

  const venueId = Number(venueIdRaw);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
  const includeAll = String(req.query?.includeAll ?? '0') === '1';

  const visibilityWhere = includeAll ? '' : ' AND v.status = 1 AND v.isApproved = 1';

  try {
    if (!Number.isInteger(venueId) || venueId <= 0) {
      return res.status(400).json({ message: 'Valid venue id is required' });
    }

    const [baseRows] = await query(
      `SELECT venue_id AS id, city_id, businessType, nearLocation
       FROM tbl_venue
       WHERE venue_id = ?
       LIMIT 1`,
      [venueId]
    );

    if (baseRows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    const base = baseRows[0];
    const cityId = base.city_id;
    const businessType = base.businessType ? String(base.businessType).trim() : '';
    const nearLocation = base.nearLocation ? String(base.nearLocation).trim() : '';

    if (!cityId || !businessType) {
      return res.status(200).json({
        message: 'Similar venues fetched successfully',
        baseVenue: { id: venueId, city_id: cityId, businessType, nearLocation },
        venues: [],
      });
    }

    const [venues] = await query(
      `SELECT
         v.venue_id AS id,
         v.businessName,
         v.businessType,
         v.profilePicture,
         v.city_id,
         c.city_name AS city,
         v.nearLocation,
         v.venueCapacity,
         v.veg_price,
         v.non_veg_price,
         v.halfday_rental_price,
         v.fullday_rental_price,
         v.isPremium,
         v.isTrusted,
         v.views,
         v.updatedAt
       FROM tbl_venue v
       LEFT JOIN tbl_city c ON c.city_id = v.city_id
       WHERE v.venue_id <> ?
         AND v.city_id = ?
         AND LOWER(TRIM(v.businessType)) = ?
         ${visibilityWhere}
       ORDER BY
         (CASE WHEN v.nearLocation = ? THEN 1 ELSE 0 END) DESC,
         v.isPremium DESC,
         v.isTrusted DESC,
         v.views DESC,
         v.updatedAt DESC
       LIMIT ?`,
      [venueId, cityId, businessType.toLowerCase(), nearLocation, limit]
    );

    return res.status(200).json({
      message: 'Similar venues fetched successfully',
      baseVenue: { id: venueId, city_id: cityId, businessType, nearLocation },
      venues,
    });
  } catch (error) {
    console.error('getSimilarVenues error:', error);
    return res.status(500).json({ message: 'Error getting similar venues', error: error.message || String(error) });
  }
};

// Get Latest venue by cityId and businessType Api
const getlatestVenueTypeData = async (req, res) => {
  const cityIdRaw = req.query?.cityId;
  const businessTypeRaw = req.query?.businessType;
  const limitRaw = Number(req.query?.limit ?? 20);
  const pageRaw = Number(req.query?.page ?? 1);
  const includeAll = String(req.query?.includeAll ?? '0') === '1';

  const cityId = cityIdRaw === undefined ? null : Number(cityIdRaw);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * limit;

  try {
    const where = ["businessType IS NOT NULL", "TRIM(businessType) <> ''"];
    const params = [];

    if (cityIdRaw !== undefined) {
      if (!Number.isInteger(cityId) || cityId <= 0) {
        return res.status(400).json({ message: 'Valid city_id is required' });
      }
      where.push('city_id = ?');
      params.push(cityId);
    }

    const businessTypeInput = businessTypeRaw === undefined ? '' : String(businessTypeRaw || '').trim();
    if (businessTypeInput) {
      const normalized = businessTypeInput.toLowerCase();
      where.push('(businessType = ? OR LOWER(TRIM(businessType)) = ?)');
      params.push(normalized, normalized);
    }

    const [rows] = await query(
      `SELECT
         LOWER(TRIM(businessType)) AS businessType,
         COUNT(*) AS total,
         MAX(updatedAt) AS latestUpdatedAt
       FROM tbl_venue
       WHERE ${where.join(' AND ')}
       GROUP BY LOWER(TRIM(businessType))
       ORDER BY latestUpdatedAt DESC, total DESC
       LIMIT ?`,
      [...params, limit]
    );

    if (businessTypeInput) {
      const total = Number(rows?.[0]?.total || 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

      const venueWhere = [];
      const venueParams = [];

      venueWhere.push("v.businessType IS NOT NULL");
      venueWhere.push("TRIM(v.businessType) <> ''");

      if (cityIdRaw !== undefined) {
        venueWhere.push('v.city_id = ?');
        venueParams.push(cityId);
      }

      const normalized = businessTypeInput.toLowerCase();
      venueWhere.push('(v.businessType = ? OR LOWER(TRIM(v.businessType)) = ?)');
      venueParams.push(normalized, normalized);

      if (!includeAll) {
        venueWhere.push('v.status = 1');
        venueWhere.push('v.isApproved = 1');
      }

      const [venueRows] = await query(
        `SELECT
           v.venue_id AS id,
           v.businessName,
           v.businessType,
           v.profilePicture,
           v.city_id,
           c.city_name AS city,
           v.nearLocation,
           v.venueCapacity,
           v.veg_price,
           v.non_veg_price,
           v.halfday_rental_price,
           v.fullday_rental_price,
           v.isPremium,
           v.isTrusted,
           v.views,
           v.updatedAt
         FROM tbl_venue v
         LEFT JOIN tbl_city c ON c.city_id = v.city_id
         WHERE ${venueWhere.join(' AND ')}
         ORDER BY v.updatedAt DESC, v.venue_id DESC
         LIMIT ? OFFSET ?`,
        [...venueParams, limit, offset]
      );

      return res.status(200).json({
        message: 'Venue type latest data fetched successfully',
        city_id: cityIdRaw !== undefined ? cityId : null,
        businessType: businessTypeInput,
        summary: rows[0] || { businessType: normalized, total: 0, },
        pagination: { page, limit, total, totalPages },
        venues: venueRows,
      });
    }

    return res.status(200).json({
      message: 'Venue types fetched successfully',
      city_id: cityIdRaw !== undefined ? cityId : null,
      businessType: null,
      vendorTypes: rows,
    });
  } catch (error) {
    console.error('getlatestVendorTypeData error:', error);
    return res.status(500).json({ message: 'Error getting vendor types', error: error.message || String(error) });
  }
};

const getVenueByCity = async (req, res) => {

  const cityIdRaw = req.params.cityId;
  const businessTypeRaw = req.query?.businessType ?? '';
  const searchRaw = req.query?.search ?? '';

  const pageRaw = Number(req.query?.page ?? 1);
  const limitRaw = Number(req.query?.limit ?? 10);

  const cityId = Number(cityIdRaw);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10;
  const offset = (page - 1) * limit;

  const includeAll = String(req.query?.includeAll ?? '0') === '1';

  const businessType = String(businessTypeRaw || '').trim().toLowerCase();
  const search = String(searchRaw || '').trim();

  try {
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return res.status(400).json({ message: 'Valid city id is required' });
    }

    const where = ['v.city_id = ?'];
    const params = [cityId];

    if (!includeAll) {
      where.push('v.status = 1');
      where.push('v.isApproved = 1');
    }

    if (businessType) {
      where.push('LOWER(v.businessType) = ?');
      params.push(businessType);
    }

    if (search) {
      where.push('v.businessName LIKE ? ESCAPE \'\\\\\'');
      params.push(`%${escapeLike(search)}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await query(
      `SELECT COUNT(*) AS total
       FROM tbl_venue v
       ${whereSql}`,
      params
    );

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const [rows] = await query(
      `SELECT
         v.venue_id AS id,
         v.businessName,
         v.businessType,
         v.profilePicture,
         v.city_id,
         c.city_name AS city,
         v.nearLocation,
         v.venueCapacity,
         v.veg_price,
         v.non_veg_price,
         v.halfday_rental_price,
         v.fullday_rental_price,
         v.isPremium,
         v.isTrusted,
         v.views,
         v.updatedAt
       FROM tbl_venue v
       LEFT JOIN tbl_city c ON c.city_id = v.city_id
       ${whereSql}
       ORDER BY v.isPremium DESC, v.isTrusted DESC, v.views DESC, v.updatedAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      message: 'Venue list fetched successfully',
      city_id: cityId,
      pagination: { page, limit, total, totalPages },
      venues: rows,
    });
  } catch (error) {
    console.error('getVenueByCity error:', error);
    return res.status(500).json({ message: 'Error getting venues by city', error: error.message || String(error) });
  }
};

// get venues by Occasion
// cityId is optional: if provided, filter by city; otherwise return all venues for the occasion.
const getVenuesByOccasion = async (req, res) => {
  const occasionIdRaw = req.params.occasionId;
  const cityIdRaw = req.query?.cityId;
  const includeAll = String(req.query?.includeAll ?? '0') === '1';

  const pageRaw = Number(req.query?.page ?? 1);
  const limitRaw = Number(req.query?.limit ?? 10);

  const occasionId = Number(occasionIdRaw);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10;
  const offset = (page - 1) * limit;

  const cityId = cityIdRaw === undefined ? null : Number(cityIdRaw);

  try {
    if (!Number.isInteger(occasionId) || occasionId <= 0) {
      return res.status(400).json({ message: 'Valid occasion id is required' });
    }

    if (cityIdRaw !== undefined && (!Number.isInteger(cityId) || cityId <= 0)) {
      return res.status(400).json({ message: 'Valid cityId is required' });
    }

    const where = ['vo.occasion_id = ?'];
    const params = [occasionId];

    if (cityIdRaw !== undefined) {
      where.push('v.city_id = ?');
      params.push(cityId);
    }

    if (!includeAll) {
      where.push('v.status = 1');
      where.push('v.isApproved = 1');
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await query(
      `SELECT COUNT(*) AS total
       FROM tbl_venue_occasion vo
       INNER JOIN tbl_venue v ON v.venue_id = vo.venue_id
       ${whereSql}`,
      params
    );

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const [rows] = await query(
      `SELECT
         v.venue_id AS id,
         v.businessName,
         v.businessType,
         v.profilePicture,
         v.city_id,
         c.city_name AS city,
         v.nearLocation,
         v.venueCapacity,
         v.veg_price,
         v.non_veg_price,
         v.halfday_rental_price,
         v.fullday_rental_price,
         v.isPremium,
         v.isTrusted,
         v.views,
         v.updatedAt,
         o.occasion_id AS occasion_id,
         o.occasion_name AS occasion_name
       FROM tbl_venue_occasion vo
       INNER JOIN tbl_venue v ON v.venue_id = vo.venue_id
       LEFT JOIN tbl_city c ON c.city_id = v.city_id
       LEFT JOIN tbl_occasion o ON o.occasion_id = vo.occasion_id
       ${whereSql}
       ORDER BY v.isPremium DESC, v.isTrusted DESC, v.views DESC, v.updatedAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      message: 'Venue list fetched successfully',
      occasion_id: occasionId,
      city_id: cityIdRaw !== undefined ? cityId : null,
      pagination: { page, limit, total, totalPages },
      venues: rows,
    });
  } catch (error) {
    console.error('getVenuesByOccasion error:', error);
    return res.status(500).json({ message: 'Error getting venues by occasion', error: error.message || String(error) });
  }
};
// search occasion by name  and show id of occasion Api 
const searchOccasion = async (req, res) => {
  const nameRaw = req.query?.q ?? req.query?.occasionName;
  const name = String(nameRaw || '').trim();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  try {
    if (!name) {
      return res.status(400).json({ message: "Occasion name is required" });
    }

    const normalized = name.toLowerCase();

    // If an exact occasion exists (case-insensitive), return only that (e.g. searching "Wedding" returns only "Wedding").
    const [exactRows] = await query(
      `SELECT occasion_id, occasion_name
       FROM tbl_occasion
       WHERE active = 1
         AND LOWER(TRIM(occasion_name)) = ?
       LIMIT 1`,
      [normalized]
    );

    const rows =
      exactRows.length > 0
        ? exactRows
        : (
          await query(
            `SELECT occasion_id, occasion_name
               FROM tbl_occasion
               WHERE active = 1
                 AND LOWER(occasion_name) LIKE ?
               ORDER BY occasion_name ASC
               LIMIT ?`,
            [`%${escapeLike(normalized)}%`, limit]
          )
        )[0];

    return res.status(200).json({
      message: "Occasion list fetched successfully",
      occasions: rows
    });

  } catch (error) {
    console.error("searchOccasion error:", error);
    return res.status(500).json({
      message: "Error searching occasion",
      error: error.message
    });
  }
};

// get unique businessType list  Api
const getuniqueBusinessTypes = async (req, res) => {
  const includeAll = String(req.query?.includeAll ?? '0') === '1';
  try {
    const where = ["businessType IS NOT NULL", "TRIM(businessType) <> ''"];
    if (!includeAll) {
      where.push('status = 1');
      where.push('isApproved = 1');
    }

    const [rows] = await query(
      `SELECT DISTINCT LOWER(TRIM(businessType)) AS businessType
       FROM tbl_venue
       WHERE ${where.join(' AND ')}
       ORDER BY businessType ASC`
    );

    return res.status(200).json({
      message: "Business type list fetched successfully",
      businessTypes: rows.map(row => row.businessType)
    });
  } catch (error) {
    console.error("getuniqueBusinessTypes error:", error);
    return res.status(500).json({
      message: "Error fetching business types",
      error: error.message
    });
  }
};

// get All citiesList name  Api 
const getAllCitiesList = async (req, res) => {
  try {
    const [rows] = await query('SELECT city_id, city_name FROM tbl_city ORDER BY city_name ASC');
    return res.status(200).json({ message: 'City list fetched successfully', cityList: rows });
  } catch (error) {
    console.error('getAllCitiesList error:', error);
    return res.status(500).json({ message: 'Error getting city list', error: error.message || String(error) });
  }
}


// Add Venue Spaces of Particular Venue
const addVenueSpaces = async (req, res) => {
  const venueId = req.params.id;

  const {
    space_name,
    space_type,
    min_capacity,
    max_capacity,
    veg_price,
    veg_imfl_price,
    non_veg_price,
    non_veg_imfl_price,

    cuisine_indian,
    cuisine_chinese,
    cuisine_mughlai,
    cuisine_continental,
    cuisine_tandoori,
    cuisine_south_indian,
    cuisine_north_indian,
    cuisine_italian,
    cuisine_mexican,

    contact_name,
    contact_number,
    city_id,
    pin_code,
    near_location_id,
    address,
    is_active
  } = req.body;

  const profile_picture = req.imageUrl || null;

  try {
    if (!venueId) {
      return res.status(400).json({ message: 'Venue ID is required' });
    }

    if (!space_name) {
      return res.status(400).json({ message: 'Space name is required' });
    }

    const insertSql = `
      INSERT INTO tbl_venue_spaces (
        venue_id, space_name, space_type,
        min_capacity, max_capacity,
        veg_price, veg_imfl_price, non_veg_price, non_veg_imfl_price,
        cuisine_indian, cuisine_chinese, cuisine_mughlai, cuisine_continental,
        cuisine_tandoori, cuisine_south_indian, cuisine_north_indian,
        cuisine_italian, cuisine_mexican,
        contact_name, contact_number,
        city_id, pin_code, near_location_id,
        address, profile_picture, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      venueId,
      space_name,
      space_type || 'Indoor',
      min_capacity || null,
      max_capacity || null,
      veg_price || null,
      veg_imfl_price || null,
      non_veg_price || null,
      non_veg_imfl_price || null,

      cuisine_indian ? 1 : 0,
      cuisine_chinese ? 1 : 0,
      cuisine_mughlai ? 1 : 0,
      cuisine_continental ? 1 : 0,
      cuisine_tandoori ? 1 : 0,
      cuisine_south_indian ? 1 : 0,
      cuisine_north_indian ? 1 : 0,
      cuisine_italian ? 1 : 0,
      cuisine_mexican ? 1 : 0,

      contact_name || null,
      contact_number || null,
      city_id || null,
      pin_code || null,
      near_location_id || null,
      address || null,
      profile_picture,
      is_active !== undefined ? is_active : 1
    ];

    const [result] = await query(insertSql, values);

    // ✅ Fetch inserted record
    const [rows] = await query(
      `SELECT * FROM tbl_venue_spaces WHERE space_id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      message: 'Venue space added successfully',
      data: rows[0]
    });

  } catch (error) {
    console.error('addVenueSpaces error:', error);
    return res.status(500).json({
      message: 'Error adding venue space',
      error: error.message || String(error)
    });
  }
};

// Get Venue Spaces of Particular Venue
const getVenueSpaces = async (req, res) => {
  const venueId = req.params.id;
  try {
    if (!venueId) return res.status(400).json({ message: 'Venue ID is required' });

    await ensureVenueSpacesTable();

    const [rows] = await query(`
      SELECT * FROM tbl_venue_spaces
      WHERE venue_id = ?
      ORDER BY space_id DESC
    `, [venueId]);

    return res.status(200).json({ message: 'Venue spaces fetched successfully', spaces: rows });
  } catch (error) {
    console.error('getVenueSpaces error:', error);
    return res.status(500).json({ message: 'Error fetching venue spaces', error: error.message || String(error) });
  }
};


// Update Venue Spaces of Particular Venue
const updateVenueSpace = async (req, res) => {
  const spaceId = req.params.spaceId;

  const {
    space_name,
    space_type,
    min_capacity,
    max_capacity,
    veg_price,
    veg_imfl_price,
    non_veg_price,
    non_veg_imfl_price,

    cuisine_indian,
    cuisine_chinese,
    cuisine_mughlai,
    cuisine_continental,
    cuisine_tandoori,
    cuisine_south_indian,
    cuisine_north_indian,
    cuisine_italian,
    cuisine_mexican,

    contact_name,
    contact_number,
    city_id,
    pin_code,
    near_location_id,
    address,
    is_active
  } = req.body;

  const profile_picture = req.imageUrl;

  try {
    if (!spaceId) {
      return res.status(400).json({ message: 'Space ID is required' });
    }

    const fields = [];
    const values = [];

    // ✅ Basic fields
    if (space_name !== undefined) { fields.push('space_name = ?'); values.push(space_name); }
    if (space_type !== undefined) { fields.push('space_type = ?'); values.push(space_type); }
    if (min_capacity !== undefined) { fields.push('min_capacity = ?'); values.push(min_capacity); }
    if (max_capacity !== undefined) { fields.push('max_capacity = ?'); values.push(max_capacity); }

    // ✅ Pricing
    if (veg_price !== undefined) { fields.push('veg_price = ?'); values.push(veg_price); }
    if (veg_imfl_price !== undefined) { fields.push('veg_imfl_price = ?'); values.push(veg_imfl_price); }
    if (non_veg_price !== undefined) { fields.push('non_veg_price = ?'); values.push(non_veg_price); }
    if (non_veg_imfl_price !== undefined) { fields.push('non_veg_imfl_price = ?'); values.push(non_veg_imfl_price); }

    // ✅ Cuisine flags
    if (cuisine_indian !== undefined) { fields.push('cuisine_indian = ?'); values.push(cuisine_indian ? 1 : 0); }
    if (cuisine_chinese !== undefined) { fields.push('cuisine_chinese = ?'); values.push(cuisine_chinese ? 1 : 0); }
    if (cuisine_mughlai !== undefined) { fields.push('cuisine_mughlai = ?'); values.push(cuisine_mughlai ? 1 : 0); }
    if (cuisine_continental !== undefined) { fields.push('cuisine_continental = ?'); values.push(cuisine_continental ? 1 : 0); }
    if (cuisine_tandoori !== undefined) { fields.push('cuisine_tandoori = ?'); values.push(cuisine_tandoori ? 1 : 0); }
    if (cuisine_south_indian !== undefined) { fields.push('cuisine_south_indian = ?'); values.push(cuisine_south_indian ? 1 : 0); }
    if (cuisine_north_indian !== undefined) { fields.push('cuisine_north_indian = ?'); values.push(cuisine_north_indian ? 1 : 0); }
    if (cuisine_italian !== undefined) { fields.push('cuisine_italian = ?'); values.push(cuisine_italian ? 1 : 0); }
    if (cuisine_mexican !== undefined) { fields.push('cuisine_mexican = ?'); values.push(cuisine_mexican ? 1 : 0); }

    // ✅ Contact & Location
    if (contact_name !== undefined) { fields.push('contact_name = ?'); values.push(contact_name); }
    if (contact_number !== undefined) { fields.push('contact_number = ?'); values.push(contact_number); }
    if (city_id !== undefined) { fields.push('city_id = ?'); values.push(city_id); }
    if (pin_code !== undefined) { fields.push('pin_code = ?'); values.push(pin_code); }
    if (near_location_id !== undefined) { fields.push('near_location_id = ?'); values.push(near_location_id); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }

    // ✅ Image
    if (profile_picture) { fields.push('profile_picture = ?'); values.push(profile_picture); }

    // ✅ Status
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(spaceId);

    const sql = `UPDATE tbl_venue_spaces SET ${fields.join(', ')} WHERE space_id = ?`;

    await query(sql, values);

    // ✅ Return updated data
    const [rows] = await query(
      `SELECT * FROM tbl_venue_spaces WHERE space_id = ?`,
      [spaceId]
    );

    return res.status(200).json({
      message: 'Venue space updated successfully',
      data: rows[0]
    });

  } catch (error) {
    console.error('updateVenueSpace error:', error);
    return res.status(500).json({
      message: 'Error updating venue space',
      error: error.message || String(error)
    });
  }
};

// Delete Venue Spaces of Particular Venue
const deleteVenueSpace = async (req, res) => {
  const spaceId = req.params.spaceId;

  try {
    if (!spaceId) {
      return res.status(400).json({ message: 'Space ID is required' });
    }

    // 1. Get the record before deleting
    const [space] = await query(
      'SELECT * FROM tbl_venue_spaces WHERE space_id = ?',
      [spaceId]
    );

    if (!space) {
      return res.status(404).json({ message: 'Venue space not found' });
    }

    // 2. Delete the record
    await query(
      'DELETE FROM tbl_venue_spaces WHERE space_id = ?',
      [spaceId]
    );

    // 3. Send deleted data in response
    return res.status(200).json({
      message: 'Venue space deleted successfully',
      deletedData: space
    });

  } catch (error) {
    console.error('deleteVenueSpace error:', error);
    return res.status(500).json({
      message: 'Error deleting venue space',
      error: error.message || String(error)
    });
  }
};



module.exports = {
  registerVenue,
  verifyVenueOtp,
  resendVenueOtp,
  resendpasswordResetOtp,
  forgotPassword,
  resetPassword,
  loginVenue,
  uploadPortfolioImage,
  getPortfolioImages,
  deletePortfolioImage,
  uploadPortfolioVideo,
  getPortfolioVideos,
  deletePortfolioVideo,
  deleteVenueTransportation,
  upsertVenuePolicies,
  deleteVenuePolicies,
  createVenueServicePackages,
  updateVenueServicePackage,
  deleteVenueServicePackage,
  createVenueFaqs,
  updateVenueFaq,
  deleteVenueFaq,
  getVenueFaqs,
  getVenueById,
  updateVenueProfile,
  deleteVenue,
  getCountryList,
  getStateList,
  getCityList,
  getLocalityList,
  addOccassions,
  getOccassions,
  updateOccassions,
  deleteOccassions,
  addAmenities,
  getAmenities,
  updateAmenities,
  deleteAmenities,
  getAllVenues,
  getSimilarVenues,
  getlatestVenueTypeData,
  getVenueByCity,
  getVenuesByOccasion,
  searchOccasion,
  getuniqueBusinessTypes,
  getAllCitiesList,
  addVenueSpaces,
  getVenueSpaces,
  updateVenueSpace,
  deleteVenueSpace
};
