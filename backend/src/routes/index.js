const { Router } = require('express');
const { authRouter } = require('../modules/auth/auth.routes');
const { householdsRouter } = require('../modules/households/households.routes');

const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/households', householdsRouter);

module.exports = { apiRouter };
