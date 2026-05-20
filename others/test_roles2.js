const { ROLES } = require('./backend/roles');

let room = {
    isDevMode: false,
    players: new Array(15).fill(0).map((_, i) => ({ socketId: i, role: '' })),
    settings: {
        kirmizi: 4, gri: 2, yesil: 9,
        roles: {
            'Şifacı': false,
            'Bekçi': false,
            'Avcı': false,
            'Muhtar': true
        }
    }
};

let enabledRoles = room.settings?.roles || {};
Object.keys(ROLES).forEach(r => {
    if (enabledRoles[r] === undefined) {
        enabledRoles[r] = true;
    }
});

const count = room.players.length;

const poolEvil = Object.keys(enabledRoles).filter(r => enabledRoles[r] && (ROLES[r]?.team === 'Eşkıyalar' || r === 'Kundakçı'));
const poolNeutral = Object.keys(enabledRoles).filter(r => enabledRoles[r] && ROLES[r]?.team === 'Bireysel' && r !== 'Kundakçı' && r !== 'Seri Katil');
const poolTown = Object.keys(enabledRoles).filter(r => enabledRoles[r] && ROLES[r]?.team === 'Köylüler');

if (poolEvil.length === 0) poolEvil.push('Eşkıya');
if (poolNeutral.length === 0) poolNeutral.push('Köy Delisi');
if (poolTown.length === 0) poolTown.push('Muhtar');

let { kirmizi, gri, yesil } = room.settings;
kirmizi = kirmizi ?? 4;
gri = gri ?? 2;
yesil = yesil ?? 9;

let activeRoles = [];

// 1. Kırmızı Takım (Kötüler)
for (let i = 0; i < kirmizi && activeRoles.length < count; i++) {
    if (i === 0 && enabledRoles['Eşkıya Başı']) activeRoles.push('Eşkıya Başı');
    else if (i === 1 && enabledRoles['Seri Katil']) activeRoles.push('Seri Katil');
    else activeRoles.push(poolEvil[Math.floor(Math.random() * poolEvil.length)]);
}

// 2. Gri Takım (Tarafsızlar)
for (let i = 0; i < gri && activeRoles.length < count; i++) {
    activeRoles.push(poolNeutral[Math.floor(Math.random() * poolNeutral.length)]);
}

// 3. Yeşil Takım (Masumlar)
for (let i = 0; i < yesil && activeRoles.length < count; i++) {
    activeRoles.push(poolTown[Math.floor(Math.random() * poolTown.length)]);
}

while (activeRoles.length < count) {
    activeRoles.push(poolTown[Math.floor(Math.random() * poolTown.length)]);
}

if (activeRoles.length > count) {
    activeRoles = activeRoles.slice(0, count);
}

room.players.forEach((player, i) => {
    player.role = activeRoles[i];
});

console.log('Normal mode players:', room.players.map(p => p.role).reduce((acc, r) => {
    acc[r] = (acc[r] || 0) + 1;
    return acc;
}, {}));
