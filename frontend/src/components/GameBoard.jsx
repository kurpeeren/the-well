import React, { useState, useEffect, useRef } from 'react';
import { Send, Moon, Sun, MessageSquare, AlertTriangle, ShieldAlert, BookOpen, X, Flame, Shield, Info } from 'lucide-react';

function GameBoard({ socket, roomCode, players, gamePhase, timeRemaining, myRole, eventNews, systemNotes, isDevMode, dayCount, gameResults, isSpectator, onLeave }) {
  const [impersonateId, setImpersonateId] = useState(null);

  const activeSocketId = (isDevMode && impersonateId) ? impersonateId : socket.id;
  const me = isSpectator ? { isSpectator: true, isAlive: false, role: 'İzleyici Ruh', name: 'Ruh' } : (players.find(p => p.socketId === activeSocketId) || {});
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
    socket.on('youAreSilenced', () => setIsSilenced(true));
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
  const hasNightTargetAction = ['Şifacı', 'Bekçi', 'Eşkıya Başı', 'Eşkıya', 'Seri Katil', 'Münafık', 'Dedikoducu', 'Falcı', 'Tefeci', 'Meyhaneci', 'Dilber'].includes(activeRole);
  
  const isAvci = activeRole === 'Avcı';
  const isKundakci = activeRole === 'Kundakçı';
  const isYanasma = activeRole === 'Yanaşma';
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
    const neutrals = ['Köy Delisi', 'Kan Davalı', 'Yanaşma', 'Seri Katil'];

    if (evils.includes(role)) return 'text-blood-red drop-shadow-[0_0_8px_rgba(127,29,29,0.8)]'; // Kırmızı
    if (neutrals.includes(role)) return 'text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.8)]'; // Gri
    return 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'; // Yeşil (Masumlar)
  };

  const getTeamName = (role) => {
    const evils = ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci', 'Kundakçı'];
    const neutrals = ['Köy Delisi', 'Kan Davalı', 'Yanaşma', 'Seri Katil'];
    if (evils.includes(role)) return 'Kırmızı Takım';
    if (neutrals.includes(role)) return 'Gri Takım';
    return 'Yeşil Takım';
  };

  const ROLE_INFO = {
    'Şifacı': { color: 'text-green-500', desc: "Köyün otacısıdır, kimin kapısına dert gelse devasını bulur. Her gece bir oyuncuyu seçer. Eğer düşmanlar o oyuncuya saldırırsa, onu hayatta tutar. Kendini oyun boyunca sadece 2 kez iyileştirebilir." },
    'Bekçi': { color: 'text-green-500', desc: "Geceleri elinde feneriyle sokakları arşınlar. Her gece bir oyuncuyu kontrol eder. Sistem ona o kişinin Eşkıya veya Masum olup olmadığını söyler. (Eşkıya Başı hariç)." },
    'Avcı': { color: 'text-green-500', desc: "Eski bir dağ adamıdır, tetikte uyur. Geceleri 'Pusuya Yatma' kararı alabilir. Eğer pusuya yatarsa, o gece ölmez ve onu ziyarete gelen herkesi vurur. Kısıtlama: Sınırlı sayıda pusu kurabilir." },
    'Muhtar': { color: 'text-green-500', desc: "Köyün mühürdarı. Gece hiçbir şey yapmaz. Gündüz 'Mührü Vur' butonuna basarak Muhtar olduğunu köye ilan edebilir. O andan itibaren oyu 3 sayılır ancak Şifacı onu gece koruyamaz." },
    'Dedikoducu': { color: 'text-green-500', desc: "Geceleri uyku tutmaz. Bir kişinin evini gözetler. O gece o eve kimlerin girip çıktığını görür ama içeride ne yaptıklarını bilemez." },
    'Falcı': { color: 'text-green-500', desc: "Kahve telvesinden insanların içini okur. Birini hedefler, sistem ona o kişinin olası üç rolünden oluşan bir kehanet sunar." },
    'Gassal': { color: 'text-green-500', desc: "Ölü yıkayıcısıdır. Geceleri ölülerin kendi aralarında yazıştığı 'Ölüler Boyutu' sohbetini canlı olarak görebilir." },
    'Dilber': { color: 'text-green-500', desc: "Her gece birini hedefler ve sabaha kadar onu oyalar. Seçilen kişi planladığı yeteneğini o gece kullanamaz. Amacı masum olanları korumaktır." },
  
    'Eşkıya Başı': { color: 'text-blood-red', desc: "Çetenin acımasız lideridir. Gece saldırılarına bağışıklığı vardır. Bekçi onu kontrol ettiğinde Temiz/Masum görünür. Çetenin kimi öldüreceğine karar verir." },
    'Münafık': { color: 'text-blood-red', desc: "Gece birini hedefler. Eğer Bekçi veya Falcı o gece o kişiyi kontrol ederse, sistem o kişiyi 'Eşkıya' veya 'Münafık' mış gibi gösterir." },
    'Eşkıya': { color: 'text-blood-red', desc: "Eşkıya Başı'nın seçtiği hedefi öldürmeye gider. Eğer o seçmezse inisiyatif alıp kendi seçtiği kişiyi vurur." },
    'Tefeci': { color: 'text-blood-red', desc: "Bir kişiyi hedefler. Ertesi gün o kişi tartısmada hiçbir şey yazamaz (susturulur)." },
    'Meyhaneci': { color: 'text-blood-red', desc: "Hedeflediği kişinin aklını çeler. Seçtiği kişi o gece yeteneğini kullanamaz." },
  
    'Kan Davalı': { color: 'text-gray-400', desc: "Gözünü intikam hırsı bürümüştür. Gece saldırılarına bağışıktır. Tek amacı kendisine oyun başı rastgele atanan Hasmını gündüz oylamayla kuyuya attırmaktır. Hedefi gece tesadüfen ölürse Köy Delisi'ne dönüşür." },
    'Kundakçı': { color: 'text-gray-400', desc: "Herkesi yakıp sona kalan kişi olmak ister. Gece saldırılarına bağışıktır. İstediği gece evlere gazyağı dökebilir, dilediği başka bir gece hepsini ateşe verebilir." },
    'Yanaşma': { color: 'text-gray-400', desc: "Sadece günü kurtarmaya çalışır. Kazanmak için kuyuya atılmayıp sonuna kadar (kim kazanırsa kazansın) yaşamak zorundadır. Sadece sınırlı sayıda kapısını kilitleyip saldırılardan saklanabilir." },
    'Köy Delisi': { color: 'text-gray-400', desc: "Aklını yitirmiş ve kuyunun dibindeki karanlığa takıntılı hale gelmiştir. Tek isteği gündüz kendini bilerek kuyuya attırmaktır. Atılırsa kazanan o olur ve ona oy veren birini kuyuya yanına çeker." },
    'Seri Katil': { color: 'text-gray-400', desc: "Gözünü kan bürümüş, yalnız hareket eden bir canidir. Gece bağışıklığı vardır. Her gece seçtiği birini öldürerek köyde tek başına hayatta kalmayı amaçlar." }
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

      <div className="flex-1 flex flex-col relative h-[75dvh] lg:h-full overflow-hidden rounded-xl border border-slate-800/50 bg-black/20">

        <div className="absolute inset-0 z-10 pointer-events-none">

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

             {isMuhtar && !me.isMayorRevealed && me.isAlive && (
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
             
             <div className="mt-12 text-center pb-8">
                 <p className="text-slate-500 text-sm tracking-widest mb-4">Bir sonraki oyun için odayı yeniden kurman gerekiyor...</p>
                 <button onClick={() => onLeave ? onLeave() : window.location.reload()} className="px-8 py-4 bg-slate-800 text-white rounded-xl border border-slate-700 hover:bg-slate-700 hover:text-amber-500 hover:border-amber-500 transition-all uppercase tracking-widest font-bold shadow-lg">Lobiye Dön</button>
             </div>
          </div>
        )}

        </div>

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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in zoom-in duration-200 pointer-events-auto">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
             <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <Info size={20} className="text-accent" />
                   <h3 className="font-serif tracking-widest uppercase text-lg text-slate-200">Rol Detayı</h3>
                </div>
                <button onClick={() => setShowRoleModal(false)} className="text-slate-400 hover:text-white transition-colors">
                   <X size={24} />
                </button>
             </div>
             <div className="p-6">
                <h4 className={`text-2xl font-bold font-serif mb-4 text-center ${ROLE_INFO[activeRole]?.color || 'text-slate-200'}`}>
                   {activeRole || 'Bilinmiyor'}
                </h4>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                   {ROLE_INFO[activeRole]?.desc || 'Bu rol hakkında henüz gizemli parşömenlerde detay bulunmuyor...'}
                </p>
                <div className="text-center">
                   <button onClick={() => setShowRoleModal(false)} className="px-6 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 font-medium tracking-wide">
                     Anladım
                   </button>
                </div>
             </div>
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
