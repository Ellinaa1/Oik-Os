const { asyncHandler } = require('../../utils/asyncHandler');
const scheduleService = require('./schedule.service');

const createEvent = asyncHandler(async (req, res) => {
  const result = await scheduleService.createEvent({
    payload: req.body || {},
    creatorUser: req.user,
  });

  res.status(result.statusCode).json({ event: result.event });
});

const syncEvents = asyncHandler(async (req, res) => {
  const result = await scheduleService.syncEvents({
    payload: req.body || {},
    user: req.user,
  });

  res.status(result.statusCode).json({ syncedEventIds: result.syncedEventIds });
});

const getConflicts = asyncHandler(async (req, res) => {
  const result = await scheduleService.listUnresolvedConflicts({ user: req.user });
  res.status(result.statusCode).json({ conflicts: result.conflicts });
});

module.exports = {
  createEvent,
  syncEvents,
  getConflicts,
};
