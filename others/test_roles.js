const { ROLES } = require('./backend/roles');

let room = {
    isDevMode: true,
    players: new Array(16).fill(0).map((_, i) => ({ socketId: i, role: '' })),
    settings: {
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
console.log('Enabled roles:', enabledRoles);

const count = room.players.length;

if (room.isDevMode) {
    let pool = Object.keys(enabledRoles).filter(r => enabledRoles[r]);
    if (pool.length === 0) pool = Object.keys(ROLES);

    let finalPool = [];
    while(finalPool.length < count) {
        let p = [...pool];
        p.sort(() => Math.random() - 0.5);
        for(let r of p) {
            if(finalPool.length < count) finalPool.push(r);
        }
    }
    
    for (let i = finalPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalPool[i], finalPool[j]] = [finalPool[j], finalPool[i]];
    }
    
    room.players.forEach((player, i) => {
        player.role = finalPool[i];
    });

    console.log('Dev mode players:', room.players.map(p => p.role).reduce((acc, r) => {
        acc[r] = (acc[r] || 0) + 1;
        return acc;
    }, {}));
}
