import type { MiniUser } from '@/types';
import { Avatar } from './ui/Avatar';

export function AvatarStack({ users, max = 4, size = 24, live }: { users: MiniUser[]; max?: number; size?: number; live?: Set<string> }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((u) => (
        <span key={u.id} className="relative" title={live?.has(u.id) ? `${u.name} is viewing` : u.name}>
          <Avatar name={u.name} color={u.avatarColor} size={size} />
          {live?.has(u.id) && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />}
        </span>
      ))}
      {extra > 0 && (
        <span className="tabular grid place-items-center rounded-full bg-surface-2 font-semibold text-muted ring-2 ring-surface" style={{ width: size, height: size, fontSize: size * 0.4 }}>
          +{extra}
        </span>
      )}
    </div>
  );
}
