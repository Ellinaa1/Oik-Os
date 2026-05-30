const { Router } = require('express');
const { requireAuthUser } = require('../../middlewares/requireAuthUser');
const membersController = require('./members.controller');

const membersRouter = Router();

membersRouter.get('/me/preferences', requireAuthUser, membersController.getMyPreferences);
membersRouter.put('/me/preferences', requireAuthUser, membersController.updateMyPreferences);

module.exports = { membersRouter };
