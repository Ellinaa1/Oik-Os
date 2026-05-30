const { asyncHandler } = require('../../utils/asyncHandler');
const membersService = require('./members.service');

const getMyPreferences = asyncHandler(async (req, res) => {
  const result = await membersService.getMyPreferences({ user: req.user });
  res.status(result.statusCode).json(result.preferences);
});

const updateMyPreferences = asyncHandler(async (req, res) => {
  const result = await membersService.updateMyPreferences({
    user: req.user,
    payload: req.body || {},
  });

  res.status(result.statusCode).json(result.preferences);
});

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};
