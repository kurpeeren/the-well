import React, { useState, useEffect, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function Admin({ onExit }) {
    const [token, setToken] = useState(localStorage.getItem('kuyu_admin_token') || '');
    const [password, setPassword] = useState('');
    const [stats, setStats] = useState(null);
    const [health, setHealth] = useState(null);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');
    const [expandedRoom, setExpandedRoom] = useState(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [toast, setToast] = useState(null);
    const failCountRef = useRef(0);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            // Tab inaktifken polling'i atla — bandwidth tasarrufu
            if (document.visibilityState === 'hidden') return;
            fetchAll(token);
        };
        fetchAll(token);
        const interval = setInterval(tick, 3000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [token]);

    const showToastMsg = (m, ms = 2500) => {
        setToast(m);
        setTimeout(() => setToast(null), ms);
    };

    const adminFetch = async (path, options = {}) => {
        return fetch(`${BACKEND_URL}${path}`, {
            ...options,
            headers: {
                'Authorization': token || password,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
    };

    const fetchAll = async (authToken) => {
        try {
            const [statsRes, healthRes, histRes] = await Promise.all([
                fetch(`${BACKEND_URL}/api/admin/stats`, { headers: { 'Authorization': authToken } }),
                fetch(`${BACKEND_URL}/api/admin/health`, { headers: { 'Authorization': authToken } }),
                fetch(`${BACKEND_URL}/api/admin/history`, { headers: { 'Authorization': authToken } }),
            ]);

            if (statsRes.ok && healthRes.ok && histRes.ok) {
                failCountRef.current = 0;
                setStats(await statsRes.json());
                setHealth(await healthRes.json());
                setHistory(await histRes.json());
                setError('');
                if (authToken !== token) {
                    setToken(authToken);
                    localStorage.setItem('kuyu_admin_token', authToken);
                }
            } else if (statsRes.status === 401) {
                // 401 — kesinleşmiş auth hatası; ilk denemede logout
                if (!token) {
                    setError('Hatalı şifre.');
                } else {
                    setError('Oturum geçersiz, tekrar giriş yapın.');
                    localStorage.removeItem('kuyu_admin_token');
                    setToken('');
                }
            } else if (statsRes.status === 429) {
                setError('Çok fazla başarısız deneme. Bir süre bekleyin.');
            } else {
                throw new Error(`HTTP ${statsRes.status}`);
            }
        } catch (err) {
            // Network/transient hatası — 3 ardışık fail'de logout
            failCountRef.current += 1;
            if (failCountRef.current >= 3 && token) {
                setError('Sunucuya 3 kez bağlanılamadı. Tekrar deneyin.');
                // Token'ı SİLME — kullanıcı manuel logout edebilsin
            } else {
                setError(`Bağlantı sorunu (${failCountRef.current}/3)...`);
            }
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        fetchAll(password);
    };

    const handleLogout = () => {
        setToken('');
        setStats(null);
        setHealth(null);
        localStorage.removeItem('kuyu_admin_token');
    };

    const handleCloseRoom = async (code) => {
        if (!confirm(`${code} odasını kapatmak üzeresin. Tüm oyuncular atılacak. Devam?`)) return;
        const res = await adminFetch(`/api/admin/rooms/${code}/close`, { method: 'POST' });
        if (res.ok) {
            showToastMsg(`${code} odası kapatıldı`);
            fetchAll(token);
        } else {
            showToastMsg('Kapatma başarısız');
        }
    };

    const handleKickPlayer = async (code, socketId, name) => {
        if (!confirm(`${name} adlı oyuncuyu ${code} odasından atmak istediğine emin misin?`)) return;
        const res = await adminFetch(`/api/admin/rooms/${code}/kick`, {
            method: 'POST',
            body: JSON.stringify({ socketId }),
        });
        if (res.ok) {
            showToastMsg(`${name} atıldı`);
            fetchAll(token);
        } else {
            showToastMsg('Atma başarısız');
        }
    };

    const handleBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastMsg.trim() || broadcastMsg.length > 280) return;
        if (!confirm(`Tüm ${health?.totalSockets || 0} bağlı kullanıcıya bu mesaj gönderilecek:\n\n"${broadcastMsg}"\n\nDevam?`)) return;
        const res = await adminFetch('/api/admin/broadcast', {
            method: 'POST',
            body: JSON.stringify({ message: broadcastMsg.trim() }),
        });
        if (res.ok) {
            const j = await res.json();
            showToastMsg(`Duyuru ${j.deliveredTo} kullanıcıya gönderildi`);
            setBroadcastMsg('');
        } else {
            showToastMsg('Duyuru başarısız');
        }
    };

    const formatUptime = (sec) => {
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (d > 0) return `${d}g ${h}sa ${m}dk`;
        if (h > 0) return `${h}sa ${m}dk`;
        if (m > 0) return `${m}dk ${s}sn`;
        return `${s}sn`;
    };

    const pingColor = (ms) => {
        if (ms == null) return 'text-slate-500';
        if (ms < 80) return 'text-emerald-300';
        if (ms < 200) return 'text-amber-300';
        return 'text-red-300';
    };

    if (!token || !stats) {
        return (
            <div className="min-h-screen bg-kuyu-dark text-white flex flex-col items-center justify-center p-6 select-none">
                <div className="max-w-md w-full bg-dark-bg p-8 rounded-xl shadow-2xl border border-slate-800 relative">
                    <button onClick={onExit} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
                    <h1 className="text-2xl font-bold mb-2 text-center text-blood-red tracking-widest font-serif">KUYU YÖNETİM</h1>
                    <p className="text-center text-slate-500 text-xs uppercase tracking-widest mb-6">Sadece Yetkili</p>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2 text-slate-300">Admin Şifresi</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blood-red"
                                placeholder="Şifrenizi girin..."
                            />
                        </div>
                        <button type="submit" className="w-full bg-blood-red hover:bg-red-800 text-white font-bold py-3 rounded-lg transition-colors uppercase tracking-widest">Giriş Yap</button>
                    </form>
                    {error && <p className="text-red-400 mt-4 text-center text-sm">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-kuyu-dark text-white p-3 sm:p-6 select-none">
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-blood-red text-white px-5 py-2.5 rounded-lg shadow-2xl z-50 text-sm font-bold tracking-widest uppercase border border-red-500/40">
                    {toast}
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-wrap justify-between items-center mb-6 sm:mb-8 border-b border-slate-800 pb-4 gap-3">
                    <h1 className="text-xl sm:text-3xl font-bold text-blood-red tracking-widest flex items-center gap-3 font-serif">
                        <button onClick={onExit} className="text-slate-500 hover:text-white transition-colors text-2xl" title="Oyuna Dön">←</button>
                        KUYU YÖNETİM
                    </h1>
                    <div className="flex items-center gap-3">
                        {error && <span className="text-amber-400 text-xs">{error}</span>}
                        <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors text-sm uppercase tracking-widest">Çıkış</button>
                    </div>
                </div>

                {/* Server Health Cards */}
                {health && (
                    <>
                        <h2 className="text-sm sm:text-base font-bold mb-3 text-slate-400 uppercase tracking-widest">Sunucu Sağlığı</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                            <HealthCard label="Çalışma Süresi" value={formatUptime(health.uptimeSeconds)} accent="emerald" />
                            <HealthCard label="CPU" value={`${health.cpuPercent}%`} accent={health.cpuPercent > 75 ? 'red' : 'emerald'} />
                            <HealthCard label="Bellek (RSS)" value={`${health.memory.rssMB} MB`} accent={health.memory.rssMB > 400 ? 'amber' : 'emerald'} />
                            <HealthCard label="Heap" value={`${health.memory.heapUsedMB}/${health.memory.heapTotalMB} MB`} accent="slate" />
                            <HealthCard label="Toplam Soket" value={health.totalSockets} accent="accent" />
                            <HealthCard label="Aktif Oda" value={health.totalRooms} accent="emerald" />
                            <HealthCard label="Emit / Receive" value={`${health.traffic.emitCount} / ${health.traffic.receiveCount}`} accent="slate" sub="kümülatif" />
                            <HealthCard label="Auth Hatası" value={health.adminAuthFailures} accent={health.adminAuthFailures > 5 ? 'red' : 'slate'} />
                        </div>
                    </>
                )}

                {/* Broadcast */}
                <h2 className="text-sm sm:text-base font-bold mb-3 text-slate-400 uppercase tracking-widest">Duyuru</h2>
                <form onSubmit={handleBroadcast} className="flex gap-2 mb-8">
                    <input
                        type="text"
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        maxLength={280}
                        placeholder="Tüm aktif kullanıcılara mesaj..."
                        className="flex-1 bg-black border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-sm"
                    />
                    <button type="submit" disabled={!broadcastMsg.trim()} className="px-4 py-2 bg-accent hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition-colors">
                        Gönder
                    </button>
                </form>

                {/* Active Rooms */}
                <h2 className="text-sm sm:text-base font-bold mb-3 text-slate-400 uppercase tracking-widest">
                    Aktif Odalar <span className="text-xs font-normal text-slate-600 normal-case ml-2">(satıra tıkla genişlet)</span>
                </h2>
                <div className="bg-dark-bg rounded-xl border border-slate-800 overflow-hidden mb-8">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/40 border-b border-slate-800">
                                <tr>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Oda</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Durum / Faz</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Oyuncu</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:table-cell">Gün</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Açılış</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Aksiyon</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {stats.rooms.length === 0 ? (
                                    <tr><td colSpan="6" className="p-6 text-center text-slate-500 italic">Aktif oda yok.</td></tr>
                                ) : (
                                    stats.rooms.map(r => (
                                        <React.Fragment key={r.id}>
                                            <tr onClick={() => setExpandedRoom(expandedRoom === r.id ? null : r.id)}
                                                className="hover:bg-slate-900/40 transition-colors cursor-pointer">
                                                <td className="p-3 font-mono font-bold tracking-widest">
                                                    {expandedRoom === r.id ? '▼ ' : '▶ '}
                                                    <span className="selectable">{r.id}</span>
                                                    {r.isDevMode && <span className="text-[9px] bg-amber-950/40 text-amber-300 border border-amber-800/50 px-1.5 py-0.5 rounded ml-2 uppercase tracking-widest">Dev</span>}
                                                </td>
                                                <td className="p-3">
                                                    <div className={`text-xs font-bold ${r.status === 'LOBBY' ? 'text-blue-300' : 'text-red-300'}`}>{r.status}</div>
                                                    {r.phase && <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{r.phase} · {r.timeRemaining}s</div>}
                                                </td>
                                                <td className="p-3 text-xs">
                                                    <span className="text-white font-bold">{r.realPlayers}</span>
                                                    <span className="text-slate-500"> + {r.botPlayers} bot</span>
                                                    {r.spectators > 0 && <div className="text-[10px] text-purple-300">{r.spectators} izleyici</div>}
                                                </td>
                                                <td className="p-3 font-bold text-amber-300 hidden sm:table-cell">{r.dayCount}</td>
                                                <td className="p-3 text-xs text-slate-500 hidden md:table-cell">
                                                    {r.createdAt ? new Date(r.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </td>
                                                <td className="p-3">
                                                    <button onClick={(e) => { e.stopPropagation(); handleCloseRoom(r.id); }}
                                                        className="text-[10px] px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 rounded-lg uppercase tracking-widest font-bold transition-colors">
                                                        Kapat
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedRoom === r.id && (
                                                <tr className="bg-black/30">
                                                    <td colSpan="6" className="p-4 border-l-2 border-blood-red">
                                                        <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">Oyuncular</h4>
                                                        {(!r.playersList || r.playersList.length === 0) ? (
                                                            <span className="italic text-slate-500 text-sm">Sadece botlar.</span>
                                                        ) : (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {r.playersList.map((p) => (
                                                                    <div key={p.socketId} className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs ${p.isAlive ? 'bg-dark-bg border-slate-700' : 'bg-red-950/20 border-red-900/30 opacity-60'}`}>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className={`font-bold truncate ${p.isAlive ? 'text-white' : 'text-slate-400 line-through'}`}>{p.name}</div>
                                                                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                                                                                <span>{p.role || 'Rol yok'}</span>
                                                                                <span className={pingColor(p.ping?.ms)}>{p.ping?.ms != null ? `${p.ping.ms}ms` : '—'}</span>
                                                                                {!p.connected && <span className="text-red-400">offline</span>}
                                                                            </div>
                                                                        </div>
                                                                        <button onClick={() => handleKickPlayer(r.id, p.socketId, p.name)}
                                                                            className="shrink-0 text-[9px] px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-300 rounded uppercase tracking-widest font-bold transition-colors">
                                                                            At
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* History */}
                <h2 className="text-sm sm:text-base font-bold mb-3 text-slate-400 uppercase tracking-widest">
                    Oyun Geçmişi <span className="text-xs font-normal text-slate-600 normal-case ml-2">(Supabase, son 50)</span>
                </h2>
                <div className="bg-dark-bg rounded-xl border border-slate-800 overflow-hidden mb-12">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/40 border-b border-slate-800">
                                <tr>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Tarih</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Oda</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:table-cell">Mod</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Kazanan</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Oyuncu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {history.length === 0 ? (
                                    <tr><td colSpan="5" className="p-6 text-center text-slate-500 italic">Henüz oyun oynanmamış.</td></tr>
                                ) : (
                                    history.map(h => {
                                        const realPlayersCount = h.players ? h.players.filter(p => !p.isBot).length : 0;
                                        return (
                                            <React.Fragment key={h.id}>
                                                <tr onClick={() => setExpandedHistoryId(expandedHistoryId === h.id ? null : h.id)}
                                                    className="hover:bg-slate-900/40 transition-colors cursor-pointer">
                                                    <td className="p-3 text-slate-300 text-xs">
                                                        {expandedHistoryId === h.id ? '▼ ' : '▶ '}
                                                        {new Date(h.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                    <td className="p-3 font-mono font-bold tracking-widest text-white text-xs"><span className="selectable">{h.room_code}</span></td>
                                                    <td className="p-3 text-slate-400 text-xs hidden sm:table-cell">{h.game_mode}</td>
                                                    <td className="p-3 font-bold text-amber-300 text-xs">{h.winner || '-'}</td>
                                                    <td className="p-3 text-slate-300 text-xs">{realPlayersCount}g / {h.players ? h.players.length - realPlayersCount : 0}b</td>
                                                </tr>
                                                {expandedHistoryId === h.id && (
                                                    <tr className="bg-black/30">
                                                        <td colSpan="5" className="p-4 border-l-2 border-accent">
                                                            <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">Maç Sonucu</h4>
                                                            {(!h.players || h.players.length === 0) ? (
                                                                <span className="italic text-slate-500 text-sm">Oyuncu verisi yok.</span>
                                                            ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {h.players.filter(p => !p.isBot).map((p, i) => (
                                                                        <div key={i} className={`p-2.5 rounded-lg border text-xs ${p.won ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-red-950/20 border-red-900/30 opacity-70'}`}>
                                                                            <div className="font-bold text-white flex justify-between items-center">
                                                                                <span className={p.won ? '' : 'line-through'}>{p.name}</span>
                                                                                {p.won && <span className="text-emerald-300 text-[9px] uppercase tracking-widest">Kazandı</span>}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500 mt-0.5">{p.role || 'Bilinmiyor'}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HealthCard({ label, value, accent = 'slate', sub }) {
    const accentMap = {
        emerald: 'text-emerald-300',
        amber: 'text-amber-300',
        red: 'text-red-300',
        accent: 'text-accent',
        slate: 'text-slate-200',
    };
    return (
        <div className="bg-dark-bg p-3 sm:p-4 rounded-xl border border-slate-800">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">{label}</h3>
            <p className={`text-lg sm:text-2xl font-black ${accentMap[accent]}`}>{value}</p>
            {sub && <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-1">{sub}</p>}
        </div>
    );
}
