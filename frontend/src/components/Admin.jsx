import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Activity, Cpu, MemoryStick, Clock, Zap, Users, Database, ShieldAlert,
    Search, Megaphone, Trash2, UserMinus, LogOut, ArrowLeft, Send, Radio,
    Eye, Skull, Crown, KeyRound, AlertCircle, Send as SendIcon,
} from 'lucide-react';

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
    const [roomFilter, setRoomFilter] = useState('');
    const [historyFilter, setHistoryFilter] = useState('');
    const [lastTick, setLastTick] = useState(0);
    const failCountRef = useRef(0);
    const cpuHistRef = useRef([]);
    const socketHistRef = useRef([]);
    const [tickFlash, setTickFlash] = useState(false);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
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
                const s = await statsRes.json();
                const h = await healthRes.json();
                setStats(s);
                setHealth(h);
                setHistory(await histRes.json());
                setError('');
                cpuHistRef.current = [...cpuHistRef.current.slice(-29), h.cpuPercent];
                socketHistRef.current = [...socketHistRef.current.slice(-29), h.totalSockets];
                setLastTick(Date.now());
                setTickFlash(true);
                setTimeout(() => setTickFlash(false), 200);
                if (authToken !== token) {
                    setToken(authToken);
                    localStorage.setItem('kuyu_admin_token', authToken);
                }
            } else if (statsRes.status === 401) {
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
        } catch {
            failCountRef.current += 1;
            if (failCountRef.current >= 3 && token) {
                setError('Sunucuya 3 kez bağlanılamadı.');
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
        if (res.ok) { showToastMsg(`${code} odası kapatıldı`); fetchAll(token); }
        else showToastMsg('Kapatma başarısız');
    };

    const handleKickPlayer = async (code, socketId, name) => {
        if (!confirm(`${name} adlı oyuncuyu ${code} odasından atmak istediğine emin misin?`)) return;
        const res = await adminFetch(`/api/admin/rooms/${code}/kick`, {
            method: 'POST',
            body: JSON.stringify({ socketId }),
        });
        if (res.ok) { showToastMsg(`${name} atıldı`); fetchAll(token); }
        else showToastMsg('Atma başarısız');
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
        } else showToastMsg('Duyuru başarısız');
    };

    const formatUptime = (sec) => {
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        if (d > 0) return `${d}g ${h}sa`;
        if (h > 0) return `${h}sa ${m}dk`;
        return `${m}dk`;
    };

    const pingColor = (ms) => {
        if (ms == null) return 'text-slate-500';
        if (ms < 80) return 'text-emerald-300';
        if (ms < 200) return 'text-amber-300';
        return 'text-red-300';
    };

    const avgPing = useMemo(() => {
        if (!stats) return null;
        const pings = stats.rooms.flatMap(r => r.playersList.map(p => p.ping?.ms).filter(Boolean));
        if (!pings.length) return null;
        return Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
    }, [stats]);

    const filteredRooms = useMemo(() => {
        if (!stats) return [];
        const q = roomFilter.trim().toLowerCase();
        if (!q) return stats.rooms;
        return stats.rooms.filter(r =>
            r.id.toLowerCase().includes(q) ||
            r.playersList.some(p => p.name.toLowerCase().includes(q))
        );
    }, [stats, roomFilter]);

    const filteredHistory = useMemo(() => {
        const q = historyFilter.trim().toLowerCase();
        if (!q) return history;
        return history.filter(h =>
            (h.room_code || '').toLowerCase().includes(q) ||
            (h.winner || '').toLowerCase().includes(q) ||
            (h.players || []).some(p => (p.name || '').toLowerCase().includes(q))
        );
    }, [history, historyFilter]);

    // ─── LOGIN SCREEN ───────────────────────────────────────────
    if (!token || !stats) {
        return (
            <div className="min-h-screen bg-kuyu-dark text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(127,29,29,0.15),transparent_70%)] pointer-events-none"></div>

                <div className="relative max-w-md w-full">
                    <button onClick={onExit} className="absolute -top-12 right-0 text-slate-500 hover:text-white text-sm uppercase tracking-widest flex items-center gap-2">
                        <ArrowLeft size={16} /> Çıkış
                    </button>

                    <div className="bg-dark-bg/90 backdrop-blur-sm p-8 rounded-2xl shadow-[0_0_60px_rgba(127,29,29,0.25)] border border-blood-red/40 relative">
                        <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-blood-red to-transparent"></div>

                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-blood-red/15 border-2 border-blood-red/60 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(127,29,29,0.35)]">
                                <KeyRound className="text-blood-red w-7 h-7" />
                            </div>
                            <h1 className="text-3xl font-bold text-blood-red tracking-[0.4em] font-serif drop-shadow-[0_0_18px_rgba(127,29,29,0.55)]">KONSEY</h1>
                            <div className="h-px w-24 bg-gradient-to-r from-transparent via-blood-red/60 to-transparent my-2"></div>
                            <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] italic">Sadece Yetkili Geçer</p>
                        </div>

                        <form onSubmit={handleLogin}>
                            <label className="block text-[10px] font-bold mb-2 text-slate-400 uppercase tracking-widest">Konsey Mührü</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                className="w-full bg-black/60 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blood-red focus:ring-1 focus:ring-blood-red transition-colors mb-4"
                                placeholder="Şifrenizi fısılda..."
                            />
                            <button type="submit" className="w-full bg-blood-red hover:bg-red-800 active:bg-red-900 text-white font-black py-3 rounded-lg transition-colors uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(127,29,29,0.4)]">
                                Mührü Çöz
                            </button>
                        </form>

                        {error && (
                            <div className="mt-4 flex items-start gap-2 bg-red-950/40 border border-red-900/50 px-3 py-2 rounded-lg">
                                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={14} />
                                <p className="text-red-300 text-xs">{error}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const liveAge = lastTick ? Math.floor((Date.now() - lastTick) / 1000) : null;

    // ─── MAIN DASHBOARD ─────────────────────────────────────────
    return (
        <div className="min-h-screen bg-kuyu-dark text-white p-3 sm:p-6 select-none">
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-blood-red text-white px-5 py-2.5 rounded-lg shadow-2xl z-50 text-sm font-bold tracking-widest uppercase border border-red-500/40 animate-in fade-in slide-in-from-top-2">
                    {toast}
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                {/* ─── HEADER ─────────────────────────────────── */}
                <header className="flex flex-wrap justify-between items-center mb-6 sm:mb-8 pb-4 border-b border-slate-800 gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <button onClick={onExit} className="shrink-0 p-2 rounded-full hover:bg-slate-900 text-slate-500 hover:text-white transition-colors" title="Oyuna Dön">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-3xl font-bold text-blood-red tracking-[0.3em] sm:tracking-[0.4em] font-serif truncate drop-shadow-[0_0_15px_rgba(127,29,29,0.45)]">
                                KARANLIK KONSEY
                            </h1>
                            <p className="text-[9px] sm:text-[10px] text-slate-600 uppercase tracking-[0.4em] italic mt-0.5">Kuyu Komuta Kulesi</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/60 border border-slate-800 rounded-full transition-colors ${tickFlash ? 'border-emerald-500/60' : ''}`}>
                            <span className={`w-2 h-2 rounded-full ${liveAge != null && liveAge < 6 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">{liveAge != null && liveAge < 6 ? 'Canlı' : 'Bekliyor'}</span>
                        </div>
                        {error && <span className="text-amber-400 text-xs flex items-center gap-1"><AlertCircle size={12} />{error}</span>}
                        <button onClick={handleLogout} className="flex items-center gap-1.5 text-slate-400 hover:text-red-300 transition-colors text-xs uppercase tracking-widest">
                            <LogOut size={14} /> Çıkış
                        </button>
                    </div>
                </header>

                {/* ─── SERVER HEALTH ──────────────────────────── */}
                {health && (
                    <Section title="Sunucu Sağlığı" icon={<Activity size={14} />}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-3">
                            <StatTile icon={<Clock size={14} />} label="Uptime" value={formatUptime(health.uptimeSeconds)} tone="emerald" />
                            <StatTile icon={<Users size={14} />} label="Toplam Soket" value={health.totalSockets} tone="accent" />
                            <StatTile icon={<Database size={14} />} label="Aktif Oda" value={health.totalRooms} tone="emerald" />
                            <StatTile icon={<Zap size={14} />} label="Ort. Ping" value={avgPing != null ? `${avgPing}ms` : '—'} tone={avgPing == null ? 'slate' : avgPing < 100 ? 'emerald' : avgPing < 250 ? 'amber' : 'red'} />
                            <StatTile icon={<ShieldAlert size={14} />} label="Auth Fail" value={health.adminAuthFailures} tone={health.adminAuthFailures > 5 ? 'red' : 'slate'} />
                            <StatTile icon={<Radio size={14} />} label="Emit / Recv" value={`${formatNum(health.traffic.emitCount)}/${formatNum(health.traffic.receiveCount)}`} tone="slate" small />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <GaugeCard
                                icon={<Cpu size={14} />}
                                label="CPU"
                                value={`${health.cpuPercent}%`}
                                percent={Math.min(100, health.cpuPercent)}
                                tone={health.cpuPercent > 75 ? 'red' : health.cpuPercent > 50 ? 'amber' : 'emerald'}
                                history={cpuHistRef.current}
                            />
                            <GaugeCard
                                icon={<MemoryStick size={14} />}
                                label="Bellek (Heap)"
                                value={`${health.memory.heapUsedMB} / ${health.memory.heapTotalMB} MB`}
                                percent={Math.min(100, (health.memory.heapUsedMB / Math.max(1, health.memory.heapTotalMB)) * 100)}
                                tone={(health.memory.heapUsedMB / health.memory.heapTotalMB) > 0.85 ? 'amber' : 'emerald'}
                                sub={`RSS ${health.memory.rssMB}MB · ${health.platform} · ${health.nodeVersion}`}
                            />
                        </div>
                    </Section>
                )}

                {/* ─── BROADCAST ───────────────────────────────── */}
                <Section title="Konsey Duyurusu" icon={<Megaphone size={14} />}>
                    <form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={broadcastMsg}
                            onChange={(e) => setBroadcastMsg(e.target.value)}
                            maxLength={280}
                            placeholder="Tüm aktif kullanıcılara fısılda..."
                            className="flex-1 bg-black/60 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm placeholder:text-slate-600"
                        />
                        <button type="submit" disabled={!broadcastMsg.trim()} className="px-5 py-2.5 bg-accent hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shrink-0">
                            <Send size={14} /> Gönder
                        </button>
                    </form>
                    <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-widest">{broadcastMsg.length}/280 karakter</p>
                </Section>

                {/* ─── ACTIVE ROOMS ───────────────────────────── */}
                <Section
                    title={`Aktif Odalar (${stats.rooms.length})`}
                    icon={<Database size={14} />}
                    extra={
                        <SearchBox value={roomFilter} onChange={setRoomFilter} placeholder="Oda kodu veya oyuncu ara..." />
                    }
                >
                    <div className="bg-dark-bg rounded-xl border border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-black/40 border-b border-slate-800">
                                    <tr>
                                        <Th>Oda</Th>
                                        <Th>Durum / Faz</Th>
                                        <Th>Oyuncu</Th>
                                        <Th className="hidden sm:table-cell">Gün</Th>
                                        <Th className="hidden md:table-cell">Açılış</Th>
                                        <Th>Aksiyon</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredRooms.length === 0 ? (
                                        <tr><td colSpan="6" className="p-6 text-center text-slate-500 italic">{roomFilter ? 'Eşleşen oda yok.' : 'Aktif oda yok.'}</td></tr>
                                    ) : filteredRooms.map(r => (
                                        <React.Fragment key={r.id}>
                                            <tr onClick={() => setExpandedRoom(expandedRoom === r.id ? null : r.id)} className="hover:bg-slate-900/40 transition-colors cursor-pointer">
                                                <td className="p-3 font-mono font-bold tracking-widest">
                                                    <span className="text-slate-500 mr-1">{expandedRoom === r.id ? '▼' : '▶'}</span>
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
                                                    {r.spectators > 0 && <div className="text-[10px] text-purple-300 flex items-center gap-1 mt-0.5"><Eye size={10} />{r.spectators}</div>}
                                                </td>
                                                <td className="p-3 font-bold text-amber-300 hidden sm:table-cell">{r.dayCount}</td>
                                                <td className="p-3 text-xs text-slate-500 hidden md:table-cell">
                                                    {r.createdAt ? new Date(r.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </td>
                                                <td className="p-3">
                                                    <button onClick={(e) => { e.stopPropagation(); handleCloseRoom(r.id); }} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 rounded-lg uppercase tracking-widest font-bold transition-colors">
                                                        <Trash2 size={10} /> Kapat
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedRoom === r.id && (
                                                <tr className="bg-black/30">
                                                    <td colSpan="6" className="p-4 border-l-2 border-blood-red">
                                                        <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2"><Users size={12} /> Oyuncular ({r.playersList.length})</h4>
                                                        {(!r.playersList || r.playersList.length === 0) ? (
                                                            <span className="italic text-slate-500 text-sm">Sadece botlar.</span>
                                                        ) : (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {r.playersList.map((p) => (
                                                                    <div key={p.socketId} className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-colors ${p.isAlive ? 'bg-dark-bg border-slate-700 hover:border-slate-600' : 'bg-red-950/20 border-red-900/30 opacity-60'}`}>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className={`font-bold truncate flex items-center gap-1.5 ${p.isAlive ? 'text-white' : 'text-slate-400 line-through'}`}>
                                                                                {!p.isAlive && <Skull size={11} className="text-red-400 shrink-0" />}
                                                                                {p.socketId === r.host && <Crown size={11} className="text-amber-400 shrink-0" />}
                                                                                {p.name}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                                                                                <span>{p.role || 'Rol yok'}</span>
                                                                                <span className={`flex items-center gap-0.5 ${pingColor(p.ping?.ms)}`}>
                                                                                    <Zap size={9} />{p.ping?.ms != null ? `${p.ping.ms}ms` : '—'}
                                                                                </span>
                                                                                {!p.connected && <span className="text-red-400">offline</span>}
                                                                            </div>
                                                                        </div>
                                                                        <button onClick={() => handleKickPlayer(r.id, p.socketId, p.name)} className="shrink-0 flex items-center gap-1 text-[9px] px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-300 rounded uppercase tracking-widest font-bold transition-colors">
                                                                            <UserMinus size={10} /> At
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Section>

                {/* ─── HISTORY ────────────────────────────────── */}
                <Section
                    title={`Oyun Geçmişi (${filteredHistory.length})`}
                    icon={<Clock size={14} />}
                    extra={
                        <SearchBox value={historyFilter} onChange={setHistoryFilter} placeholder="Oda, kazanan veya oyuncu ara..." />
                    }
                >
                    <div className="bg-dark-bg rounded-xl border border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-black/40 border-b border-slate-800">
                                    <tr>
                                        <Th>Tarih</Th>
                                        <Th>Oda</Th>
                                        <Th className="hidden sm:table-cell">Mod</Th>
                                        <Th>Kazanan</Th>
                                        <Th>Oyuncu</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredHistory.length === 0 ? (
                                        <tr><td colSpan="5" className="p-6 text-center text-slate-500 italic">{historyFilter ? 'Eşleşen oyun yok.' : 'Henüz oyun oynanmamış.'}</td></tr>
                                    ) : filteredHistory.map(h => {
                                        const realPlayersCount = h.players ? h.players.filter(p => !p.isBot).length : 0;
                                        return (
                                            <React.Fragment key={h.id}>
                                                <tr onClick={() => setExpandedHistoryId(expandedHistoryId === h.id ? null : h.id)} className="hover:bg-slate-900/40 transition-colors cursor-pointer">
                                                    <td className="p-3 text-slate-300 text-xs">
                                                        <span className="text-slate-500 mr-1">{expandedHistoryId === h.id ? '▼' : '▶'}</span>
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
                                                            <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2"><Users size={12} /> Maç Sonucu</h4>
                                                            {(!h.players || h.players.length === 0) ? (
                                                                <span className="italic text-slate-500 text-sm">Oyuncu verisi yok.</span>
                                                            ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {h.players.filter(p => !p.isBot).map((p, i) => (
                                                                        <div key={i} className={`p-2.5 rounded-lg border text-xs transition-colors ${p.won ? 'bg-emerald-950/30 border-emerald-800/50 hover:border-emerald-700' : 'bg-red-950/20 border-red-900/30 opacity-70'}`}>
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
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Section>

                <p className="text-center text-[9px] text-slate-700 uppercase tracking-[0.4em] py-6">Karanlık Konsey · v{__APP_VERSION__}</p>
            </div>
        </div>
    );
}

/* ─── Sub-components ────────────────────────────────────────── */

function Section({ title, icon, extra, children }) {
    return (
        <div className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <span className="text-blood-red">{icon}</span>{title}
                </h2>
                {extra}
            </div>
            {children}
        </div>
    );
}

function Th({ children, className = '' }) {
    return (
        <th className={`p-3 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.2em] ${className}`}>{children}</th>
    );
}

function SearchBox({ value, onChange, placeholder }) {
    return (
        <div className="relative w-full sm:w-72">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-black/40 border border-slate-800 rounded-full pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 focus:bg-black/60"
            />
        </div>
    );
}

const TONE_MAP = {
    emerald: { text: 'text-emerald-300', bar: 'bg-emerald-700/70', glow: 'shadow-[inset_0_0_14px_rgba(110,231,183,0.10)]' },
    amber: { text: 'text-amber-300', bar: 'bg-amber-700/70', glow: 'shadow-[inset_0_0_14px_rgba(251,191,36,0.12)]' },
    red: { text: 'text-red-300', bar: 'bg-red-700/70', glow: 'shadow-[inset_0_0_14px_rgba(248,113,113,0.15)]' },
    accent: { text: 'text-accent', bar: 'bg-accent/70', glow: 'shadow-[inset_0_0_14px_rgba(217,119,6,0.12)]' },
    slate: { text: 'text-slate-200', bar: 'bg-slate-600/70', glow: '' },
};

function StatTile({ icon, label, value, tone = 'slate', small = false }) {
    const t = TONE_MAP[tone] || TONE_MAP.slate;
    return (
        <div className={`bg-dark-bg p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors ${t.glow}`}>
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                <span className={t.text}>{icon}</span>{label}
            </div>
            <div className={`font-black ${t.text} ${small ? 'text-sm' : 'text-xl sm:text-2xl'} leading-tight tabular-nums`}>{value}</div>
        </div>
    );
}

function GaugeCard({ icon, label, value, percent, tone = 'emerald', sub, history }) {
    const t = TONE_MAP[tone] || TONE_MAP.slate;
    return (
        <div className={`bg-dark-bg p-4 rounded-xl border border-slate-800 ${t.glow}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
                    <span className={t.text}>{icon}</span>{label}
                </div>
                <span className={`font-black tabular-nums text-lg ${t.text}`}>{value}</span>
            </div>
            <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-slate-800">
                <div className={`h-full ${t.bar} transition-all duration-700`} style={{ width: `${percent}%` }}></div>
            </div>
            {history && history.length > 1 && <Sparkline data={history} tone={tone} />}
            {sub && <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-2">{sub}</p>}
        </div>
    );
}

function Sparkline({ data, tone = 'emerald' }) {
    const t = TONE_MAP[tone] || TONE_MAP.slate;
    const w = 220, h = 32;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = w / (data.length - 1);
    const path = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' L ');
    const stroke = t.text.replace('text-', '');
    const strokeColor = {
        'emerald-300': '#6ee7b7', 'amber-300': '#fcd34d', 'red-300': '#fca5a5', 'accent': '#d97706', 'slate-200': '#e2e8f0',
    }[stroke] || '#94a3b8';
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 mt-2 opacity-80" preserveAspectRatio="none">
            <path d={`M ${path}`} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function formatNum(n) {
    if (n < 1000) return n.toString();
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
    return `${(n / 1_000_000).toFixed(1)}M`;
}
