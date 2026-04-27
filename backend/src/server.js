require('dotenv').config();
const { app } = require('./app');
const { initDb } = require('./db/connection');
const { env } = require('./config/env');
const { logger } = require('./config/logger');

const bootstrap = async () => {
  await initDb();

  app.listen(env.port, () => {
    logger.info('Server started', {
      port: env.port,
      nodeEnv: env.nodeEnv,
    });
  });
};

bootstrap().catch((error) => {
  logger.error('Failed to start server', { message: error.message, stack: error.stack });
  process.exit(1);
});
