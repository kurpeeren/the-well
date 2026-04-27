import React, { useState } from 'react';
import { UserPlus, LogIn, ArrowRight, Eye } from 'lucide-react';

function Lobby({ socket, playerName, setPlayerName, showToast }) {
  const [mode, setMode] = useState(''); // 'CREATE', 'JOIN'
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = () => {
    if (!playerName.trim()) return showToast('Kasabaya girmek için bir isim seç.');
    socket.emit('createRoom', playerName);
  };

  const handleJoin = () => {
     if (!playerName.trim()) return showToast('Kasabaya girmek için bir isim seç.');
     if (!joinCode.trim()) return showToast('Oda kodu eksik!');
     socket.emit('joinRoom', { playerName, roomCode: joinCode });
  };

  const handleSpectate = () => {
     if (!joinCode.trim()) return showToast('Oda kodu eksik!');
     socket.emit('joinAsSpectator', { playerName: playerName || 'İzleyici', roomCode: joinCode });
  };

  return (
    <div className="w-full max-w-sm flex flex-col gap-5 bg-dark-bg p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group transition-all duration-500">
      
      {/* Decorative gradient */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blood-red via-accent to-blood-red opacity-70"></div>

      <div className="flex flex-col gap-2 relative z-10 items-center">
        <label className="text-slate-400 text-sm font-semibold tracking-wider uppercase text-center w-full block">Adın Ne Yabancı?</label>
        <input 
          type="text" 
          placeholder="İsmini fısılda..." 
          value={playerName} 
          onChange={e => setPlayerName(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-white transition-all shadow-inner"
        />
      </div>

      <div className="flex gap-2 relative z-10 mt-2">
        <button onClick={() => setMode('CREATE')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl font-medium transition-all ${mode === 'CREATE' ? 'bg-accent/20 border border-accent text-accent' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <UserPlus size={20} className="mb-2" />
          <span className="text-xs">Köy Kur</span>
        </button>
        <button onClick={() => setMode('JOIN')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl font-medium transition-all ${mode === 'JOIN' ? 'bg-accent/20 border border-accent text-accent' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <LogIn size={20} className="mb-2" />
          <span className="text-xs">Sız</span>
        </button>
        <button onClick={() => setMode('SPECTATE')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl font-medium transition-all ${mode === 'SPECTATE' ? 'bg-purple-500/20 border border-purple-500 text-purple-400' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <Eye size={20} className="mb-2" />
          <span className="text-xs">İzle</span>
        </button>
        <button onClick={() => setMode('DEV')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl font-medium transition-all ${mode === 'DEV' ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-500' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'} border border-transparent`}>
          <span className="text-xl mb-1">🛠️</span>
          <span className="text-[10px] sm:text-xs">Geliştirici</span>
        </button>
      </div>

      {mode === 'CREATE' && (
         <button onClick={handleCreate} className="mt-4 flex items-center justify-center gap-2 w-full bg-blood-red hover:bg-red-800 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(127,29,29,0.5)] hover:shadow-[0_0_30px_rgba(127,29,29,0.7)] hover:scale-[1.02]">
           Köyü İnşa Et
           <ArrowRight size={20} />
         </button>
      )}

      {mode === 'DEV' && (
         <div className="mt-4">
           <p className="text-yellow-500 text-xs text-center mb-3">Tüm 16 rolün test edilebileceği sanal bir kasaba oluşturulacak.</p>
           <button onClick={() => socket.emit('createDevRoom')} className="flex items-center justify-center gap-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(202,138,4,0.5)] hover:scale-[1.02]">
             Simülasyonu Başlat
             <ArrowRight size={20} />
           </button>
         </div>
      )}

      {mode === 'JOIN' && (
        <div className="flex flex-col gap-4 mt-4 origin-top transition-all duration-300">
          <input 
             type="text" 
             placeholder="Köy Mührü" 
             value={joinCode} 
             onChange={e => setJoinCode(e.target.value)}
             className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-center text-2xl tracking-[0.3em] font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-slate-600 shadow-inner"
             maxLength={6}
          />
          <button onClick={handleJoin} className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-amber-700 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(217,119,6,0.5)] hover:shadow-[0_0_30px_rgba(217,119,6,0.7)] hover:scale-[1.02]">
            Kapıyı Çal
            <ArrowRight size={20} />
          </button>
        </div>
      )}

      {mode === 'SPECTATE' && (
        <div className="flex flex-col gap-4 mt-4 origin-top transition-all duration-300">
          <input 
             type="text" 
             placeholder="Köy Mührü" 
             value={joinCode} 
             onChange={e => setJoinCode(e.target.value)}
             className="w-full bg-slate-900 border border-purple-900/50 p-4 rounded-xl text-center text-2xl tracking-[0.3em] font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder:text-slate-600 shadow-inner"
             maxLength={6}
          />
          <button onClick={handleSpectate} className="w-full flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(126,34,206,0.5)] hover:shadow-[0_0_30px_rgba(126,34,206,0.7)] hover:scale-[1.02]">
            Ruh Olarak Sız
            <Eye size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

export default Lobby;
