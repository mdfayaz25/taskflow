import { Schema, model } from 'mongoose';

const commentSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
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

export const Comment = model('Comment', commentSchema);
