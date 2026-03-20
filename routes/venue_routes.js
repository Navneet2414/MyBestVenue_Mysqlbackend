const express = require('express');
const router = express.Router();
const venueController = require('../controller/venue_controller');
const { uploadVenueProfilePictureToS3 } = require('../middlewares/upload_profile_picture_s3');

router.post('/register', uploadVenueProfilePictureToS3, venueController.registerVenue);
router.post('/verify-otp', venueController.verifyVenueOtp);
router.post('/resend-otp', venueController.resendVenueOtp);
router.post('/resend-password-reset-otp', venueController.resendpasswordResetOtp);
router.post('/forgot-password', venueController.forgotPassword);
router.post('/reset-password', venueController.resetPassword);
router.post('/login', venueController.loginVenue);
router.get('/list', venueController.getAllVenues);
router.get('/getVenueByCity/:cityId', venueController.getVenueByCity);

router.get('/venue-types/latest', venueController.getlatestVenueTypeData);
router.get('/similar/:id', venueController.getSimilarVenues);
router.get('/get-venue-details/:id', venueController.getVenueById);
router.put('/update-venue-details/:id', uploadVenueProfilePictureToS3, venueController.updateVenueProfile);
router.delete('/delete-venue/:id', venueController.deleteVenue);

// country ,state, city
router.get('/countries', venueController.getCountryList);
router.get('/states/:countryId', venueController.getStateList);
router.get('/cities/:stateId', venueController.getCityList);
router.get('/localities/:city_id', venueController.getLocalityList);
// get All citiesList name  Api 
router.get('/cities-list', venueController.getAllCitiesList);



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

// search occasion by name
router.get('/search-occasion', venueController.searchOccasion);

router.get('/getVenuesByOccasion/:occasionId', venueController.getVenuesByOccasion);
// get unique business types
router.get('/unique-business-types', venueController.getuniqueBusinessTypes);



// venue spaces
router.post('/create-venue-spaces/:id', uploadVenueProfilePictureToS3, venueController.addVenueSpaces);
router.get('/venue-spaces/:id', venueController.getVenueSpaces);
router.put('/venue-spaces/update/:spaceId', uploadVenueProfilePictureToS3, venueController.updateVenueSpace);
router.delete('/venue-spaces/delete/:spaceId', venueController.deleteVenueSpace);

module.exports = router;
