import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [notifications, unread] = await Promise.all([
      Notification.find({ recipient: req.user!.id }).sort({ createdAt: -1 }).limit(40).populate('actor', 'name avatarColor').populate('board', 'name color'),
      Notification.countDocuments({ recipient: req.user!.id, read: false }),
    ]);
    res.json({ notifications, unread });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ recipient: req.user!.id, read: false }, { read: true });
    res.json({ ok: true });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, recipient: req.user!.id }, { read: true });
    res.json({ ok: true });
  }),
);

export default router;
