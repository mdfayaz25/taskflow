import { Schema, model } from 'mongoose';

export const NOTIFICATION_TYPES = ['assigned', 'commented', 'moved', 'completed', 'added_to_board', 'due_soon'] as const;

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    board: { type: Schema.Types.ObjectId, ref: 'Board' },
    task: { type: Schema.Types.ObjectId, ref: 'Task' },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Notification = model('Notification', notificationSchema);
