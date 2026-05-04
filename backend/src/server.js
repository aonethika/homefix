import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { initSocket } from './socket/socket.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`🏠 HomeFix Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
  process.exit(1);
});
