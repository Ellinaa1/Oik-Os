const { asyncHandler } = require('../../utils/asyncHandler');
const authService = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body || {});
  res.status(result.statusCode).json({ message: result.message });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail({ token: req.query.token });
  res.status(result.statusCode).json({ message: result.message });
});

module.exports = {
  register,
  verifyEmail,
};
