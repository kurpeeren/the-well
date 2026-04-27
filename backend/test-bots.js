const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';
const args = process.argv.slice(2);
const ROOM_CODE = args[0]; // Parametre olarak verilirse o odaya katılır
const BOT_COUNT = 6; // Kaç bot olacağı

const names = ['Efe', 'Selin', 'Burak', 'Cemre', 'Kaan', 'Derya', 'Oğuz', 'Gizem', 'Mert', 'Aslı'];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runBots() {
  const bots = [];

  if (ROOM_CODE) {
    console.log(`[*] ${ROOM_CODE} kodlu odana ${BOT_COUNT} bot ekleniyor... Lütfen bekle...`);
    for (let i = 0; i < BOT_COUNT; i++) {
        await sleep(300); // 300ms aralıkla yolluyoruz ki Socket yorulmasın
        const botName = names[i % names.length] + "_" + Math.floor(Math.random() * 100);
        const botSocket = io(SERVER_URL);
        bots.push(botSocket);

        botSocket.on('connect', () => {
            botSocket.emit('joinRoom', { playerName: botName, roomCode: ROOM_CODE });
        });
        botSocket.on('roomJoined', () => console.log(`  -> [+] ${botName} lobine geldi.`));
        botSocket.on('error', (err) => console.error(`  -> [-] Hata (${botName}): ${err}`));
    }
    console.log(`\n[!] Başarılı! Tüm botlar lobide. Kendi frontend ekranından (tarayıcıdan) 'Oyunu Başlat' butonuna basabilirsin!`);
  } else {
    // SADECE İZLEMEK VEYA OTOMATİK OYUN TEST EDİLMEK İSTENİYORSA
    console.log(`[*] Kendi kendine test senaryosu başlatılıyor. (1 Kurucu Bot + ${BOT_COUNT-1} Katılımcı Bot)`);
    const hostName = "HostBot_" + Math.floor(Math.random()*10);
    const hostSocket = io(SERVER_URL);
    
    hostSocket.on('connect', () => {
        hostSocket.emit('createRoom', hostName);
    });

    hostSocket.on('roomJoined', async (data) => {
        if (data.isHost) {
            const roomCode = data.roomCode;
            console.log(`\n[+] ODA OLUŞTURULDU: ${roomCode}`);
            console.log(`[!] Tarayıcından hemen http://localhost:5173 e girip bu koda (${roomCode}) bağlanabilirsin!`);
            console.log(`\n[*] Diğer ${BOT_COUNT-1} bot bağlanıyor...`);
            
            for (let i = 1; i < BOT_COUNT; i++) {
                await sleep(300);
                const botName = names[i % names.length] + "_" + Math.floor(Math.random() * 100);
                const botSocket = io(SERVER_URL);
                botSocket.emit('joinRoom', { playerName: botName, roomCode });
            }

            console.log(`\n[*] Bütün botlar odaya katıldı.`);
            console.log(`[*] 15 SANİYE SONRA OYUN HOST BOT TARAFINDAN OTOMATİK BAŞLATILACAK! (Bu arada frontend'den odaya sen de katılabilirsin)`);
            
            await sleep(15000);
            console.log(`\n[*] Oyun Başlatılıyor...`);
            hostSocket.emit('startGame', roomCode);
            
            hostSocket.on('gameStarted', () => console.log(`[!] ---> OYUN BAŞLADI <---`));
            hostSocket.on('phaseChanged', (p) => {
                console.log(`\n[GEÇİŞ] Evre: ${p.phase} (${p.timeRemaining}s)`);
                if(p.news) console.log(`[HABER] ${p.news}`);
            });
            hostSocket.on('morningNews', (n) => console.log(`[SABAH HABERİ] Kurban: ${n.killedPlayerName || 'Kimse'}`));
            hostSocket.on('voteResult', (n) => console.log(`[HÜKÜM] Kuyuya Atılan: ${n.lynchedPlayerName || 'Kimse'}`));
            hostSocket.on('gameOver', (g) => {
                console.log(`\n[!!!] OYUN BİTTİ !!! Kazanan: ${g.winner}`);
                process.exit(0);
            });
        }
    });
  }
}

console.log('============================================');
console.log('        KUYU BOT TEST ARACI AKTİF           ');
console.log('============================================');
runBots();
