import React, { useState, useEffect, useRef } from 'react';
import { Send, Moon, Sun, MessageSquare, AlertTriangle, ShieldAlert, BookOpen, X, Flame, Shield, Info, VolumeX } from 'lucide-react';

function GameBoard({ socket, roomCode, players, gamePhase, timeRemaining, myRole, eventNews, systemNotes, isDevMode, dayCount, gameResults, isSpectator, onLeave, isHost }) {
  const [impersonateId, setImpersonateId] = useState(null);

  const activeSocketId = (isDevMode && impersonateId) ? impersonateId : socket.id;
  const me = isSpectator 
    ? { isSpectator: true, isAlive: false, role: 'İzleyici Ruh', name: 'Ruh' } 
    : (players.find(p => p.socketId === activeSocketId) || { isAlive: true, role: myRole, name: '' });
  const activeRole = isSpectator ? 'İzleyici Ruh' : ((isDevMode && impersonateId) ? me.role : myRole);

  useEffect(() => {
     if (isDevMode && !impersonateId && players.length > 0) {
        setImpersonateId(players[0].socketId);
     }
  }, [isDevMode, players, impersonateId]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [deadChatMessages, setDeadChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [hasActioned, setHasActioned] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [personalNotes, setPersonalNotes] = useState('');
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [voteCounts, setVoteCounts] = useState({});
  const [voteDetails, setVoteDetails] = useState({});
  const [isSilenced, setIsSilenced] = useState(false);
  const [showSilencedModal, setShowSilencedModal] = useState(false);
  const [skipDayCount, setSkipDayCount] = useState({ count: 0, total: 0 });
  const chatEndRef = useRef(null);
  const deadChatEndRef = useRef(null);

  useEffect(() => {
    socket.on('chatMessage', (msgObj) => setChatMessages(prev => [...prev, msgObj]));
    socket.on('deadChatMessage', (msgObj) => setDeadChatMessages(prev => [...prev, msgObj]));
    socket.on('voteCounts', (data) => {
       setVoteCounts(data.counts || {});
       setVoteDetails(data.details || {});
    });
    socket.on('youAreSilenced', () => {
       setIsSilenced(true);
       setShowSilencedModal(true);
    });
    socket.on('skipDayUpdate', (data) => setSkipDayCount(data));
    return () => {
       socket.off('chatMessage');
       socket.off('deadChatMessage');
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
       setDeadChatMessages([]); // Temizle
    }
    if(gamePhase === 'NIGHT') setIsSilenced(false);
    if(gamePhase !== 'VOTING') {
       setVoteCounts({});
       setVoteDetails({});
    }
  }, [gamePhase]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    if (deadChatEndRef.current) deadChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, deadChatMessages]);

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

  const sendChat = (e, isDeadChat = false) => {
    e.preventDefault();
    if(currentMessage.trim()) {
      socket.emit(isDeadChat ? 'deadChatMessage' : 'chatMessage', { roomCode, message: currentMessage, impersonateId: isDevMode ? impersonateId : null });
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
           return { ...p, name: p.name + ' [TAKIM]' };
        }
        return p;
     });
  }

  const getTeamColor = (role) => {
    const evils = ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci', 'Kundakçı'];
    const neutrals = ['Köy Delisi', 'Kan Davalı', 'Kaçak', 'Seri Katil'];

    if (evils.includes(role)) return 'text-blood-red drop-shadow-[0_0_8px_rgba(127,29,29,0.8)]'; // Kırmızı
    if (neutrals.includes(role)) return 'text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.8)]'; // Gri
    return 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'; // Yeşil (Masumlar)
  };

  const getTeamName = (role) => {
    const evils = ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci', 'Kundakçı'];
    const neutrals = ['Köy Delisi', 'Kan Davalı', 'Kaçak', 'Seri Katil'];
    if (evils.includes(role)) return 'Kırmızı Takım';
    if (neutrals.includes(role)) return 'Gri Takım';
    return 'Yeşil Takım';
  };

  const ROLE_INFO = {
    'Şifacı': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/sifaci.jpeg',
      ability: '🌿 Her gece bir kişiyi iyileştirir',
      desc: 'Köyün bilge otacısı. Her gece bir oyuncunun kapısına giderek onu gece saldırılarından korur. Eğer o gece hedefi saldırıya uğrarsa, hayatta kalır. Kendini oyun boyunca yalnızca 2 kez iyileştirebilir.',
    },
    'Bekçi': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/bekci.jpeg',
      ability: '🔦 Her gece bir kişiyi kontrol eder',
      desc: 'Geceleri elinde fenerle sokakları arşınlar. Seçtiği kişinin eşkıya olup olmadığını araştırır. Eşkıya Başı kontrol edildiğinde masum görünür; Münafık tarafından çerçevelenmiş biri ise eşkıya gibi görünür.',
    },
    'Avcı': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/avci.jpeg',
      ability: '🪤 Sınırlı sayıda pusu kurabilir (3 hak)',
      desc: 'Eski bir dağ adamı, tetikte uyur. "Pusuya Yat" seçeneğiyle o gece evine gelen herkesi, masum ya da değil, vurur. Gece koruması yoktur. Sınırlı sayıda kullanım hakkı vardır.',
    },
    'Muhtar': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/muhtar.jpeg',
      ability: '🔏 Mühür vurarak oyunu ağırlığını ortaya koyar',
      desc: 'Köyün mühürdarı. Gece hareketsizdir. Gündüz "Mührü Vur" diyerek kimliğini ilan edebilir. Bu andan itibaren oylamalarda oyu 3 sayılır; ancak Şifacı kendisini bir daha koruyamaz. Susturulmuşsa mührü vuramaz.',
    },
    'Gözcü': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/gozcu.jpeg',
      ability: '🕵️ Bir kişinin evini gözetler',
      desc: 'Gece uyku tutmaz, başkalarının işine burnunu sokar. Bir kişinin kapısını gözlemler: o gece o kişiyi kim ziyaret etmiş görür. Ama içeride ne yaptıklarını bilemez.',
    },
    'Falcı': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/falci.jpeg',
      ability: '🔮 Olası 3 rolden oluşan kehanet alır',
      desc: 'Kahve telvesinden geleceği okur. Her gece bir kişiyi hedefler; sistem ona o kişinin olası 3 rolünden oluşan bir kehanet sunar. Münafık tarafından çerçevelenmiş biri farklı bir kehanet üretir.',
    },
    'Gassal': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/gassal.jpeg',
      ability: '💀 Ölü konuşmalarını dinleyebilir',
      desc: 'Ölü yıkayıcısıdır. Gece yetenekli değildir ama öte dünyaya kapısı açıktır: ölmüş oyuncuların kendi aralarında yaptığı "Ölüler Boyutu" sohbetini canlı olarak görebilir.',
    },
    'Eskort': {
      color: 'text-green-400', team: 'Yeşil Takım', teamColor: 'bg-green-900/40 text-green-400 border-green-700',
      image: '/roles/eskort.jpeg',
      ability: '💃 Hedefini oyalar, yeteneğini engeller',
      desc: 'Her gece bir kişiyi ziyaret eder ve onu sabaha kadar oyalar. O kişi o gece hiçbir yeteneğini kullanamaz. Eşkıyaları bile etkisiz kılabilir; eşkıyalar da onu ziyaret ederse ölebilir.',
    },
    'Eşkıya Başı': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/eskiya_basi.jpeg',
      ability: '🗡️ Her gece öldürme emri verir',
      desc: 'Çetenin acımasız lideri. Gece saldırılarına bağışıktır. Bekçi onu kontrol etse masum görünür (kan bulaşmamışsa). Kimin öldürüleceğini o belirler. Eşkıyalar ona karşı çıkamaz.',
    },
    'Münafık': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/munafik.jpeg',
      ability: '🎭 Bir kişiyi yanlış gösterir',
      desc: 'Gece bir kişiyi hedefler. O gece Bekçi veya Falcı o kişiyi araştırırsa, sistem o kişiyi sanki eşkıyaymış gibi gösterir. Masum biri haksız yere şüphe altına girebilir.',
    },
    'Eşkıya': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/eskiya.jpeg',
      ability: '🔪 Eşkıya Başı ile koordineli saldırır',
      desc: 'Çetenin yardımcısı. Eşkıya Başı seçmezse inisiyatif alıp kendi hedefini vurabilir. Takım olarak hareket eder; gece kimin öldürüleceğini birlikte planlarlar.',
    },
    'Tefeci': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/tefeci.jpeg',
      ability: '🤐 Birini bir gün susturur',
      desc: 'Faiz ve tehditle geçimini sağlar. Her gece bir kişiyi hedefler; ertesi gün o kişi tartışmada hiçbir şey yazamaz (susturulur). Susturulan Muhtar mührünü de vuramaz.',
    },
    'Meyhaneci': {
      color: 'text-red-400', team: 'Kırmızı Takım', teamColor: 'bg-red-900/40 text-red-400 border-red-700',
      image: '/roles/meyhaneci.jpeg',
      ability: '💋 Hedefini bir gece işe yaramaz hale getirir',
      desc: 'Eşkıyaların kiralık engelleyicisi. Gece bir kişiyi ziyaret eder; o kişi o gece yeteneğini kullanamaz. Masum roller bile devre dışı kalabilir. Eskort gibi çalışır ama kötü amaçlıdır.',
    },
    'Kan Davalı': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/kan_davali.jpeg',
      ability: '⚔️ Tek bir kişiyi kuyuya attırmak zorundadır',
      desc: 'Gözünü intikam hırsı bürümüştür. Gece saldırılarına bağışıktır. Oyun başı rastgele bir "kan hasımı" atanır; bu kişiyi gündüz oylamayla kuyuya attırmak zorundadır. Hasım başka bir şekilde ölürse Köy Delisi\'ne dönüşür.',
    },
    'Kundakçı': {
      color: 'text-orange-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/kundakci.jpeg',
      ability: '🔥 Evleri yakabilir, son kişi olmak ister',
      desc: 'Herkesi yakıp en son kalan olmayı hedefler. Gece saldırılarına bağışıktır. Bir gece evlere gazyağı dökebilir, başka bir gece hepsini ateşe verebilir. Kendi kendine bir kaos yaratır.',
    },
    'Kaçak': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/kacak.jpeg',
      ability: '🛡️ Sınırlı sayıda kapısını kilitler (4 hak)',
      desc: 'Sadece hayatta kalmayı hedefler. Kim kazanırsa kazansın, oyunun sonuna kadar sağ kalırsa kazanır. Saldırılardan korunmak için kapısını kilitleyebilir ama bu hak sınırlıdır.',
    },
    'Köy Delisi': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/koy_delisi.jpeg',
      ability: '🪦 Kendisini kuyuya attırmak ister',
      desc: 'Aklını yitirmiş, kuyunun karanlığına çekilmiş biri. Tek amacı gündüz kendini oylamayla kuyuya attırmaktır. Başarılırsa kazanır ve oy verenlerden birini kuyuya çeker. Gece eylemsizdir.',
    },
    'Seri Katil': {
      color: 'text-gray-400', team: 'Gri Takım', teamColor: 'bg-slate-800/60 text-slate-400 border-slate-600',
      image: '/roles/seri_katil.jpeg',
      ability: '🩸 Her gece bir kişiyi öldürür',
      desc: 'Yalnız hareket eden, gözü dönmüş bir cani. Gece bağışıklığı vardır. Hiçbir takıma bağlı olmaksızın her gece bir kişiyi öldürür. Köyde tek başına hayatta kalan kişi olursa kazanır.',
    },
  };

  return (
    <div className={`w-full max-w-4xl flex flex-col gap-4 p-6 rounded-2xl transition-all duration-1000 ${gamePhase === 'NIGHT' ? 'bg-black text-slate-400 shadow-[0_0_30px_rgba(0,0,0,0.8)]' : 'bg-dark-bg text-slate-100 shadow-2xl'} border border-slate-800 min-h-[75vh]`}>
      
      {isDevMode && (
         <div className="bg-yellow-900/30 border border-yellow-700 p-3 rounded-xl mb-1 flex items-center justify-between">
            <span className="text-yellow-500 font-bold tracking-wider uppercase text-sm hidden md:inline">Geliştirici Kumandası</span>
            <div className="flex items-center gap-3 ml-auto">
               <button onClick={() => socket.emit('forceNextPhase', roomCode)} title="Mevcut süreyi atla" className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold px-3 py-1.5 text-[11px] uppercase tracking-wider rounded-lg border border-yellow-500 transition-all shadow-[0_0_10px_rgba(202,138,4,0.4)] whitespace-nowrap">
                 Faza Geç ⏭
               </button>
               <select 
                  className="bg-black text-yellow-500 border border-yellow-700 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-yellow-500 w-[140px] md:w-auto text-xs"
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

      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/60 p-3 sm:p-5 rounded-xl border border-slate-800 backdrop-blur-sm gap-4">
        <div className="flex gap-3 sm:gap-4 items-center w-full sm:w-auto">
           <div className="p-2 sm:p-3 bg-slate-800 rounded-full border border-slate-700 shadow-inner shrink-0">
             {getPhaseIcon()}
           </div>
           <div className="flex-1 min-w-0">
             <h2 className="text-lg sm:text-2xl font-bold tracking-wider font-serif text-slate-200 truncate">{getPhaseNameTR()}</h2>
             <div className="text-xs sm:text-sm font-medium mt-1 text-slate-300 flex items-center flex-wrap gap-1">
               <span>Rolün: </span>
               <span 
                 className={`uppercase tracking-widest cursor-pointer select-none px-2 py-0.5 sm:px-3 sm:py-1 rounded-md transition-all duration-300 ${isRoleVisible || isSpectator ? getTeamColor(activeRole) + ' bg-slate-900/80 border border-current' : 'text-slate-500 bg-slate-800 border border-slate-700'}`}
                 onPointerDown={() => !isSpectator && setIsRoleVisible(true)}
                 onPointerUp={() => !isSpectator && setIsRoleVisible(false)}
                 onPointerLeave={() => !isSpectator && setIsRoleVisible(false)}
                 onContextMenu={(e) => e.preventDefault()}
               >
                 {isSpectator ? 'İzleyici Ruh' : (isRoleVisible ? activeRole : '****')}
               </span>
               <button onClick={() => setShowRoleModal(true)} className="ml-1 text-slate-500 hover:text-yellow-500 transition-colors tooltip align-middle shrink-0" title="Rol Rehberi">
                 <Info size={16} />
               </button>
             </div>
           </div>
        </div>
        <div className="flex gap-4 items-center justify-center w-full sm:w-auto border-t border-slate-800/50 sm:border-0 pt-3 sm:pt-0">
           <button onClick={() => setShowNotes(true)} className="p-2.5 sm:p-3 bg-slate-800 rounded-full border-2 border-slate-700 hover:border-accent text-slate-300 hover:text-white transition-all shadow-md group relative">
             <BookOpen size={20} className="sm:w-6 sm:h-6" />
             {systemNotes?.length > 0 && <span className="absolute -top-1 -right-1 bg-blood-red w-4 h-4 rounded-full animate-pulse border border-dark-bg"></span>}
           </button>
           <div className="flex flex-col items-center justify-center bg-slate-800 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)] shrink-0">
             <span className="text-2xl sm:text-3xl font-mono text-white tracking-tighter leading-none">{timeRemaining}</span>
             <span className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-widest mt-1">Saniye</span>
           </div>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-500 ${eventNews ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-gradient-to-r from-blood-red/80 to-transparent p-4 rounded-xl border-l-4 border-red-500 flex items-center gap-3 shadow-lg mb-4">
          <AlertTriangle className="text-white shrink-0" />
          <p className="text-lg font-medium text-white">{eventNews}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 mt-2">

      <div className="flex-1 flex flex-col relative overflow-hidden rounded-xl border border-slate-800/50 bg-black/20" style={{ minHeight: '75vh' }}>


        {/* GECE AŞAMASI */}
        {gamePhase === 'NIGHT' && (
          <div className="absolute inset-0 flex mt-2 p-4 pointer-events-auto gap-4">
             {/* EĞER CANLIYSA AKSİYON PANELİ VEYA UYKU EKRANI */}
             {me.isAlive && !isSpectator && (
                <div className={`flex flex-col flex-1 h-full max-w-md mx-auto overflow-y-auto custom-scrollbar animate-in fade-in duration-700 ${canSeeDeadChat ? 'w-1/2' : 'w-full'}`}>
                  {!hasActioned ? (
                     <>
                        {hasNightTargetAction && (
                           <>
                              <p className="text-blood-red mb-6 text-center text-lg font-serif tracking-widest uppercase mb-4">
                                 Hedefini Seç
                              </p>
                              <PlayerList players={nightTargets} selected={selectedPlayer} onSelect={setSelectedPlayer} isNight={true} isDevMode={isDevMode} />
                              <button onClick={() => handleAction('target')} className="mt-8 w-full py-4 bg-blood-red text-white font-bold tracking-widest uppercase rounded-xl hover:bg-opacity-80 transition-all shadow-[0_0_30px_rgba(127,29,29,0.6)]">Onayla</button>
                           </>
                        )}

                        {isAvci && (
                           <div className="flex flex-col items-center mt-4 p-6 bg-slate-900/80 rounded-2xl border border-slate-700">
                              <ShieldAlert size={48} className="text-amber-600 mb-4" />
                              <p className="text-slate-300 mb-4 text-center">Evinin önüne pusu kurarsan, sana gelen herkesi (Masum veya değil) vurursun. <br/>Kalan Hakkın: {3 - (me.uses || 0)}</p>
                              <div className="flex gap-4 w-full">
                                <button onClick={() => handleAction('pusu', true)} disabled={(me.uses || 0) >= 3} className="flex-1 py-4 bg-amber-600 text-white font-bold rounded-xl uppercase hover:scale-105">Pusu Kur</button>
                                <button onClick={() => handleAction('bos', false)} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl uppercase">Boş Geç</button>
                              </div>
                           </div>
                        )}

                        {isKundakci && (
                           <div className="flex flex-col mt-4">
                              <p className="text-orange-500 mb-4 text-center font-serif tracking-widest uppercase">Evi Gazla Veya Ateşe Ver!</p>
                              <PlayerList players={nightTargets} selected={selectedPlayer} onSelect={setSelectedPlayer} isNight={true} isDevMode={isDevMode} />
                              <div className="flex gap-4 w-full mt-8">
                                <button onClick={() => handleAction('douse')} className="flex-1 py-4 bg-orange-700 text-white font-bold rounded-xl hover:scale-105">Gazyağı Dök</button>
                                <button onClick={() => handleAction('ignite', true)} className="flex-1 py-4 bg-red-600 flex justify-center items-center gap-2 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.7)] hover:scale-105"><Flame/>Ateşle</button>
                              </div>
                           </div>
                        )}

                        {isYanasma && (
                           <div className="flex flex-col items-center mt-10 p-6 bg-slate-900/80 rounded-2xl border border-slate-700">
                              <Shield size={48} className="text-emerald-600 mb-4" />
                              <p className="text-slate-300 mb-4 text-center">Kapıyı içeriden kilitleyip geceden korunabilirsin.<br/>Kalan Hakkın: {4 - (me.uses || 0)}</p>
                              <div className="flex gap-4 w-full">
                                <button onClick={() => handleAction('protect', true)} disabled={(me.uses || 0) >= 4} className="flex-1 py-4 bg-emerald-700 text-white font-bold rounded-xl uppercase">Saklan</button>
                                <button onClick={() => handleAction('bos', false)} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl uppercase">Boş Geç</button>
                              </div>
                           </div>
                        )}

                        {!hasNightTargetAction && !isAvci && !isKundakci && !isYanasma && (
                           <div className="flex flex-col items-center justify-center opacity-50 mt-20 animate-pulse w-full">
                              <Moon size={64} className="text-blue-900 mb-6" />
                              <p className="italic text-slate-500 font-serif">Köy derin bir uykuya daldı...</p>
                           </div>
                        )}
                     </>
                  ) : (
                     <div className="flex flex-col items-center justify-center opacity-80 mt-10 w-full">
                        <AlertTriangle size={64} className="text-amber-500 mb-6" />
                        <p className="text-amber-500 text-2xl font-serif text-center">Karar Kaydedildi.<br/>Sabahı Bekle...</p>
                     </div>
                  )}
                </div>
             )}

             {/* DEAD CHAT PANEL (GECE) */}
             {canSeeDeadChat && (
                <div className="flex-1 flex flex-col bg-slate-900/80 rounded-xl p-3 border border-purple-900/50 shadow-inner overflow-hidden max-w-sm mx-auto w-full">
                   <h3 className="text-purple-400 font-serif text-center mb-2 tracking-widest uppercase border-b border-purple-900/50 pb-2">Ölüler Boyutu</h3>
                   <div className="flex-1 overflow-y-auto flex flex-col gap-2 custom-scrollbar p-2">
                     {deadChatMessages.map((c, i) => (
                        <div key={i} className="text-sm p-2 rounded-lg bg-black/40 text-purple-200 border border-purple-900/30">
                           <span className="block text-[10px] uppercase text-purple-500 mb-0.5">{c.sender}</span>
                           <span>{c.message}</span>
                        </div>
                     ))}
                     <div ref={deadChatEndRef} />
                   </div>
                    {!me.isAlive && !isSpectator && (
                     <form onSubmit={(e) => sendChat(e, true)} className="mt-2 flex gap-2">
                       <input value={currentMessage} onChange={e=>setCurrentMessage(e.target.value)} className="flex-1 bg-black/50 border border-purple-900/50 text-white rounded-lg p-2 text-sm focus:outline-none" placeholder="Fısılda..." />
                       <button type="submit" className="bg-purple-800 text-white p-2 rounded-lg"><Send size={16}/></button>
                     </form>
                   )}
                   {isSpectator && (
                     <div className="mt-2 text-center text-[10px] text-purple-400 opacity-60 uppercase p-2 border border-purple-900/30 rounded-lg">Ruhlar fısıldar, sen sadece duyarsın.</div>
                   )}
                </div>
             )}
          </div>
        )}

        {/* GÜNDÜZ (TARTIŞMA) */}
        {gamePhase === 'DAY' && (
           <div className="flex flex-col h-full absolute inset-0 pointer-events-auto animate-in fade-in duration-500 bg-slate-900/50 rounded-xl p-2 border border-slate-800">
             
             {me.isAlive && !isSpectator && (
                <div className="flex justify-end w-full mb-1 z-10 px-1">
                   <button 
                      onClick={() => socket.emit('skipDayVote', { roomCode, impersonateId: isDevMode ? impersonateId : null })}
                      className="px-4 py-1.5 bg-slate-800/80 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 hover:text-white transition shadow-md text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                   >
                      Günü Atla ({skipDayCount.count}/{skipDayCount.total || players.filter(p => p.isAlive && p.connected).length})
                   </button>
                </div>
             )}

             {isMuhtar && !me.isMayorRevealed && me.isAlive && !isSilenced && (
                <div className="bg-slate-800/80 p-3 mb-2 rounded-xl border border-slate-700 flex justify-between items-center shadow-lg">
                   <span className="text-slate-300 text-sm">Gidişatı beğenmedin mi? Ağırlığını koyma vakti!</span>
                   <button onClick={() => socket.emit('mayorReveal', { roomCode, impersonateId: isDevMode ? impersonateId : null })} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(217,119,6,0.6)]">Mührü Vur</button>
                </div>
             )}

             <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
                {chatMessages.map((c, i) => {
                  const isMe = c.sender === me.name;
                  return (
                    <div key={i} className={`p-3 rounded-2xl max-w-[75%] shadow-md ${isMe ? 'bg-accent text-white align-self-end ml-auto rounded-br-sm' : 'bg-slate-800 text-slate-200 mr-auto rounded-bl-sm border border-slate-700'}`}>
                      {!isMe && <span className="text-[10px] text-slate-400 block mb-1 font-bold uppercase tracking-wider">{c.sender}</span>}
                      <span className="text-sm md:text-base leading-relaxed">{c.message}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
             </div>
             {isSpectator ? (
               <div className="bg-slate-900/50 border border-purple-900/50 rounded-xl p-4 mt-2 text-center shadow-inner">
                 <p className="text-purple-400/80 text-sm font-serif tracking-wider uppercase">— İzleyici Boyutundan İzleniyor —</p>
               </div>
             ) : me.isAlive ? (
               <form onSubmit={(e) => sendChat(e, false)} className="flex gap-2 mt-2 bg-slate-800 p-2 rounded-xl">
                 <input type="text" 
                    value={currentMessage} 
                    onChange={e => setCurrentMessage(e.target.value)} 
                    disabled={isSilenced}
                    className="flex-1 bg-slate-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-accent border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" 
                    placeholder={isSilenced ? "Tefeci seni susturduğu için konuşamazsın!" : "Zanlıları tartış..."} 
                 />
                 <button type="submit" disabled={isSilenced} className="bg-accent px-6 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"><Send size={20} /></button>
               </form>
             ) : (
               <div className="bg-red-900/20 border border-red-900 rounded-xl p-4 mt-2 text-center">
                 <p className="text-red-500 text-sm font-semibold tracking-wider uppercase">Sen öldün, ruhlar meydanda konuşamaz.</p>
               </div>
             )}
           </div>
        )}

        {/* OYLAMA */}
        {gamePhase === 'VOTING' && (
          <div className="absolute inset-0 flex flex-col items-center mt-6 p-4 animate-in pointer-events-auto slide-in-from-top-4 duration-500 overflow-y-auto custom-scrollbar pb-6">
            {isSpectator ? (
               <div className="flex flex-col items-center opacity-80 mt-10">
                 <AlertTriangle size={48} className="text-purple-500 mb-4" />
                 <p className="text-center text-purple-400 font-serif text-xl mt-4">Köy Kuyuya Kimi Atacak?</p>
                 <p className="text-center text-slate-500 text-sm italic mt-2">(Meydan izleniyor)</p>
               </div>
            ) : me.isAlive ? (
              <div className="w-full max-w-md">
                {!hasActioned ? (
                  <>
                    <p className="text-accent mb-6 text-center text-xl font-bold tracking-widest font-serif">Kimi Kuyuya Atacaksın?</p>
                    <PlayerList players={players.filter(p => !p.isMayorRevealed || p.socketId !== activeSocketId).filter(p => p.socketId !== activeSocketId && p.isAlive)} selected={selectedPlayer} onSelect={setSelectedPlayer} isDevMode={isDevMode} />
                    <div className="flex gap-4 mt-8">
                       <button onClick={() => handleVote(true)} className="flex-1 py-4 bg-slate-700 text-slate-300 font-bold tracking-widest uppercase rounded-xl hover:bg-slate-600 transition-all shadow-[0_0_15px_rgba(51,65,85,0.4)]">Pas Geç</button>
                       <button onClick={() => handleVote(false)} className="flex-[2] py-4 bg-accent text-white font-bold tracking-widest uppercase rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_20px_rgba(29,78,216,0.6)]">Oyu Gönder</button>
                    </div>


                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-80 mt-10">
                    <ShieldAlert size={64} className="text-accent mb-6" />
                    <p className="text-accent text-2xl tracking-[0.2em] font-serif text-center">Karar Verildi.<br/>Bekleniyor...</p>
                  </div>
                )}
              </div>
            ) : (
               <div className="flex flex-col items-center opacity-50 mt-20">
                 <AlertTriangle size={48} className="text-blood-red mb-4" />
                 <p className="text-center text-blood-red font-serif text-xl">Ölülerin oy hakkı yoktur.</p>
               </div>
            )}
          </div>
        )}

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
                {players.filter(p => !p.isAlive).map(p => (
                   <li key={p.socketId} className="flex flex-col bg-black/40 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-300 font-medium text-sm line-through opacity-70">{p.name} {isDevMode ? `(${p.role})` : ''}</span>
                      <span className={`${getTeamColor(p.role).split(' ')[0]} font-bold text-[11px] uppercase tracking-wider`}>{getTeamName(p.role)}</span>
                   </li>
                ))}
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 pointer-events-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50 rounded-t-2xl">
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
                  <h4 className="text-sm font-bold text-yellow-500 tracking-wider uppercase mb-3 border-b border-slate-800 pb-2">Kişisel Gizli Notların</h4>
                  <textarea value={personalNotes} onChange={e => setPersonalNotes(e.target.value)} placeholder="Şüphelendiğin durumları veya emin olduklarını buraya karala..." className="flex-1 w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none font-serif leading-relaxed" />
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ROL BİLGİSİ MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in zoom-in duration-200 pointer-events-auto">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
            
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in zoom-in duration-200 pointer-events-auto">
          <div className="w-full max-w-sm bg-slate-900 border border-red-900/50 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.3)] overflow-hidden flex flex-col items-center p-8 text-center">
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
    </div>
  );
}

function PlayerList({ players, selected, onSelect, isNight, isDevMode }) {
  if (players.length === 0) return <p className="text-slate-500 text-center italic">Kimse kalmadı...</p>;
  return (
    <div className="grid grid-cols-2 gap-4">
      {players.map(p => (
        <div key={p.socketId} onClick={() => onSelect(p.socketId)} className={`p-4 rounded-xl cursor-pointer border-2 transition-all duration-300 font-medium text-center ${selected === p.socketId ? (isNight ? 'bg-blood-red/20 border-blood-red text-white shadow-[0_0_15px_rgba(127,29,29,0.3)]' : 'bg-accent/20 border-accent text-white shadow-[0_0_15px_rgba(29,78,216,0.3)]') : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 text-slate-300'}`}>
          {p.name} {p.isMayorRevealed && <span className="text-amber-500 text-xs ml-2">[MUHTAR]</span>}
          {isDevMode && <span className="block text-yellow-500 text-[10px] uppercase font-bold tracking-widest opacity-80 mt-1">({p.role || 'Rol Bekleniyor'})</span>}
        </div>
      ))}
    </div>
  );
}

export default GameBoard;
