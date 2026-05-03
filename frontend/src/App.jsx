import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

const ROLES_LIST = [
  { name: 'Şifacı', group: 'Masumlar' }, { name: 'Bekçi', group: 'Masumlar' }, { name: 'Avcı', group: 'Masumlar' }, { name: 'Muhtar', group: 'Masumlar' }, { name: 'Gözcü', group: 'Masumlar' }, { name: 'Falcı', group: 'Masumlar' }, { name: 'Gassal', group: 'Masumlar' }, { name: 'Eskort', group: 'Masumlar' },
  { name: 'Eşkıya Başı', group: 'Eşkıyalar' }, { name: 'Münafık', group: 'Eşkıyalar' }, { name: 'Eşkıya', group: 'Eşkıyalar' }, { name: 'Tefeci', group: 'Eşkıyalar' }, { name: 'Meyhaneci', group: 'Eşkıyalar' },
  { name: 'Köy Delisi', group: 'Tarafsızlar' }, { name: 'Seri Katil', group: 'Tarafsızlar' }, { name: 'Kan Davalı', group: 'Tarafsızlar' }, { name: 'Kundakçı', group: 'Tarafsızlar' }, { name: 'Kaçak', group: 'Tarafsızlar' }
];

function App() {
  const videoRef = useRef(null);
  const [gameState, setGameState] = useState('INTRO'); // INTRO, JOIN, LOBBY, GAME
  const [introPhase, setIntroPhase] = useState('WAITING'); // WAITING, PLAYING, ENDED
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [players, setPlayers] = useState([]);
  
  // Game Phase data
  const [gamePhase, setGamePhase] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [myRole, setMyRole] = useState(null);
  const [eventNews, setEventNews] = useState(null); 
  const [systemNotes, setSystemNotes] = useState([]);
  const [dayCount, setDayCount] = useState(1);
  const [settings, setSettings] = useState({ nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30, kirmizi: 4, gri: 2, yesil: 9 });
  const [gameResults, setGameResults] = useState(null);
  const [revealedNotes, setRevealedNotes] = useState([]);
  const [toast, setToast] = useState(null);
  const [showRoleSettings, setShowRoleSettings] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('kuyu_token');
    const savedRoom = localStorage.getItem('kuyu_room');
    if (savedToken && savedRoom) {
       setGameState('JOIN');
       socket.emit('reconnectRoom', { roomCode: savedRoom, token: savedToken });
    }

    socket.on('roomJoined', ({ roomCode, isHost, isDevMode, settings: roomSettings, isSpectator, token, reconnected }) => {
      setRoomCode(roomCode);
      setIsHost(isHost);
      if (isDevMode) setIsDevMode(true);
      if (isSpectator) setIsSpectator(true);
      if (token && !isSpectator) {
         localStorage.setItem('kuyu_token', token);
         localStorage.setItem('kuyu_room', roomCode);
      }
      if (!reconnected) setGameState('LOBBY');
      setSystemNotes([]);
      setDayCount(1);
      if (roomSettings) setSettings(roomSettings);
    });

    socket.on('settingsUpdated', (newSettings) => {
      setSettings(newSettings);
    });

    socket.on('updateLobby', (playerList) => {
      setPlayers(playerList);
    });

    socket.on('error', (msg) => {
      showToast(msg);
    });
    
    socket.on('reconnectFailed', () => {
      localStorage.removeItem('kuyu_token');
      localStorage.removeItem('kuyu_room');
      setGameState('JOIN');
    });

    socket.on('gameStarted', (playerList) => {
      setPlayers(playerList);
      setGameState('GAME');
      const me = playerList.find(p => p.socketId === socket.id);
      if (me) setMyRole(me.role);
    });

    socket.on('phaseChanged', ({ phase, timeRemaining, dayCount: newDay }) => {
      setGamePhase(phase);
      setTimeRemaining(timeRemaining);
      if (newDay) setDayCount(newDay);
      setEventNews(null); 
    });

    socket.on('timerUpdate', (t) => setTimeRemaining(t));

    socket.on('morningNews', ({ killedPlayerName, killedPlayerAlignment, personalNote }) => {
      if(killedPlayerName) {
        setEventNews(`${killedPlayerName} gece karanlığında kurban gitti.`);
        setSystemNotes(prev => [...prev, { text: `${killedPlayerName} gece öldürüldü.`, align: 'Bilinmiyor' }]);
        if (personalNote) {
           setRevealedNotes(prev => [...prev, { playerName: killedPlayerName, note: personalNote }]);
        }
      } else {
        setEventNews('Dün gece köye huzur hakimdi, kimse ölmedi.');
      }
    });

    socket.on('privateNews', (newsObj) => {
      setSystemNotes(prev => [...prev, newsObj]);
    });

    socket.on('voteResult', ({ lynchedPlayerName, lynchedPlayerAlignment, voteTally, personalNote }) => {
       if(lynchedPlayerName) {
         setEventNews(`${lynchedPlayerName} köylüler tarafından ${voteTally} oyla kuyuya fırlatıldı!`);
         setSystemNotes(prev => [...prev, { text: `${lynchedPlayerName} kuyuya atıldı. (Toplam Oy: ${voteTally})`, align: 'Bilinmiyor' }]);
         if (personalNote) {
            setRevealedNotes(prev => [...prev, { playerName: lynchedPlayerName, note: personalNote }]);
         }
       } else {
         setEventNews('Oylar eşit, kimse kuyuya atılmadı.');
       }
    });

    socket.on('mayorRevealed', ({ playerName }) => {
       setEventNews(`DİKKAT: ${playerName} Mührü Vurdu ve Muhtar olduğunu ilan etti!`);
       setPlayers(prev => prev.map(p => p.name === playerName ? { ...p, isMayorRevealed: true } : p));
    });

    socket.on('gameOver', ({ winnerTitle, results }) => {
      setGamePhase('END');
      setEventNews(`Oyun Bitti! Kazanan: ${winnerTitle}`);
      setGameResults(results);
    });

    socket.on('returnedToLobby', () => {
      setGameState('LOBBY');
      setGamePhase(null);
      setGameResults(null);
      setEventNews(null);
      setSystemNotes([]);
      setRevealedNotes([]);
      setMyRole(null);
    });

    return () => {
      socket.off('roomJoined');
      socket.off('updateLobby');
      socket.off('error');
      socket.off('gameStarted');
      socket.off('phaseChanged');
      socket.off('timerUpdate');
      socket.off('morningNews');
      socket.off('privateNews');
      socket.off('voteResult');
      socket.off('mayorRevealed');
      socket.off('gameOver');
      socket.off('settingsUpdated');
      socket.off('reconnectFailed');
      socket.off('returnedToLobby');
    };
  }, []);

  const handleLeave = () => {
    const savedToken = localStorage.getItem('kuyu_token');
    const savedRoom = localStorage.getItem('kuyu_room');
    if(savedToken && savedRoom) {
       socket.emit('leaveRoom', { roomCode: savedRoom, token: savedToken });
    }
    localStorage.removeItem('kuyu_token');
    localStorage.removeItem('kuyu_room');
    window.location.reload();
  };

  return (
    <div className="min-h-[100dvh] text-slate-100 font-sans flex flex-col items-center p-4">
      {toast && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 bg-blood-red text-white px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(127,29,29,0.5)] z-50 animate-bounce font-bold tracking-wider text-sm border border-red-500">
          {toast}
        </div>
      )}

      {gameState === 'INTRO' && (
        <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center overflow-hidden">
           {introPhase === 'WAITING' && (
              <button 
                 onClick={() => {
                     setIntroPhase('PLAYING');
                     if (videoRef.current) videoRef.current.play().catch(e => console.error("Video error:", e));
                 }} 
                 className="text-slate-400 uppercase tracking-[0.5em] hover:text-white transition-colors duration-1000 animate-pulse text-sm z-20"
              >
                 Karanlığa Adım At
              </button>
           )}
           <div className={`absolute inset-0 overflow-hidden flex items-center justify-center bg-black transition-opacity duration-1000 ${introPhase === 'WAITING' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="relative w-full aspect-video md:w-full md:h-full md:aspect-auto flex items-center justify-center">
                 <video 
                    ref={videoRef}
                    src="/intro.mp4" 
                    playsInline
                    onEnded={() => setIntroPhase('ENDED')}
                    className={`absolute w-full h-full object-cover transition-opacity duration-1000 ${introPhase === 'ENDED' ? 'opacity-20 blur-sm' : 'opacity-100'}`}
                 />
                 <div className="absolute inset-0 z-10 pointer-events-none" style={{ 
                    background: 'radial-gradient(ellipse at center, transparent 50%, black 100%)',
                    boxShadow: 'inset 0 0 60px 30px #000'
                 }}></div>
              </div>
           </div>
           {introPhase === 'ENDED' && (
              <div 
                 className="relative z-10 flex flex-col items-center cursor-pointer group animate-pulse"
                 onClick={() => setGameState('JOIN')}
              >
                 <h1 className="text-7xl md:text-9xl font-bold text-blood-red tracking-[0.3em] font-serif group-hover:text-red-500 transition-all duration-700 drop-shadow-[0_0_40px_rgba(220,38,38,1)]">
                    KUYU
                 </h1>
                 <p className="text-slate-400 mt-8 tracking-[0.5em] text-xs uppercase group-hover:text-slate-200 transition-colors">
                    Kasabaya Girmek İçin Tıkla
                 </p>
              </div>
           )}
        </div>
      )}

      {gameState !== 'INTRO' && (
        <div className="w-full flex flex-col items-center pt-8 md:pt-20 pb-20">
          <header className="mb-8 mt-4 text-center relative w-full max-w-4xl">
            <h1 className="text-5xl font-bold text-blood-red tracking-widest drop-shadow-lg font-serif">KUYU</h1>
            <p className="text-sm text-slate-400 mt-2 tracking-wide text-opacity-80">Karanlık Bir Köyün Olayları</p>
            {gameState !== 'JOIN' && (
              <button onClick={handleLeave} className="absolute right-0 top-2 bg-red-900/50 hover:bg-red-800 text-red-200 px-4 py-2 rounded-lg text-xs tracking-widest uppercase transition border border-red-900/50 shadow-lg">
                Çıkış Yap
              </button>
            )}
          </header>
          
          {gameState === 'JOIN' && (
            <Lobby socket={socket} setPlayerName={setPlayerName} playerName={playerName} showToast={showToast} />
          )}
      
      {gameState === 'LOBBY' && (
         <div className="w-full max-w-md bg-dark-bg p-6 rounded-xl border border-slate-800 shadow-2xl transition-all">
           <h2 className="text-2xl mb-6 font-semibold text-center text-accent tracking-widest">Oda: {roomCode}</h2>
           <ul className="mb-6 space-y-3">
             {players.map((p, i) => (
               <li key={i} className="bg-slate-800 px-4 py-3 rounded-lg flex justify-between shadow-inner">
                 <span className="font-medium text-slate-200">{p.name} {p.socketId === socket.id && <span className="text-slate-500 text-sm ml-2">(Sen)</span>}</span>
                 {p.socketId === players[0]?.socketId && <span className="text-amber-500 text-xs font-bold mt-1 tracking-wider uppercase">Host</span>}
               </li>
             ))}
             {players.length === 0 && <li className="text-slate-500 italic text-center">İzleyici modundasın. Oyuncular listeleniyor...</li>}
           </ul>

            <div className="bg-slate-900 p-4 rounded-xl mb-6 border border-slate-700">
              <h3 className="text-yellow-500 font-bold mb-3 uppercase tracking-wider text-[11px] flex items-center justify-between">
                 Oda Ayarları
                 {!isHost && <span className="text-[10px] text-slate-400 normal-case">(Sadece Kurucu değiştirebilir)</span>}
              </h3>
              
              <p className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wider border-b border-slate-800 pb-1">Süreler (Saniye)</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                 {['nightTimer', 'morningTimer', 'dayTimer', 'votingTimer'].map(k => {
                    const labelMap = { nightTimer: 'Gece', morningTimer: 'Sabah', dayTimer: 'Gün', votingTimer: 'Oylama' };
                    return (
                       <div key={k} className="flex flex-col">
                          <label className="text-[10px] text-slate-400 mb-1 font-medium">{labelMap[k]}</label>
                          <input type="number" disabled={!isHost} value={settings[k] || 0} 
                             onChange={(e) => {
                                const newSettings = { ...settings, [k]: parseInt(e.target.value) || 0 };
                                setSettings(newSettings); socket.emit('updateSettings', { roomCode, settings: newSettings });
                             }}
                             className="bg-black border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-yellow-500 focus:ring-1 text-sm w-full"
                          />
                       </div>
                    )
                 })}
              </div>

              <div className="flex justify-between items-end border-b border-slate-800 pb-1 mb-2">
                 <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Rol Dağılımı (Altın Oran)</p>
                 <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Kırmızıda Eşkıya Başı ve Cinnetkar sabit</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                 {['kirmizi', 'gri', 'yesil'].map(k => {
                    const labelMap = { kirmizi: 'Kırmızı', gri: 'Gri', yesil: 'Yeşil' };
                    const colorMap = { kirmizi: 'text-blood-red', gri: 'text-slate-400', yesil: 'text-green-500' };
                    return (
                       <div key={k} className="flex flex-col">
                          <label className={`text-[10px] ${colorMap[k]} font-bold mb-1 uppercase tracking-wider`}>{labelMap[k]}</label>
                          <input type="number" disabled={!isHost} value={settings[k] || 0} 
                             onChange={(e) => {
                                const newSettings = { ...settings, [k]: parseInt(e.target.value) || 0 };
                                setSettings(newSettings); socket.emit('updateSettings', { roomCode, settings: newSettings });
                             }}
                             className="bg-black border border-slate-700 shadow-inner rounded-lg p-2 text-white outline-none focus:border-yellow-500 focus:ring-1 text-sm w-full"
                          />
                       </div>
                    )
                 })}
              </div>
               <div className="mt-4 border-t border-slate-800 pt-3">
                  <button onClick={() => isHost && setShowRoleSettings(true)} disabled={!isHost} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-widest border border-slate-700">
                      Rol Havuzu Ayarları
                  </button>
               </div>
            </div>

            {isHost ? (
             <button onClick={() => socket.emit('startGame', roomCode)} className="w-full bg-blood-red hover:bg-red-800 text-white font-bold py-4 rounded-lg transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(127,29,29,0.4)]">
               Oyunu Başlat ({players.length}/16)
             </button>
           ) : (
             <p className="text-center text-slate-400 animate-pulse mt-4">Köyün kurucusu bekleniyor...</p>
           )}
           {isSpectator && (
             <p className="text-center text-accent/80 font-serif text-sm mt-2">Görünmez bir ruh olarak kasabayı izliyorsun.</p>
           )}
         </div>
      )}

      {gameState === 'GAME' && (
         <GameBoard 
           socket={socket}
           roomCode={roomCode}
           players={players}
           gamePhase={gamePhase}
           timeRemaining={timeRemaining}
           myRole={myRole}
           eventNews={eventNews}
           systemNotes={systemNotes}
           isDevMode={isDevMode}
           dayCount={dayCount}
           gameResults={gameResults}
           revealedNotes={revealedNotes}
           setRevealedNotes={setRevealedNotes}
           isSpectator={isSpectator}
           isHost={isHost}
           onLeave={handleLeave}
         />
      )}
        </div>
      )}

      {showRoleSettings && (
         <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 relative">
               <button onClick={() => setShowRoleSettings(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
               <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-widest border-b border-slate-800 pb-2">Rol Havuzu Seçimi</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['Masumlar', 'Eşkıyalar', 'Tarafsızlar'].map(group => (
                     <div key={group}>
                        <h3 className={`text-sm font-bold mb-3 uppercase tracking-wider ${group === 'Masumlar' ? 'text-green-500' : group === 'Eşkıyalar' ? 'text-blood-red' : 'text-slate-400'}`}>{group}</h3>
                        <div className="space-y-2">
                           {ROLES_LIST.filter(r => r.group === group).map(r => (
                              <label key={r.name} className="flex items-center space-x-3 text-slate-300 cursor-pointer hover:bg-slate-800 p-1 rounded transition-colors">
                                 <input type="checkbox" checked={settings.roles ? settings.roles[r.name] !== false : true} disabled={!isHost}
                                    onChange={(e) => {
                                       const newRoles = { ...(settings.roles || {}) };
                                       newRoles[r.name] = e.target.checked;
                                       const newSettings = { ...settings, roles: newRoles };
                                       setSettings(newSettings);
                                       socket.emit('updateSettings', { roomCode, settings: newSettings });
                                    }}
                                    className="w-4 h-4 rounded border-slate-600 text-blood-red focus:ring-blood-red focus:ring-1 bg-slate-800"
                                 />
                                 <span className="text-sm font-medium">{r.name}</span>
                              </label>
                           ))}
                        </div>
                     </div>
                  ))}
               </div>
               <div className="mt-6 border-t border-slate-800 pt-4 flex justify-end">
                  <button onClick={() => setShowRoleSettings(false)} className="bg-blood-red hover:bg-red-800 text-white px-6 py-2 rounded-xl font-bold transition-colors">Tamam</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

export default App;
