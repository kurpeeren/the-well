import React, { useState, useEffect, useRef } from 'react';
import { Send, Moon, Sun, MessageSquare, AlertTriangle, ShieldAlert, BookOpen, X, Flame, Shield, Info, VolumeX } from 'lucide-react';
import TimerDisplay from './TimerDisplay';

function GameBoard({ socket, roomCode, players, gamePhase, myRole, eventNews, systemNotes, isDevMode, dayCount, dousedList, gameResults, revealedNotes, setRevealedNotes, isSpectator, onLeave, isHost }) {
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
  const [showNotes, setShowNotes] = useState(false);
  const [personalNotesMap, setPersonalNotesMap] = useState({});
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [voteDetails, setVoteDetails] = useState({});
  const [isSilenced, setIsSilenced] = useState(false);
  const [showSilencedModal, setShowSilencedModal] = useState(false);
  const [skipDayCount, setSkipDayCount] = useState({ count: 0, total: 0 });
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on('chatMessage', (msgObj) => setChatMessages(prev => [...prev, msgObj]));
    socket.on('voteCounts', (data) => {
       setVoteDetails(data.details || {});
    });
    socket.on('youAreSilenced', () => {
       setIsSilenced(true);
       setShowSilencedModal(true);
    });
    socket.on('skipDayUpdate', (data) => setSkipDayCount(data));
    return () => {
       socket.off('chatMessage');
       socket.off('voteCounts');
       socket.off('youAreSilenced');
       socket.off('skipDayUpdate');
    }
  }, [socket]);

  useEffect(() => {
    setSelectedPlayer(null);
    setHasActioned(false);
    if(gamePhase === 'MORNING' || gamePhase === 'NIGHT') {
       setChatMessages([]);
    }
    if(gamePhase === 'NIGHT') setIsSilenced(false);
    if(gamePhase !== 'VOTING') {
       setVoteDetails({});
    }
  }, [gamePhase]);

  useEffect(() => {
    if (chatEndRef.current && chatMessages.length > 0) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages]);

  useEffect(() => {
    const isModalOpen = showNotes || showRoleModal || showSilencedModal || (revealedNotes && revealedNotes.length > 0) || gamePhase === 'END';
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
    
    socket.emit('nightAction', { 
       roomCode, 
       actionObj: { targetId: selectedPlayer, actionType, isSelfAlert },
       impersonateId: isDevMode ? impersonateId : null
    });
    setHasActioned(true);
  };

  const handleVote = (pass = false) => {
    if (pass) socket.emit('votePlayer', { roomCode, targetId: 'SKIP', impersonateId: isDevMode ? impersonateId : null });
    else {
      if(!selectedPlayer) return;
      socket.emit('votePlayer', { roomCode, targetId: selectedPlayer, impersonateId: isDevMode ? impersonateId : null });
    }
    setHasActioned(true);
  };

  const sendChat = (e) => {
    e.preventDefault();
    if(currentMessage.trim()) {
      if (gamePhase === 'DAY') {
         socket.emit('chatMessage', { roomCode, message: currentMessage, impersonateId: isDevMode ? impersonateId : null });
      } else if (gamePhase === 'NIGHT') {
         if (!me.isAlive || isSpectator || activeRole === 'Gassal') {
            socket.emit('deadChatMessage', { roomCode, message: currentMessage, impersonateId: isDevMode ? impersonateId : null });
         } else if (isEskiya) {
            socket.emit('mafiaChatMessage', { roomCode, message: currentMessage, impersonateId: isDevMode ? impersonateId : null });
         }
      }
      setCurrentMessage('');
    }
  };

  const getPhaseIcon = () => {
    switch(gamePhase) {
       case 'NIGHT': return <Moon size={24} className="text-slate-400" />;
       case 'MORNING': return <Sun size={24} className="text-yellow-500 animate-spin-slow" />;
       case 'DAY': return <MessageSquare size={24} className="text-blue-400" />;
       case 'VOTING': return <AlertTriangle size={24} className="text-blood-red animate-pulse" />;
       case 'END': return <ShieldAlert size={24} className="text-accent" />;
       default: return null;
    }
  }

  const getPhaseNameTR = () => {
    switch(gamePhase) {
      case 'NIGHT': return `${dayCount}. Gece Çöktü`;
      case 'MORNING': return `${dayCount}. Gün Sabahı`;
      case 'DAY': return `${dayCount}. Gün (Tartışma)`;
      case 'VOTING': return `${dayCount}. Gün (Hüküm Vakti)`;
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

  // Chat Input Yetkisi Kontrolü
  const canSendChat = (gamePhase === 'DAY' && me.isAlive && !isSpectator) || (gamePhase === 'NIGHT' && (canSeeDeadChat || isEskiya));

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
    return 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'; // Yeşil (Masumlar)
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
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/sifaci.webp',
      ability: '🌿 Her gece bir kişiyi iyileştirir',
      desc: 'Köyün bilge otacısı. Her gece bir oyuncunun kapısına giderek onu gece saldırılarından korur. Eğer o gece hedefi saldırıya uğrarsa, hayatta kalır. Kendini oyun boyunca yalnızca 2 kez iyileştirebilir.',
    },
    'Bekçi': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/bekci.webp',
      ability: '🔦 Her gece bir kişiyi kontrol eder',
      desc: 'Geceleri elinde fenerle sokakları arşınlar. Seçtiği kişinin eşkıya olup olmadığını araştırır. Eşkıya Başı kontrol edildiğinde masum görünür; Münafık tarafından çerçevelenmiş biri ise eşkıya gibi görünür.',
    },
    'Avcı': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/avci.webp',
      ability: '🪤 Sınırlı sayıda pusu kurabilir (3 hak)',
      desc: 'Eski bir dağ adamı, tetikte uyur. "Pusuya Yat" seçeneğiyle o gece evine gelen herkesi, masum ya da değil, vurur. Gece koruması yoktur. Sınırlı sayıda kullanım hakkı vardır.',
    },
    'Muhtar': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/muhtar.webp',
      ability: '🔏 Mühür vurarak oyunu ağırlığını ortaya koyar',
      desc: 'Köyün mühürdarı. Oyuna gizli bir zırh (tek seferlik yelek) ile başlar, geceleri ilk saldırıdan sağ kurtulur. Gündüz "Mührü Vur" diyerek kimliğini ilan edebilir. Bu andan itibaren oylamalarda oyu 3 sayılır; ancak Şifacı kendisini bir daha koruyamaz. Susturulmuşsa mührü vuramaz.',
    },
    'Gözcü': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/gozcu.webp',
      ability: '🕵️ Bir kişinin evini gözetler',
      desc: 'Gece uyku tutmaz, başkalarının işine burnunu sokar. Bir kişinin kapısını gözlemler: o gece o kişiyi kim ziyaret etmiş görür. Ama içeride ne yaptıklarını bilemez.',
    },
    'Falcı': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/falci.webp',
      ability: '🔮 Olası 3 rolden oluşan kehanet alır',
      desc: 'Kahve telvesinden geleceği okur. Her gece bir kişiyi hedefler; sistem ona o kişinin olası 3 rolünden oluşan bir kehanet sunar. Münafık tarafından çerçevelenmiş biri farklı bir kehanet üretir.',
    },
    'Gassal': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/gassal.webp',
      ability: '💀 Ölü konuşmalarını dinleyebilir',
      desc: 'Ölü yıkayıcısıdır. Gece yetenekli değildir ama öte dünyaya kapısı açıktır: ölmüş oyuncuların kendi aralarında yaptığı "Ölüler Boyutu" sohbetini canlı olarak görebilir.',
    },
    'Eskort': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
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
    <div className={`w-full max-w-4xl flex flex-col gap-2 p-3 sm:p-6 rounded-2xl transition-all duration-1000 ${gamePhase === 'NIGHT' ? 'bg-black text-slate-400 shadow-[0_0_30px_rgba(0,0,0,0.8)]' : 'bg-dark-bg text-slate-100 shadow-2xl'} border border-slate-800 min-h-[75vh]`}>
      
      {isDevMode && (
         <div className="bg-yellow-900/30 border border-yellow-700 p-2 rounded-xl mb-1 flex items-center justify-between">
            <span className="text-yellow-500 font-bold tracking-wider uppercase text-[10px] hidden md:inline">Geliştirici Kumandası</span>
            <div className="flex items-center gap-2 ml-auto">
               <button onClick={() => socket.emit('forceNextPhase', roomCode)} title="Mevcut süreyi atla" className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold px-3 py-1 text-[9px] uppercase tracking-wider rounded-lg border border-yellow-500 transition-all shadow-md whitespace-nowrap">
                 Faza Geç ⏭
               </button>
               <select 
                  className="bg-black text-yellow-500 border border-yellow-700 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-yellow-500 w-[120px] md:w-auto text-[10px]"
                  value={impersonateId || ''}
                  onChange={(e) => {
                     setImpersonateId(e.target.value);
                     setHasActioned(false); 
                  }}
               >
                  {players.map(p => (
                     <option key={p.socketId} value={p.socketId}>{p.name} {p.isAlive ? '' : '(ÖLÜ)'}</option>
                  ))}
               </select>
            </div>
         </div>
      )}

      <div className="flex justify-between items-center bg-slate-900/60 p-2 sm:p-4 rounded-xl border border-slate-800 backdrop-blur-sm gap-2">
        <div className="flex gap-2 sm:gap-4 items-center flex-1 min-w-0">
           <div className="p-1.5 sm:p-2 bg-slate-800 rounded-full border border-slate-700 shadow-inner shrink-0">
             {getPhaseIcon()}
           </div>
           <div className="flex-1 min-w-0">
             <h2 className="text-sm sm:text-xl font-bold tracking-tight font-serif text-slate-200 truncate leading-tight">{getPhaseNameTR()}</h2>
             <div className="text-[9px] sm:text-xs font-medium mt-0.5 text-slate-400 flex items-center gap-1">
               <span 
                 className={`uppercase tracking-widest cursor-pointer select-none px-1.5 py-0.5 rounded transition-all duration-300 ${isRoleVisible || isSpectator ? getTeamColor(activeRole) + ' bg-slate-900/80 border border-current' : 'text-slate-600 bg-slate-800 border border-slate-700'}`}
                 onClick={() => !isSpectator && setIsRoleVisible(!isRoleVisible)}
               >
                 {isSpectator ? 'İzleyici' : (isRoleVisible ? activeRole : 'ROLÜN')}
               </span>
               {!isSpectator && isRoleVisible && activeRole === 'Şifacı' && <span className="text-[8px] sm:text-[9px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded font-bold border border-green-700/50 uppercase tracking-widest" title="Kendini Koruma Hakkı">Kalkan: {2 - (me.uses || 0)}</span>}
               {!isSpectator && isRoleVisible && activeRole === 'Avcı' && <span className="text-[8px] sm:text-[9px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded font-bold border border-amber-700/50 uppercase tracking-widest" title="Pusu Kurma Hakkı">Pusu: {3 - (me.uses || 0)}</span>}
               {!isSpectator && isRoleVisible && activeRole === 'Kaçak' && <span className="text-[8px] sm:text-[9px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-700/50 uppercase tracking-widest" title="Saklanma Hakkı">Saklanma: {4 - (me.uses || 0)}</span>}
               <button onClick={() => setShowRoleModal(true)} className="text-slate-600 hover:text-yellow-500 transition-colors">
                 <Info size={14} />
               </button>
             </div>
           </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
           <button onClick={() => setShowNotes(true)} className="p-2 bg-slate-800 rounded-full border border-slate-700 hover:border-accent text-slate-400 hover:text-white transition-all shadow-md relative">
             <BookOpen size={18} />
             {systemNotes?.length > 0 && <span className="absolute -top-1 -right-1 bg-blood-red w-3 h-3 rounded-full animate-pulse border border-dark-bg"></span>}
           </button>
           <TimerDisplay socket={socket} />
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-500 ${eventNews ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-gradient-to-r from-blood-red/80 to-transparent p-4 rounded-xl border-l-4 border-red-500 flex items-center gap-3 shadow-lg mb-4">
          <AlertTriangle className="text-white shrink-0" />
          <p className="text-lg font-medium text-white">{eventNews}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 mt-2 overflow-hidden">

      <div className="flex-1 flex flex-col relative rounded-xl border border-slate-800/50 bg-black/10 overflow-hidden" style={{ minHeight: '70vh' }}>
        
        {/* ÜST: AKSİYON ALANI (Gece Seçimleri, Oylama, Haberler) */}
        <div className={`transition-all duration-500 overflow-hidden border-b border-slate-800/30 bg-slate-900/40 ${['NIGHT', 'VOTING', 'MORNING'].includes(gamePhase) && !hasActioned ? 'min-h-[140px] max-h-[180px]' : 'max-h-[0px]'}`}>
           
           {/* GECE AKSİYONLARI */}
           {gamePhase === 'NIGHT' && me.isAlive && !isSpectator && !hasActioned && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 {hasNightTargetAction && (
                    <div className="w-full">
                       <div className="flex justify-between items-center mb-2 px-2">
                          <div className="flex items-center gap-2">
                             <p className="text-blood-red text-[10px] font-black tracking-widest uppercase">Hedef Seç</p>
                             {activeRole === 'Şifacı' && (
                                <span className="text-[9px] text-green-400/80 font-bold uppercase tracking-wider">
                                   (Kendini Koruma: {2 - (me.uses || 0)})
                                </span>
                             )}
                          </div>
                          {selectedPlayer && (
                             <button onClick={() => handleAction('target')} className="bg-blood-red text-white text-[9px] font-black uppercase px-4 py-1.5 rounded-full shadow-[0_0_10px_rgba(127,29,29,0.5)] animate-pulse">Onayla</button>
                          )}
                       </div>
                       <PlayerList players={nightTargets} selected={selectedPlayer} onSelect={setSelectedPlayer} isNight={true} isDevMode={isDevMode} />
                    </div>
                 )}
                 {isAvci && (
                    <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 max-w-sm mx-auto w-full">
                       <div className="flex flex-col">
                          <p className="text-[10px] text-amber-500 font-bold uppercase">Pusu Modu</p>
                          <p className="text-[9px] text-slate-400">Kalan: {3 - (me.uses || 0)}</p>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleAction('pusu', true)} disabled={(me.uses || 0) >= 3} className="px-4 py-2 bg-amber-600 text-white text-[9px] font-black rounded-lg uppercase">Pusu Kur</button>
                          <button onClick={() => handleAction('bos', false)} className="px-4 py-2 bg-slate-700 text-slate-300 text-[9px] font-black rounded-lg uppercase">Pas</button>
                       </div>
                    </div>
                 )}
                 {isKundakci && (
                    <div className="w-full">
                       <div className="flex justify-between items-center mb-2 px-2">
                          <p className="text-orange-500 text-[10px] font-black tracking-widest uppercase">Kundaklama</p>
                          <div className="flex gap-2">
                             <button onClick={() => handleAction('ignite', true)} className="bg-red-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg"><Flame size={10}/>Yak</button>
                             {selectedPlayer && <button onClick={() => handleAction('douse')} className="bg-orange-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-full">Gazla</button>}
                          </div>
                       </div>
                       <PlayerList players={nightTargets} selected={selectedPlayer} onSelect={setSelectedPlayer} isNight={true} isDevMode={isDevMode} dousedList={dousedList} />
                    </div>
                 )}
                 {isYanasma && (
                    <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 max-w-sm mx-auto w-full">
                       <div className="flex flex-col">
                          <p className="text-[10px] text-emerald-500 font-bold uppercase">Saklanma</p>
                          <p className="text-[9px] text-slate-400">Kalan: {4 - (me.uses || 0)}</p>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleAction('protect', true)} disabled={(me.uses || 0) >= 4} className="px-4 py-2 bg-emerald-700 text-white text-[9px] font-black rounded-lg uppercase">Saklan</button>
                          <button onClick={() => handleAction('bos', false)} className="px-4 py-2 bg-slate-700 text-slate-300 text-[9px] font-black rounded-lg uppercase">Pas</button>
                       </div>
                    </div>
                 )}
              </div>
           )}

           {/* OYLAMA AKSİYONU */}
           {gamePhase === 'VOTING' && me.isAlive && !isSpectator && !hasActioned && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 <div className="flex justify-between items-center mb-2 px-2">
                    <p className="text-accent text-[10px] font-black tracking-widest uppercase">Kuyuya At</p>
                    <div className="flex gap-2">
                       <button onClick={() => handleVote(true)} className="bg-slate-700 text-slate-300 text-[9px] font-black uppercase px-3 py-1.5 rounded-full">Pas Geç</button>
                       {selectedPlayer && <button onClick={() => handleVote(false)} className="bg-accent text-white text-[9px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg">Oyla</button>}
                    </div>
                 </div>
                 <PlayerList players={players.filter(p => !p.isMayorRevealed || p.socketId !== activeSocketId).filter(p => p.socketId !== activeSocketId && p.isAlive)} selected={selectedPlayer} onSelect={setSelectedPlayer} isDevMode={isDevMode} />
              </div>
           )}

           {/* SABAH DURUMU */}
           {gamePhase === 'MORNING' && (
              <div className="h-full flex flex-col items-center justify-center text-yellow-500 animate-pulse">
                 <Sun size={24} className="mb-1" />
                 <p className="text-[10px] font-black uppercase tracking-[0.2em]">Haberler Bekleniyor</p>
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
                 <button onClick={() => socket.emit('mayorReveal', { roomCode, impersonateId: isDevMode ? impersonateId : null })} className="bg-amber-600 text-white px-3 py-1 rounded text-[9px] font-black uppercase shadow-md">Mührü Vur</button>
              </div>
           )}

           {/* GÜNÜ ATLA PANELİ */}
           {gamePhase === 'DAY' && me.isAlive && !isSpectator && (
              <div className="flex justify-end p-2 bg-slate-800/10 shrink-0">
                 <button 
                    onClick={() => socket.emit('skipDayVote', { roomCode, impersonateId: isDevMode ? impersonateId : null })}
                    className="px-3 py-1 bg-slate-800 text-slate-400 rounded-md border border-slate-700 text-[9px] font-bold uppercase"
                 >
                    Günü Atla ({skipDayCount.count}/{skipDayCount.total || players.filter(p => p.isAlive && p.connected).length})
                 </button>
              </div>
           )}

           {/* MESAJ LİSTESİ */}
           <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 custom-scrollbar">
              {chatMessages.map((c, i) => {
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

                  return (
                    <div key={i} className={`p-2.5 rounded-2xl max-w-[85%] shadow-md border ${bubbleClass} ${isMe ? 'ml-auto rounded-br-sm' : 'mr-auto rounded-bl-sm'}`}>
                      <span className={`text-[9px] block mb-0.5 font-bold uppercase tracking-wider ${senderClass}`}>{c.sender}</span>
                      <span className="text-sm leading-relaxed">{c.message}</span>
                    </div>
                  );
              })}
              <div ref={chatEndRef} />
           </div>

           {/* SOHBET GİRDİSİ */}
           <div className="p-2 bg-slate-900/60 border-t border-slate-800/50 shrink-0">
              {isSpectator && gamePhase === 'DAY' ? (
                 <div className="p-2 text-center"><p className="text-purple-400/80 text-[10px] font-serif uppercase">— İzleyici Modu —</p></div>
              ) : canSendChat ? (
                 <form onSubmit={sendChat} className="flex gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <input type="text" 
                       value={currentMessage} 
                       onChange={e => setCurrentMessage(e.target.value)} 
                       disabled={isSilenced && gamePhase === 'DAY'}
                       className="flex-1 min-w-0 bg-transparent text-white px-3 py-2 focus:outline-none text-sm" 
                       placeholder={isSilenced && gamePhase === 'DAY' ? "Susturuldun!" : (gamePhase === 'NIGHT' ? (isEskiya ? "Çete ile konuş..." : "Ruhlarla fısılda...") : "Zanlıları tartış...")} 
                    />
                    <button type="submit" disabled={isSilenced && gamePhase === 'DAY'} className="bg-accent px-4 shrink-0 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center text-white disabled:opacity-50"><Send size={16} /></button>
                 </form>
              ) : (
                 <div className="p-2 text-center opacity-50"><p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Sohbet Kapalı</p></div>
              )}
           </div>
        </div>

      </div>

      <div className="w-full lg:w-56 flex flex-col gap-4 min-h-[200px] lg:h-full shrink-0">

        {/* ... (rest of the file) */}


        {/* END */}
        {gamePhase === 'END' && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col p-8 overflow-y-auto animate-in fade-in duration-1000 custom-scrollbar">
             <h2 className="text-5xl font-serif text-center mb-4 tracking-widest text-amber-500 uppercase drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">Oyun Sona Erdi</h2>
             <p className="text-xl text-slate-300 text-center mb-10 tracking-widest uppercase">{eventNews}</p>
             
             {gameResults && (
             <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto w-full">
                 <div className="flex-1 bg-slate-900/80 p-6 rounded-2xl border-2 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                     <h3 className="text-2xl text-green-500 font-bold mb-6 border-b border-green-500/30 pb-3 text-center uppercase tracking-widest flex items-center justify-center gap-2">Kazananlar</h3>
                     <ul className="space-y-3">
                         {gameResults.filter(r => r.won).map((r, i) => (
                             <li key={i} className="flex flex-col bg-black/60 p-3 rounded-lg border border-green-500/20">
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

      </div>

      <div className="w-full lg:w-56 flex flex-col gap-4 min-h-[300px] lg:h-full shrink-0">
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

          {gamePhase === 'VOTING' && (
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

      {/* NOTLAR MODAL */}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300 pointer-events-auto" onClick={() => setShowNotes(false)}>
          <div className="w-full h-full sm:h-[80vh] sm:max-w-lg bg-slate-900 sm:border border-slate-700 rounded-none sm:rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50 sm:rounded-t-2xl">
              <div className="flex items-center gap-3">
                 <BookOpen className="text-accent" size={24} />
                 <h3 className="text-xl font-bold font-serif tracking-widest text-slate-200">Köy Defteri</h3>
              </div>
              <button onClick={() => setShowNotes(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
               <div>
                  <h4 className="text-sm font-bold text-accent tracking-wider uppercase mb-3 border-b border-slate-800 pb-2">Otomatik Sistem Notları</h4>
                  <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 border-b border-transparent">
                    {systemNotes?.length > 0 ? systemNotes.map((note, i) => {
                      let borderClass = 'border-slate-600';
                      if(note.align === 'Kırmızı') borderClass = 'border-blood-red';
                      if(note.align === 'Yeşil') borderClass = 'border-green-500';
                      if(note.align === 'Gri') borderClass = 'border-gray-400';
                      if(note.align === 'Yarı') borderClass = 'border-amber-500';
                      
                      return (
                        <li key={i} className={`bg-slate-800 p-3 rounded-lg border-l-4 ${borderClass} shadow-inner text-[13px] flex items-center gap-4`}>
                          <span className="text-slate-300">{note.text}</span>
                        </li>
                      );
                    }) : (
                      <li className="text-slate-500 italic text-sm">Henüz bir olay gerçekleşmedi...</li>
                    )}
                  </ul>
               </div>

               <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                     <h4 className="text-sm font-bold text-yellow-500 tracking-wider uppercase">Vasiyetin (Gizli Notların)</h4>
                     <span className="text-[9px] text-yellow-500/70 italic uppercase tracking-widest hidden sm:inline">Öldüğünde tüm köye okunacaktır</span>
                  </div>
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
                  <p className="text-[10px] text-slate-500 italic mt-2 sm:hidden text-center">Bu notlar öldüğünde tüm köye okunacaktır.</p>
               </div>
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

      {/* REVEALED DEATH NOTES MODAL */}
      {revealedNotes && revealedNotes.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-0 sm:p-4 animate-in zoom-in duration-500 pointer-events-auto" onClick={() => setRevealedNotes([])}>
           <div className="w-full h-full sm:h-auto sm:max-w-lg bg-[#f4e4bc] text-slate-900 p-8 sm:rounded-sm shadow-[0_0_60px_rgba(252,211,77,0.3)] relative flex flex-col" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/old-wall.png')" }} onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-black/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-black/20 to-transparent"></div>
              
              <h2 className="text-3xl font-serif font-bold text-center mb-6 text-[#5c4033] border-b-2 border-[#5c4033]/30 pb-4 shrink-0">ÖLÜNÜN VASİYETİ</h2>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2 max-h-none sm:max-h-[60vh]">
                 {revealedNotes.map((rn, idx) => (
                    <div key={idx} className="mb-4">
                       <h3 className="font-bold text-xl text-[#3b2a21] mb-2">{rn.playerName} Tarafından Yazıldı:</h3>
                       <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap italic text-[#4a3628] bg-black/5 p-4 rounded-md border-l-4 border-[#8b5a2b]">
                          {rn.note || "Sayfalar boş... Hiçbir not bırakmamış."}
                       </p>
                    </div>
                 ))}
              </div>

              <div className="mt-8 text-center shrink-0">
                 <button onClick={() => setRevealedNotes([])} className="bg-[#8b5a2b] hover:bg-[#704214] text-[#f4e4bc] px-8 py-3 rounded shadow-lg font-bold uppercase tracking-widest transition-colors">
                    Huzur İçinde Yatsın
                 </button>
              </div>
           </div>
        </div>
      )}

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
