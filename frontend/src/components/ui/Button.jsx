import React from 'react';

// Tek tasarım dili: tüm butonlar bunu kullanır. Saf sunum; mantık yok.
// variant: primary | accent | neutral | danger | chip
// size:    sm | md | lg
// className: konumlandırma/animasyon/aktif-durum için sona eklenir (override eder).

const BASE =
  'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-widest ' +
  'transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  primary: 'bg-blood-red hover:bg-red-800 text-white border border-blood-red shadow-[0_0_20px_rgba(127,29,29,0.4)]',
  accent:  'bg-accent hover:bg-amber-700 text-white border border-accent shadow-[0_0_20px_rgba(217,119,6,0.4)]',
  neutral: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  danger:  'bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-900/60',
  chip:    'bg-slate-900/60 hover:text-white text-slate-400 border border-slate-700',
};

// Radius variant'a göre TEK utility olarak üretilir (chip tam yuvarlak, diğerleri
// rounded-xl). Aynı border-radius için iki utility yan yana basmak Tailwind emit
// sırasına güvenmek demek — kırılgan; bu yüzden tek radius üretilir.
const RADIUS = { chip: 'rounded-full' };

// Chip aktif durumu TEK set olarak üretilir (base chip sınıfları üzerine
// çakışan bg/text/border katmanlamak Tailwind emit sırasına güvenmek demek —
// radius'ta olduğu gibi kırılgan; bu yüzden aktif/pasif ayrık sınıf seti).
const CHIP_ACTIVE = 'bg-blood-red hover:bg-red-800 text-white border border-blood-red';

const SIZES = {
  sm: 'text-[10px] px-3 py-1.5',
  md: 'text-xs px-5 py-3',
  lg: 'text-sm px-6 py-3.5',
};

export function Button({ variant = 'primary', size = 'md', type = 'button', pill = false, active = false, className = '', children, ...rest }) {
  const radius = pill ? 'rounded-full' : (RADIUS[variant] || 'rounded-xl');
  const variantCls = variant === 'chip'
    ? (active ? CHIP_ACTIVE : VARIANTS.chip)
    : (VARIANTS[variant] || VARIANTS.primary);
  const cls = `${BASE} ${SIZES[size] || SIZES.md} ${radius} ${variantCls} ${className}`;
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ 'aria-label': ariaLabel, type = 'button', className = '', children, ...rest }) {
  const cls =
    'inline-flex items-center justify-center p-1.5 rounded-full text-slate-500 ' +
    'hover:text-white hover:bg-slate-800 transition-colors active:scale-95 ' +
    'disabled:opacity-50 disabled:pointer-events-none ' + className;
  return (
    <button type={type} aria-label={ariaLabel} className={cls} {...rest}>
      {children}
    </button>
  );
}

export default Button;
