const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for KYC documents
// Note: 'private' type requires a paid Cloudinary plan — use 'upload' for free tier
const kycStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ridesharing/kyc',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    resource_type: 'image',
  },
});

const uploadKYC = multer({
  storage: kycStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Storage for ride photos (public, visible to both parties)
const ridePhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ridesharing/ride-photos',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    resource_type: 'image',
    transformation: [{ width: 1280, height: 960, crop: 'limit', quality: 'auto' }],
  },
});

const uploadRidePhoto = multer({
  storage: ridePhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Storage for profile photos
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ridesharing/profile-photos',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    resource_type: 'image',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
  },
});

const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = { cloudinary, uploadKYC, uploadRidePhoto, uploadProfilePhoto };
