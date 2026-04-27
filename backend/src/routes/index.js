const { Router } = require('express');
const { authRouter } = require('../modules/auth/auth.routes');

const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);

module.exports = { apiRouter };
