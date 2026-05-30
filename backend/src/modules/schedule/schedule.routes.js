const { Router } = require('express');
const { requireAuthUser } = require('../../middlewares/requireAuthUser');
const scheduleController = require('./schedule.controller');

const scheduleRouter = Router();

scheduleRouter.get('/events', requireAuthUser, scheduleController.listEvents);
scheduleRouter.post('/events', requireAuthUser, scheduleController.createEvent);
scheduleRouter.put('/events/:id', requireAuthUser, scheduleController.updateEvent);
scheduleRouter.delete('/events/:id', requireAuthUser, scheduleController.deleteEvent);
scheduleRouter.post('/sync', requireAuthUser, scheduleController.syncEvents);
scheduleRouter.get('/conflicts', requireAuthUser, scheduleController.getConflicts);

module.exports = { scheduleRouter };
