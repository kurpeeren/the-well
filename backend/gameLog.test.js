const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pushChat, pushEvent, CHAT_CAP } = require('./gameLog');

test('CHAT_CAP = 2000', () => {
  assert.equal(CHAT_CAP, 2000);
});

test('pushChat cap altında ekler', () => {
  const room = {};
  pushChat(room, { ch: 'day', sender: 'A', msg: 'x', day: 1, phase: 'DAY', ts: 1 });
  pushChat(room, { ch: 'dead', sender: 'B', msg: 'y', day: 1, phase: 'NIGHT', ts: 2 });
  assert.equal(room.chatLog.length, 2);
  assert.equal(room.chatLog[0].sender, 'A');
  assert.equal(room.chatLog[1].ch, 'dead');
});

test('pushChat cap aşımında en eskileri atar, uzunluk == CHAT_CAP', () => {
  const room = { chatLog: [] };
  for (let i = 0; i < CHAT_CAP + 50; i++) pushChat(room, { ch: 'day', sender: 's', msg: String(i), day: 1, phase: 'DAY', ts: i });
  assert.equal(room.chatLog.length, CHAT_CAP);
  assert.equal(room.chatLog[0].msg, '50');
  assert.equal(room.chatLog[CHAT_CAP - 1].msg, String(CHAT_CAP + 49));
});

test('pushEvent sınırsız ekler', () => {
  const room = {};
  for (let i = 0; i < 5000; i++) pushEvent(room, { type: 'phase', text: 't', day: 1, phase: 'DAY', ts: i });
  assert.equal(room.eventLog.length, 5000);
});

test('null/undefined room güvenli (çökmez)', () => {
  assert.doesNotThrow(() => pushChat(null, { msg: 'x' }));
  assert.doesNotThrow(() => pushEvent(undefined, { type: 'end' }));
});
