import React, { useEffect, useState } from 'react';
import { X, MessageSquare, Send, Heart, Check } from 'lucide-react';
import { Button, IconButton } from './ui/Button';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function FeedbackModal({ onClose, showToast, gameState }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (submitting) return;
    if (!name.trim()) return setErr('Adını yazar mısın?');
    if (message.trim().length < 5) return setErr('Mesaj çok kısa — en az 5 karakter.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setErr('E-posta formatı geçersiz görünüyor.');
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          gameState: gameState || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Gönderilemedi, biraz sonra tekrar dene.');
        setSubmitting(false);
        return;
      }
      setSent(true);
      setTimeout(() => { onClose(); }, 1800);
    } catch {
      setErr('Bağlantı hatası — internet bağlantını kontrol et.');
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center modal-safe-pad animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-dark-bg border border-accent/40 rounded-2xl shadow-[0_0_60px_rgba(217,119,6,0.3)] overflow-hidden animate-in zoom-in-95 duration-200 relative"
      >
        {/* Üst başlık */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-accent/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-accent" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] font-serif text-accent">Geri Bildirim</h3>
          </div>
          <IconButton aria-label="Kapat" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        {sent ? (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700/60 flex items-center justify-center">
              <Check size={28} className="text-emerald-400" />
            </div>
            <h4 className="text-emerald-300 font-bold uppercase tracking-widest text-sm">Teşekkürler!</h4>
            <p className="text-slate-300 text-sm leading-relaxed max-w-xs">
              Mesajın bana ulaştı. Okuyacağıma söz veriyorum <Heart size={12} className="inline text-blood-red fill-blood-red" />
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            {/* Açıklama */}
            <p className="text-slate-300 text-sm leading-relaxed">
              Bu mesajlarınız benim için önemli — hepsini okuyorum <Heart size={12} className="inline text-blood-red fill-blood-red" />
              <br />
              <span className="text-slate-500 text-xs">Bug, öneri, rol fikri, sorduğun her şey...</span>
            </p>

            {/* İsim */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">İsim</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                autoFocus
                placeholder="Adın..."
                className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm"
              />
            </div>

            {/* E-posta (opsiyonel) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                E-posta <span className="text-slate-600 normal-case tracking-normal font-normal text-[10px]">(opsiyonel — sadece cevap dönmem gerekirse)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                placeholder="ornek@mail.com"
                className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm placeholder:text-slate-600"
              />
            </div>

            {/* Mesaj */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mesaj</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Aklındakileri yaz..."
                className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm placeholder:text-slate-600 resize-none"
              />
              <p className="text-[9px] text-slate-600 mt-1 text-right tabular-nums">{message.length}/2000</p>
            </div>

            {/* Hata */}
            {err && (
              <div className="bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2 text-red-300 text-xs">
                {err}
              </div>
            )}

            {/* Gönder */}
            <Button variant="accent" size="lg" type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Gönderiliyor...' : <><Send size={14} /> Gönder</>}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default FeedbackModal;
