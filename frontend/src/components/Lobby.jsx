import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, LogIn, ArrowRight, Eye } from 'lucide-react';
import { Button } from './ui/Button';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function sanitizeRoomCode(raw) {
  return raw
    .toUpperCase()
    .split('')
    .filter(c => ROOM_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, 6);
}

function Lobby({ socket, playerName, setPlayerName, showToast }) {
  const [mode, setMode] = useState(''); // 'CREATE', 'JOIN'
  const [joinCode, setJoinCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    const unlock = () => setIsSubmitting(false);
    socket.on('error', unlock);
    return () => { socket.off('error', unlock); };
  }, [socket]);

  // Davet linkinden gelenlerin oda kodunu otomatik doldur
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (!r) return;
    const sanitized = sanitizeRoomCode(r);
    if (sanitized) {
      setJoinCode(sanitized);
      setMode('JOIN');
    }
    // URL'i temizle — kullanıcı odadan çıkıp tekrar girerse karışmasın
    params.delete('room');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash);
  }, []);

  const handleInputFocus = () => {
    /* Klavye açılınca form üste kaysın ki butonlar kaybolmasın */
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }, 300);
  };

  const submitOnce = (fn) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    fn();
    setTimeout(() => setIsSubmitting(false), 1500);
  };

  const handleCreate = () => {
    if (!playerName.trim()) return showToast('Kasabaya girmek için bir isim seç.');
    submitOnce(() => socket.emit('createRoom', playerName));
  };

  const handleJoin = () => {
     if (!playerName.trim()) return showToast('Kasabaya girmek için bir isim seç.');
     if (!joinCode.trim()) return showToast('Oda kodu eksik!');
     submitOnce(() => socket.emit('joinRoom', { playerName, roomCode: joinCode }));
  };

  const handleSpectate = () => {
     if (!joinCode.trim()) return showToast('Oda kodu eksik!');
     submitOnce(() => socket.emit('joinAsSpectator', { playerName: playerName || 'İzleyici', roomCode: joinCode }));
  };

  const handleDev = () => {
     submitOnce(() => socket.emit('createDevRoom'));
  };

  return (
    <div ref={formRef} className="w-full max-w-sm flex flex-col gap-3 sm:gap-5 bg-dark-bg p-5 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group transition-all duration-500 max-h-full">

      <div className="flex flex-col gap-2 relative z-10 items-center">
        <label className="text-slate-400 text-xs sm:text-sm font-semibold tracking-wider uppercase text-center w-full block">Adın Ne Yabancı?</label>
        <input
          type="text"
          name="playerNickname"
          placeholder="İsmini fısılda..."
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          onFocus={handleInputFocus}
          autoComplete="nickname"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck="false"
          inputMode="text"
          maxLength={20}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          className="w-full bg-slate-900 border border-slate-700 p-3 sm:p-4 rounded-xl focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-white transition-all shadow-inner"
        />
      </div>

      <div className="flex gap-2 relative z-10 mt-1">
        <button onClick={() => setMode('CREATE')} className={`flex-1 flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl font-medium transition-all ${mode === 'CREATE' ? 'bg-accent/20 border border-accent text-accent' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <UserPlus size={18} className="mb-1 sm:mb-2" />
          <span className="text-[11px] sm:text-xs">Köy Kur</span>
        </button>
        <button onClick={() => setMode('JOIN')} className={`flex-1 flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl font-medium transition-all ${mode === 'JOIN' ? 'bg-accent/20 border border-accent text-accent' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <LogIn size={18} className="mb-1 sm:mb-2" />
          <span className="text-[11px] sm:text-xs">Sız</span>
        </button>
        <button onClick={() => setMode('SPECTATE')} className={`flex-1 flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl font-medium transition-all ${mode === 'SPECTATE' ? 'bg-purple-500/20 border border-purple-500 text-purple-400' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <Eye size={18} className="mb-1 sm:mb-2" />
          <span className="text-[11px] sm:text-xs">İzle</span>
        </button>
        <button onClick={() => setMode('DEV')} className={`flex-1 flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl font-medium transition-all ${mode === 'DEV' ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-500' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <span className="text-base sm:text-xl mb-0.5 sm:mb-1">🛠️</span>
          <span className="text-[10px] sm:text-xs">Dev</span>
        </button>
      </div>

      {mode === 'CREATE' && (
         <Button variant="primary" size="lg" onClick={handleCreate} disabled={isSubmitting} className="w-full mt-2">
           Köyü İnşa Et
           <ArrowRight size={20} />
         </Button>
      )}

      {mode === 'DEV' && (
         <div className="mt-2">
           <p className="text-yellow-500 text-[11px] sm:text-xs text-center mb-2">Tüm 16 rolün test edilebileceği sanal bir kasaba oluşturulacak.</p>
           <button onClick={handleDev} disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 sm:py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(202,138,4,0.5)] hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
             Simülasyonu Başlat
             <ArrowRight size={20} />
           </button>
         </div>
      )}

      {mode === 'JOIN' && (
        <div className="flex flex-col gap-3 mt-2 origin-top transition-all duration-300">
          <input
             type="text"
             placeholder="Köy Mührü"
             value={joinCode}
             onChange={e => setJoinCode(sanitizeRoomCode(e.target.value))}
             onFocus={handleInputFocus}
             autoCapitalize="characters"
             autoCorrect="off"
             autoComplete="off"
             spellCheck="false"
             inputMode="text"
             className="w-full bg-slate-900 border border-slate-700 p-3 sm:p-4 rounded-xl text-center text-xl sm:text-2xl tracking-[0.3em] font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-slate-600 shadow-inner"
             maxLength={6}
          />
          <Button variant="accent" size="lg" onClick={handleJoin} disabled={isSubmitting} className="w-full">
            Kapıyı Çal
            <ArrowRight size={20} />
          </Button>
        </div>
      )}

      {mode === 'SPECTATE' && (
        <div className="flex flex-col gap-3 mt-2 origin-top transition-all duration-300">
          <input
             type="text"
             placeholder="Köy Mührü"
             value={joinCode}
             onChange={e => setJoinCode(sanitizeRoomCode(e.target.value))}
             onFocus={handleInputFocus}
             autoCapitalize="characters"
             autoCorrect="off"
             autoComplete="off"
             spellCheck="false"
             inputMode="text"
             className="w-full bg-slate-900 border border-purple-900/50 p-3 sm:p-4 rounded-xl text-center text-xl sm:text-2xl tracking-[0.3em] font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder:text-slate-600 shadow-inner"
             maxLength={6}
          />
          <button onClick={handleSpectate} disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold py-3 sm:py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(126,34,206,0.5)] hover:shadow-[0_0_30px_rgba(126,34,206,0.7)] hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
            Ruh Olarak Sız
            <Eye size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

export default Lobby;
