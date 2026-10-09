import { Briefcase, Globe, Layout, Megaphone, Rocket, Smartphone, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BOARD_ICONS: Record<string, LucideIcon> = { layout: Layout, globe: Globe, smartphone: Smartphone, megaphone: Megaphone, rocket: Rocket, target: Target, briefcase: Briefcase, sparkles: Sparkles };
export const BOARD_COLORS = ['#5E5CE6', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'];

export function BoardIcon({ icon, color, size = 32, className }: { icon: string; color: string; size?: number; className?: string }) {
  const Icon = BOARD_ICONS[icon] ?? Layout;
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-[30%] text-white', className)} style={{ width: size, height: size, background: `linear-gradient(140deg, ${color}, ${color}cc)` }}>
      <Icon style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.2} />
    </span>
  );
}
