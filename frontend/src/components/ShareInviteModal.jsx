import React, { useEffect, useState } from 'react';
import { X, Copy, Share2, QrCode, Check } from 'lucide-react';
import QRCode from 'qrcode';

// Davet linki/QR daima public domain üzerinden (yerel/preview origin değil).
// Gerekirse VITE_PUBLIC_URL ile geçersiz kılınır.
const PUBLIC_BASE = (import.meta.env.VITE_PUBLIC_URL || 'https://kuyu.click').replace(/\/+$/, '');

function ShareInviteModal({ roomCode, onClose, showToast }) {
  const url = `${PUBLIC_BASE}/?room=${roomCode}`;
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: '#fca5a5', light: '#020617' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [url]);

  // ESC ile kapan
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast?.(url);
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: 'KUYU - Köy Daveti',
        text: `KUYU oyununa katıl! Köy mührü: ${roomCode}`,
        url,
      });
    } catch (e) {
      if (e?.name !== 'AbortError') showToast?.('Paylaşım başarısız');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-dark-bg border border-accent/40 rounded-2xl shadow-[0_0_60px_rgba(217,119,6,0.3)] overflow-hidden animate-in zoom-in-95 duration-200 relative"
      >
        {/* Üst başlık */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-accent/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] font-serif text-accent">Köy Daveti</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-colors" title="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-5 flex flex-col items-center gap-4">
          {/* Oda kodu büyük */}
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em] mb-1">Köy Mührü</p>
            <p className="font-mono text-3xl font-black tracking-[0.3em] text-accent selectable">{roomCode}</p>
          </div>

          {/* QR kod */}
          <div className="relative">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR kod"
                className="w-56 h-56 rounded-xl border border-accent/30 shadow-[0_0_24px_rgba(252,165,165,0.15)]"
              />
            ) : (
              <div className="w-56 h-56 rounded-xl border border-slate-800 flex items-center justify-center">
                <QrCode size={48} className="text-slate-700 animate-pulse" />
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest leading-relaxed">Telefonla QR'ı oku<br />veya aşağıdaki linki paylaş</p>

          {/* URL kutusu */}
          <div className="w-full bg-black/60 border border-slate-800 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <span className="text-[11px] text-slate-300 font-mono truncate flex-1 selectable">{url}</span>
          </div>

          {/* Aksiyonlar */}
          <div className="w-full grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 active:scale-95 transition-all text-xs uppercase tracking-widest font-bold text-slate-200"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>
            {navigator.share ? (
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-accent/50 bg-accent/15 hover:bg-accent/25 active:scale-95 transition-all text-xs uppercase tracking-widest font-bold text-accent"
              >
                <Share2 size={14} />
                Paylaş
              </button>
            ) : (
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-accent/50 bg-accent/15 hover:bg-accent/25 active:scale-95 transition-all text-xs uppercase tracking-widest font-bold text-accent"
              >
                <Copy size={14} />
                Linki Al
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareInviteModal;
