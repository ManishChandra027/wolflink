import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { getDatabaseStatus } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { authRoutes } from './routes/authRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { conversationRoutes } from './routes/conversationRoutes.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './services/emailService.js';

export function createApp(config, dependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ data: { service: 'wolflink-api', status: 'ok' } });
  });

  app.get('/api/ready', (_req, res) => {
    const database = getDatabaseStatus();
    const status = database === 'connected' ? 200 : 503;
    res.status(status).json({ data: { service: 'wolflink-api', status: database === 'connected' ? 'ready' : 'not_ready', database } });
  });

  app.use('/api/auth', authRoutes(config, {
    sendEmail: dependencies.sendEmail || sendVerificationEmail,
    sendPasswordResetEmail: dependencies.sendPasswordResetEmail || sendPasswordResetEmail,
  }));
  app.use('/api/users', userRoutes(config));
  app.use('/api/conversations', conversationRoutes(config));

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
