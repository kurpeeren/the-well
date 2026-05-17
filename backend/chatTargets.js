// Kapsamlı (çete/ölü) sohbet için TEKİL alıcı socketId listesi. Saf, izole.
//
// Neden Set: dev modda players[0] gerçek host'tur (socketId === room.host).
// Host'un kendi koltuğu predicate'i sağladığında döngü zaten room.host'a
// gönderir; ayrıca dev modda host bot trafiğini de izlesin diye room.host
// eklenir. İkisi çakışınca eskiden mesaj ÇİFT gidiyordu — Set tekilleştirir.
function chatRecipients(room, predicate) {
  if (!room || !Array.isArray(room.players)) return [];
  const ids = new Set();
  for (const p of room.players) {
    if (p && predicate(p)) ids.add(p.socketId);
  }
  if (room.isDevMode && room.host) ids.add(room.host);
  return [...ids];
}

module.exports = { chatRecipients };
