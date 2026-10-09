import { Schema, model } from 'mongoose';

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const taskSchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    column: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    labels: [{ type: String, trim: true, maxlength: 24 }],
    dueDate: Date,
    order: { type: Number, required: true },
    checklist: [{ text: { type: String, required: true, maxlength: 140 }, done: { type: Boolean, default: false } }],
    commentCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: Date,
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

taskSchema.index({ assignees: 1, dueDate: 1 });

export const Task = model('Task', taskSchema);
