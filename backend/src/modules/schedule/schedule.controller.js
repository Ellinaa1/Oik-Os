const { asyncHandler } = require('../../utils/asyncHandler');
const scheduleService = require('./schedule.service');

const listEvents = asyncHandler(async (req, res) => {
  const result = await scheduleService.listEvents({
    query: req.query || {},
    user: req.user,
  });

  res.status(result.statusCode).json({
    householdId: result.householdId,
    members: result.members,
    events: result.events,
  });
});

const createEvent = asyncHandler(async (req, res) => {
  const result = await scheduleService.createEvent({
    payload: req.body || {},
    creatorUser: req.user,
  });

  res.status(result.statusCode).json({ event: result.event });
});

const updateEvent = asyncHandler(async (req, res) => {
  const result = await scheduleService.updateEvent({
    eventId: req.params.id,
    payload: req.body || {},
    user: req.user,
  });

  res.status(result.statusCode).json({ event: result.event });
});

const deleteEvent = asyncHandler(async (req, res) => {
  const result = await scheduleService.deleteEvent({
    eventId: req.params.id,
    user: req.user,
  });

  res.status(result.statusCode).json({
    eventId: result.eventId,
    deletedAt: result.deletedAt,
  });
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
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
  getConflicts,
};
