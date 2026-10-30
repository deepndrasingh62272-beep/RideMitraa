/**
 * Face verification utility using AWS Rekognition.
 * Compares a driver's live selfie URL against their government ID photo URL.
 *
 * Requires env vars:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *
 * Both URLs must be publicly accessible (Cloudinary secure URLs work fine).
 * For production, prefer passing S3 object references instead of URLs.
 */

const https = require('https');

// Lazy-load AWS SDK so the app still boots without it (graceful degradation)
let RekognitionClient, CompareFacesCommand;
try {
  ({ RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition'));
} catch {
  // SDK not installed — face verification will be skipped
}

const SIMILARITY_THRESHOLD = parseFloat(process.env.FACE_SIMILARITY_THRESHOLD) || 90;

/**
 * Downloads an image from a URL and returns a Buffer.
 */
const fetchImageBuffer = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });

/**
 * Compares two face images.
 * @param {string} selfieUrl   - Cloudinary URL of the live selfie
 * @param {string} govtIdUrl   - Cloudinary URL of the government ID photo
 * @returns {{ match: boolean, similarity: number, skipped: boolean }}
 */
const compareFaces = async (selfieUrl, govtIdUrl) => {
  if (!RekognitionClient) {
    console.warn('[FaceVerification] AWS SDK not installed — skipping face match');
    return { match: false, similarity: 0, skipped: true };
  }

  const [selfieBytes, govtIdBytes] = await Promise.all([
    fetchImageBuffer(selfieUrl),
    fetchImageBuffer(govtIdUrl),
  ]);

  const client = new RekognitionClient({ region: process.env.AWS_REGION || 'ap-south-1' });

  const command = new CompareFacesCommand({
    SourceImage: { Bytes: selfieBytes },
    TargetImage: { Bytes: govtIdBytes },
    SimilarityThreshold: SIMILARITY_THRESHOLD,
  });

  const response = await client.send(command);
  const topMatch = response.FaceMatches?.[0];
  const similarity = topMatch?.Similarity ?? 0;

  return {
    match:      similarity >= SIMILARITY_THRESHOLD,
    similarity: parseFloat(similarity.toFixed(2)),
    skipped:    false,
  };
};

module.exports = { compareFaces };
