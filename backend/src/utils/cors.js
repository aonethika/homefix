const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://zoon-gilt.vercel.app',
  ...configuredOrigins,
]);

export const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Upload-Session'],
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/$/, '');
    if (!origin || allowedOrigins.has(normalizedOrigin)) {
      callback(null, true);
      return;
    }
    callback(Object.assign(new Error(`Origin ${origin} is not allowed`), { status: 403 }));
  },
};
