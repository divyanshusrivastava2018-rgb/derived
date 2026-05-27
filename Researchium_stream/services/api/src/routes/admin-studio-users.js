import { Router } from 'express';
import { requireApiKey } from '../middleware/require-api-key.js';
import { asyncHandler } from '../middleware/async-handler.js';
import * as adminUsers from '../services/admin-users.js';

export const adminStudioUsersRouter = Router();

adminStudioUsersRouter.use('/api/admin/studio-users', requireApiKey);

adminStudioUsersRouter.get(
  '/api/admin/studio-users',
  asyncHandler(async (_req, res) => {
    const users = await adminUsers.listStudioUsers();
    res.json({ users });
  })
);

adminStudioUsersRouter.post(
  '/api/admin/studio-users',
  asyncHandler(async (req, res) => {
    const { email, password, name, institution } = req.body || {};
    const user = await adminUsers.createStudioUser({ email, password, name, institution });
    res.status(201).json({ user });
  })
);

adminStudioUsersRouter.delete(
  '/api/admin/studio-users/:id',
  asyncHandler(async (req, res) => {
    await adminUsers.deleteStudioUser(req.params.id);
    res.status(204).end();
  })
);
