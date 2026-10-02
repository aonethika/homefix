import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  const sensitive = req.path.includes('professional-register') || req.path.includes('/uploads');
  if (sensitive) logger.error('KYC request failed', { status: err.status || 500, code: err.code, path: req.path });
  else logger.error(err.message, { stack: err.stack, path: req.path });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2034') {
      return res.status(409).json({ success: false, message: 'This request changed while you were responding. Refresh and try again.' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Record already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    if (err.code === 'P2021' || err.code === 'P2022') {
      return res.status(503).json({ success: false, message: 'Zoon is temporarily unavailable. Please try again shortly.' });
    }
  }

  return res.status(err.status || 500).json({
    success: false,
    message: !err.status || err.status >= 500 ? 'Something went wrong on our side. Please try again shortly.' : err.message || 'We could not complete that. Please try again.',
  });
};
