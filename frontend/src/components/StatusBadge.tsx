import { STATUS_COLORS, STATUS_LABELS } from '@/utils/formatTime';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const colorClass =
    STATUS_COLORS[status] ||
    'text-[#a8a29e] bg-[#2a2a30] border border-[#3a3a40]';

  const label = STATUS_LABELS[status] || status;

  const sizeClass =
    size === 'sm'
      ? 'text-[9px] px-1.5 py-0.5'
      : 'text-[11px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1';

  return (
    <span
      className={`${colorClass} ${sizeClass} rounded-full font-medium inline-flex items-center gap-1`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}