const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nominationThreshold, weightFor, tallyNomination, findNominee, evaluateVerdict } = require('./voteLogic');

test('nominationThreshold = floor(alive/2)', () => {
  assert.equal(nominationThreshold(8), 4);
  assert.equal(nominationThreshold(7), 3);
  assert.equal(nominationThreshold(6), 3);
  assert.equal(nominationThreshold(5), 2);
  assert.equal(nominationThreshold(4), 2);
});

test('weightFor: açık Muhtar 3, diğerleri 1', () => {
  assert.equal(weightFor({ isMayorRevealed: true }), 3);
  assert.equal(weightFor({ isMayorRevealed: false }), 1);
  assert.equal(weightFor({}), 1);
  assert.equal(weightFor(null), 1);
  assert.equal(weightFor(undefined), 1);
});

test('tallyNomination ağırlıkları toplar, SKIP/null hariç', () => {
  const votes = {
    a: { targetId: 'X', weight: 1 },
    b: { targetId: 'X', weight: 3 },
    c: { targetId: 'Y', weight: 1 },
    d: { targetId: 'SKIP', weight: 1 },
    e: { targetId: null, weight: 1 },
  };
  assert.deepEqual(tallyNomination(votes), { X: 4, Y: 1 });
});

test('findNominee: ağırlıklı oy eşiği KESİN aşınca aday döner', () => {
  const votes7 = { a:{targetId:'X',weight:3}, b:{targetId:'X',weight:1} };
  assert.equal(findNominee(votes7, 7), 'X');
});

test('findNominee: eşiğe eşit yeterli değil (kesin büyük)', () => {
  const votes = { a:{targetId:'X',weight:3} };
  assert.equal(findNominee(votes, 7), null);
});

test('findNominee: Muhtar(3) tek başına 4 kişide yeter (eşik 2)', () => {
  const votes = { m:{targetId:'X',weight:3} };
  assert.equal(findNominee(votes, 4), 'X');
});

test('findNominee: kimse aşmazsa null', () => {
  const votes = { a:{targetId:'X',weight:1}, b:{targetId:'Y',weight:1} };
  assert.equal(findNominee(votes, 7), null);
});

test('evaluateVerdict: guiltyW > spareW → HANG', () => {
  const jv = { a:{verdict:'GUILTY',weight:3}, b:{verdict:'SPARE',weight:1}, c:{verdict:'SPARE',weight:1} };
  assert.equal(evaluateVerdict(jv), 'HANG');
});

test('evaluateVerdict: eşitlik → SPARE', () => {
  const jv = { a:{verdict:'GUILTY',weight:2}, b:{verdict:'SPARE',weight:2} };
  assert.equal(evaluateVerdict(jv), 'SPARE');
});

test('evaluateVerdict: oy yok → SPARE', () => {
  assert.equal(evaluateVerdict({}), 'SPARE');
});
