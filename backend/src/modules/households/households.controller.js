const { asyncHandler } = require('../../utils/asyncHandler');
const householdsService = require('./households.service');

const createHousehold = asyncHandler(async (req, res) => {
  const result = await householdsService.createHousehold({
    payload: req.body || {},
    creatorUser: req.user,
  });

  res.status(result.statusCode).json({ household: result.household });
});

module.exports = {
  createHousehold,
};
