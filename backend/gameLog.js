// Oyun içi sohbet/olay biriktirme. Saf, izole — birim testlenebilir.

const CHAT_CAP = 2000;

function pushChat(room, entry) {
  if (!room) return;
  if (!room.chatLog) room.chatLog = [];
  room.chatLog.push(entry);
  const over = room.chatLog.length - CHAT_CAP;
  if (over > 0) room.chatLog.splice(0, over);
}

function pushEvent(room, entry) {
  if (!room) return;
  if (!room.eventLog) room.eventLog = [];
  room.eventLog.push(entry);
}

module.exports = { pushChat, pushEvent, CHAT_CAP };
