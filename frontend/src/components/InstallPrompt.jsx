import React, { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

// PWA "Add to Home Screen" prompt — Chrome/Edge/Android'de beforeinstallprompt + iOS Safari'de manuel rehber.
// Sik gosterilmemesi icin: kapatildiktan sonra 14 gun bekleme; iOS'ta ek olarak 3. ziyarete kadar gosterilmez.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState('native'); // 'native' | 'ios'

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator && window.navigator.standalone) return; // iOS standalone

    try {
      const dismissed = parseInt(localStorage.getItem('kuyu_install_dismissed') || '0', 10);
      if (dismissed && Date.now() - dismissed < 14 * 24 * 60 * 60 * 1000) return;
    } catch {}

    // iOS Safari tespiti — Chrome/Firefox/Edge on iOS'u dislar (UA'da Cri/FxiOS/EdgiOS var).
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafariIOS = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);

    if (isSafariIOS) {
      // Ziyaret sayacini artir; 3. ziyaret veya sonrasinda goster
      try {
         const visits = parseInt(localStorage.getItem('kuyu_visits') || '0', 10) + 1;
         localStorage.setItem('kuyu_visits', String(visits));
         if (visits < 3) return;
      } catch {}
      setMode('ios');
      setTimeout(() => setShow(true), 4000);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      setMode('native');
      // Hemen acmak yerine 3 saniye geciktir — sayfa yuklenir yuklenmez surpriz olmasin
      setTimeout(() => setShow(true), 3000);
    };
    const installedHandler = () => setShow(false);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem('kuyu_install_dismissed', String(Date.now())); } catch {}
  };

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      const { outcome } = await deferred.userChoice;
      if (outcome === 'dismissed') dismiss();
      else setShow(false);
    } catch {
      setShow(false);
    }
    setDeferred(null);
  };

  if (!show) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[150] w-[calc(100%-1.5rem)] max-w-md bg-slate-900/95 backdrop-blur-md border border-blood-red/50 rounded-2xl p-4 shadow-[0_0_40px_rgba(127,29,29,0.45)] animate-in slide-in-from-bottom-4 duration-500"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Kapat"
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
      >
        <X size={14} />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <img src="/kuyu-icon-192.png" alt="" className="w-12 h-12 rounded-xl shrink-0 border border-slate-700" />
        <div className="flex-1 min-w-0">
          <h3 className="text-yellow-400 font-bold text-sm font-serif tracking-wide">Oyunumuzu kurmak ister misiniz?</h3>
          {mode === 'ios' ? (
             <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">
               Safari'de aşağıdaki <Share size={12} className="inline -mt-0.5" /> Paylaş tuşuna bas, sonra <span className="text-yellow-300">"Ana Ekrana Ekle"</span> de.
             </p>
          ) : (
             <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">Ana ekranına ekle, tarayıcı arayüzü olmadan tek dokunuşla aç.</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={dismiss}
          className="flex-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 font-medium py-2 px-3 text-xs uppercase tracking-wider rounded-lg transition-colors"
        >
          {mode === 'ios' ? 'Tamam' : 'Şimdi Değil'}
        </button>
        {mode === 'native' && (
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 bg-blood-red hover:bg-red-700 active:bg-red-800 text-white font-bold py-2 px-3 text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-lg"
          >
            <Download size={14} /> Kur
          </button>
        )}
      </div>
    </div>
  );
}
