const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX   = process.env.FIELD_ENCRYPTION_KEY; // 64-char hex = 32 bytes

/**
 * Returns a 32-byte Buffer key from the env variable.
 * Throws clearly if misconfigured so the server won't silently use a weak key.
 */
const getKey = () => {
  if (!KEY_HEX || KEY_HEX.length !== 64)
    throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  return Buffer.from(KEY_HEX, 'hex');
};

/**
 * Encrypts a string value.
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex-encoded).
 */
const encrypt = (plaintext) => {
  if (plaintext == null) return plaintext;
  const key = getKey();
  const iv  = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypts a value produced by encrypt().
 * Returns the original plaintext string, or null on failure.
 */
const decrypt = (ciphertext) => {
  if (ciphertext == null) return ciphertext;
  try {
    const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
    const key     = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null; // tampered or wrong key
  }
};

/**
 * Mongoose plugin — encrypts listed fields before save, decrypts after find.
 * Usage: schema.plugin(encryptFields, { fields: ['phone', 'email'] })
 */
const encryptFieldsPlugin = (schema, options = {}) => {
  const fields = options.fields || [];

  schema.pre('save', function (next) {
    for (const field of fields) {
      if (this.isModified(field) && this[field]) {
        this[field] = encrypt(this[field]);
      }
    }
    next();
  });

  // Decrypt after any find-type query
  const decryptDoc = (doc) => {
    if (!doc) return;
    for (const field of fields) {
      if (doc[field]) doc[field] = decrypt(doc[field]);
    }
  };

  schema.post('find',    (docs) => docs.forEach(decryptDoc));
  schema.post('findOne', decryptDoc);
  schema.post('findOneAndUpdate', decryptDoc);
};

module.exports = { encrypt, decrypt, encryptFieldsPlugin };
