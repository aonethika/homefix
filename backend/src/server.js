import { runAppointmentReminders } from './services/booking.service.js';
import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { initSocket } from './socket/socket.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  const remind = () => runAppointmentReminders().catch(() => logger.error('Appointment reminders temporarily unavailable; will retry.'));
  remind();
  const timer = setInterval(remind, 60000);
  timer.unref();
  httpServer.on('close', () => clearInterval(timer));
  logger.info(`🏠 zoon Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Stop the duplicate backend process or set a different PORT in backend/.env.`);
  } else {
    logger.error('HTTP server failed to start', { message: error.message, stack: error.stack });
  }
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
  process.exit(1);
});
