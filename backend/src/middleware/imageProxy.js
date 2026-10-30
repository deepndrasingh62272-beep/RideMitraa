/**
 * Image Proxy Middleware
 * 
 * Proxies external image requests through the backend to:
 * 1. Handle CORS issues
 * 2. Cache images to reduce API calls
 * 3. Add error handling and fallback avatars
 * 4. Sanitize and validate image URLs
 */

const axios = require('axios');
const NodeCache = require('node-cache');

// Cache images for 24 hours
const imageCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// Fallback avatar (base64 encoded 1x1 transparent PNG)
const FALLBACK_AVATAR = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Proxy image request
 * GET /api/image-proxy?url=<encoded-url>
 */
const proxyImage = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required',
      });
    }

    // Decode URL
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL encoding',
      });
    }

    // Validate URL (only allow http/https)
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        error: 'Only HTTP/HTTPS URLs are allowed',
      });
    }

    // Check cache
    const cacheKey = 'image:' + decodedUrl;
    const cachedImage = imageCache.get(cacheKey);
    if (cachedImage) {
      console.log('[ImageProxy] Cache hit for:', decodedUrl);
      res.set('Content-Type', cachedImage.contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(cachedImage.data);
    }

    // Fetch image
    console.log('[ImageProxy] Fetching image from:', decodedUrl);
    const response = await axios.get(decodedUrl, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        'User-Agent': 'RideMitra/1.0',
      },
    });

    const contentType = response.headers['content-type'] || 'image/png';
    const imageData = Buffer.from(response.data);

    // Cache the image
    imageCache.set(cacheKey, {
      data: imageData,
      contentType: contentType,
    });

    // Return image
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(imageData);
  } catch (error) {
    console.error('[ImageProxy] Error:', error.message);

    // Return fallback avatar on error
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(FALLBACK_AVATAR);
  }
};

/**
 * Get image URL for proxying
 * Encodes a URL for use with the image proxy
 */
const getProxyUrl = (imageUrl) => {
  return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
};

/**
 * Clear image cache
 */
const clearCache = () => {
  imageCache.flushAll();
  console.log('[ImageProxy] Cache cleared');
};

module.exports = {
  proxyImage,
  getProxyUrl,
  clearCache,
};
