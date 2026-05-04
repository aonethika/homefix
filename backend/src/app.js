import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import requestRoutes from './routes/request.routes.js';
import workerRoutes from './routes/worker.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import ratingRoutes from './routes/rating.routes.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ratings', ratingRoutes);

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use(errorHandler);

export default app;
