const crypto = require('crypto');

const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');

const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

module.exports = {
  generateVerificationToken,
  hashToken,
};
