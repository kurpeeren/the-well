import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Admin from './components/Admin';
import { LogOut } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

const ROLES_LIST = [
  { name: 'Şifacı', group: 'Masumlar' }, { name: 'Bekçi', group: 'Masumlar' }, { name: 'Avcı', group: 'Masumlar' }, { name: 'Muhtar', group: 'Masumlar' }, { name: 'Gözcü', group: 'Masumlar' }, { name: 'Falcı', group: 'Masumlar' }, { name: 'Gassal', group: 'Masumlar' }, { name: 'Eskort', group: 'Masumlar' },
  { name: 'Eşkıya Başı', group: 'Eşkıyalar' }, { name: 'Münafık', group: 'Eşkıyalar' }, { name: 'Eşkıya', group: 'Eşkıyalar' }, { name: 'Tefeci', group: 'Eşkıyalar' }, { name: 'Meyhaneci', group: 'Eşkıyalar' },
  { name: 'Köy Delisi', group: 'Tarafsızlar' }, { name: 'Seri Katil', group: 'Tarafsızlar' }, { name: 'Kan Davalı', group: 'Tarafsızlar' }, { name: 'Kundakçı', group: 'Tarafsızlar' }, { name: 'Kaçak', group: 'Tarafsızlar' }
];

function App() {
  const videoRef = useRef(null);

  const [gameState, setGameState] = useState(() => {
     if (window.location.search.includes('admin=true')) return 'ADMIN';
     return 'INTRO';
  }); // INTRO, JOIN, LOBBY, GAME, ADMIN
  const [introPhase, setIntroPhase] = useState('WAITING'); // WAITING, PLAYING, ENDED
  const [introClicks, setIntroClicks] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [players, setPlayers] = useState([]);
  
  // Game Phase data
  const [gamePhase, setGamePhase] = useState('');
  const [myRole, setMyRole] = useState(null);
  const [eventNews, setEventNews] = useState(null); 
  const [systemNotes, setSystemNotes] = useState([]);
  const [dayCount, setDayCount] = useState(1);
  const [dousedList, setDousedList] = useState([]);
  const [settings, setSettings] = useState({ nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30, kirmizi: 4, gri: 2, yesil: 9 });
  const [isRatioManuallySet, setIsRatioManuallySet] = useState(false);
  const [gameResults, setGameResults] = useState(null);
  const [revealedNotes, setRevealedNotes] = useState([]);
  const [toast, setToast] = useState(null);
  const [lobbyTab, setLobbyTab] = useState('players'); // 'players' | 'settings' | 'roles'

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
     if (gameState === 'LOBBY' && isHost && !isRatioManuallySet) {
        const N = players.length;
        if (N > 0) {
           let k = Math.max(1, Math.round(N * 0.26));
           let g = Math.round(N * 0.14);
           let y = N - k - g;
           if (y < 0) y = 0;
           if (settings.kirmizi !== k || settings.gri !== g || settings.yesil !== y) {
              const newSettings = { ...settings, kirmizi: k, gri: g, yesil: y };
              setSettings(newSettings);
              socket.emit('updateSettings', { roomCode, settings: newSettings });
           }
        }
     }
  }, [players.length, gameState, isHost, isRatioManuallySet]);

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

    socket.on('phaseChanged', ({ phase, dayCount: newDay, doused }) => {
      setGamePhase(phase);
      if (newDay) setDayCount(newDay);
      if (doused) setDousedList(doused);
      setEventNews(null); 
    });

    socket.on('morningNews', ({ killedPlayerName, killedPlayerAlignment, personalNote, cause }) => {
      if(killedPlayerName) {
        if (cause === 'arsonist') {
           setEventNews(`${killedPlayerName} gece evinde çıkan feci bir yangında kül oldu!`);
           setSystemNotes(prev => [...prev, { text: `${killedPlayerName} yanarak can verdi.`, align: 'Kırmızı' }]);
        } else {
           setEventNews(`${killedPlayerName} gece karanlığında kurban gitti.`);
           setSystemNotes(prev => [...prev, { text: `${killedPlayerName} gece öldürüldü.`, align: 'Bilinmiyor' }]);
        }

        /* Vasiyet boş olsa bile göster — kullanıcı Tamam'a basana kadar açık kalsın */
        setRevealedNotes(prev => [...prev, { playerName: killedPlayerName, note: personalNote || '' }]);
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
         /* Vasiyet boş olsa bile göster */
         setRevealedNotes(prev => [...prev, { playerName: lynchedPlayerName, note: personalNote || '' }]);
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

  if (gameState === 'ADMIN') {
      return <Admin onExit={() => {
          const url = new URL(window.location);
          url.searchParams.delete('admin');
          window.history.pushState({}, '', url);
          setGameState('INTRO');
      }} />;
  }

  if (gameState === 'TEST') {
      return <TestUI onExit={() => {
          const url = new URL(window.location);
          url.searchParams.delete('test');
          window.history.pushState({}, '', url);
          setGameState('INTRO');
      }} />;
  }

  const isInGame = gameState === 'GAME';
  return (
    <div className="text-slate-100 font-sans flex flex-col items-center bg-[#050505] h-[100svh] sm:min-h-[100svh] overflow-hidden sm:overflow-visible sm:p-4">
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
           <div 
              className={`absolute inset-0 overflow-hidden flex items-center justify-center bg-black transition-opacity duration-1000 ${introPhase === 'WAITING' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              onClick={() => {
                const nextClicks = introClicks + 1;
                setIntroClicks(nextClicks);
                if (nextClicks >= 3) {
                   setIntroPhase('ENDED');
                }
              }}
           >
              <div className="relative w-full aspect-video md:w-full md:h-full md:aspect-auto flex items-center justify-center pointer-events-none">
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
        <div className="w-full flex flex-col items-center relative flex-1 min-h-0 overflow-hidden sm:overflow-visible sm:pb-20">

          {!isInGame && (
            <header className={`w-full max-w-4xl text-center relative z-40 mt-2 mb-3 sm:mb-8 shrink-0 px-4 ${gameState === 'LOBBY' ? 'hidden sm:block' : ''}`}>
              <div className="relative inline-block px-6 sm:px-10 py-2 sm:py-4">
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-blood-red tracking-[0.4em] font-serif drop-shadow-[0_0_15px_rgba(127,29,29,0.7)] cursor-default">
                  KUYU
                </h1>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-blood-red/40 to-transparent mt-2"></div>
                <p className="text-[9px] md:text-[11px] text-slate-500 mt-1 sm:mt-2 tracking-[0.3em] uppercase font-bold italic opacity-60">Fısıltılar Köyü</p>
              </div>

              {gameState === 'LOBBY' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleLeave(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 group flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border border-red-900/50 bg-black/40 hover:bg-red-950/40 hover:border-red-500 transition-all duration-500 shadow-xl"
                >
                  <LogOut size={14} className="text-red-400 group-hover:text-red-300 transition-colors" />
                  <span className="text-[10px] tracking-[0.2em] uppercase font-black text-slate-400 group-hover:text-red-300 transition-colors hidden sm:inline">Çıkış</span>
                </button>
              )}
            </header>
          )}

          {gameState === 'JOIN' && (
            <div className="flex-1 min-h-0 w-full flex flex-col items-center px-4 pb-4 sm:pb-0 overflow-y-auto custom-scrollbar">
              <div className="my-auto w-full max-w-sm flex flex-col items-center gap-4 py-2">
                <Lobby socket={socket} setPlayerName={setPlayerName} playerName={playerName} showToast={showToast} />
                <a
                  href="/bilgi/"
                  className="group flex items-center gap-2 text-slate-500 hover:text-accent active:text-amber-500 text-[11px] sm:text-xs uppercase tracking-[0.3em] py-2 px-4 transition-colors"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">📜</span>
                  Köyü Gez
                </a>
              </div>
            </div>
          )}
      
      {gameState === 'LOBBY' && (
         <div className="w-full max-w-md flex-1 min-h-0 flex flex-col bg-dark-bg sm:rounded-xl border-y sm:border border-slate-800 shadow-2xl mx-0 sm:mx-4 sm:my-2">
           {/* Oda kodu üst bar */}
           <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-2xl font-semibold text-accent tracking-widest truncate">Oda: {roomCode}</h2>
              <div className="flex items-center gap-2 shrink-0">
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{players.length}/16</span>
                 <button
                    onClick={(e) => { e.stopPropagation(); handleLeave(); }}
                    className="sm:hidden p-1.5 rounded-full border border-red-900/50 bg-black/40 hover:bg-red-950/40 hover:border-red-500 transition-all"
                    title="Çıkış"
                 >
                    <LogOut size={14} className="text-red-400" />
                 </button>
              </div>
           </div>

           {/* Sekme bar */}
           <div className="shrink-0 grid grid-cols-3 border-b border-slate-800">
              {[
                 { id: 'players', label: 'Oyuncular' },
                 { id: 'settings', label: 'Ayarlar' },
                 { id: 'roles', label: 'Roller' },
              ].map(t => (
                 <button
                    key={t.id}
                    onClick={() => setLobbyTab(t.id)}
                    className={`py-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
                       lobbyTab === t.id
                          ? 'text-accent border-accent bg-slate-900/40'
                          : 'text-slate-500 border-transparent hover:text-slate-300'
                    }`}
                 >
                    {t.label}
                 </button>
              ))}
           </div>

           {/* Sekme içeriği */}
           <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5">
              {lobbyTab === 'players' && (
                 <ul className="space-y-2">
                    {players.map((p, i) => (
                       <li key={i} className="bg-slate-800 px-4 py-3 rounded-lg flex justify-between items-center shadow-inner">
                          <span className="font-medium text-slate-200">{p.name} {p.socketId === socket.id && <span className="text-slate-500 text-sm ml-2">(Sen)</span>}</span>
                          {p.socketId === players[0]?.socketId && <span className="text-amber-500 text-xs font-bold tracking-wider uppercase">Host</span>}
                       </li>
                    ))}
                    {players.length === 0 && <li className="text-slate-500 italic text-center py-4">İzleyici modundasın. Oyuncular listeleniyor...</li>}
                    {isSpectator && (
                       <p className="text-center text-accent/80 font-serif text-sm mt-4">Görünmez bir ruh olarak kasabayı izliyorsun.</p>
                    )}
                 </ul>
              )}

              {lobbyTab === 'settings' && (
                 <div className="space-y-5">
                    {!isHost && (
                       <p className="text-[10px] text-slate-400 bg-slate-800/60 px-3 py-2 rounded text-center uppercase tracking-widest">Sadece kurucu değiştirebilir</p>
                    )}

                    <div>
                       <p className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wider border-b border-slate-800 pb-1">Süreler (Saniye)</p>
                       <div className="grid grid-cols-2 gap-3">
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
                    </div>

                    <div>
                       <div className="flex justify-between items-end border-b border-slate-800 pb-1 mb-2">
                          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Rol Dağılımı</p>
                          <span className="text-[9px] text-slate-500">Eşkıya Başı + Cinnetkar sabit</span>
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
                                         setIsRatioManuallySet(true);
                                         const newSettings = { ...settings, [k]: parseInt(e.target.value) || 0 };
                                         setSettings(newSettings); socket.emit('updateSettings', { roomCode, settings: newSettings });
                                      }}
                                      className="bg-black border border-slate-700 shadow-inner rounded-lg p-2 text-white outline-none focus:border-yellow-500 focus:ring-1 text-sm w-full"
                                   />
                                </div>
                             )
                          })}
                       </div>
                    </div>
                 </div>
              )}

              {lobbyTab === 'roles' && (
                 <div className="space-y-5">
                    {!isHost && (
                       <p className="text-[10px] text-slate-400 bg-slate-800/60 px-3 py-2 rounded text-center uppercase tracking-widest">Sadece kurucu değiştirebilir</p>
                    )}
                    {['Masumlar', 'Eşkıyalar', 'Tarafsızlar'].map(group => (
                       <div key={group}>
                          <h3 className={`text-[11px] font-bold mb-2 uppercase tracking-wider ${group === 'Masumlar' ? 'text-green-500' : group === 'Eşkıyalar' ? 'text-blood-red' : 'text-slate-400'}`}>{group}</h3>
                          <div className="grid grid-cols-2 gap-1.5">
                             {ROLES_LIST.filter(r => r.group === group).map(r => (
                                <label key={r.name} className="flex items-center space-x-2 text-slate-300 cursor-pointer hover:bg-slate-800 p-1.5 rounded transition-colors">
                                   <input type="checkbox" checked={settings.roles ? settings.roles[r.name] !== false : true} disabled={!isHost}
                                      onChange={(e) => {
                                         const newRoles = { ...(settings.roles || {}) };
                                         newRoles[r.name] = e.target.checked;
                                         const newSettings = { ...settings, roles: newRoles };
                                         setSettings(newSettings);
                                         socket.emit('updateSettings', { roomCode, settings: newSettings });
                                      }}
                                      className="w-4 h-4 rounded border-slate-600 text-blood-red focus:ring-blood-red focus:ring-1 bg-slate-800 shrink-0"
                                   />
                                   <span className="text-[12px] font-medium truncate">{r.name}</span>
                                </label>
                             ))}
                          </div>
                       </div>
                    ))}
                 </div>
              )}
           </div>

           {/* Sticky CTA */}
           <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900/40" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              {isHost ? (
                 <button onClick={() => socket.emit('startGame', roomCode)} className="w-full bg-blood-red hover:bg-red-800 text-white font-bold py-3 sm:py-4 rounded-lg transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(127,29,29,0.4)]">
                    Oyunu Başlat ({players.length}/16)
                 </button>
              ) : (
                 <p className="text-center text-slate-400 animate-pulse text-sm">Köyün kurucusu bekleniyor...</p>
              )}
           </div>
         </div>
      )}

      {gameState === 'GAME' && (
         <GameBoard 
           socket={socket}
           roomCode={roomCode}
           players={players}
           gamePhase={gamePhase}
           myRole={myRole}
           eventNews={eventNews}
           systemNotes={systemNotes}
           isDevMode={isDevMode}
           dayCount={dayCount}
           dousedList={dousedList}
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
    </div>
  );
}

export default App;
