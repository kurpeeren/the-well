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
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [roomFilter, setRoomFilter] = useState('');
    const [historyFilter, setHistoryFilter] = useState('');
    const [lastTick, setLastTick] = useState(0);
    const [metricsRange, setMetricsRange] = useState('hour'); // 'hour' | 'day' | 'week'
    const [metricsData, setMetricsData] = useState(null);
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

    // Tarihsel metrikleri — range değişince yeniden çek
    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        const fetchMetrics = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/metrics?range=${metricsRange}`, {
                    headers: { 'Authorization': token },
                });
                if (cancelled) return;
                if (res.ok) setMetricsData(await res.json());
            } catch { /* sessiz */ }
        };
        fetchMetrics();
        // Saat görünümünde 30s'de bir tazele, gün/hafta için 5dk'da bir
        const refreshMs = metricsRange === 'hour' ? 30000 : 300000;
        const interval = setInterval(fetchMetrics, refreshMs);
        return () => { cancelled = true; clearInterval(interval); };
    }, [token, metricsRange]);

    // index.css mobilde body/#root overflow:hidden + height:100vh kuruyor —
    // admin sayfasında scroll'a izin vermek için bunları geçici olarak ezeriz.
    // NOT: html overflow'u değiştirmiyoruz; body→viewport overflow propagation'ı
    // kırmaması için visible kalsın.
    useEffect(() => {
        const root = document.getElementById('root');
        const prev = {
            bodyOverflow: document.body.style.overflow,
            bodyHeight: document.body.style.height,
            rootHeight: root?.style.height || '',
            rootMinHeight: root?.style.minHeight || '',
            rootOverflow: root?.style.overflow || '',
        };
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
        if (root) {
            root.style.height = 'auto';
            root.style.minHeight = '100vh';
            root.style.overflow = 'visible';
        }
        return () => {
            document.body.style.overflow = prev.bodyOverflow;
            document.body.style.height = prev.bodyHeight;
            if (root) {
                root.style.height = prev.rootHeight;
                root.style.minHeight = prev.rootMinHeight;
                root.style.overflow = prev.rootOverflow;
            }
        };
    }, []);

    const showToastMsg = (m, ms = 2800) => {
        setToast(m);
        setTimeout(() => setToast(null), ms);
    };

    const askConfirm = (config, onYes) => {
        setConfirmDialog({
            ...config,
            onConfirm: () => {
                setConfirmDialog(null);
                onYes();
            },
        });
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

    const handleCloseRoom = (code) => {
        askConfirm({
            title: 'Oda Kapatılsın mı?',
            message: `${code} odasındaki tüm oyuncular atılacak.\nBu işlem geri alınamaz.`,
            danger: true,
            confirmLabel: 'Kapat',
        }, async () => {
            const res = await adminFetch(`/api/admin/rooms/${code}/close`, { method: 'POST' });
            if (res.ok) { showToastMsg(`${code} odası kapatıldı`); fetchAll(token); }
            else showToastMsg('Kapatma başarısız');
        });
    };

    const handleKickPlayer = (code, socketId, name) => {
        askConfirm({
            title: 'Oyuncu Atılsın mı?',
            message: `${name} adlı oyuncuyu ${code} odasından atmak üzeresin.`,
            danger: true,
            confirmLabel: 'At',
        }, async () => {
            const res = await adminFetch(`/api/admin/rooms/${code}/kick`, {
                method: 'POST',
                body: JSON.stringify({ socketId }),
            });
            if (res.ok) { showToastMsg(`${name} atıldı`); fetchAll(token); }
            else showToastMsg('Atma başarısız');
        });
    };

    const handleBroadcast = (e) => {
        e.preventDefault();
        if (!broadcastMsg.trim() || broadcastMsg.length > 280) return;
        const msg = broadcastMsg.trim();
        askConfirm({
            title: 'Duyuru Gönderilsin mi?',
            message: `Tüm ${health?.totalSockets || 0} bağlı kullanıcı bu mesajı görecek:\n\n"${msg}"`,
            danger: false,
            confirmLabel: 'Gönder',
        }, async () => {
            const res = await adminFetch('/api/admin/broadcast', {
                method: 'POST',
                body: JSON.stringify({ message: msg }),
            });
            if (res.ok) {
                const j = await res.json();
                showToastMsg(`Duyuru ${j.deliveredTo} kullanıcıya gönderildi`);
                setBroadcastMsg('');
            } else showToastMsg('Duyuru başarısız');
        });
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
                            <h1
                                className="text-3xl font-bold tracking-[0.22em] font-serif uppercase leading-tight whitespace-nowrap"
                                style={{
                                    backgroundImage: 'linear-gradient(110deg, #7f1d1d 0%, #b91c1c 25%, #fca5a5 50%, #b91c1c 75%, #7f1d1d 100%)',
                                    backgroundSize: '300% 100%',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    animation: 'bloodShimmer 8s linear infinite, bloodGlow 4s ease-in-out infinite, councilReveal 1.3s cubic-bezier(0.2,0.9,0.3,1.15) backwards',
                                }}
                            >
                                KONSEY
                            </h1>
                            <div
                                className="h-px w-28 bg-gradient-to-r from-transparent via-blood-red to-transparent my-2 origin-center"
                                style={{ animation: 'titleUnderlineGrow 1.4s cubic-bezier(0.4,0,0.2,1) 0.2s backwards, titleUnderlinePulse 3.4s ease-in-out infinite 1.6s' }}
                            ></div>
                            <p className="text-slate-500 text-[10px] uppercase tracking-[0.32em] italic">Sadece Yetkili Geçer</p>
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
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-none">
                    <div className="bg-dark-bg/95 backdrop-blur-md border border-blood-red/40 px-5 py-3 rounded-xl shadow-[0_0_30px_rgba(127,29,29,0.5)] flex items-center gap-3 max-w-md relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-blood-red to-transparent"></div>
                        <span className="w-2 h-2 rounded-full bg-blood-red shrink-0 shadow-[0_0_8px_rgba(127,29,29,0.8)] animate-pulse"></span>
                        <p className="text-slate-100 text-sm font-medium tracking-wide leading-snug font-serif">{toast}</p>
                    </div>
                </div>
            )}

            {confirmDialog && (
                <ConfirmDialog
                    {...confirmDialog}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}

            <div className="max-w-6xl mx-auto">
                {/* ─── HEADER ─────────────────────────────────── */}
                <header className="flex flex-wrap justify-between items-center mb-6 sm:mb-8 pb-4 border-b border-slate-800 gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <button onClick={onExit} className="shrink-0 p-2 rounded-full hover:bg-slate-900 text-slate-500 hover:text-white transition-colors" title="Oyuna Dön">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="min-w-0">
                            <h1
                                className="text-xl sm:text-3xl font-bold tracking-[0.15em] sm:tracking-[0.2em] font-serif leading-tight uppercase whitespace-nowrap"
                                style={{
                                    backgroundImage: 'linear-gradient(110deg, #7f1d1d 0%, #b91c1c 25%, #fca5a5 50%, #b91c1c 75%, #7f1d1d 100%)',
                                    backgroundSize: '300% 100%',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    animation: 'bloodShimmer 8s linear infinite, bloodGlow 4s ease-in-out infinite, titleFlicker 9s ease-in-out infinite, councilReveal 1.3s cubic-bezier(0.2,0.9,0.3,1.15) backwards',
                                }}
                            >
                                KARANLIK KONSEY
                            </h1>
                            <div
                                className="h-px w-full mt-1 bg-gradient-to-r from-transparent via-blood-red to-transparent origin-center"
                                style={{ animation: 'titleUnderlineGrow 1.5s cubic-bezier(0.4,0,0.2,1) 0.25s backwards, titleUnderlinePulse 3.4s ease-in-out infinite 1.75s' }}
                            ></div>
                            <p className="text-[9px] sm:text-[10px] text-slate-600 uppercase tracking-[0.3em] italic mt-1.5 animate-in fade-in duration-1000 delay-300">Kuyu Komuta Kulesi</p>
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

                {/* ─── HISTORICAL METRICS ───────────────────────── */}
                <Section
                    title="Tarihsel Metrikler"
                    icon={<Clock size={14} />}
                    extra={
                        <div className="flex gap-1 bg-black/40 border border-slate-800 rounded-full p-0.5">
                            {[
                                { id: 'hour', label: 'Saat' },
                                { id: 'day', label: 'Gün' },
                                { id: 'week', label: 'Hafta' },
                            ].map(r => (
                                <button key={r.id} onClick={() => setMetricsRange(r.id)}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors ${metricsRange === r.id ? 'bg-blood-red text-white' : 'text-slate-400 hover:text-white'}`}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    }
                >
                    {metricsData && metricsData.samples.length > 1 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <BigChart label="CPU %" samples={metricsData.samples} field="cpu" color="#fca5a5" suffix="%" range={metricsRange} maxHint={100} />
                            <BigChart label="Bellek (Heap MB)" samples={metricsData.samples} field="heapMB" color="#fcd34d" suffix=" MB" range={metricsRange} />
                            <BigChart label="Soket Bağlantısı" samples={metricsData.samples} field="sockets" color="#6ee7b7" range={metricsRange} />
                            <BigChart label="Aktif Oda" samples={metricsData.samples} field="rooms" color="#d97706" range={metricsRange} />
                            <BigChart label="Ortalama Ping" samples={metricsData.samples} field="avgPing" color="#93c5fd" suffix=" ms" range={metricsRange} />
                            <BigChart label="Bellek (RSS MB)" samples={metricsData.samples} field="rssMB" color="#cbd5e1" suffix=" MB" range={metricsRange} />
                        </div>
                    ) : (
                        <div className="bg-dark-bg border border-slate-800 rounded-xl p-6 text-center text-slate-500 italic text-sm">
                            {metricsData?.samples?.length === 0 ? `Bu aralıkta henüz veri yok. ${metricsRange === 'week' ? 'Bir hafta veri toplandıkça doluyor.' : 'Birkaç dakika bekleyin.'}` : 'Veri yükleniyor...'}
                        </div>
                    )}
                </Section>

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
                                                    <td className={`p-3 font-bold text-xs ${teamColors(teamOf(h.winner)).text}`}>{h.winner || '-'}</td>
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
                                                                    {h.players.filter(p => !p.isBot).map((p, i) => {
                                                                        const tc = teamColors(teamOf(p.role));
                                                                        return (
                                                                            <div key={i} className={`p-2.5 rounded-lg border text-xs transition-colors ${tc.bg} ${tc.border} ${tc.hover} ${p.won ? '' : 'opacity-70'}`}>
                                                                                <div className="font-bold text-white flex justify-between items-center gap-2">
                                                                                    <span className={p.won ? '' : 'line-through'}>{p.name}</span>
                                                                                    {p.won && <span className={`shrink-0 text-[9px] uppercase tracking-widest font-black ${tc.text}`}>Kazandı</span>}
                                                                                </div>
                                                                                <div className={`text-[10px] mt-0.5 ${tc.text} opacity-80`}>{p.role || 'Bilinmiyor'}</div>
                                                                            </div>
                                                                        );
                                                                    })}
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

                <p className="text-center text-[9px] text-slate-700 font-mono tracking-[0.2em] opacity-60 py-6 select-all">Karanlık Konsey · {__APP_COMMIT__} · {__APP_BUILD_DATE__}</p>
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

function ConfirmDialog({ title, message, danger, confirmLabel, onConfirm, onCancel }) {
    const accentBorder = danger ? 'border-red-900/60' : 'border-amber-800/60';
    const accentText = danger ? 'text-red-300' : 'text-amber-300';
    const accentBg = danger ? 'bg-red-950/30' : 'bg-amber-950/25';
    const confirmBtn = danger
        ? 'bg-blood-red hover:bg-red-800 active:bg-red-900 shadow-[0_0_18px_rgba(127,29,29,0.5)]'
        : 'bg-accent hover:bg-amber-700 active:bg-amber-800 shadow-[0_0_18px_rgba(217,119,6,0.4)]';

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onCancel}
        >
            <div
                className={`w-full max-w-sm bg-dark-bg border ${accentBorder} rounded-2xl shadow-[0_0_60px_rgba(127,29,29,0.35)] overflow-hidden animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`px-5 py-3 border-b ${accentBorder} ${accentBg} flex items-center gap-2`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${danger ? 'bg-blood-red' : 'bg-accent'} animate-pulse`}></span>
                    <h3 className={`text-[11px] font-black uppercase tracking-[0.3em] font-serif ${accentText}`}>{title}</h3>
                </div>
                <div className="px-5 py-4 text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                    {message}
                </div>
                <div className="grid grid-cols-2 border-t border-slate-800 divide-x divide-slate-800">
                    <button
                        onClick={onCancel}
                        className="py-3 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors text-xs uppercase tracking-[0.3em] font-bold"
                    >
                        Vazgeç
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`py-3 text-white ${confirmBtn} transition-colors text-xs uppercase tracking-[0.3em] font-black`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

const ROLE_TEAM = {
    'Şifacı': 'Masumlar', 'Bekçi': 'Masumlar', 'Avcı': 'Masumlar', 'Muhtar': 'Masumlar',
    'Gözcü': 'Masumlar', 'Falcı': 'Masumlar', 'Gassal': 'Masumlar', 'Eskort': 'Masumlar',
    'Eşkıya Başı': 'Eşkıyalar', 'Münafık': 'Eşkıyalar', 'Eşkıya': 'Eşkıyalar', 'Tefeci': 'Eşkıyalar', 'Meyhaneci': 'Eşkıyalar',
    'Köy Delisi': 'Tarafsızlar', 'Seri Katil': 'Tarafsızlar', 'Kan Davalı': 'Tarafsızlar', 'Kundakçı': 'Tarafsızlar', 'Kaçak': 'Tarafsızlar',
};

function teamOf(label) {
    if (!label) return 'Tarafsızlar';
    if (label === 'Masumlar' || label === 'Köylüler') return 'Masumlar';
    if (label === 'Eşkıyalar') return 'Eşkıyalar';
    if (label === 'Beraberlik') return 'Beraberlik';
    if (ROLE_TEAM[label]) return ROLE_TEAM[label];
    return 'Tarafsızlar';
}

function teamColors(team) {
    switch (team) {
        case 'Masumlar':   return { text: 'text-emerald-300', bg: 'bg-emerald-950/30', border: 'border-emerald-800/50', hover: 'hover:border-emerald-700' };
        case 'Eşkıyalar':  return { text: 'text-red-300', bg: 'bg-red-950/30', border: 'border-red-900/50', hover: 'hover:border-red-700' };
        case 'Beraberlik': return { text: 'text-amber-300', bg: 'bg-amber-950/30', border: 'border-amber-800/50', hover: 'hover:border-amber-700' };
        default:           return { text: 'text-slate-400', bg: 'bg-slate-900/40', border: 'border-slate-700/50', hover: 'hover:border-slate-600' };
    }
}

function BigChart({ label, samples, field, color = '#cbd5e1', suffix = '', range, maxHint }) {
    const values = samples.map(s => s[field]).filter(v => v != null);
    const W = 320, H = 90, P = 8;
    if (values.length < 2) {
        return (
            <div className="bg-dark-bg p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</div>
                <div className="h-[90px] flex items-center justify-center text-xs text-slate-600 italic">Yetersiz veri</div>
            </div>
        );
    }
    const min = Math.min(...values);
    const max = Math.max(maxHint || -Infinity, ...values);
    const range01 = max - min || 1;
    const stepX = (W - P * 2) / (samples.length - 1);
    const points = samples.map((s, i) => {
        const v = s[field];
        if (v == null) return null;
        const x = P + i * stepX;
        const y = P + (H - P * 2) * (1 - (v - min) / range01);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(Boolean);
    const path = `M ${points.join(' L ')}`;
    const areaPath = `${path} L ${(P + (samples.length - 1) * stepX).toFixed(1)},${H - P} L ${P},${H - P} Z`;

    const latest = values[values.length - 1];
    const first = values[0];
    const delta = latest - first;
    const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    const deltaColor = Math.abs(delta) < 0.1 ? 'text-slate-500' : delta > 0 ? 'text-red-300' : 'text-emerald-300';

    const rangeLabel = { hour: '1 saat', day: '24 saat', week: '7 gün' }[range] || range;

    return (
        <div className="bg-dark-bg p-3 sm:p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
                <div className="text-right">
                    <div className="text-lg font-black tabular-nums" style={{ color }}>{latest != null ? `${latest}${suffix}` : '—'}</div>
                    <div className={`text-[9px] tabular-nums ${deltaColor}`}>{deltaStr}{suffix} ({rangeLabel})</div>
                </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px]" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`grad-${field}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#grad-${field})`} />
                <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex justify-between text-[9px] text-slate-600 mt-1 tabular-nums">
                <span>min {min}{suffix}</span>
                <span>maks {max}{suffix}</span>
            </div>
        </div>
    );
}
