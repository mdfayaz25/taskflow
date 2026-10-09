import { Types } from 'mongoose';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';
import { emitToUser } from './realtime.js';

type Type = (typeof NOTIFICATION_TYPES)[number];

/** Creates a notification for each recipient except the actor and pushes it over the socket. */
export async function notify(opts: { recipients: (string | Types.ObjectId)[]; actor: string; board?: string; task?: string; type: Type; message: string }) {
  const ids = [...new Set(opts.recipients.map(String))].filter((id) => id !== opts.actor);
  if (!ids.length) return;
  const docs = await Notification.insertMany(
    ids.map((recipient) => ({ recipient, actor: opts.actor, board: opts.board, task: opts.task, type: opts.type, message: opts.message })),
  );
  const populated = await Notification.populate(docs, [{ path: 'actor', select: 'name avatarColor' }, { path: 'board', select: 'name color' }]);
  for (const n of populated) emitToUser(String(n.recipient), 'notification:new', n.toJSON());
}
