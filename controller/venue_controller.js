const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getConnection } = require('../config/db');
// const { ensureVenuesTable } = require('../models/table_venues');

const EMAIL_REGEX = /^[a-zA-Z0-9](\.?[a-zA-Z0-9_-])*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;

const toBoolInt = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  if (value === false || value === 'false' || value === 0 || value === '0') return 0;
  return null;
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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

const parseIdList = (value) => {
  if (value === undefined) return null;
  if (value === null) return [];

  const arr = Array.isArray(value) ? value : String(value).split(',');
  const ids = arr
    .map((v) => Number(String(v).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  return [...new Set(ids)];
};

const registerVenue = async (req, res) => {
  const { businessName, businessType, contactName, email, phone, password } = req.body;

  try {
    const normalizedBusinessType = String(businessType || 'venue').toLowerCase();

    if (!businessName || !businessType || !contactName || !email || !phone || !password) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (normalizedBusinessType !== 'venue') {
      return res.status(400).json({ message: 'businessType must be venue' });
    }

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
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const vendor = rows[0];
    if (Number(vendor.isVerified) === 1) {
      return res.status(400).json({ message: 'Vendor already verified' });
    }

    const otpMatches = String(otp).trim() === String(vendor.otp || '').trim();
    const otpExpired = !vendor.otpExpires || Number(vendor.otpExpires) < Date.now();

    if (!otpMatches || otpExpired) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    await query('UPDATE tbl_venue SET isVerified = 1, otp = NULL, otpExpires = NULL WHERE venue_id = ?', [vendor.id]);

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

    return res.status(200).json({
      message: 'Password reset OTP generated successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (error) {
    console.error('resendpasswordResetOtp error:', error);
    return res.status(500).json({ message: 'Error resending password reset OTP', error: error.message || String(error) });
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
    const amenityIds = parseIdList(body.amenity_ids ?? body.amenityIds);
    const occasionIds = parseIdList(body.occasion_ids ?? body.occasionIds);

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
      if (!hasAmenityUpdate && !hasOccasionUpdate) {
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

    const [updatedRows] = await conn.query(
      'SELECT venue_id AS id, businessName, businessType, contactName, email, phone, isPremium, profilePicture, address, city_id AS city, state_id AS state, country_id AS country, pinCode, nearLocation, status, updatedAt FROM tbl_venue WHERE venue_id = ? LIMIT 1',
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

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      vendor: updatedRows[0],
      amenities: amenityRows,
      occasions: occasionRows,
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

    // await ensureVenuesTable({ query });

    const [rows] = await query(
      `SELECT
        v.venue_id AS id, v.businessName, v.businessType, v.contactName, v.email, v.phone,
        v.profilePicture, v.address,
        v.city_id AS city_id, c.city_name AS city,
        v.state_id AS state_id, s.state_name AS state,
        v.country_id AS country_id, co.country_name AS country,
        v.pinCode,
        COALESCE(l.locality_name, v.nearLocation) AS nearLocation,
        v.description, v.status, v.isVerified, v.isApproved, v.isPremium, v.venueCapacity, v.views, v.updatedAt
       FROM tbl_venue v
       LEFT JOIN tbl_city c ON c.city_id = v.city_id
       LEFT JOIN tbl_state s ON s.state_id = v.state_id
       LEFT JOIN tbl_country co ON co.country_id = v.country_id
       LEFT JOIN tbl_locality l ON v.nearLocation REGEXP '^[0-9]+$' AND l.locality_id = CAST(v.nearLocation AS UNSIGNED)
       WHERE v.venue_id = ?
       LIMIT 1`,
      [vendorId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const vendor = rows[0];
    const [amenityRows] = await query(
      `SELECT a.amenity_id, a.amenity_name, a.active
       FROM tbl_venue_amenities va
       INNER JOIN tbl_amenities a ON a.amenity_id = va.amenity_id
       WHERE va.venue_id = ?
       ORDER BY a.amenity_name ASC`,
      [vendorId]
    );

    const [occasionRows] = await query(
      `SELECT o.occasion_id, o.occasion_name, o.active
       FROM tbl_venue_occasion vo
       INNER JOIN tbl_occasion o ON o.occasion_id = vo.occasion_id
       WHERE vo.venue_id = ?
       ORDER BY o.occasion_name ASC`,
      [vendorId]
    );

    const slug = (value, fallback) =>
      String(value || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    const seoUrl = `/${slug(vendor.city, 'location')}/${slug(vendor.businessType, 'vendor')}/${slug(vendor.businessName, 'business')}-in-${slug(vendor.nearLocation, 'area')}`;

    return res.status(200).json({
      message: 'Venue found successfully',
      venue: {
        ...vendor,
        seoUrl,
        amenities: amenityRows,
        occasions: occasionRows,
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
const  deleteOccassions = async (req,res)=> {
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



module.exports = {
  registerVenue,
  verifyVenueOtp,
  resendVenueOtp,
  resendpasswordResetOtp,
  loginVenue,
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
  deleteAmenities
};
