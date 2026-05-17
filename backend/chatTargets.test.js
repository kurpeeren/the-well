const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chatRecipients } = require('./chatTargets');

const ESKIYA = p => p.role === 'Eşkıya' || p.role === 'Münafık';
const DEAD = p => !p.isAlive || p.role === 'Gassal';

test('dev modda host kendi koltuğu çete ise tek kez listelenir (çift değil)', () => {
  // Bug senaryosu: player[0] = host (socketId === room.host) ve Eşkıya.
  const room = {
    isDevMode: true,
    host: 'HOST',
    players: [
      { socketId: 'HOST', role: 'Eşkıya', isAlive: true },
      { socketId: 'dev_1', role: 'Münafık', isAlive: true },
      { socketId: 'dev_2', role: 'Şifacı', isAlive: true },
    ],
  };
  const r = chatRecipients(room, ESKIYA);
  assert.deepEqual([...r].sort(), ['HOST', 'dev_1']);
  assert.equal(r.filter(x => x === 'HOST').length, 1, 'HOST yalnız bir kez olmalı');
});

test('dev modda host koltuğu çete DEĞİLSE host yine de izler (tek kopya)', () => {
  const room = {
    isDevMode: true,
    host: 'HOST',
    players: [
      { socketId: 'HOST', role: 'Şifacı', isAlive: true },
      { socketId: 'dev_1', role: 'Eşkıya', isAlive: true },
    ],
  };
  const r = chatRecipients(room, ESKIYA);
  assert.deepEqual([...r].sort(), ['HOST', 'dev_1']);
  assert.equal(r.filter(x => x === 'HOST').length, 1);
});

test('normal mod: yalnız uyan oyuncular, host eklenmez', () => {
  const room = {
    isDevMode: false,
    host: 'A',
    players: [
      { socketId: 'A', role: 'Eşkıya', isAlive: true },
      { socketId: 'B', role: 'Münafık', isAlive: true },
      { socketId: 'C', role: 'Avcı', isAlive: true },
    ],
  };
  const r = chatRecipients(room, ESKIYA);
  assert.deepEqual([...r].sort(), ['A', 'B']);
});

test('ölü sohbeti predicate: ölüler + Gassal, dev host dedupe', () => {
  const room = {
    isDevMode: true,
    host: 'HOST',
    players: [
      { socketId: 'HOST', role: 'Avcı', isAlive: false }, // host ölü
      { socketId: 'dev_1', role: 'Gassal', isAlive: true },
      { socketId: 'dev_2', role: 'Avcı', isAlive: true },
    ],
  };
  const r = chatRecipients(room, DEAD);
  assert.deepEqual([...r].sort(), ['HOST', 'dev_1']);
  assert.equal(r.filter(x => x === 'HOST').length, 1);
});

test('aynı socketId iki oyuncuda olsa bile tekilleşir', () => {
  const room = {
    isDevMode: false,
    host: 'X',
    players: [
      { socketId: 'DUP', role: 'Eşkıya', isAlive: true },
      { socketId: 'DUP', role: 'Münafık', isAlive: true },
    ],
  };
  assert.deepEqual(chatRecipients(room, ESKIYA), ['DUP']);
});

test('null/bozuk room güvenli → []', () => {
  assert.deepEqual(chatRecipients(null, ESKIYA), []);
  assert.deepEqual(chatRecipients({}, ESKIYA), []);
  assert.deepEqual(chatRecipients({ players: null }, ESKIYA), []);
});
