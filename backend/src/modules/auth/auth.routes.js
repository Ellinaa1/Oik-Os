const { Router } = require('express');
const authController = require('./auth.controller');

const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.get('/verify', authController.verifyEmail);

module.exports = { authRouter };
