import React from 'react';

// Tutarlı gösterge/sayaç/rozet. Saf sunum. Button deseninin gösterge eşi.
// tone: neutral | red | amber | green | phase
// size: sm | md   (desktop'ta KÜÇÜLMEZ — gerekiyorsa md kullan)
// className sona eklenir (override eder).

const BASE =
  'inline-flex items-center gap-1.5 rounded-xl border font-bold uppercase ' +
  'tracking-wider whitespace-nowrap leading-none';

const TONES = {
  neutral: 'bg-slate-800/70 text-slate-300 border-slate-700',
  red:     'bg-red-950/30 text-red-300 border-red-900/50',
  amber:   'bg-amber-950/30 text-amber-300 border-amber-900/50',
  green:   'bg-emerald-950/30 text-emerald-300 border-emerald-900/50',
  phase:   'bg-slate-800/70 text-slate-200 border-slate-700',
};

const SIZES = {
  sm: 'text-[10px] px-2 py-1',
  md: 'text-xs px-3 py-1.5',
};

export function StatBadge({ tone = 'neutral', size = 'sm', className = '', children, ...rest }) {
  const cls = `${BASE} ${SIZES[size] || SIZES.sm} ${TONES[tone] || TONES.neutral} ${className}`;
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

export default StatBadge;
