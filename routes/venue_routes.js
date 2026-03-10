const express = require('express');
const router = express.Router();
const venueController = require('../controller/venue_controller');

router.post('/register', venueController.registerVenue);
router.post('/verify-otp', venueController.verifyVenueOtp);
router.post('/resend-otp', venueController.resendVenueOtp);
router.post('/resend-password-reset-otp', venueController.resendpasswordResetOtp);
router.post('/login', venueController.loginVenue);
router.get('/get-venue-details/:id', venueController.getVenueById);
router.put('/update-venue-details/:id', venueController.updateVenueProfile);
router.delete('/delete-venue/:id', venueController.deleteVenue);

// country ,state, city
router.get('/countries', venueController.getCountryList);
router.get('/states/:countryId', venueController.getStateList);
router.get('/cities/:stateId', venueController.getCityList);
router.get('/localities/:city_id', venueController.getLocalityList);

// add occassions
router.post('/add-occassions', venueController.addOccassions);
// get occassions
router.get('/occassions', venueController.getOccassions);
// update occassions
router.put('/update-occassions/:occasionId', venueController.updateOccassions);
// delete occassions
router.delete('/delete-occassions/:occasionId', venueController.deleteOccassions);

// add amenities
router.post('/add-amenities', venueController.addAmenities);
// get amenities
router.get('/amenities', venueController.getAmenities);
// update amenities
router.put('/update-amenities/:amenityId', venueController.updateAmenities);
// delete amenities
router.delete('/delete-amenities/:amenityId', venueController.deleteAmenities);



// 







module.exports = router;
