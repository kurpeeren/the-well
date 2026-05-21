import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Admin from './components/Admin';
import ShareInviteModal from './components/ShareInviteModal';
import FeedbackModal from './components/FeedbackModal';
import { LogOut, Share2, MessageSquare, UserMinus } from 'lucide-react';
import { Button } from './components/ui/Button';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL, {
  transports: ['websocket'], // Polling adımını atla — ilk bağlantı hızlanır
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});

/* Global koruma — tıklamalı eventler için 500ms throttle.
   Bir butona hızlı 2-3 kez basılırsa sadece ilki geçer, geri kalanı sessizce düşer.
   updateSettings ve diğer akış-bazlı eventler hariç tutuldu. */
const THROTTLED_EVENTS = new Set([
  'createRoom', 'createDevRoom', 'joinRoom', 'joinAsSpectator',
  'nightAction', 'votePlayer',
  'chatMessage', 'deadChatMessage', 'mafiaChatMessage',
  'mayorReveal', 'skipDayVote', 'startGame', 'returnToLobby',
  'forceNextPhase', 'leaveRoom', 'hostKick',
  'judgmentVote', 'withdrawVote',
]);
const _lastEmit = new Map();
const _origEmit = socket.emit.bind(socket);
socket.emit = (event, ...args) => {
  if (THROTTLED_EVENTS.has(event)) {
    const now = Date.now();
    if (now - (_lastEmit.get(event) || 0) < 500) return socket;
    _lastEmit.set(event, now);
  }
  return _origEmit(event, ...args);
};

const ROLES_LIST = [
  { name: 'Şifacı', group: 'Masumlar' }, { name: 'Bekçi', group: 'Masumlar' }, { name: 'Avcı', group: 'Masumlar' }, { name: 'Muhtar', group: 'Masumlar' }, { name: 'Gözcü', group: 'Masumlar' }, { name: 'Falcı', group: 'Masumlar' }, { name: 'Gassal', group: 'Masumlar' }, { name: 'Eskort', group: 'Masumlar' }, { name: 'Deli', group: 'Masumlar' },
  { name: 'Eşkıya Başı', group: 'Eşkıyalar' }, { name: 'Münafık', group: 'Eşkıyalar' }, { name: 'Eşkıya', group: 'Eşkıyalar' }, { name: 'Tefeci', group: 'Eşkıyalar' }, { name: 'Meyhaneci', group: 'Eşkıyalar' },
  { name: 'Garip', group: 'Tarafsızlar' }, { name: 'Seri Katil', group: 'Tarafsızlar' }, { name: 'Kan Davalı', group: 'Tarafsızlar' }, { name: 'Kundakçı', group: 'Tarafsızlar' }, { name: 'Kaçak', group: 'Tarafsızlar' }
];

// Hizli mod presetleri — strateji sayfasiyla birebir uyumlu.
// Her preset rol agirliklari (1, ya da [name, weight]) + ekip oranlari (k/g/y) iceriyor.
const MODE_PRESETS = [
  {
    id: 'tanisma', name: 'Tanışma Maçı', sub: '8 kişi · Yeni başlayanlar', icon: '🎯',
    kirmizi: 2, gri: 1, yesil: 5,
    roles: ['Eşkıya Başı', 'Tefeci', 'Garip', 'Şifacı', 'Bekçi', 'Avcı', 'Muhtar', 'Falcı'],
  },
  {
    id: 'klasik', name: 'Klasik Denge', sub: '10 kişi · Turnuva', icon: '⚖️',
    kirmizi: 3, gri: 1, yesil: 6,
    roles: ['Eşkıya Başı', 'Münafık', 'Tefeci', 'Seri Katil', 'Şifacı', 'Bekçi', 'Avcı', 'Muhtar', 'Falcı', 'Eskort'],
  },
  {
    id: 'bilgi', name: 'Bilgi Ağırlıklı', sub: '12 kişi · ×2 bilgi rolü', icon: '🔮',
    kirmizi: 3, gri: 2, yesil: 7,
    roles: ['Eşkıya Başı', 'Münafık', 'Tefeci', 'Seri Katil', 'Garip', 'Şifacı', ['Bekçi', 2], 'Avcı', 'Muhtar', ['Falcı', 2], 'Gözcü', 'Eskort'],
  },
  {
    id: 'twist', name: 'Kaotik Sürpriz', sub: '14 kişi · Deli + tarafsızlar', icon: '🌀',
    kirmizi: 4, gri: 2, yesil: 8,
    roles: ['Eşkıya Başı', 'Münafık', 'Tefeci', 'Meyhaneci', 'Seri Katil', 'Kan Davalı', 'Şifacı', 'Bekçi', 'Avcı', 'Muhtar', 'Falcı', 'Gözcü', 'Gassal', 'Deli'],
  },
  {
    id: 'tamkadro', name: 'Tam Kadro', sub: '16 kişi · Festival', icon: '🎪',
    kirmizi: 4, gri: 2, yesil: 10,
    roles: ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Meyhaneci', 'Seri Katil', 'Kundakçı', 'Şifacı', 'Bekçi', 'Avcı', 'Muhtar', 'Falcı', 'Gözcü', 'Gassal', 'Eskort', 'Tefeci', 'Deli'],
  },
  {
    // Ozel mod: 1 Seri Katil + 1 rastgele gercek masum + geri kalan Deli.
    // Backend gameMode bayragiyla ozel atama yapar; rol agirliklari onemsiz.
    id: 'delikoyu', name: 'Deli Köyü', sub: '1 katil + 1 gerçek masum + tümü Deli', icon: '🎭',
    gameMode: 'deli_koyu',
    kirmizi: 1, gri: 0, yesil: 7,
    roles: ['Seri Katil', 'Deli', 'Şifacı', 'Bekçi', 'Avcı', 'Muhtar', 'Gözcü', 'Falcı', 'Gassal', 'Eskort'],
  },
];

// Hizli sure presetleri — 5 faz timer'ini ayni anda set eder.
const TIME_PRESETS = [
  {
    id: 'cabuk', name: 'Çabuk', sub: '~15-25 dk', icon: '⚡',
    nightTimer: 25, morningTimer: 5, dayTimer: 50, votingTimer: 15, defenseTimer: 20,
  },
  {
    id: 'standart', name: 'Standart', sub: '~25-40 dk', icon: '⏱️',
    nightTimer: 35, morningTimer: 8, dayTimer: 75, votingTimer: 25, defenseTimer: 30,
  },
  {
    id: 'uzun', name: 'Uzun', sub: '~40-60 dk', icon: '🐢',
    nightTimer: 50, morningTimer: 12, dayTimer: 120, votingTimer: 40, defenseTimer: 45,
  },
];

function App() {
  const videoRef = useRef(null);
  const kuyuClickRef = useRef({ count: 0, timer: null });

  const handleKuyuSecretClick = () => {
    const k = kuyuClickRef.current;
    k.count += 1;
    if (k.timer) clearTimeout(k.timer);
    if (k.count >= 4) {
      k.count = 0;
      const url = new URL(window.location);
      url.searchParams.set('admin', 'true');
      window.history.pushState({}, '', url);
      setGameState('ADMIN');
      return;
    }
    k.timer = setTimeout(() => { k.count = 0; }, 1500);
  };

  const [gameState, setGameState] = useState(() => {
     const params = new URLSearchParams(window.location.search);
     if (params.get('admin') === 'true') return 'ADMIN';
     // Davet linkiyle gelenler intro'yu atlasın
     if (params.get('room')) return 'JOIN';
     return 'INTRO';
  }); // INTRO, JOIN, LOBBY, GAME, ADMIN
  const [introPhase, setIntroPhase] = useState('WAITING'); // WAITING, PLAYING, ENDED
  const [introClicks, setIntroClicks] = useState(0);
  const [playerName, setPlayerName] = useState(() => {
    // PWA / tarayici farketmez — son girdigi ismi localStorage'da hatirla
    try { return localStorage.getItem('kuyu_playerName') || ''; } catch { return ''; }
  });
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
  const [trial, setTrial] = useState(null);
  const dayCountRef = useRef(1);
  const [dousedList, setDousedList] = useState([]);
  const [settings, setSettings] = useState({ nightTimer: 35, morningTimer: 8, dayTimer: 75, votingTimer: 25, defenseTimer: 30, kirmizi: 2, gri: 1, yesil: 5 });
  const [isRatioManuallySet, setIsRatioManuallySet] = useState(false);
  const [gameResults, setGameResults] = useState(null);
  const [revealedNotes, setRevealedNotes] = useState([]);
  const [toast, setToast] = useState(null);
  const [lobbyTab, setLobbyTab] = useState('players'); // 'players' | 'settings' | 'roles'
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [kickTarget, setKickTarget] = useState(null); // { socketId, name }
  const [kickedNotice, setKickedNotice] = useState(null); // sebebi tutan string, modal trigger

  useEffect(() => { dayCountRef.current = dayCount; }, [dayCount]);

  // Oyuncu ismi degisince localStorage'a yaz — bir sonraki acilista pre-fill icin
  useEffect(() => {
    const trimmed = playerName.trim();
    if (trimmed) {
      try { localStorage.setItem('kuyu_playerName', trimmed); } catch {}
    }
  }, [playerName]);

  // Atma onay modali acik kalmis ama oyuncu kendiliginden ayrilmis ya da faz degismis → modal'i kapat
  useEffect(() => {
    if (!kickTarget) return;
    if (gameState !== 'LOBBY' || !players.some(p => p.socketId === kickTarget.socketId)) {
      setKickTarget(null);
    }
  }, [players, gameState, kickTarget]);

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
    const urlRoom = (new URLSearchParams(window.location.search).get('room') || '').toUpperCase();
    const savedToken = localStorage.getItem('kuyu_token');
    const savedRoom = localStorage.getItem('kuyu_room');
    if (urlRoom && savedRoom && urlRoom !== savedRoom.toUpperCase()) {
       // Davet farklı bir oda için — eski oturumu bırak, JOIN ekranına düş
       localStorage.removeItem('kuyu_token');
       localStorage.removeItem('kuyu_room');
       setGameState('JOIN');
    } else if (savedToken && savedRoom) {
       setGameState('JOIN');
       socket.emit('reconnectRoom', { roomCode: savedRoom, token: savedToken });
    }

    // Soket her bağlantı kurduğunda (ilk açılış + wifi/uyku sonrası otomatik reconnect),
    // localStorage'da token varsa oda kurtarma denemesi yap.
    // Boylece oyun esnasinda dusen oyuncu, soket yeniden baglandiginda otomatik geri girer.
    socket.on('connect', () => {
      const savedToken = localStorage.getItem('kuyu_token');
      const savedRoom = localStorage.getItem('kuyu_room');
      if (savedToken && savedRoom) {
        socket.emit('reconnectRoom', { roomCode: savedRoom, token: savedToken });
      }
    });

    // Admin RTT ping — sunucu timestamp gönderir, biz echo ederiz
    socket.on('adminPing', (ts) => socket.emit('adminPong', ts));

    // Admin broadcast — tüm aktif kullanıcılara duyuru
    socket.on('adminBroadcast', ({ message }) => {
      showToast('📢 ' + message);
    });

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
      setTrial(null);
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

    socket.on('kicked', ({ reason } = {}) => {
      localStorage.removeItem('kuyu_token');
      localStorage.removeItem('kuyu_room');
      setRoomCode('');
      setIsHost(false);
      setPlayers([]);
      setIsSpectator(false);
      setGameState('JOIN');
      setKickedNotice(reason || 'Oda kurucusu tarafindan atildin.');
    });

    socket.on('gameStarted', (playerList) => {
      setPlayers(playerList);
      setGameState('GAME');
      const me = playerList.find(p => p.socketId === socket.id);
      if (me) setMyRole(me.role);
    });

    socket.on('phaseChanged', ({ phase, dayCount: newDay, doused, trial }) => {
      setGamePhase(phase);
      if (newDay) setDayCount(newDay);
      if (doused) setDousedList(doused);
      setTrial(trial || null);
      setEventNews(null);
    });

    socket.on('morningNews', ({ killedPlayerName, killedPlayerAlignment, personalNote, cause }) => {
      const d = dayCountRef.current;
      if(killedPlayerName) {
        if (cause === 'arsonist') {
           setEventNews(`${killedPlayerName} gece evinde çıkan feci bir yangında kül oldu!`);
           setSystemNotes(prev => [...prev, { text: `${killedPlayerName} yanarak can verdi.`, align: 'Kırmızı', day: d }]);
        } else {
           setEventNews(`${killedPlayerName} gece karanlığında kurban gitti.`);
           setSystemNotes(prev => [...prev, { text: `${killedPlayerName} gece öldürüldü.`, align: 'Bilinmiyor', day: d }]);
        }

        /* Vasiyet boş olsa bile göster — kullanıcı Tamam'a basana kadar açık kalsın */
        setRevealedNotes(prev => [...prev, { playerName: killedPlayerName, note: personalNote || '' }]);
      } else {
        setEventNews('Dün gece köye huzur hakimdi, kimse ölmedi.');
      }
    });

    socket.on('privateNews', (newsObj) => {
      setSystemNotes(prev => [...prev, { ...newsObj, day: dayCountRef.current }]);
    });

    socket.on('voteResult', ({ lynchedPlayerName, lynchedPlayerAlignment, voteTally, personalNote }) => {
       const d = dayCountRef.current;
       if(lynchedPlayerName) {
         setEventNews(`${lynchedPlayerName} köylüler tarafından ${voteTally} oyla kuyuya fırlatıldı!`);
         setSystemNotes(prev => [...prev, { text: `${lynchedPlayerName} kuyuya atıldı. (Toplam Oy: ${voteTally})`, align: 'Bilinmiyor', day: d }]);
         /* Vasiyet boş olsa bile göster */
         setRevealedNotes(prev => [...prev, { playerName: lynchedPlayerName, note: personalNote || '' }]);
       } else {
         setEventNews('Köylüler bağışladı, kimse kuyuya atılmadı.');
       }
    });

    socket.on('mayorRevealed', ({ playerName }) => {
       setEventNews(`DİKKAT: ${playerName} Mührü Vurdu ve Muhtar olduğunu ilan etti!`);
       setPlayers(prev => prev.map(p => p.name === playerName ? { ...p, isMayorRevealed: true } : p));
    });

    socket.on('gameOver', ({ winnerTitle, results }) => {
      setGamePhase('END');
      setTrial(null);
      setEventNews(`Oyun Bitti! Kazanan: ${winnerTitle}`);
      setGameResults(results);
    });

    socket.on('returnedToLobby', () => {
      setGameState('LOBBY');
      setGamePhase(null);
      setTrial(null);
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
      socket.off('kicked');
      socket.off('returnedToLobby');
      socket.off('connect');
    };
  }, []);

  const handleOpenInvite = () => {
    if (!roomCode) return;
    setShowInviteModal(true);
  };

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
    <div
      className="text-slate-100 font-sans flex flex-col items-center bg-[#050505] h-[100svh] overflow-hidden sm:p-4"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {toast && (
        <div
          className="fixed left-1/2 transform -translate-x-1/2 bg-blood-red text-white px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(127,29,29,0.5)] z-50 animate-bounce font-bold tracking-wider text-sm border border-red-500"
          style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
        >
          {toast}
        </div>
      )}

      {/* ATILDIN MODAL — host tarafindan odadan atilinca acilir */}
      {kickedNotice && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-slate-900 border border-red-900/60 rounded-2xl shadow-[0_0_60px_rgba(220,38,38,0.4)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-7 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-red-600/30 blur-2xl rounded-full" />
                <UserMinus size={56} className="text-red-500 relative drop-shadow-[0_0_12px_rgba(220,38,38,0.7)]" />
              </div>
              <h3 className="font-serif tracking-widest uppercase text-2xl text-red-500 font-bold mb-3 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]">Odadan Atıldın</h3>
              <p className="text-slate-300 text-sm leading-relaxed font-serif italic">
                {kickedNotice}
              </p>
              <p className="text-slate-500 text-[11px] mt-4 uppercase tracking-widest">İstersen oda koduyla geri dönebilirsin</p>
            </div>
            <div className="border-t border-slate-800 p-3">
              <Button variant="danger" size="md" className="w-full" onClick={() => setKickedNotice(null)}>
                Tamam
              </Button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && roomCode && (
        <ShareInviteModal
          roomCode={roomCode}
          onClose={() => setShowInviteModal(false)}
          showToast={showToast}
        />
      )}

      {showFeedbackModal && (
        <FeedbackModal
          gameState={gameState}
          onClose={() => setShowFeedbackModal(false)}
          showToast={showToast}
        />
      )}

      {['INTRO', 'JOIN'].includes(gameState) && (
        <div
          className="fixed bottom-0 left-0 right-0 flex flex-col items-center gap-0.5 pointer-events-none z-[101] select-none"
          style={{ paddingBottom: 'max(2px, env(safe-area-inset-bottom))' }}
        >
          <p className="text-[10px] text-slate-500 tracking-wide">
            <a
              href="https://instagram.com/aekeren"
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto text-slate-400 hover:text-accent active:text-amber-500 transition-colors font-semibold"
            >@aekeren</a>
            <span className="text-slate-600"> tarafından yapılmıştır</span>
          </p>
          <span className="text-[9px] text-slate-700 font-mono tracking-[0.2em] opacity-60">
            {__APP_COMMIT__} · {__APP_BUILD_DATE__}
          </span>
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
                 className="text-slate-400 uppercase tracking-[0.5em] hover:text-white transition-colors duration-1000 animate-pulse text-sm z-20 select-none"
                 style={{ WebkitTouchCallout: 'none' }}
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
                 className="relative z-10 flex flex-col items-center cursor-pointer group select-none"
                 style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                 onClick={() => setGameState('JOIN')}
              >
                 <div className="h-px bg-gradient-to-r from-transparent via-blood-red/60 to-transparent mb-3" style={{ width: 'clamp(6rem, 25vw, 9rem)' }}></div>

                 <div className="relative">
                    <h1
                       className="relative font-serif font-black uppercase leading-none md:text-8xl"
                       style={{
                          fontSize: 'clamp(3.5rem, 17vw, 6rem)',
                          letterSpacing: '0.4em',
                          paddingLeft: '0.4em',
                          backgroundImage: 'linear-gradient(110deg, #b91c1c 0%, #dc2626 30%, #fca5a5 50%, #dc2626 70%, #b91c1c 100%)',
                          backgroundSize: '250% 100%',
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          animation: 'titleFlicker 7s ease-in-out infinite, bloodShimmer 6s linear infinite, bloodGlow 4s ease-in-out infinite',
                       }}
                    >
                       KUYU
                    </h1>

                    {/* Kan damlaları — JOIN ekranıyla birebir aynı */}
                    <span aria-hidden="true" className="absolute left-[18%] top-full w-[3px] h-[4px] rounded-full bg-blood-red origin-top animate-blood-drip pointer-events-none" style={{ animationDelay: '0s', boxShadow: '0 0 6px rgba(127,29,29,0.7)' }}></span>
                    <span aria-hidden="true" className="absolute left-[44%] top-full w-[2.5px] h-[3px] rounded-full bg-red-800 origin-top animate-blood-drip pointer-events-none" style={{ animationDelay: '1.8s', boxShadow: '0 0 5px rgba(127,29,29,0.6)' }}></span>
                    <span aria-hidden="true" className="absolute left-[72%] top-full w-[3px] h-[4px] rounded-full bg-blood-red origin-top animate-blood-drip pointer-events-none" style={{ animationDelay: '3.4s', boxShadow: '0 0 6px rgba(127,29,29,0.7)' }}></span>
                 </div>

                 <div className="flex items-center gap-3 mt-3">
                    <div className="h-px bg-gradient-to-r from-transparent to-blood-red/50" style={{ width: 'clamp(3.5rem, 15vw, 5.5rem)' }}></div>
                    <span className="text-blood-red/70 tracking-widest" style={{ fontSize: 'clamp(0.65rem, 2.5vw, 0.85rem)' }}>✦</span>
                    <div className="h-px bg-gradient-to-l from-transparent to-blood-red/50" style={{ width: 'clamp(3.5rem, 15vw, 5.5rem)' }}></div>
                 </div>

                 <p className="text-slate-400 mt-2 tracking-[0.45em] uppercase font-serif italic group-hover:text-slate-200 transition-colors animate-pulse" style={{ fontSize: 'clamp(0.65rem, 2.5vw, 0.8rem)' }}>
                    Kasabaya Girmek İçin Tıkla
                 </p>
              </div>
           )}
        </div>
      )}

      {gameState !== 'INTRO' && (
        <div className="w-full flex flex-col items-center relative flex-1 min-h-0 overflow-hidden sm:pb-20">

          {!isInGame && gameState !== 'JOIN' && (
            <header className={`w-full max-w-4xl text-center relative z-40 mt-2 mb-3 sm:mb-8 shrink-0 px-4 ${gameState === 'LOBBY' ? 'hidden sm:block' : ''}`}>
              <div className="relative inline-block px-6 sm:px-10 py-2 sm:py-4">
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-blood-red tracking-[0.4em] font-serif drop-shadow-[0_0_15px_rgba(127,29,29,0.7)] cursor-default select-none">
                  KUYU
                </h1>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-blood-red/40 to-transparent mt-2"></div>
                <p className="text-[9px] md:text-[11px] text-slate-500 mt-1 sm:mt-2 tracking-[0.3em] uppercase font-bold italic opacity-60 select-none">Fısıltılar Köyü</p>
              </div>

            </header>
          )}

          {gameState === 'JOIN' && (
            <div className="flex-1 min-h-0 w-full flex flex-col items-center px-4 pb-4 sm:pb-0 overflow-y-auto custom-scrollbar">
              <div className="my-auto w-full max-w-sm flex flex-col items-center gap-3 sm:gap-5 py-3">
                {/* Stylized KUYU logo — directly above the form (4 hızlı tık ile admin panel) */}
                <div
                  onClick={handleKuyuSecretClick}
                  className="relative flex flex-col items-center select-none cursor-default"
                  style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                >
                  <div className="h-px bg-gradient-to-r from-transparent via-blood-red/60 to-transparent mb-3" style={{ width: 'clamp(6rem, 25vw, 9rem)' }}></div>

                  <div className="relative">
                    <h1
                      className="relative font-serif font-black uppercase leading-none md:text-8xl"
                      style={{
                        fontSize: 'clamp(3.5rem, 17vw, 6rem)',
                        letterSpacing: '0.4em',
                        paddingLeft: '0.4em',
                        backgroundImage: 'linear-gradient(110deg, #b91c1c 0%, #dc2626 30%, #fca5a5 50%, #dc2626 70%, #b91c1c 100%)',
                        backgroundSize: '250% 100%',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'titleFlicker 7s ease-in-out infinite, bloodShimmer 6s linear infinite, bloodGlow 4s ease-in-out infinite',
                      }}
                    >
                      KUYU
                    </h1>

                    {/* Kan damlaları — harflerin altından staggered düşer */}
                    <span aria-hidden="true" className="absolute left-[18%] top-full w-[3px] h-[4px] rounded-full bg-blood-red origin-top animate-blood-drip" style={{ animationDelay: '0s', boxShadow: '0 0 6px rgba(127,29,29,0.7)' }}></span>
                    <span aria-hidden="true" className="absolute left-[44%] top-full w-[2.5px] h-[3px] rounded-full bg-red-800 origin-top animate-blood-drip" style={{ animationDelay: '1.8s', boxShadow: '0 0 5px rgba(127,29,29,0.6)' }}></span>
                    <span aria-hidden="true" className="absolute left-[72%] top-full w-[3px] h-[4px] rounded-full bg-blood-red origin-top animate-blood-drip" style={{ animationDelay: '3.4s', boxShadow: '0 0 6px rgba(127,29,29,0.7)' }}></span>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <div className="h-px bg-gradient-to-r from-transparent to-blood-red/50" style={{ width: 'clamp(3.5rem, 15vw, 5.5rem)' }}></div>
                    <span className="text-blood-red/70 tracking-widest" style={{ fontSize: 'clamp(0.65rem, 2.5vw, 0.85rem)' }}>✦</span>
                    <div className="h-px bg-gradient-to-l from-transparent to-blood-red/50" style={{ width: 'clamp(3.5rem, 15vw, 5.5rem)' }}></div>
                  </div>

                  <p className="italic text-slate-500 tracking-[0.45em] uppercase mt-2 font-serif" style={{ fontSize: 'clamp(0.65rem, 2.5vw, 0.8rem)' }}>
                    Fısıltılar Köyü
                  </p>
                </div>

                <Lobby socket={socket} setPlayerName={setPlayerName} playerName={playerName} showToast={showToast} />

                <div className="flex items-center gap-1 flex-wrap justify-center">
                  <a
                    href="/bilgi/"
                    className="group flex items-center gap-2 text-slate-500 hover:text-accent active:text-amber-500 text-[11px] sm:text-xs uppercase tracking-[0.3em] py-2 px-4 transition-colors select-none"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">📜</span>
                    Köyü Gez
                  </a>
                  <span className="text-slate-700">·</span>
                  <a
                    href="/strateji/"
                    className="group flex items-center gap-2 text-slate-500 hover:text-accent active:text-amber-500 text-[11px] sm:text-xs uppercase tracking-[0.3em] py-2 px-4 transition-colors select-none"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">🎯</span>
                    Strateji
                  </a>
                  <span className="text-slate-700">·</span>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="group flex items-center gap-1.5 text-slate-500 hover:text-accent active:text-amber-500 text-[11px] sm:text-xs uppercase tracking-[0.3em] py-2 px-4 transition-colors select-none"
                    title="Bana mesaj yaz"
                  >
                    <MessageSquare size={13} className="group-hover:scale-110 transition-transform" />
                    Geri Bildirim
                  </button>
                </div>
              </div>
            </div>
          )}
      
      {gameState === 'LOBBY' && (
         <div className="w-full max-w-md flex-1 min-h-0 flex flex-col bg-dark-bg sm:rounded-xl border-y sm:border border-slate-800 shadow-2xl mx-0 sm:mx-4 sm:my-2">
           {/* Oda kodu üst bar */}
           <div className="shrink-0 px-3 sm:px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-2xl font-semibold text-accent tracking-widest truncate">Oda: <span className="selectable">{roomCode}</span></h2>
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                 {isHost && (
                    <Button
                       variant="accent"
                       size="sm"
                       pill
                       onClick={(e) => { e.stopPropagation(); handleOpenInvite(); }}
                       title="Davet ve QR"
                    >
                       <Share2 size={16} />
                       Davet
                    </Button>
                 )}
                 <span className="px-2.5 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 font-bold uppercase tracking-widest tabular-nums">{players.length}/16</span>
                 <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleLeave(); }}
                    title="Çıkış"
                 >
                    <LogOut size={15} />
                    Çıkış
                 </Button>
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
                    {players.map((p, i) => {
                       const isMe = p.socketId === socket.id;
                       const isHostRow = p.socketId === players[0]?.socketId;
                       const canKick = isHost && !isMe && !isSpectator;
                       return (
                          <li key={i} className="bg-slate-800 px-4 py-3 rounded-lg flex justify-between items-center shadow-inner gap-2">
                             <span className="font-medium text-slate-200 truncate">{p.name} {isMe && <span className="text-slate-500 text-sm ml-2">(Sen)</span>}</span>
                             <div className="flex items-center gap-2 shrink-0">
                                {isHostRow && <span className="text-amber-500 text-xs font-bold tracking-wider uppercase">Host</span>}
                                {canKick && (
                                   <button
                                      type="button"
                                      onClick={() => setKickTarget({ socketId: p.socketId, name: p.name })}
                                      title={`${p.name} adli oyuncuyu odadan at`}
                                      className="p-1.5 rounded-md text-slate-400 hover:text-blood-red hover:bg-red-950/40 active:bg-red-900/40 transition-colors"
                                   >
                                      <UserMinus size={16} />
                                   </button>
                                )}
                             </div>
                          </li>
                       );
                    })}
                    {players.length === 0 && <li className="text-slate-500 italic text-center py-4">İzleyici modundasın. Oyuncular listeleniyor...</li>}
                    {isSpectator && (
                       <p className="text-center text-accent/80 font-serif text-sm mt-4">Görünmez bir ruh olarak kasabayı izliyorsun.</p>
                    )}
                 </ul>
              )}

              {lobbyTab === 'settings' && (
                 <div className="space-y-6">
                    {!isHost && (
                       <p className="text-xs text-slate-400 bg-slate-800/60 px-3 py-2 rounded text-center uppercase tracking-widest">Sadece kurucu değiştirebilir</p>
                    )}

                    {/* HIZLI MOD PRESETLERI */}
                    <div>
                       <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Hızlı Mod</p>
                          <a href="/strateji/" className="text-[10px] text-accent/80 hover:text-accent transition-colors uppercase tracking-widest">Detaylar →</a>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {MODE_PRESETS.map(preset => (
                             <button
                                key={preset.id}
                                type="button"
                                disabled={!isHost}
                                onClick={() => {
                                   if (!isHost) return;
                                   const newRoles = {};
                                   ROLES_LIST.forEach(r => { newRoles[r.name] = 0; });
                                   preset.roles.forEach(entry => {
                                      if (Array.isArray(entry)) newRoles[entry[0]] = entry[1];
                                      else newRoles[entry] = 1;
                                   });
                                   const newSettings = {
                                      ...settings,
                                      kirmizi: preset.kirmizi,
                                      gri: preset.gri,
                                      yesil: preset.yesil,
                                      roles: newRoles,
                                      // Ozel mod bayragi (varsa) — backend assignRoles farkli mantik calistirir
                                      gameMode: preset.gameMode || 'normal',
                                   };
                                   setSettings(newSettings);
                                   setIsRatioManuallySet(true);
                                   socket.emit('updateSettings', { roomCode, settings: newSettings });
                                   showToast(`${preset.name} modu yüklendi`);
                                }}
                                className="group flex items-center gap-3 bg-slate-800/60 hover:bg-slate-800 active:bg-slate-700 border border-slate-700/70 hover:border-accent/60 rounded-xl px-3 py-2.5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800/60 disabled:hover:border-slate-700/70"
                             >
                                <span className="text-2xl shrink-0">{preset.icon}</span>
                                <div className="min-w-0 flex-1">
                                   <p className="text-sm font-bold text-slate-200 truncate group-hover:text-accent transition-colors">{preset.name}</p>
                                   <p className="text-[10px] text-slate-500 truncate uppercase tracking-wider">{preset.sub}</p>
                                </div>
                                <span className="text-[9px] text-slate-600 font-bold tabular-nums shrink-0 group-hover:text-accent/70 transition-colors">
                                   {preset.kirmizi}/{preset.gri}/{preset.yesil}
                                </span>
                             </button>
                          ))}
                       </div>
                       <p className="text-[10px] text-slate-500 italic mt-2 text-center px-2">
                          Mod seçtiğinde rol ağırlıkları ve ekip sayıları otomatik dolar. Sonradan elle ince ayar yapabilirsin.
                       </p>
                    </div>

                    <div>
                       <p className="text-xs text-slate-400 mb-3 font-semibold uppercase tracking-wider border-b border-slate-800 pb-2">Süreler (Saniye)</p>
                       {/* HIZLI SURE PRESETLERI */}
                       <div className="grid grid-cols-3 gap-2 mb-4">
                          {TIME_PRESETS.map(preset => {
                             const isActive = settings.nightTimer === preset.nightTimer
                                && settings.morningTimer === preset.morningTimer
                                && settings.dayTimer === preset.dayTimer
                                && settings.votingTimer === preset.votingTimer
                                && settings.defenseTimer === preset.defenseTimer;
                             return (
                                <button
                                   key={preset.id}
                                   type="button"
                                   disabled={!isHost}
                                   onClick={() => {
                                      if (!isHost) return;
                                      const newSettings = {
                                         ...settings,
                                         nightTimer: preset.nightTimer,
                                         morningTimer: preset.morningTimer,
                                         dayTimer: preset.dayTimer,
                                         votingTimer: preset.votingTimer,
                                         defenseTimer: preset.defenseTimer,
                                      };
                                      setSettings(newSettings);
                                      socket.emit('updateSettings', { roomCode, settings: newSettings });
                                      showToast(`${preset.name} süre tempo yüklendi`);
                                   }}
                                   className={`group flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                      isActive
                                         ? 'bg-accent/20 border-accent text-accent'
                                         : 'bg-slate-800/60 hover:bg-slate-800 active:bg-slate-700 border-slate-700/70 hover:border-accent/60 text-slate-200'
                                   }`}
                                >
                                   <span className="text-xl leading-none">{preset.icon}</span>
                                   <span className="text-xs font-bold mt-1">{preset.name}</span>
                                   <span className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-accent/80' : 'text-slate-500'}`}>{preset.sub}</span>
                                </button>
                             );
                          })}
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          {['nightTimer', 'morningTimer', 'dayTimer', 'votingTimer', 'defenseTimer'].map(k => {
                             const labelMap = { nightTimer: 'Gece', morningTimer: 'Sabah', dayTimer: 'Gün', votingTimer: 'Hüküm', defenseTimer: 'Savunma' };
                             return (
                                <div key={k} className="flex flex-col">
                                   <label className="text-xs text-slate-300 mb-1.5 font-medium">{labelMap[k]}</label>
                                   <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={3}
                                      disabled={!isHost}
                                      value={settings[k] ?? 0}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                         const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
                                         const num = raw === '' ? 0 : parseInt(raw, 10);
                                         const newSettings = { ...settings, [k]: num };
                                         setSettings(newSettings); socket.emit('updateSettings', { roomCode, settings: newSettings });
                                      }}
                                      className="bg-black border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-yellow-500 focus:ring-1 text-base w-full text-center tabular-nums"
                                   />
                                </div>
                             )
                          })}
                       </div>
                    </div>

                    <div>
                       <div className="flex flex-wrap justify-between items-end gap-2 border-b border-slate-800 pb-2 mb-3">
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Rol Dağılımı</p>
                          <span className="text-[10px] text-slate-500 italic">Eşkıya Başı + Seri Katil sabit</span>
                       </div>
                       <div className="grid grid-cols-3 gap-2">
                          {['kirmizi', 'gri', 'yesil'].map(k => {
                             const labelMap = { kirmizi: 'Kırmızı', gri: 'Gri', yesil: 'Yeşil' };
                             const colorMap = { kirmizi: 'text-blood-red', gri: 'text-slate-400', yesil: 'text-emerald-300' };
                             return (
                                <div key={k} className="flex flex-col">
                                   <label className={`text-xs ${colorMap[k]} font-bold mb-1.5 uppercase tracking-wider`}>{labelMap[k]}</label>
                                   <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={2}
                                      disabled={!isHost}
                                      value={settings[k] ?? 0}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                         setIsRatioManuallySet(true);
                                         const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                                         const num = raw === '' ? 0 : parseInt(raw, 10);
                                         const newSettings = { ...settings, [k]: num };
                                         setSettings(newSettings); socket.emit('updateSettings', { roomCode, settings: newSettings });
                                      }}
                                      className="bg-black border border-slate-700 shadow-inner rounded-lg p-2.5 text-white outline-none focus:border-yellow-500 focus:ring-1 text-base w-full text-center tabular-nums"
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
                       <p className="text-xs text-slate-400 bg-slate-800/60 px-3 py-2 rounded text-center uppercase tracking-widest">Sadece kurucu değiştirebilir</p>
                    )}
                    <p className="text-[10px] text-slate-500 italic text-center px-2">
                       0 = kapalı · 1 = normal · 2-5 = daha sık çıkar
                    </p>
                    {(() => {
                       // Ağırlık normalize: legacy boolean (true/false) → 1/0
                       const weightOf = (v) => {
                          if (v === undefined) return 1;
                          if (typeof v === 'boolean') return v ? 1 : 0;
                          const n = Math.floor(Number(v) || 0);
                          return Math.max(0, Math.min(5, n));
                       };
                       const setWeight = (roleName, newWeight) => {
                          const clamped = Math.max(0, Math.min(5, newWeight));
                          const newRoles = { ...(settings.roles || {}) };
                          newRoles[roleName] = clamped;
                          const newSettings = { ...settings, roles: newRoles };
                          setSettings(newSettings);
                          socket.emit('updateSettings', { roomCode, settings: newSettings });
                       };
                       return ['Masumlar', 'Eşkıyalar', 'Tarafsızlar'].map(group => (
                          <div key={group}>
                             <h3 className={`text-sm font-bold mb-3 uppercase tracking-widest ${group === 'Masumlar' ? 'text-emerald-300' : group === 'Eşkıyalar' ? 'text-blood-red' : 'text-slate-400'}`}>{group}</h3>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {ROLES_LIST.filter(r => r.group === group).map(r => {
                                   const w = weightOf(settings.roles?.[r.name]);
                                   const active = w > 0;
                                   return (
                                      <div key={r.name} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors ${active ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-900/30 border-slate-800/40'}`}>
                                         <span className={`text-sm font-medium truncate ${active ? 'text-slate-200' : 'text-slate-600'}`}>{r.name}</span>
                                         <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                               type="button"
                                               onClick={() => setWeight(r.name, w - 1)}
                                               disabled={!isHost || w <= 0}
                                               aria-label={`${r.name} azalt`}
                                               className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-lg leading-none flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >−</button>
                                            <span className={`w-5 text-center tabular-nums text-sm font-black ${active ? 'text-accent' : 'text-slate-600'}`}>{w}</span>
                                            <button
                                               type="button"
                                               onClick={() => setWeight(r.name, w + 1)}
                                               disabled={!isHost || w >= 5}
                                               aria-label={`${r.name} artir`}
                                               className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-lg leading-none flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >+</button>
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          </div>
                       ));
                    })()}
                 </div>
              )}
           </div>

           {/* Sticky CTA */}
           <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900/40">
              {isHost ? (
                 <Button variant="primary" size="lg" className="w-full" onClick={() => socket.emit('startGame', roomCode)}>
                    Oyunu Başlat ({players.length}/16)
                 </Button>
              ) : (
                 <p className="text-center text-slate-400 animate-pulse text-sm">Köyün kurucusu bekleniyor...</p>
              )}
              <p className="text-center text-[9px] text-slate-700 font-mono tracking-[0.2em] opacity-50 mt-2 select-all">
                 {__APP_COMMIT__} · {__APP_BUILD_DATE__}
              </p>
           </div>

           {/* ODADAN ATMA ONAYI MODAL */}
           {kickTarget && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setKickTarget(null)}>
                 <div className="w-full max-w-sm bg-slate-900 border border-red-900/50 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.3)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="p-6 flex flex-col items-center text-center">
                       <UserMinus size={48} className="text-red-500 mb-3" />
                       <h3 className="font-serif tracking-widest uppercase text-xl text-red-500 font-bold mb-2">Oyuncuyu At?</h3>
                       <p className="text-slate-300 text-sm leading-relaxed">
                          <span className="text-slate-100 font-bold">{kickTarget.name}</span> odadan çıkarılsın mı? Bu kişi isterse yine de oda koduyla geri dönebilir.
                       </p>
                    </div>
                    <div className="flex gap-2 border-t border-slate-800 p-3">
                       <Button variant="neutral" size="md" className="flex-1" onClick={() => setKickTarget(null)}>Vazgeç</Button>
                       <Button
                          variant="danger"
                          size="md"
                          className="flex-1"
                          onClick={() => {
                             socket.emit('hostKick', { roomCode, targetSocketId: kickTarget.socketId });
                             setKickTarget(null);
                          }}
                       >Kuyuya Yolla</Button>
                    </div>
                 </div>
              </div>
           )}
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
           trial={trial}
           dousedList={dousedList}
           gameResults={gameResults}
           revealedNotes={revealedNotes}
           setRevealedNotes={setRevealedNotes}
           isSpectator={isSpectator}
           onOpenFeedback={() => setShowFeedbackModal(true)}
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
