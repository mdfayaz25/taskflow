import { Router } from 'express';
import authRoutes from './auth.routes.js';
import boardRoutes from './board.routes.js';
import taskRoutes from './task.routes.js';
import notificationRoutes from './notification.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/boards', boardRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/notifications', notificationRoutes);
