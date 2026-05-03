import React, { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function Admin({ onExit }) {
    const [token, setToken] = useState(localStorage.getItem('kuyu_admin_token') || '');
    const [password, setPassword] = useState('');
    const [stats, setStats] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (token) {
            fetchStats(token);
            const interval = setInterval(() => fetchStats(token), 3000);
            return () => clearInterval(interval);
        }
    }, [token]);

    const fetchStats = async (authToken) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/admin/stats`, {
                headers: { 'Authorization': authToken }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
                setError('');
                if (authToken !== token) {
                    setToken(authToken);
                    localStorage.setItem('kuyu_admin_token', authToken);
                }
            } else {
                if (stats) setStats(null); // Clear old stats on auth fail
                setError('Hatalı şifre veya oturum düştü.');
                localStorage.removeItem('kuyu_admin_token');
                setToken('');
            }
        } catch (err) {
            console.error(err);
            setError('Sunucuya bağlanılamadı.');
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        fetchStats(password);
    };

    const handleLogout = () => {
        setToken('');
        setStats(null);
        localStorage.removeItem('kuyu_admin_token');
    };

    if (!token || !stats) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
                <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 relative">
                    <button onClick={onExit} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
                    <h1 className="text-2xl font-bold mb-6 text-center text-red-500 tracking-widest">KUYU YÖNETİM</h1>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2 text-slate-300">Admin Şifresi</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-red-500" 
                                placeholder="Şifrenizi girin..." 
                            />
                        </div>
                        <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors">GİRİŞ YAP</button>
                    </form>
                    {error && <p className="text-red-400 mt-4 text-center text-sm">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                    <h1 className="text-3xl font-bold text-red-500 tracking-widest flex items-center gap-4">
                        <button onClick={onExit} className="text-slate-500 hover:text-white transition-colors" title="Oyuna Dön">←</button>
                        KUYU YÖNETİM PANELİ
                    </h1>
                    <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">Çıkış Yap</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Toplam Aktif Oyuncu</h3>
                        <p className="text-4xl font-bold text-white">{stats.totalRealPlayers}</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Aktif Odalar</h3>
                        <p className="text-4xl font-bold text-green-400">{stats.totalRooms}</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Toplam Soket Bağlantısı</h3>
                        <p className="text-4xl font-bold text-yellow-500">{stats.totalSockets}</p>
                    </div>
                </div>

                <h2 className="text-xl font-bold mb-4 text-slate-300">Aktif Oyun Odaları</h2>
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900 border-b border-slate-700">
                                <tr>
                                    <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Oda Kodu</th>
                                    <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Durum</th>
                                    <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Oyuncu (Aktif/Bot)</th>
                                    <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Oyuncular</th>
                                    <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Gün</th>
                                    <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Açılış</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {stats.rooms.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-6 text-center text-slate-500 italic">Şu an aktif bir oda bulunmuyor.</td>
                                    </tr>
                                ) : (
                                    stats.rooms.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 font-mono font-bold tracking-widest flex items-center">
                                                {r.id} 
                                                {r.isDevMode && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded ml-2">DEV</span>}
                                            </td>
                                            <td className={`p-4 font-bold ${r.status === 'LOBBY' ? 'text-blue-400' : 'text-red-400'}`}>
                                                {r.status}
                                            </td>
                                            <td className="p-4">
                                                <span className="text-white font-bold">{r.realPlayers}</span> / <span className="text-slate-500">{r.botPlayers} bot</span>
                                                {r.spectators > 0 && <span className="block text-xs text-slate-500">{r.spectators} İzleyici</span>}
                                            </td>
                                            <td className="p-4 text-xs text-slate-400 max-w-xs">
                                                {r.playersList && r.playersList.map((p, i) => (
                                                    <span key={i} className={`inline-block mr-1 mb-1 px-1 rounded ${p.isAlive ? 'bg-slate-800' : 'bg-red-900/30 line-through'}`}>
                                                        {p.name} {p.role ? `(${p.role})` : ''}
                                                    </span>
                                                ))}
                                                {(!r.playersList || r.playersList.length === 0) && <span className="italic">Sadece Botlar</span>}
                                            </td>
                                            <td className="p-4 font-bold text-yellow-500">{r.dayCount}</td>
                                            <td className="p-4 text-xs text-slate-400">
                                                {r.createdAt ? new Date(r.createdAt).toLocaleTimeString('tr-TR') : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
