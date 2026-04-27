import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

function App() {
  const [gameState, setGameState] = useState('JOIN'); // JOIN, LOBBY, GAME
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

  useEffect(() => {
    socket.on('roomJoined', ({ roomCode, isHost, isDevMode, settings: roomSettings, isSpectator }) => {
      setRoomCode(roomCode);
      setIsHost(isHost);
      if (isDevMode) setIsDevMode(true);
      if (isSpectator) setIsSpectator(true);
      setGameState('LOBBY');
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
      alert(msg);
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

    socket.on('morningNews', ({ killedPlayerName, killedPlayerAlignment }) => {
      if(killedPlayerName) {
        setEventNews(`${killedPlayerName} gece karanlığında kurban gitti.`);
        setSystemNotes(prev => [...prev, { text: `${killedPlayerName} gece öldürüldü. Takımı: `, align: killedPlayerAlignment }]);
      } else {
        setEventNews('Dün gece köye huzur hakimdi, kimse ölmedi.');
      }
    });

    socket.on('privateNews', (newsObj) => {
      setSystemNotes(prev => [...prev, newsObj]);
    });

    socket.on('voteResult', ({ lynchedPlayerName, lynchedPlayerAlignment, voteTally }) => {
       if(lynchedPlayerName) {
         setEventNews(`${lynchedPlayerName} köylüler tarafından ${voteTally} oyla kuyuya fırlatıldı!`);
         setSystemNotes(prev => [...prev, { text: `${lynchedPlayerName} kuyuya atıldı. (Toplam Oy: ${voteTally})`, align: lynchedPlayerAlignment }]);
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
    };
  }, []);

  return (
    <div className="min-h-screen text-slate-100 font-sans flex flex-col items-center p-4">
      <header className="mb-8 mt-4 text-center">
        <h1 className="text-5xl font-bold text-blood-red tracking-widest drop-shadow-lg font-serif">KUYU</h1>
        <p className="text-sm text-slate-400 mt-2 tracking-wide text-opacity-80">Karanlık Bir Köyün Olayları</p>
      </header>
      
      {gameState === 'JOIN' && (
        <Lobby socket={socket} setPlayerName={setPlayerName} playerName={playerName} />
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
           isSpectator={isSpectator}
         />
      )}
    </div>
  );
}

export default App;
