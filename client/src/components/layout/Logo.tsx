import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="TaskFlow home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#5E5CE6" />
        <rect x="7" y="8" width="5" height="16" rx="2" fill="#fff" />
        <rect x="13.5" y="8" width="5" height="11" rx="2" fill="#fff" opacity=".8" />
        <rect x="20" y="8" width="5" height="7" rx="2" fill="#fff" opacity=".6" />
      </svg>
      <span className="font-display text-[17px] font-extrabold tracking-tight">TaskFlow</span>
    </Link>
  );
}
