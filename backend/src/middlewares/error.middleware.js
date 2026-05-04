import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Record already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
  }

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};
