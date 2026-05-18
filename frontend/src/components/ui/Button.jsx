import React from 'react';

// Tek tasarım dili: tüm butonlar bunu kullanır. Saf sunum; mantık yok.
// variant: primary | accent | neutral | danger | chip
// size:    sm | md | lg     (chip'te radius full'a override edilir)
// className: konumlandırma/animasyon/aktif-durum için sona eklenir (override eder).

const BASE =
  'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-widest ' +
  'transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  primary: 'bg-blood-red hover:bg-red-800 text-white border border-blood-red shadow-[0_0_20px_rgba(127,29,29,0.4)]',
  accent:  'bg-accent hover:bg-amber-700 text-white border border-accent shadow-[0_0_20px_rgba(217,119,6,0.4)]',
  neutral: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  danger:  'bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-900/60',
  chip:    'bg-slate-900/60 hover:text-white text-slate-400 border border-slate-700 rounded-full',
};

const SIZES = {
  sm: 'text-[10px] px-3 py-1.5 rounded-xl',
  md: 'text-xs px-5 py-3 rounded-xl',
  lg: 'text-sm px-6 py-3.5 rounded-xl',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }) {
  // chip variant kendi radius'unu (rounded-full) VARIANTS'ta verir; SIZES'taki
  // rounded-xl'i ezmesi için variant sınıfı size'dan SONRA gelir.
  const cls = `${BASE} ${SIZES[size] || SIZES.md} ${VARIANTS[variant] || VARIANTS.primary} ${className}`;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ 'aria-label': ariaLabel, className = '', children, ...rest }) {
  const cls =
    'inline-flex items-center justify-center p-1.5 rounded-full text-slate-500 ' +
    'hover:text-white hover:bg-slate-800 transition-colors active:scale-95 ' +
    'disabled:opacity-50 disabled:pointer-events-none ' + className;
  return (
    <button aria-label={ariaLabel} className={cls} {...rest}>
      {children}
    </button>
  );
}

export default Button;
