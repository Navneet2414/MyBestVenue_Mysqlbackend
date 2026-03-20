const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin_controller');
const { adminAuth } = require('../middlewares/auth');

router.post('/register', adminController.registerAdmin);
router.post('/verify-otp', adminController.verifyAdminOtp);
router.post('/resend-otp', adminController.resendAdminOtp);
router.post('/login', adminController.loginAdmin);
// Api route to Approve registered Venue by Admin
router.post('/approve-venue/:id', adminAuth, adminController.approveVenue);

module.exports = router;
