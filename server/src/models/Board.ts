import { Schema, model, type InferSchemaType } from 'mongoose';

export const BOARD_ROLES = ['admin', 'member', 'viewer'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

const columnSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  color: { type: String, default: '#94A3B8' },
  isDone: { type: Boolean, default: false },
});

const boardSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 280, default: '' },
    color: { type: String, default: '#5E5CE6' },
    icon: { type: String, default: 'layout' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: BOARD_ROLES, default: 'member' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    columns: [columnSchema],
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

boardSchema.index({ 'members.user': 1 });

export type BoardType = InferSchemaType<typeof boardSchema>;
export const Board = model('Board', boardSchema);
