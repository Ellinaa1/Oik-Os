const { Router } = require('express');
const { requireAuthUser } = require('../../middlewares/requireAuthUser');
const householdsController = require('./households.controller');

const householdsRouter = Router();

householdsRouter.post('/', requireAuthUser, householdsController.createHousehold);

module.exports = { householdsRouter };
