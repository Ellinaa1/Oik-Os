const { Router } = require('express');
const { requireAuthUser } = require('../../middlewares/requireAuthUser');
const scheduleController = require('./schedule.controller');

const scheduleRouter = Router();

scheduleRouter.post('/events', requireAuthUser, scheduleController.createEvent);
scheduleRouter.post('/sync', requireAuthUser, scheduleController.syncEvents);
scheduleRouter.get('/conflicts', requireAuthUser, scheduleController.getConflicts);

module.exports = { scheduleRouter };
