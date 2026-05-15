import React, { useState, useEffect, useRef } from 'react';
import { Send, Moon, Sun, MessageSquare, AlertTriangle, ShieldAlert, BookOpen, X, Flame, Shield, Info, VolumeX, Skull, LogOut, CheckCircle2 } from 'lucide-react';
import TimerDisplay from './TimerDisplay';

function GameBoard({ socket, roomCode, players, gamePhase, myRole, eventNews, systemNotes, isDevMode, dayCount, dousedList, gameResults, revealedNotes, setRevealedNotes, isSpectator, onLeave, isHost, onOpenFeedback, trial = null }) {
  const [impersonateId, setImpersonateId] = useState(null);

  const activeSocketId = (isDevMode && impersonateId) ? impersonateId : socket.id;
  const me = React.useMemo(() => {
    return isSpectator 
      ? { isSpectator: true, isAlive: false, role: 'İzleyici Ruh', name: 'Ruh' } 
      : (players.find(p => p.socketId === activeSocketId) || { isAlive: true, role: myRole, name: '' });
  }, [players, activeSocketId, isSpectator, myRole]);

  const activeRole = React.useMemo(() => {
    return isSpectator ? 'İzleyici Ruh' : ((isDevMode && impersonateId) ? me.role : myRole);
  }, [isSpectator, isDevMode, impersonateId, me.role, myRole]);

  useEffect(() => {
     if (isDevMode && !impersonateId && players.length > 0) {
        setImpersonateId(players[0].socketId);
     }
  }, [isDevMode, players, impersonateId]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [hasActioned, setHasActioned] = useState(false);
  const [lastActionLabel, setLastActionLabel] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notesTab, setNotesTab] = useState('events'); // 'events' | 'will'
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showImpersonateMenu, setShowImpersonateMenu] = useState(false);
  const [personalNotesMap, setPersonalNotesMap] = useState({});
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [voteDetails, setVoteDetails] = useState({});
  const [isSilenced, setIsSilenced] = useState(false);
  const [showSilencedModal, setShowSilencedModal] = useState(false);
  const [skipDayCount, setSkipDayCount] = useState({ count: 0, total: 0 });
  const [judgmentCounts, setJudgmentCounts] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on('chatMessage', (msgObj) => setChatMessages(prev => [...prev, msgObj]));
    socket.on('voteCounts', (data) => {
       setVoteDetails(data.details || {});
    });
    socket.on('judgmentCounts', (data) => {
       setJudgmentCounts(data);
    });
    socket.on('youAreSilenced', () => {
       setIsSilenced(true);
       setShowSilencedModal(true);
    });
    socket.on('skipDayUpdate', (data) => setSkipDayCount(data));
    return () => {
       socket.off('chatMessage');
       socket.off('voteCounts');
       socket.off('judgmentCounts');
       socket.off('youAreSilenced');
       socket.off('skipDayUpdate');
    }
  }, [socket]);

  useEffect(() => {
    setSelectedPlayer(null);
    setHasActioned(false);
    setLastActionLabel(null);
    // DAY veya NIGHT fazına geçişte sohbete gün ayracı koy (silme — geçmiş kalsın)
    if (gamePhase === 'DAY' || gamePhase === 'NIGHT') {
       setChatMessages(prev => {
          const last = prev[prev.length - 1];
          const phaseLabel = gamePhase === 'DAY' ? 'Gün' : 'Gece';
          if (last?.type === 'separator' && last.day === dayCount && last.phase === gamePhase) return prev;
          return [...prev, { type: 'separator', day: dayCount, phase: gamePhase, text: `${dayCount}. ${phaseLabel}` }];
       });
    }
    if(gamePhase === 'NIGHT') setIsSilenced(false);
    if(gamePhase !== 'DAY') {
       setVoteDetails({});
    }
    if(gamePhase !== 'JUDGMENT') {
       setJudgmentCounts(null);
    }
  }, [gamePhase, dayCount]);

  useEffect(() => {
    if (chatEndRef.current && chatMessages.length > 0) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages]);

  useEffect(() => {
    const isModalOpen = showNotes || showRoleModal || showSilencedModal || showGraveyard || (revealedNotes && revealedNotes.length > 0) || gamePhase === 'END';
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showNotes, showRoleModal, showSilencedModal, revealedNotes, gamePhase]);

  const handleAction = (actionType = 'target', isSelfAlert = false) => {
    // actionType: target, pusu, douse, ignite, protect, bos
    if (actionType === 'target' && !selectedPlayer) return;

    const targetName = selectedPlayer ? (players.find(p => p.socketId === selectedPlayer)?.name) : null;

    socket.emit('nightAction', {
       roomCode,
       actionObj: { targetId: selectedPlayer, actionType, isSelfAlert },
       impersonateId: isDevMode ? impersonateId : null
    });

    const labels = {
      target: targetName ? `${targetName} hedef alındı` : 'Hedef onaylandı',
      pusu: 'Pusu kuruldu',
      douse: targetName ? `${targetName} gazlandı` : 'Gazlandı',
      ignite: 'Yakma başlatıldı',
      protect: 'Saklanıyorsun',
      bos: 'Pas geçildi',
    };
    setLastActionLabel(labels[actionType] || 'Eylem onaylandı');
    setHasActioned(true);
  };

  const handleVote = (pass = false) => {
    if (pass) {
      socket.emit('votePlayer', { roomCode, targetId: 'SKIP', impersonateId: isDevMode ? impersonateId : null });
      setLastActionLabel('Pas geçildi');
    } else {
      if(!selectedPlayer) return;
      const targetName = players.find(p => p.socketId === selectedPlayer)?.name;
      socket.emit('votePlayer', { roomCode, targetId: selectedPlayer, impersonateId: isDevMode ? impersonateId : null });
      setLastActionLabel(targetName ? `${targetName} kuyuya oylandı` : 'Oy verildi');
    }
    setHasActioned(true);
  };

  const sendChat = (e) => {
    e.preventDefault();
    const trimmed = currentMessage.trim();
    if (!trimmed) return;

    const baseOpts = { roomCode, impersonateId: isDevMode ? impersonateId : null };

    // /c shortcut — alive eşkıya gündüz çete'ye gizli mesaj atar
    if (me.isAlive && isEskiya && (trimmed.startsWith('/c ') || trimmed === '/c')) {
      const msg = trimmed.replace(/^\/c\s*/, '').trim();
      if (msg) socket.emit('mafiaChatMessage', { ...baseOpts, message: msg });
      setCurrentMessage('');
      return;
    }

    // Ölü/spectator: her fazda ölü boyutuna yaz
    if (!me.isAlive || isSpectator) {
       socket.emit('deadChatMessage', { ...baseOpts, message: trimmed });
    } else if (gamePhase === 'DAY') {
       socket.emit('chatMessage', { ...baseOpts, message: trimmed });
    } else if (gamePhase === 'NIGHT') {
       if (activeRole === 'Gassal') {
          socket.emit('deadChatMessage', { ...baseOpts, message: trimmed });
       } else if (isEskiya) {
          socket.emit('mafiaChatMessage', { ...baseOpts, message: trimmed });
       }
    }
    setCurrentMessage('');
  };

  const getPhaseIcon = () => {
    switch(gamePhase) {
       case 'NIGHT': return <Moon className="w-8 h-8 sm:w-6 sm:h-6 text-slate-300 drop-shadow-[0_0_8px_rgba(148,163,184,0.4)]" />;
       case 'MORNING': return <Sun className="w-8 h-8 sm:w-6 sm:h-6 text-amber-300 animate-spin-slow drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />;
       case 'DAY': return <MessageSquare className="w-8 h-8 sm:w-6 sm:h-6 text-blue-300 drop-shadow-[0_0_6px_rgba(96,165,250,0.4)]" />;
       case 'DEFENSE': return <ShieldAlert className="w-8 h-8 sm:w-6 sm:h-6 text-amber-300 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />;
       case 'JUDGMENT': return <AlertTriangle className="w-8 h-8 sm:w-6 sm:h-6 text-red-300 animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />;
       case 'END': return <ShieldAlert className="w-8 h-8 sm:w-6 sm:h-6 text-accent drop-shadow-[0_0_8px_rgba(217,119,6,0.4)]" />;
       default: return null;
    }
  }

  const getPhaseTextClass = () => {
    switch(gamePhase) {
      case 'NIGHT':   return 'text-slate-100 drop-shadow-[0_0_12px_rgba(148,163,184,0.45)]';
      case 'MORNING': return 'text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]';
      case 'DAY':     return 'text-slate-100 drop-shadow-[0_0_8px_rgba(96,165,250,0.35)]';
      case 'DEFENSE': return 'text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]';
      case 'JUDGMENT': return 'text-red-200 drop-shadow-[0_0_12px_rgba(127,29,29,0.6)]';
      case 'END':     return 'text-amber-300 drop-shadow-[0_0_12px_rgba(217,119,6,0.5)]';
      default:        return 'text-slate-200';
    }
  };

  const getPhasePillClass = () => {
    switch(gamePhase) {
      case 'NIGHT':   return 'bg-slate-900/70 border-slate-700/80 shadow-[inset_0_0_18px_rgba(148,163,184,0.08)]';
      case 'MORNING': return 'bg-amber-950/40 border-amber-800/50 shadow-[inset_0_0_18px_rgba(251,191,36,0.12)]';
      case 'DAY':     return 'bg-slate-900/60 border-slate-700/70 shadow-[inset_0_0_14px_rgba(96,165,250,0.08)]';
      case 'DEFENSE': return 'bg-amber-950/40 border-amber-800/50 shadow-[inset_0_0_20px_rgba(251,191,36,0.15)]';
      case 'JUDGMENT': return 'bg-red-950/50 border-red-900/60 shadow-[inset_0_0_20px_rgba(127,29,29,0.20)]';
      case 'END':     return 'bg-amber-950/40 border-amber-800/50 shadow-[inset_0_0_18px_rgba(217,119,6,0.15)]';
      default:        return 'bg-slate-900/50 border-slate-800';
    }
  };

  const getPhaseNameTR = () => {
    switch(gamePhase) {
      case 'NIGHT': return `${dayCount}. Gece Çöktü`;
      case 'MORNING': return `${dayCount}. Gün Sabahı`;
      case 'DAY': return `${dayCount}. Gün (Tartışma)`;
      case 'DEFENSE': return `${dayCount}. Gün (Savunma)`;
      case 'JUDGMENT': return `${dayCount}. Gün (Hüküm Vakti)`;
      case 'END': return 'Oyun Bitti';
      default: return 'Bekleniyor...';
    }
  };

  // ROLE LOGIC
  const isEskiya = ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'].includes(activeRole);
  const hasNightTargetAction = ['Şifacı', 'Bekçi', 'Eşkıya Başı', 'Eşkıya', 'Seri Katil', 'Münafık', 'Gözcü', 'Falcı', 'Tefeci', 'Meyhaneci', 'Eskort'].includes(activeRole);
  
  const isAvci = activeRole === 'Avcı';
  const isKundakci = activeRole === 'Kundakçı';
  const isYanasma = activeRole === 'Kaçak';
  const isMuhtar = activeRole === 'Muhtar';
  
  // İzleyiciler de Gassal gibi ölü konuşmalarını görebilsin
  const canSeeDeadChat = isSpectator || !me.isAlive || activeRole === 'Gassal';

  // Chat Input Yetkisi
  // - Spectator: hiç yazamaz, sadece izler
  // - Ölü: her fazda ölü chat'e yazar
  // - Alive: DAY'de day, NIGHT'ta eskiya→mafia, Gassal→dead, masum→yazamaz
  const canSendChat = !isSpectator && (
    !me.isAlive ? true :
    gamePhase === 'DAY' ? true :
    gamePhase === 'NIGHT' ? (isEskiya || activeRole === 'Gassal') :
    false
  );

  // Yazma kanalı — input nereye gönderir
  const chatChannel =
    (!me.isAlive || isSpectator) ? 'dead' :
    gamePhase === 'NIGHT' && canSeeDeadChat ? 'dead' :
    gamePhase === 'NIGHT' && isEskiya ? 'mafia' :
    gamePhase === 'DAY' ? 'day' :
    'day';

  // Okuma erişimi — viewer hangi kanalları görebilir
  // Spectator: dead
  // Ölü eşkıya: day + dead + mafia (3'ünü de izler, sadece dead'e yazar)
  // Ölü diğer: day + dead
  // Alive eşkıya: day + mafia (gece /c gündüz de görür)
  // Alive Gassal: day + dead
  // Alive masum: day
  const readAccess = React.useMemo(() => {
    const s = new Set();
    if (isSpectator) { s.add('dead'); return s; }
    if (!me.isAlive) {
      s.add('day'); s.add('dead');
      if (isEskiya) s.add('mafia');
      return s;
    }
    if (isEskiya) { s.add('day'); s.add('mafia'); return s; }
    if (activeRole === 'Gassal') { s.add('day'); s.add('dead'); return s; }
    s.add('day');
    return s;
  }, [isSpectator, me.isAlive, isEskiya, activeRole]);

  const visibleMessages = React.useMemo(() => {
    return chatMessages.filter(c => {
      if (c.type === 'separator') return true;
      const ch = c.type || 'day';
      return readAccess.has(ch);
    });
  }, [chatMessages, readAccess]);

  // ANIMASYON EFEKTLERI STATE'I
  const [animEffect, setAnimEffect] = useState(null); // 'death', 'well'
  const [animText, setAnimText] = useState('');

  // Sadece Sabahları ve Oylama sonuçlarında çıkan mesajları inceleyip animasyon tetikliyoruz
  useEffect(() => {
     if (eventNews) {
        if (eventNews.includes('kurban gitti')) {
           // Biri gece öldü
           if (eventNews.includes(me?.name)) {
              // Biz öldük
              setAnimEffect('death');
              setAnimText('KANINA GİRDİLER');
           }
        } 
        else if (eventNews.includes('kuyuya fırlatıldı')) {
           // Biri kuyuya atıldı
           setAnimEffect('well');
           if (eventNews.includes(me?.name)) {
              setAnimText('KUYUYA ATILDIN');
           } else {
              setAnimText('BİRİ KUYUYA DÜŞTÜ');
           }
        }
        
        // 4 saniye sonra efekti kapat
        setTimeout(() => setAnimEffect(null), 4000);
     }
  }, [eventNews, me?.name]);

  // Night valid targets 
  let nightTargets = players.filter(p => p.isAlive).filter(p => {
     if (p.socketId === activeSocketId) {
        if (activeRole === 'Şifacı' && (me.uses || 0) < 2) return true;
        return false;
     }
     return true;
  });

  if (isEskiya) {
     nightTargets = nightTargets.map(p => {
        if (['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'].includes(p.role)) {
           return { ...p, isTeam: true };
        }
        return p;
     });
  }

  const getTeamColor = (role) => {
    const evils = ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'];
    const neutrals = ['Köy Delisi', 'Kan Davalı', 'Kaçak', 'Seri Katil', 'Kundakçı'];

    if (evils.includes(role)) return 'text-blood-red drop-shadow-[0_0_8px_rgba(127,29,29,0.8)]'; // Kırmızı
    if (neutrals.includes(role)) return 'text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.8)]'; // Gri
    return 'text-emerald-300 drop-shadow-[0_0_5px_rgba(110,231,183,0.35)]'; // Yeşil (Masumlar) — muted
  };

  const getTeamName = (role) => {
    const evils = ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'];
    const neutrals = ['Köy Delisi', 'Kan Davalı', 'Kaçak', 'Seri Katil', 'Kundakçı'];
    if (evils.includes(role)) return 'Kırmızı Takım';
    if (neutrals.includes(role)) return 'Gri Takım';
    return 'Yeşil Takım';
  };

  const ROLE_INFO = {
    'Şifacı': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/sifaci.webp',
      ability: '🌿 Her gece bir kişiyi iyileştirir',
      desc: 'Köyün bilge otacısı. Her gece bir oyuncunun kapısına giderek onu gece saldırılarından korur. Eğer o gece hedefi saldırıya uğrarsa, hayatta kalır. Kendini oyun boyunca yalnızca 2 kez iyileştirebilir.',
    },
    'Bekçi': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/bekci.webp',
      ability: '🔦 Her gece bir kişiyi kontrol eder',
      desc: 'Geceleri elinde fenerle sokakları arşınlar. Seçtiği kişinin eşkıya olup olmadığını araştırır. Eşkıya Başı kontrol edildiğinde masum görünür; Münafık tarafından çerçevelenmiş biri ise eşkıya gibi görünür.',
    },
    'Avcı': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/avci.webp',
      ability: '🪤 Sınırlı sayıda pusu kurabilir (3 hak)',
      desc: 'Eski bir dağ adamı, tetikte uyur. "Pusuya Yat" seçeneğiyle o gece evine gelen herkesi, masum ya da değil, vurur. Gece koruması yoktur. Sınırlı sayıda kullanım hakkı vardır.',
    },
    'Muhtar': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/muhtar.webp',
      ability: '🔏 Mühür vurarak oyunu ağırlığını ortaya koyar',
      desc: 'Köyün mühürdarı. Oyuna gizli bir zırh (tek seferlik yelek) ile başlar, geceleri ilk saldırıdan sağ kurtulur. Gündüz "Mührü Vur" diyerek kimliğini ilan edebilir. Bu andan itibaren oylamalarda oyu 3 sayılır; ancak Şifacı kendisini bir daha koruyamaz. Susturulmuşsa mührü vuramaz.',
    },
    'Gözcü': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/gozcu.webp',
      ability: '🕵️ Bir kişinin evini gözetler',
      desc: 'Gece uyku tutmaz, başkalarının işine burnunu sokar. Bir kişinin kapısını gözlemler: o gece o kişiyi kim ziyaret etmiş görür. Ama içeride ne yaptıklarını bilemez.',
    },
    'Falcı': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/falci.webp',
      ability: '🔮 Olası 3 rolden oluşan kehanet alır',
      desc: 'Kahve telvesinden geleceği okur. Her gece bir kişiyi hedefler; sistem ona o kişinin olası 3 rolünden oluşan bir kehanet sunar. Münafık tarafından çerçevelenmiş biri farklı bir kehanet üretir.',
    },
    'Gassal': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/gassal.webp',
      ability: '💀 Ölü konuşmalarını dinleyebilir',
      desc: 'Ölü yıkayıcısıdır. Gece yetenekli değildir ama öte dünyaya kapısı açıktır: ölmüş oyuncuların kendi aralarında yaptığı "Ölüler Boyutu" sohbetini canlı olarak görebilir.',
    },
    'Eskort': {
      color: 'text-emerald-300', team: 'Yeşil Takım', teamColor: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60',
      image: '/roles/eskort.webp',
      ability: '💃 Hedefini oyalar, yeteneğini engeller',
      desc: 'Her gece bir kişiyi ziyaret eder ve onu sabaha kadar oyalar. O kişi o gece hiçbir yeteneğini kullanamaz. Eşkıyaları bile etkisiz kılabilir; eşkıyalar da onu ziyaret ederse ölebilir.',
    },
    'Eşkıya Başı': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/eskiya_basi.webp',
      ability: '🗡️ Her gece öldürme emri verir',
      desc: 'Çetenin acımasız lideri. Gece saldırılarına bağışıktır. Bekçi onu kontrol etse masum görünür (kan bulaşmamışsa). Kimin öldürüleceğini o belirler. Eşkıyalar ona karşı çıkamaz.',
    },
    'Münafık': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/munafik.webp',
      ability: '🎭 Bir kişiyi yanlış gösterir',
      desc: 'Gece bir kişiyi hedefler. O gece Bekçi veya Falcı o kişiyi araştırırsa, sistem o kişiyi sanki eşkıyaymış gibi gösterir. Masum biri haksız yere şüphe altına girebilir.',
    },
    'Eşkıya': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/eskiya.webp',
      ability: '🔪 Eşkıya Başı ile koordineli saldırır',
      desc: 'Çetenin yardımcısı. Eşkıya Başı seçmezse inisiyatif alıp kendi hedefini vurabilir. Takım olarak hareket eder; gece kimin öldürüleceğini birlikte planlarlar.',
    },
    'Tefeci': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/tefeci.webp',
      ability: '🤐 Birini bir gün susturur',
      desc: 'Faiz ve tehditle geçimini sağlar. Her gece bir kişiyi hedefler; ertesi gün o kişi tartışmada hiçbir şey yazamaz (susturulur). Susturulan Muhtar mührünü de vuramaz.',
    },
    'Meyhaneci': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/meyhaneci.webp',
      ability: '💋 Hedefini bir gece işe yaramaz hale getirir',
      desc: 'Eşkıyaların kiralık engelleyicisi. Gece bir kişiyi ziyaret eder; o kişi o gece yeteneğini kullanamaz. Masum roller bile devre dışı kalabilir. Eskort gibi çalışır ama kötü amaçlıdır.',
    },
    'Kan Davalı': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/kan_davali.webp',
      ability: '⚔️ Tek bir kişiyi kuyuya attırmak zorundadır',
      desc: 'Gözünü intikam hırsı bürümüştür. Gece saldırılarına bağışıktır. Oyun başı rastgele bir "kan hasımı" atanır; bu kişiyi gündüz oylamayla kuyuya attırmak zorundadır. Hasım başka bir şekilde ölürse Köy Delisi\'ne dönüşür.',
    },
    'Kundakçı': {
      color: 'text-orange-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/kundakci.webp',
      ability: '🔥 Evleri yakabilir, son kişi olmak ister',
      desc: 'Herkesi yakıp en son kalan olmayı hedefler. Gece saldırılarına bağışıktır. Bir gece evlere gazyağı dökebilir, başka bir gece hepsini ateşe verebilir. Kendi kendine bir kaos yaratır.',
    },
    'Kaçak': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/kacak.webp',
      ability: '🛡️ Sınırlı sayıda kapısını kilitler (4 hak)',
      desc: 'Sadece hayatta kalmayı hedefler. Kim kazanırsa kazansın, oyunun sonuna kadar sağ kalırsa kazanır. Saldırılardan korunmak için kapısını kilitleyebilir ama bu hak sınırlıdır.',
    },
    'Köy Delisi': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/koy_delisi.webp',
      ability: '🪦 Kendisini kuyuya attırmak ister',
      desc: 'Aklını yitirmiş, kuyunun karanlığına çekilmiş biri. Tek amacı gündüz kendini oylamayla kuyuya attırmaktır. Başarılırsa kazanır ve oy verenlerden birini kuyuya çeker. Gece eylemsizdir.',
    },
    'Seri Katil': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/seri_katil.webp',
      ability: '🩸 Her gece bir kişiyi öldürür',
      desc: 'Yalnız hareket eden, gözü dönmüş bir cani. Gece bağışıklığı vardır. Hiçbir takıma bağlı olmaksızın her gece bir kişiyi öldürür. Köyde tek başına hayatta kalan kişi olursa kazanır.',
    },
  };

  return (
    <div className={`w-full max-w-4xl flex flex-col gap-0 sm:gap-2 p-0 sm:p-6 rounded-none sm:rounded-2xl transition-all duration-1000 ${gamePhase === 'NIGHT' ? 'bg-black text-slate-400 shadow-[0_0_30px_rgba(0,0,0,0.8)]' : 'bg-dark-bg text-slate-100 shadow-2xl'} border-0 sm:border border-slate-800 h-full sm:h-auto sm:min-h-[75vh] overflow-hidden`}>
      
      {isDevMode && (
         <div className="shrink-0 relative z-10 bg-yellow-900/30 border border-yellow-700 p-2 rounded-xl mb-1 flex items-center justify-between">
            <span className="text-yellow-500 font-bold tracking-wider uppercase text-[10px] hidden md:inline">Geliştirici Kumandası</span>
            <div className="flex items-center gap-2 ml-auto">
               <button type="button" onClick={() => socket.emit('forceNextPhase', roomCode)} title="Mevcut süreyi atla" className="bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 text-white font-bold px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-lg border border-yellow-500 transition-all shadow-md whitespace-nowrap">
                 Faza Geç ⏭
               </button>
               <div className="relative">
                  <button
                     type="button"
                     onClick={() => setShowImpersonateMenu(true)}
                     className="bg-black text-yellow-500 border border-yellow-700 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-yellow-500 w-[120px] md:w-auto text-[10px] flex items-center justify-between gap-2 hover:bg-yellow-950/40 transition-colors"
                  >
                     <span className="truncate">
                        {(() => {
                           const p = players.find(pl => pl.socketId === impersonateId);
                           return p ? `${p.name}${p.isAlive ? '' : ' (ÖLÜ)'}` : 'Seç';
                        })()}
                     </span>
                     <span className="text-yellow-700 text-[8px]">▼</span>
                  </button>
               </div>
            </div>
         </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-900/80 sm:bg-slate-900/60 px-3 py-2 sm:p-4 rounded-none sm:rounded-xl border-0 border-b sm:border border-slate-800 backdrop-blur-sm gap-2 sm:gap-2 shrink-0">

        <div className="flex gap-2 sm:gap-4 items-center flex-1 min-w-0 w-full sm:w-auto">
           <div className={`p-3 sm:p-2.5 rounded-full border shadow-inner shrink-0 transition-colors duration-700 ${getPhasePillClass()}`}>
             {getPhaseIcon()}
           </div>
           <div className="flex-1 min-w-0">
             <div className={`inline-flex max-w-full items-center px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg border backdrop-blur-sm transition-all duration-700 ${getPhasePillClass()}`}>
               <h2 className={`text-sm sm:text-lg font-bold tracking-[0.2em] sm:tracking-[0.25em] font-serif uppercase truncate leading-tight transition-colors duration-700 ${getPhaseTextClass()}`}>{getPhaseNameTR()}</h2>
             </div>
             <div className="text-[11px] sm:text-xs font-medium mt-1 sm:mt-0.5 text-slate-400 flex items-center gap-1.5 sm:gap-1 flex-wrap">
               <span
                 className={`uppercase tracking-widest cursor-pointer select-none px-2.5 sm:px-1.5 py-1 sm:py-0.5 rounded-lg sm:rounded transition-all duration-300 ${isRoleVisible || isSpectator ? getTeamColor(activeRole) + ' bg-slate-900/80 border border-current' : 'text-slate-600 bg-slate-800 border border-slate-700'}`}
                 onClick={() => !isSpectator && setIsRoleVisible(!isRoleVisible)}
               >
                 {isSpectator ? 'İzleyici' : (isRoleVisible ? activeRole : 'ROLÜN')}
               </span>
               {!isSpectator && isRoleVisible && activeRole === 'Şifacı' && <span className="text-[10px] sm:text-[9px] bg-emerald-950/50 text-emerald-300 px-2 sm:px-1.5 py-0.5 rounded font-bold border border-emerald-800/50 uppercase tracking-widest" title="Kendini Koruma Hakkı">Kalkan: {2 - (me.uses || 0)}</span>}
               {!isSpectator && isRoleVisible && activeRole === 'Avcı' && <span className="text-[10px] sm:text-[9px] bg-amber-900/50 text-amber-400 px-2 sm:px-1.5 py-0.5 rounded font-bold border border-amber-700/50 uppercase tracking-widest" title="Pusu Kurma Hakkı">Pusu: {3 - (me.uses || 0)}</span>}
               {!isSpectator && isRoleVisible && activeRole === 'Kaçak' && <span className="text-[10px] sm:text-[9px] bg-emerald-950/50 text-emerald-300 px-2 sm:px-1.5 py-0.5 rounded font-bold border border-emerald-800/50 uppercase tracking-widest" title="Saklanma Hakkı">Saklanma: {4 - (me.uses || 0)}</span>}
               <button onClick={() => setShowRoleModal(true)} className="text-slate-500 hover:text-yellow-500 active:text-yellow-400 transition-colors p-1 sm:p-0 -m-1 sm:m-0">
                 <Info className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
               </button>
               {onOpenFeedback && (
                 <button onClick={onOpenFeedback} className="text-slate-500 hover:text-accent active:text-amber-400 transition-colors p-1 sm:p-0 -m-1 sm:m-0" title="Geri Bildirim">
                   <MessageSquare className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
                 </button>
               )}
             </div>
           </div>
           <div className="sm:hidden shrink-0">
             <TimerDisplay socket={socket} />
           </div>
        </div>

        <div className="flex items-stretch sm:items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
           <button onClick={() => setShowGraveyard(true)} className="lg:hidden flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 py-3 sm:p-2.5 px-2 sm:px-0 bg-slate-800 rounded-2xl sm:rounded-full border border-slate-700 hover:border-slate-500 active:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-md relative min-h-[64px] sm:min-h-0">
             <Skull className="w-7 h-7 sm:w-5 sm:h-5" />
             <span className="sm:hidden text-[10px] font-bold uppercase tracking-widest">Mezarlık</span>
           </button>
           <button onClick={() => setShowNotes(true)} className="flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 py-3 sm:p-2.5 px-2 sm:px-0 bg-slate-800 rounded-2xl sm:rounded-full border border-slate-700 hover:border-accent active:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-md relative min-h-[64px] sm:min-h-0">
             <BookOpen className="w-7 h-7 sm:w-5 sm:h-5" />
             <span className="sm:hidden text-[10px] font-bold uppercase tracking-widest">Notlar</span>
             {systemNotes?.length > 0 && <span className="absolute top-2 right-2 sm:-top-1 sm:-right-1 bg-blood-red w-3.5 h-3.5 sm:w-3 sm:h-3 rounded-full animate-pulse border border-dark-bg"></span>}
           </button>
           <div className="hidden sm:block">
             <TimerDisplay socket={socket} />
           </div>
           <button
              onClick={() => setShowLeaveConfirm(true)}
              title="Kasabayı Terket"
              className="flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 py-3 sm:p-2.5 px-2 sm:px-0 bg-red-950/40 rounded-2xl sm:rounded-full border border-red-900/60 hover:bg-red-900/60 hover:border-red-500 active:bg-red-900/60 text-red-400 hover:text-white transition-all shadow-md min-h-[64px] sm:min-h-0"
           >
             <LogOut className="w-7 h-7 sm:w-5 sm:h-5" />
             <span className="sm:hidden text-[10px] font-bold uppercase tracking-widest">Çıkış</span>
           </button>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-500 shrink-0 ${eventNews ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="relative bg-gradient-to-r from-blood-red/70 via-blood-red/30 to-transparent p-3 sm:p-4 rounded-none sm:rounded-xl border-l-4 border-red-500 flex items-center gap-3 shadow-[0_0_25px_rgba(127,29,29,0.4)] mb-0 sm:mb-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(127,29,29,0.4),transparent_60%)] pointer-events-none"></div>
          <AlertTriangle className="text-red-300 shrink-0 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)] relative z-10" size={20} />
          <p className="relative z-10 text-sm sm:text-lg font-medium text-slate-50 italic font-serif tracking-wide leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{eventNews}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 sm:gap-4 flex-1 mt-0 sm:mt-2 overflow-hidden min-h-0">

      <div className="flex-1 flex flex-col relative sm:rounded-xl border-0 sm:border border-slate-800/50 bg-black/10 overflow-hidden min-h-0">
        
        {/* ÜST: AKSİYON ALANI (Gece Seçimleri, Oylama, Haberler) */}
        <div className={`transition-all duration-500 overflow-hidden border-b border-slate-800/30 bg-slate-900/40 ${['NIGHT', 'DAY', 'DEFENSE', 'JUDGMENT', 'MORNING'].includes(gamePhase) ? 'min-h-[140px] max-h-[220px]' : 'max-h-[0px]'}`}>

           {/* ONAYLANMIŞ EYLEM DURUMU — panel kapanmasın, kullanıcı geri bildirim görsün */}
           {hasActioned && ['NIGHT'].includes(gamePhase) && me.isAlive && !isSpectator && (
              <div className="p-3 h-full flex items-center justify-center animate-in fade-in duration-300">
                 <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-800/50 px-5 py-3 rounded-2xl shadow-[0_0_18px_rgba(110,231,183,0.08)] max-w-sm w-full">
                    <CheckCircle2 className="text-emerald-300 shrink-0 w-8 h-8 sm:w-6 sm:h-6" />
                    <div className="flex flex-col min-w-0 flex-1">
                       <p className="text-emerald-300 text-xs sm:text-[11px] font-black uppercase tracking-widest">Onaylandı</p>
                       <p className="text-slate-200 text-sm sm:text-xs font-medium truncate">{lastActionLabel || 'Eylem kaydedildi'}</p>
                    </div>
                 </div>
              </div>
           )}

           {/* GECE AKSİYONLARI */}
           {gamePhase === 'NIGHT' && me.isAlive && !isSpectator && !hasActioned && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 {hasNightTargetAction && (
                    <div className="w-full">
                       <div className="flex justify-between items-center mb-2 px-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                             <p className="text-blood-red text-[11px] sm:text-[10px] font-black tracking-widest uppercase shrink-0">Hedef Seç</p>
                             {activeRole === 'Şifacı' && (
                                <span className="text-[9px] text-emerald-300/80 font-bold uppercase tracking-wider truncate">
                                   (Kendini Koruma: {2 - (me.uses || 0)})
                                </span>
                             )}
                          </div>
                          {selectedPlayer && (
                             <button onClick={() => handleAction('target')} className="bg-blood-red text-white text-xs sm:text-[9px] font-black uppercase px-5 sm:px-4 py-2.5 sm:py-1.5 rounded-full shadow-[0_0_10px_rgba(127,29,29,0.5)] animate-pulse shrink-0">Onayla</button>
                          )}
                       </div>
                       <PlayerList players={nightTargets} selected={selectedPlayer} onSelect={setSelectedPlayer} isNight={true} isDevMode={isDevMode} />
                    </div>
                 )}
                 {isAvci && (
                    <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 max-w-sm mx-auto w-full gap-2">
                       <div className="flex flex-col min-w-0">
                          <p className="text-[11px] sm:text-[10px] text-amber-500 font-bold uppercase">Pusu Modu</p>
                          <p className="text-[10px] sm:text-[9px] text-slate-400">Kalan: {3 - (me.uses || 0)}</p>
                       </div>
                       <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleAction('pusu', true)} disabled={(me.uses || 0) >= 3} className="px-5 sm:px-4 py-3 sm:py-2 bg-accent hover:bg-amber-700 text-white text-xs sm:text-[9px] font-black rounded-lg uppercase disabled:opacity-50 transition-colors">Pusu Kur</button>
                          <button onClick={() => handleAction('bos', false)} className="px-5 sm:px-4 py-3 sm:py-2 bg-slate-700 text-slate-300 text-xs sm:text-[9px] font-black rounded-lg uppercase">Pas</button>
                       </div>
                    </div>
                 )}
                 {isKundakci && (
                    <div className="w-full">
                       <div className="flex justify-between items-center mb-2 px-2 gap-2">
                          <p className="text-orange-500 text-[11px] sm:text-[10px] font-black tracking-widest uppercase shrink-0">Kundaklama</p>
                          <div className="flex gap-2 shrink-0">
                             <button onClick={() => handleAction('ignite', true)} className="bg-blood-red hover:bg-red-800 text-white text-xs sm:text-[9px] font-black uppercase px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full flex items-center gap-1 shadow-lg transition-colors"><Flame className="w-3.5 h-3.5 sm:w-2.5 sm:h-2.5"/>Yak</button>
                             {selectedPlayer && <button onClick={() => handleAction('douse')} className="bg-orange-800 hover:bg-orange-700 text-white text-xs sm:text-[9px] font-black uppercase px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full transition-colors">Gazla</button>}
                          </div>
                       </div>
                       <PlayerList players={nightTargets} selected={selectedPlayer} onSelect={setSelectedPlayer} isNight={true} isDevMode={isDevMode} dousedList={dousedList} />
                    </div>
                 )}
                 {isYanasma && (
                    <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 max-w-sm mx-auto w-full gap-2">
                       <div className="flex flex-col min-w-0">
                          <p className="text-[11px] sm:text-[10px] text-emerald-300 font-bold uppercase">Saklanma</p>
                          <p className="text-[10px] sm:text-[9px] text-slate-400">Kalan: {4 - (me.uses || 0)}</p>
                       </div>
                       <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleAction('protect', true)} disabled={(me.uses || 0) >= 4} className="px-5 sm:px-4 py-3 sm:py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs sm:text-[9px] font-black rounded-lg uppercase disabled:opacity-50 transition-colors">Saklan</button>
                          <button onClick={() => handleAction('bos', false)} className="px-5 sm:px-4 py-3 sm:py-2 bg-slate-700 text-slate-300 text-xs sm:text-[9px] font-black rounded-lg uppercase">Pas</button>
                       </div>
                    </div>
                 )}
              </div>
           )}

           {/* GÜNDÜZ CANLI SUÇLAMA OYU */}
           {gamePhase === 'DAY' && me.isAlive && !isSpectator && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 <div className="flex justify-between items-center mb-2 px-2 gap-2">
                    <p className="text-accent text-[11px] sm:text-[10px] font-black tracking-widest uppercase shrink-0">Kuyuya Oyla</p>
                    <div className="flex gap-2 shrink-0">
                       <button onClick={() => socket.emit('withdrawVote', { roomCode, impersonateId: isDevMode ? impersonateId : null })} className="bg-slate-700 text-slate-300 text-xs sm:text-[9px] font-black uppercase px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full">Oyu Geri Al</button>
                       {selectedPlayer && <button onClick={() => handleVote(false)} className="bg-accent text-white text-xs sm:text-[9px] font-black uppercase px-5 sm:px-4 py-2.5 sm:py-1.5 rounded-full shadow-lg">Oyla</button>}
                    </div>
                 </div>
                 <PlayerList players={players.filter(p => p.socketId !== activeSocketId && p.isAlive)} selected={selectedPlayer} onSelect={setSelectedPlayer} isDevMode={isDevMode} />
              </div>
           )}

           {/* SAVUNMA */}
           {gamePhase === 'DEFENSE' && (
              <div className="p-3 h-full flex items-center justify-center animate-in fade-in duration-300">
                 <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/50 px-5 py-3 rounded-2xl shadow-[0_0_18px_rgba(251,191,36,0.10)] max-w-md w-full">
                    <ShieldAlert className="text-amber-300 shrink-0 w-9 h-9 sm:w-7 sm:h-7 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <div className="flex flex-col min-w-0 flex-1">
                       <p className="text-amber-300 text-xs sm:text-[11px] font-black uppercase tracking-widest">Savunma</p>
                       <p className="text-slate-200 text-sm sm:text-xs font-serif italic">🪦 {trial?.accusedName || 'Sanık'} kuyu başında kendini savunuyor…{trial && me.socketId === trial.accusedId ? ' (Konuşma hakkı sende!)' : ''}</p>
                    </div>
                 </div>
              </div>
           )}

           {/* HÜKÜM */}
           {gamePhase === 'JUDGMENT' && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 {trial && me.isAlive && !isSpectator && me.socketId !== trial.accusedId ? (
                    <div className="flex flex-col items-center gap-3">
                       <p className="text-red-200 text-[11px] sm:text-[10px] font-black tracking-widest uppercase">{trial.accusedName} asılsın mı?</p>
                       <div className="flex gap-3">
                          <button onClick={() => socket.emit('judgmentVote', { roomCode, verdict: 'GUILTY', impersonateId: isDevMode ? impersonateId : null })} className="bg-blood-red text-white text-sm sm:text-xs font-black uppercase px-6 py-3 rounded-xl shadow-lg">Suçlu</button>
                          <button onClick={() => socket.emit('judgmentVote', { roomCode, verdict: 'SPARE', impersonateId: isDevMode ? impersonateId : null })} className="bg-emerald-800 text-white text-sm sm:text-xs font-black uppercase px-6 py-3 rounded-xl shadow-lg">Affet</button>
                          <button onClick={() => socket.emit('withdrawVote', { roomCode, impersonateId: isDevMode ? impersonateId : null })} className="bg-slate-700 text-slate-300 text-xs font-black uppercase px-4 py-3 rounded-xl">Geri Al</button>
                       </div>
                       {judgmentCounts && <p className="text-[10px] text-slate-400 uppercase tracking-wider">Suçlu {judgmentCounts.guiltyW} — Affet {judgmentCounts.spareW}</p>}
                    </div>
                 ) : (
                    <div className="flex items-center justify-center h-full">
                       <p className="text-slate-200 text-sm sm:text-xs font-serif italic">{trial && me.socketId === trial.accusedId ? 'Yargılanıyorsun — oy veremezsin, kaderini bekle…' : 'Köy hüküm veriyor…'}</p>
                    </div>
                 )}
              </div>
           )}

           {/* SABAH DURUMU */}
           {gamePhase === 'MORNING' && (
              <div className="p-3 h-full flex items-center justify-center animate-in fade-in duration-300">
                 <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/50 px-5 py-3 rounded-2xl shadow-[0_0_18px_rgba(251,191,36,0.10)] max-w-sm w-full">
                    <Sun className="text-amber-300 shrink-0 w-9 h-9 sm:w-7 sm:h-7 animate-spin-slow drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <div className="flex flex-col min-w-0 flex-1">
                       <p className="text-amber-300 text-xs sm:text-[11px] font-black uppercase tracking-widest">Sabah</p>
                       <p className="text-slate-200 text-sm sm:text-xs font-serif italic">Haberler hazırlanıyor...</p>
                    </div>
                 </div>
              </div>
           )}

           {/* GECE — aksiyon yok (ekstra rol veya dead/spectator) */}
           {gamePhase === 'NIGHT' && !hasActioned && (isSpectator || !me.isAlive || (!hasNightTargetAction && !isAvci && !isKundakci && !isYanasma)) && (
              <div className="p-3 h-full flex items-center justify-center animate-in fade-in duration-300">
                 <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-700/60 px-5 py-3 rounded-2xl shadow-[0_0_18px_rgba(148,163,184,0.06)] max-w-sm w-full">
                    <Moon className="text-slate-300 shrink-0 w-9 h-9 sm:w-7 sm:h-7 drop-shadow-[0_0_8px_rgba(148,163,184,0.4)]" />
                    <div className="flex flex-col min-w-0 flex-1">
                       <p className="text-slate-300 text-xs sm:text-[11px] font-black uppercase tracking-widest">Gece</p>
                       <p className="text-slate-200 text-sm sm:text-xs font-serif italic">{isSpectator ? 'Ruh olarak köyü izliyorsun...' : !me.isAlive ? 'Mezarından olanları izliyorsun...' : 'Köy uykuda, gölgeler hareketleniyor...'}</p>
                    </div>
                 </div>
              </div>
           )}

           {/* HÜKÜM — dead/spectator için bekleme */}
           {gamePhase === 'JUDGMENT' && (isSpectator || !me.isAlive) && (
              <div className="p-3 h-full flex items-center justify-center animate-in fade-in duration-300">
                 <div className="flex items-center gap-3 bg-red-950/30 border border-red-900/50 px-5 py-3 rounded-2xl shadow-[0_0_18px_rgba(127,29,29,0.12)] max-w-sm w-full">
                    <AlertTriangle className="text-red-300 shrink-0 w-9 h-9 sm:w-7 sm:h-7 animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                    <div className="flex flex-col min-w-0 flex-1">
                       <p className="text-red-300 text-xs sm:text-[11px] font-black uppercase tracking-widest">Hüküm</p>
                       <p className="text-slate-200 text-sm sm:text-xs font-serif italic">Köy oyunu kullanıyor, sonuç bekleniyor...</p>
                    </div>
                 </div>
              </div>
           )}
        </div>

        {/* ALT: KALICI SOHBET ALANI */}

        {/* ALT: KALICI SOHBET ALANI */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/40">
           
           {/* MUHTAR MÜHÜR PANELİ */}
           {gamePhase === 'DAY' && isMuhtar && !me.isMayorRevealed && me.isAlive && !isSilenced && (
              <div className="bg-amber-900/20 p-2 border-b border-amber-800/30 flex justify-between items-center px-4 shrink-0">
                 <span className="text-[10px] text-amber-400 font-bold uppercase tracking-tight">Mührünü vurup oyları toplayabilirsin!</span>
                 <button onClick={() => socket.emit('mayorReveal', { roomCode, impersonateId: isDevMode ? impersonateId : null })} className="bg-accent hover:bg-amber-700 active:bg-amber-800 text-white px-4 sm:px-3 py-2 sm:py-1 rounded-lg text-xs sm:text-[9px] font-black uppercase shadow-md transition-colors">Mührü Vur</button>
              </div>
           )}

           {/* GÜNÜ ATLA PANELİ */}
           {gamePhase === 'DAY' && me.isAlive && !isSpectator && (
              <div className="flex justify-end p-2 bg-slate-800/10 shrink-0">
                 <button
                    onClick={() => socket.emit('skipDayVote', { roomCode, impersonateId: isDevMode ? impersonateId : null })}
                    className="px-4 sm:px-3 py-2 sm:py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 rounded-lg border border-slate-700 text-xs sm:text-[9px] font-bold uppercase"
                 >
                    Günü Atla ({skipDayCount.count}/{skipDayCount.total || players.filter(p => p.isAlive && p.connected).length})
                 </button>
              </div>
           )}

           {/* MESAJ LİSTESİ */}
           <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 custom-scrollbar">
              {visibleMessages.map((c, i) => {
                  // Gün/Gece ayracı
                  if (c.type === 'separator') {
                     return (
                       <div key={i} className="flex items-center gap-2 my-1.5 select-none">
                          <div className="flex-1 h-px bg-slate-800"></div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-800">
                             {c.text}
                          </span>
                          <div className="flex-1 h-px bg-slate-800"></div>
                       </div>
                     );
                  }

                  const isMe = c.sender.includes(me.name);
                  let bubbleClass = 'bg-slate-800 text-slate-200 border-slate-700';
                  let senderClass = 'text-slate-400';

                  if (c.type === 'dead') {
                     bubbleClass = 'bg-purple-900/30 border-purple-800/50 text-purple-200';
                     senderClass = 'text-purple-400';
                  } else if (c.type === 'mafia') {
                     bubbleClass = 'bg-red-900/30 border-red-800/50 text-red-200';
                     senderClass = 'text-red-400';
                  } else if (isMe) {
                     bubbleClass = 'bg-accent text-white ml-auto rounded-br-sm border-accent';
                     senderClass = 'text-blue-200';
                  }

                  const time = c.ts ? new Date(c.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={i} className={`p-2.5 rounded-2xl max-w-[85%] shadow-md border ${bubbleClass} ${isMe ? 'ml-auto rounded-br-sm' : 'mr-auto rounded-bl-sm'}`}>
                      <div className="flex justify-between items-baseline gap-2 mb-0.5">
                         <span className={`text-[9px] font-bold uppercase tracking-wider ${senderClass} truncate`}>{c.sender}</span>
                         {time && <span className={`text-[9px] tabular-nums shrink-0 ${senderClass} opacity-60`}>{time}</span>}
                      </div>
                      <span className="text-sm leading-relaxed selectable">{c.message}</span>
                    </div>
                  );
              })}
              <div ref={chatEndRef} />
           </div>

           {/* SOHBET GİRDİSİ — Channel'a göre tema */}
           {(() => {
              const channelTheme = {
                 dead:  { wrap: 'bg-purple-950/40 border-purple-900/50',  form: 'bg-purple-900/30 border-purple-800/50',  send: 'bg-purple-800 hover:bg-purple-700',  label: 'Ölüler Boyutu',     placeholder: 'Ruhlarla fısılda...',     text: 'text-purple-300' },
                 mafia: { wrap: 'bg-red-950/40 border-red-900/50',        form: 'bg-red-900/30 border-red-800/50',        send: 'bg-blood-red hover:bg-red-800',      label: 'Çete Sohbeti',      placeholder: 'Çete ile konuş...',       text: 'text-red-300' },
                 day:   { wrap: 'bg-slate-900/60 border-slate-800/50',    form: 'bg-slate-800 border-slate-700',          send: 'bg-accent hover:bg-amber-700',       label: null,                placeholder: 'Zanlıları tartış...',     text: 'text-slate-300' },
              };
              const canMafiaShortcut = me.isAlive && isEskiya && gamePhase === 'DAY';
              // Eşkıya gündüz /c ile yazarken input kırmızı tema'ya geçer
              const isMafiaShortcut = canMafiaShortcut && currentMessage.trim().startsWith('/c');
              const t = isMafiaShortcut ? channelTheme.mafia : (channelTheme[chatChannel] || channelTheme.day);
              if (canMafiaShortcut && !isMafiaShortcut) t.placeholder = 'Zanlıları tartış...  ·  /c ile çete';

              return (
                 <div className={`shrink-0 border-t ${t.wrap}`}>
                    {chatChannel && channelTheme[chatChannel].label && (
                       <div className={`px-3 py-1 text-center text-[9px] font-black uppercase tracking-[0.3em] ${t.text} border-b ${t.wrap.split(' ')[1]}`}>
                          — {t.label} —
                       </div>
                    )}
                    <div className="p-2">
                       {isSpectator && gamePhase === 'DAY' ? (
                          <div className="p-2 text-center"><p className="text-purple-400/80 text-[10px] font-serif uppercase">— İzleyici Modu —</p></div>
                       ) : canSendChat ? (
                          <form onSubmit={sendChat} className={`flex gap-2 p-1 rounded-xl border ${t.form}`}>
                             <input type="text"
                                value={currentMessage}
                                onChange={e => setCurrentMessage(e.target.value)}
                                disabled={isSilenced && gamePhase === 'DAY'}
                                className="flex-1 min-w-0 bg-transparent text-white px-3 py-2 focus:outline-none text-sm"
                                placeholder={isSilenced && gamePhase === 'DAY' ? "Susturuldun!" : t.placeholder}
                             />
                             <button type="submit" disabled={isSilenced && gamePhase === 'DAY'} className={`${t.send} px-4 shrink-0 rounded-lg transition-colors flex items-center justify-center text-white disabled:opacity-50`}><Send size={16} /></button>
                          </form>
                       ) : (
                          <div className="p-2 text-center opacity-50"><p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Sohbet Kapalı</p></div>
                       )}
                    </div>
                 </div>
              );
           })()}
        </div>

      </div>

        {/* END (fixed overlay — no layout wrapper needed) */}
        {gamePhase === 'END' && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col p-8 overflow-y-auto animate-in fade-in duration-1000 custom-scrollbar">
             <h2 className="text-5xl font-serif text-center mb-4 tracking-widest text-amber-500 uppercase drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">Oyun Sona Erdi</h2>
             <p className="text-xl text-slate-300 text-center mb-10 tracking-widest uppercase">{eventNews}</p>
             
             {gameResults && (
             <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto w-full">
                 <div className="flex-1 bg-slate-900/80 p-6 rounded-2xl border-2 border-emerald-700/40 shadow-[0_0_25px_rgba(110,231,183,0.10)]">
                     <h3 className="text-2xl text-emerald-300 font-bold mb-6 border-b border-emerald-700/40 pb-3 text-center uppercase tracking-widest flex items-center justify-center gap-2">Kazananlar</h3>
                     <ul className="space-y-3">
                         {gameResults.filter(r => r.won).map((r, i) => (
                             <li key={i} className="flex flex-col bg-black/60 p-3 rounded-lg border border-emerald-800/30">
                                 <span className="text-lg font-medium text-slate-200">{r.name}</span>
                                 <span className={`${getTeamColor(r.role).split(' ')[0]} text-sm font-bold tracking-widest uppercase mt-1`}>{r.role}</span>
                             </li>
                         ))}
                         {gameResults.filter(r => r.won).length === 0 && <p className="text-center text-slate-500 italic mt-4">Kazanan olmadı...</p>}
                     </ul>
                 </div>

                 <div className="flex-1 bg-slate-900/80 p-6 rounded-2xl border-2 border-blood-red/30 shadow-[0_0_30px_rgba(127,29,29,0.15)]">
                     <h3 className="text-2xl text-blood-red font-bold mb-6 border-b border-blood-red/30 pb-3 text-center uppercase tracking-widest flex items-center justify-center gap-2">Kaybedenler</h3>
                     <ul className="space-y-3">
                         {gameResults.filter(r => !r.won).map((r, i) => (
                             <li key={i} className="flex flex-col bg-black/60 p-3 rounded-lg border border-blood-red/20 opacity-80 hover:opacity-100 transition-opacity">
                                 <span className="text-lg font-medium text-slate-400 line-through decoration-red-500/50">{r.name}</span>
                                 <span className={`${getTeamColor(r.role).split(' ')[0]} text-sm font-bold tracking-widest uppercase mt-1`}>{r.role}</span>
                             </li>
                         ))}
                         {gameResults.filter(r => !r.won).length === 0 && <p className="text-center text-slate-500 italic mt-4">Neyse ki herkes kazandı...</p>}
                     </ul>
                 </div>
             </div>
             )}
             
             <div className="mt-12 flex flex-col items-center gap-4 pb-8">
                 <p className="text-slate-500 text-sm tracking-widest text-center max-w-lg mb-2">Oyun sona erdi. Aynı odada devam etmek için kurucunun lobiyi başlatmasını bekleyin veya tamamen çıkış yapın.</p>
                 <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-4">
                    {isHost ? (
                       <button onClick={() => socket.emit('returnToLobby', roomCode)} className="flex-1 sm:flex-none px-8 py-4 bg-slate-800 text-white rounded-xl border border-slate-700 hover:bg-slate-700 hover:text-amber-500 hover:border-amber-500 transition-all uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)]">Odada Kal & Lobiye Dön</button>
                    ) : (
                       <div className="flex-1 sm:flex-none px-8 py-4 bg-slate-900/50 text-slate-500 rounded-xl border border-slate-800/50 uppercase tracking-widest font-bold text-center flex items-center justify-center">Kurucuyu Bekliyorsun...</div>
                    )}
                    <button onClick={() => onLeave ? onLeave() : window.location.reload()} className={`flex-1 sm:flex-none px-8 py-4 ${isHost ? 'bg-red-900/20 hover:bg-red-900/40 border-red-900/50' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} hover:text-red-400 text-slate-300 rounded-xl border transition-all uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>Çıkış Yap</button>
                 </div>
             </div>
          </div>
        )}

      <div className="hidden lg:flex w-full lg:w-56 flex-col gap-4 lg:h-full shrink-0">
          <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex-1 overflow-hidden shadow-md">
             <h3 className="text-slate-400 font-bold border-b border-slate-700 pb-2 mb-2 text-center text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                Kuyunun Dibi
             </h3>
             <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {players.filter(p => !p.isAlive).map(p => {
                   // Normalde ölen kişinin rolü herkese görünür olmalı (Town of Salem mantığı).
                   // Eğer rolün sadece isDevMode'da görünmesini istiyorsak burayı değiştirebiliriz.
                   // Ancak standartta herkes ölenin rolünü bilmeli.
                   const roleToDisplay = p.displayRole || p.role;
                   return (
                   <li key={p.socketId} className="flex flex-col bg-black/40 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-300 font-medium text-sm line-through opacity-70">{p.name}</span>
                      <span className={`${getTeamColor(roleToDisplay).split(' ')[0]} font-bold text-[11px] uppercase tracking-wider`}>{roleToDisplay}</span>
                   </li>
                   );
                })}
                {players.filter(p => !p.isAlive).length === 0 && (
                   <p className="text-slate-600 text-[10px] italic text-center mt-4 uppercase tracking-widest">Kuyu Şimdilik Boş...</p>
                )}
             </ul>
          </div>

          {gamePhase === 'DAY' && (
              <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl p-3 shadow-md animate-in slide-in-from-bottom-4 duration-500 max-h-[50%]">
                 <h3 className="text-amber-500 font-bold border-b border-slate-700 pb-2 mb-2 text-center text-[10px] uppercase tracking-widest">
                    Meydan Şahitleri
                 </h3>
                 <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-wrap gap-2 items-start content-start">
                    {Object.keys(voteDetails).length > 0 ? (
                       Object.entries(voteDetails).map(([voter, targetId], i) => (
                           <div key={i} className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1.5 rounded-md border border-slate-800/50 shadow-inner">
                              <span className="text-slate-400 text-[10px] uppercase font-medium">{voter}</span>
                              <span className="text-slate-600 text-[10px]">»</span>
                              <span className="text-blood-red font-bold text-[10px] uppercase">{targetId === 'SKIP' ? 'PAS' : players.find(p => p.socketId === targetId)?.name}</span>
                           </div>
                       ))
                    ) : (
                       <p className="text-slate-600 text-[10px] italic text-center mt-2 w-full uppercase tracking-widest">Henüz Ses Yok...</p>
                    )}
                 </div>
              </div>
          )}
      </div>

      </div>

      {/* NOTLAR MODAL — Sekmeli */}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300 pointer-events-auto" onClick={() => setShowNotes(false)}>
          <div className="w-full h-full sm:h-[80vh] sm:max-w-lg bg-slate-900 sm:border border-slate-700 rounded-none sm:rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50 sm:rounded-t-2xl">
              <div className="flex items-center gap-3">
                 <BookOpen className="text-accent" size={22} />
                 <h3 className="text-lg sm:text-xl font-bold font-serif tracking-widest text-slate-200">Köy Defteri</h3>
              </div>
              <button onClick={() => setShowNotes(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition"><X size={22} /></button>
            </div>

            {/* Sekme bar */}
            <div className="shrink-0 grid grid-cols-2 border-b border-slate-800">
               {[
                  { id: 'events', label: 'Olaylar' },
                  { id: 'will', label: 'Vasiyetim' },
               ].map(t => (
                  <button
                     key={t.id}
                     onClick={() => setNotesTab(t.id)}
                     className={`py-3 text-[11px] font-bold uppercase tracking-widest transition-all border-b-2 ${
                        notesTab === t.id
                           ? (t.id === 'will' ? 'text-yellow-500 border-yellow-500 bg-yellow-900/10' : 'text-accent border-accent bg-slate-900/40')
                           : 'text-slate-500 border-transparent hover:text-slate-300'
                     }`}
                  >
                     {t.label}
                  </button>
               ))}
            </div>

            {/* Sekme içeriği */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
               {notesTab === 'events' && (
                  <ul className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                     {systemNotes?.length > 0 ? (() => {
                       const items = [];
                       let lastDay = null;
                       systemNotes.forEach((note, i) => {
                          const noteDay = note.day ?? 1;
                          if (noteDay !== lastDay) {
                             items.push(
                                <li key={`sep-${noteDay}-${i}`} className="flex items-center gap-2 my-1 select-none">
                                   <div className="flex-1 h-px bg-slate-800"></div>
                                   <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-800">{noteDay}. Gün</span>
                                   <div className="flex-1 h-px bg-slate-800"></div>
                                </li>
                             );
                             lastDay = noteDay;
                          }
                          let borderClass = 'border-slate-600';
                          if(note.align === 'Kırmızı') borderClass = 'border-blood-red';
                          if(note.align === 'Yeşil') borderClass = 'border-emerald-500';
                          if(note.align === 'Gri') borderClass = 'border-gray-400';
                          if(note.align === 'Yarı') borderClass = 'border-amber-500';
                          items.push(
                             <li key={i} className={`bg-slate-800 p-3 rounded-lg border-l-4 ${borderClass} shadow-inner text-[13px] flex items-center gap-4`}>
                                <span className="text-slate-300">{note.text}</span>
                             </li>
                          );
                       });
                       return items;
                     })() : (
                       <li className="text-slate-500 italic text-sm text-center mt-6">Henüz bir olay gerçekleşmedi...</li>
                     )}
                  </ul>
               )}

               {notesTab === 'will' && (
                  <div className="flex-1 min-h-0 flex flex-col p-4 gap-2">
                     <textarea
                        value={personalNotesMap[activeSocketId] || ''}
                        onChange={e => {
                           const val = e.target.value;
                           setPersonalNotesMap(prev => ({ ...prev, [activeSocketId]: val }));
                           socket.emit('savePersonalNote', { roomCode, note: val, impersonateId: isDevMode ? impersonateId : null });
                        }}
                        placeholder="Öldüğünde köyün bilmesini istediğin şüphelerini buraya yaz..."
                        className="flex-1 w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none font-serif leading-relaxed"
                     />
                     <p className="shrink-0 text-[10px] text-yellow-500/70 italic text-center uppercase tracking-widest">Öldüğünde tüm köye okunacaktır</p>
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* ROL BİLGİSİ MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in zoom-in duration-200 pointer-events-auto" onClick={() => setShowRoleModal(false)}>
          <div className="w-full h-full sm:h-auto sm:max-w-sm bg-slate-900 sm:border border-slate-700 rounded-none sm:rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-none sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            
            {/* Kapak: Resim Alanı */}
            <div className="relative w-full aspect-square bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
              {ROLE_INFO[activeRole]?.image ? (
                <img 
                  src={ROLE_INFO[activeRole].image} 
                  alt={activeRole}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display='none'; }}
                />
              ) : null}
              {/* Placeholder overlay her zaman var, resim yoksa tam görünür */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center">
                <h4 className={`text-2xl font-bold font-serif tracking-widest ${ROLE_INFO[activeRole]?.color || 'text-slate-200'}`}>
                  {activeRole || 'Bilinmiyor'}
                </h4>
                {ROLE_INFO[activeRole]?.team && (
                  <span className={`mt-1 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${ROLE_INFO[activeRole].teamColor}`}>
                    {ROLE_INFO[activeRole].team}
                  </span>
                )}
              </div>
              <button onClick={() => setShowRoleModal(false)} className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors bg-black/50 rounded-full p-1">
                <X size={20} />
              </button>
            </div>

            {/* İçerik */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">

              {/* Yetenek Özeti */}
              {ROLE_INFO[activeRole]?.ability && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3">
                  <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-1">Yetenek</p>
                  <p className={`text-sm font-semibold ${ROLE_INFO[activeRole]?.color || 'text-slate-200'}`}>
                    {ROLE_INFO[activeRole].ability}
                  </p>
                </div>
              )}

              {/* Açıklama */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-2">Hikaye & Kurallar</p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {ROLE_INFO[activeRole]?.desc || 'Bu rol hakkında henüz gizemli parşömenlerde detay bulunmuyor...'}
                </p>
              </div>

              <button 
                onClick={() => setShowRoleModal(false)} 
                className="w-full py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700 font-bold tracking-widest uppercase text-sm transition-colors mt-1"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEZARLIK / KUYU MODALI (Mobile-only via Skull icon) */}
      {showGraveyard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300 pointer-events-auto" onClick={() => setShowGraveyard(false)}>
          <div className="w-full h-full sm:h-[80vh] sm:max-w-md bg-slate-900 sm:border border-slate-700 rounded-none sm:rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50 sm:rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <Skull className="text-slate-400" size={22} />
                <h3 className="text-lg font-bold font-serif tracking-widest text-slate-200">Kuyunun Dibi</h3>
              </div>
              <button onClick={() => setShowGraveyard(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition"><X size={22} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
              <div>
                <h4 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2 border-b border-slate-800 pb-2">Ölüler</h4>
                {(() => {
                   const dead = players.filter(p => !p.isAlive);
                   if (dead.length === 0) {
                     return <p className="text-slate-600 text-[11px] italic text-center py-6 uppercase tracking-widest">Kuyu Şimdilik Boş...</p>;
                   }
                   // Güne göre gruplandır — diedDay yoksa "Bilinmiyor" kovasına
                   const groups = new Map();
                   dead.forEach(p => {
                     const key = p.diedDay ?? '?';
                     if (!groups.has(key)) groups.set(key, []);
                     groups.get(key).push(p);
                   });
                   const sortedKeys = [...groups.keys()].sort((a, b) => {
                     if (a === '?') return 1;
                     if (b === '?') return -1;
                     return a - b;
                   });
                   return sortedKeys.map(day => (
                     <div key={day} className="mb-3">
                       <div className="flex items-center gap-2 my-2 select-none">
                         <div className="flex-1 h-px bg-slate-800"></div>
                         <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-800">{day === '?' ? 'Önceden' : `${day}. Gün`}</span>
                         <div className="flex-1 h-px bg-slate-800"></div>
                       </div>
                       <ul className="space-y-2">
                         {groups.get(day).map(p => {
                           const roleToDisplay = p.displayRole || p.role;
                           const teamLabel = ROLE_INFO[roleToDisplay]?.team || 'Bilinmiyor';
                           return (
                             <li key={p.socketId} className="flex items-center justify-between bg-black/40 px-3 py-2.5 rounded-lg border border-slate-800">
                               <div className="flex items-center gap-2 min-w-0">
                                 <span className="text-slate-300 font-medium text-sm line-through opacity-70 truncate">{p.name}</span>
                                 {p.diedPhase === 'NIGHT' && <Moon size={11} className="text-slate-500 shrink-0" />}
                                 {(p.diedPhase === 'VOTING' || p.diedPhase === 'JUDGMENT') && <AlertTriangle size={11} className="text-amber-500/70 shrink-0" />}
                               </div>
                               <span className={`${getTeamColor(roleToDisplay).split(' ')[0]} font-bold text-[11px] uppercase tracking-wider shrink-0 ml-2`}>{teamLabel}</span>
                             </li>
                           );
                         })}
                       </ul>
                     </div>
                   ));
                })()}
              </div>

              {gamePhase === 'DAY' && (
                <div>
                  <h4 className="text-[10px] font-bold text-amber-500 tracking-widest uppercase mb-2 border-b border-slate-800 pb-2">Meydan Şahitleri</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(voteDetails).length > 0 ? (
                      Object.entries(voteDetails).map(([voter, targetId], i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1.5 rounded-md border border-slate-800/50 shadow-inner">
                          <span className="text-slate-400 text-[10px] uppercase font-medium">{voter}</span>
                          <span className="text-slate-600 text-[10px]">»</span>
                          <span className="text-blood-red font-bold text-[10px] uppercase">{targetId === 'SKIP' ? 'PAS' : players.find(p => p.socketId === targetId)?.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-600 text-[10px] italic text-center py-4 w-full uppercase tracking-widest">Henüz Ses Yok...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SİLENCED MODAL */}
      {showSilencedModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in zoom-in duration-200 pointer-events-auto" onClick={() => setShowSilencedModal(false)}>
          <div className="w-full h-full sm:h-auto sm:max-w-sm bg-slate-900 sm:border border-red-900/50 rounded-none sm:rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.3)] overflow-hidden flex flex-col items-center justify-center p-8 text-center" onClick={(e) => e.stopPropagation()}>
             <VolumeX size={64} className="text-red-500 mb-4 animate-pulse" />
             <h3 className="font-serif tracking-widest uppercase text-2xl text-red-500 font-bold mb-2">ŞŞŞT!</h3>
             <p className="text-slate-300 text-sm leading-relaxed mb-8">
               Tefeci seni susturdu! Bugün konuşman kesinlikle yasak. Sadece diğerlerini dinleyebilirsin.
             </p>
             <button 
                onClick={() => setShowSilencedModal(false)} 
                className="w-full py-4 bg-red-900/40 text-red-100 hover:bg-red-800/60 font-bold tracking-widest uppercase rounded-xl transition-colors border border-red-900/50"
             >
                Tamam, Susuyorum
             </button>
          </div>
        </div>
      )}

       {/* AYRILMA ONAYI MODAL */}
       {showLeaveConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowLeaveConfirm(false)}>
             <div className="w-full max-w-sm bg-slate-900 border border-red-900/50 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.3)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 flex flex-col items-center text-center">
                   <LogOut size={48} className="text-red-500 mb-3" />
                   <h3 className="font-serif tracking-widest uppercase text-xl text-red-500 font-bold mb-2">Kasabayı Terket?</h3>
                   <p className="text-slate-300 text-sm leading-relaxed">
                      Çıkarsan oyuna geri dönemezsin. Emin misin?
                   </p>
                </div>
                <div className="grid grid-cols-2 border-t border-slate-800">
                   <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="py-4 text-slate-300 hover:bg-slate-800 font-bold tracking-widest uppercase text-sm transition-colors border-r border-slate-800"
                   >
                      Vazgeç
                   </button>
                   <button
                      onClick={() => {
                         setShowLeaveConfirm(false);
                         onLeave ? onLeave() : window.location.reload();
                      }}
                      className="py-4 text-red-100 bg-red-900/40 hover:bg-red-800/60 font-bold tracking-widest uppercase text-sm transition-colors"
                   >
                      Terket
                   </button>
                </div>
             </div>
          </div>
       )}

       {/* IMPERSONATE DROPDOWN MODAL (Dev) */}
       {showImpersonateMenu && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowImpersonateMenu(false)}>
             <div className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-yellow-700/50 rounded-t-2xl sm:rounded-2xl shadow-[0_0_40px_rgba(202,138,4,0.3)] flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                   <h3 className="text-yellow-500 font-bold uppercase tracking-widest text-sm">Oyuncu Seç</h3>
                   <button onClick={() => setShowImpersonateMenu(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition">
                      <X size={20} />
                   </button>
                </div>
                <ul className="flex-1 overflow-y-auto custom-scrollbar p-2">
                   {players.map(p => (
                      <li key={p.socketId}>
                         <button
                            onClick={() => {
                               setImpersonateId(p.socketId);
                               setHasActioned(false);
                               setLastActionLabel(null);
                               setShowImpersonateMenu(false);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                               p.socketId === impersonateId
                                  ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50'
                                  : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                            }`}
                         >
                            <span className="font-medium">{p.name}</span>
                            <span className={`text-[10px] uppercase tracking-widest ${p.isAlive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                               {p.isAlive ? 'Hayatta' : 'Ölü'}
                            </span>
                         </button>
                      </li>
                   ))}
                </ul>
             </div>
          </div>
       )}

       {/* KİŞİSEL ANİMASYONLAR (Ölüm ve Kuyu) */}
       {animEffect === 'death' && (
          <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center bg-red-950/80 animate-[flash_0.2s_ease-out_3]">
             <div className="bg-black border-[10px] border-red-700 rounded-full w-64 h-64 flex flex-col items-center justify-center shadow-[0_0_100px_rgba(255,0,0,1)] animate-[pulse_0.5s_infinite]">
                 <Flame size={80} className="text-red-500 animate-pulse" />
                 <h1 className="text-3xl font-black text-red-500 font-serif tracking-widest mt-4 animate-bounce text-center">{animText}</h1>
             </div>
             <style>{`
                @keyframes flash {
                   0% { opacity: 0; }
                   50% { opacity: 1; filter: saturate(3); }
                   100% { opacity: 0; }
                }
             `}</style>
          </div>
       )}

       {animEffect === 'well' && (
          <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center bg-black/90 pb-[100vh] animate-[slideDown_3s_ease-in-out_forwards]">
             <div className="bg-slate-900 border-4 border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)] -mt-96">
                 <AlertTriangle size={64} className="text-slate-500 mb-4" />
                 <h1 className="text-3xl font-black text-slate-300 font-serif tracking-[0.3em] uppercase text-center">{animText}</h1>
             </div>
             <style>{`
                @keyframes slideDown {
                   0% { transform: translateY(-100%); opacity: 0; }
                   30% { transform: translateY(100vh); opacity: 1; }
                      80% { transform: translateY(100vh); opacity: 1; }
                   100% { transform: translateY(200%); opacity: 0; }
                }
             `}</style>
          </div>
        )}

      {/* REVEALED DEATH NOTES MODAL — Carousel */}
      {revealedNotes && revealedNotes.length > 0 && (
        <RevealedNotesModal revealedNotes={revealedNotes} onClose={() => setRevealedNotes([])} />
      )}

    </div>
  );
}

function RevealedNotesModal({ revealedNotes, onClose }) {
   const trackRef = useRef(null);
   const [activeIdx, setActiveIdx] = useState(0);
   const total = revealedNotes.length;
   const isMulti = total > 1;

   const handleScroll = () => {
      const el = trackRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx !== activeIdx) setActiveIdx(idx);
   };

   const goTo = (i) => {
      const el = trackRef.current;
      if (!el) return;
      el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
   };

   return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-0 sm:p-4 animate-in zoom-in duration-500 pointer-events-auto" onClick={onClose}>
         <div
            className="w-full h-full sm:h-[80vh] sm:max-w-lg bg-[#f4e4bc] text-slate-900 sm:rounded-sm shadow-[0_0_60px_rgba(252,211,77,0.3)] relative flex flex-col overflow-hidden"
            style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/old-wall.png')" }}
            onClick={(e) => e.stopPropagation()}
         >
            <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-10"></div>
            <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-10"></div>

            <div className="shrink-0 px-6 pt-6 pb-4 border-b-2 border-[#5c4033]/30 flex items-center justify-between">
               <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#5c4033]">ÖLÜNÜN VASİYETİ</h2>
               {isMulti && (
                  <span className="text-[#5c4033]/70 font-bold text-sm font-serif tracking-widest">{activeIdx + 1}/{total}</span>
               )}
            </div>

            <div
               ref={trackRef}
               onScroll={handleScroll}
               className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
            >
               {revealedNotes.map((rn, idx) => (
                  <div key={idx} className="snap-center shrink-0 w-full h-full overflow-y-auto custom-scrollbar p-6 sm:p-8">
                     <h3 className="font-bold text-lg sm:text-xl text-[#3b2a21] mb-3">{rn.playerName} Tarafından Yazıldı:</h3>
                     <p className="font-serif text-base sm:text-lg leading-relaxed whitespace-pre-wrap italic text-[#4a3628] bg-black/5 p-4 rounded-md border-l-4 border-[#8b5a2b]">
                        {rn.note || "Sayfalar boş... Hiçbir not bırakmamış."}
                     </p>
                  </div>
               ))}
            </div>

            {isMulti && (
               <div className="shrink-0 flex items-center justify-center gap-2 py-2">
                  {revealedNotes.map((_, i) => (
                     <button
                        key={i}
                        onClick={() => goTo(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === activeIdx ? 'bg-[#5c4033] w-6' : 'bg-[#5c4033]/30'}`}
                        aria-label={`Vasiyet ${i + 1}`}
                     />
                  ))}
               </div>
            )}

            <div className="shrink-0 p-4 sm:p-6 text-center border-t border-[#5c4033]/20">
               <button onClick={onClose} className="bg-[#8b5a2b] hover:bg-[#704214] text-[#f4e4bc] px-8 py-3 rounded shadow-lg font-bold uppercase tracking-widest transition-colors">
                  Huzur İçinde Yatsın
               </button>
            </div>
         </div>
      </div>
   );
}

function PlayerList({ players, selected, onSelect, isNight, isDevMode, dousedList = [] }) {
  if (players.length === 0) return <div className="h-16 flex items-center justify-center italic text-slate-600 text-[10px] uppercase tracking-widest">Yaşayan Kimse Kalmadı...</div>;
  
  return (
    <div className="flex overflow-x-auto gap-2 py-2 px-1 custom-scrollbar snap-x no-scrollbar">
      {players.map(p => {
        const isDoused = dousedList.includes(p.socketId);
        return (
        <div 
          key={p.socketId} 
          onClick={() => onSelect(p.socketId)} 
          className={`relative flex-shrink-0 w-24 snap-start p-2 rounded-xl cursor-pointer border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${selected === p.socketId ? (isNight ? 'bg-blood-red/20 border-blood-red shadow-[0_0_15px_rgba(127,29,29,0.3)]' : 'bg-accent/20 border-accent shadow-[0_0_15px_rgba(29,78,216,0.3)]') : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-500'}`}
        >
          {isDoused && <div className="absolute -top-2 -right-1 bg-orange-600 text-white p-0.5 rounded-full shadow-[0_0_8px_rgba(234,88,12,0.8)]"><Flame size={12} /></div>}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${selected === p.socketId ? (isNight ? 'bg-blood-red text-white' : 'bg-accent text-white') : 'bg-slate-700 text-slate-400'}`}>
             {p.name.substring(0, 2).toUpperCase()}
          </div>
          <span className={`text-[10px] font-bold truncate w-full text-center ${p.isTeam ? "text-blood-red" : "text-slate-300"}`}>
            {p.name}
          </span>
          {p.isMayorRevealed && <span className="text-[8px] bg-amber-600 text-white px-1 rounded font-black uppercase">MHTR</span>}
          {isDevMode && <span className="text-[8px] text-yellow-500/80 font-black uppercase opacity-60">({p.role?.substring(0,3) || '??'})</span>}
        </div>
      )})}
    </div>
  );
}

export default GameBoard;
