// Saf oy karar mantığı. Socket/IO/state yok — birim testlenebilir.

function nominationThreshold(aliveCount) {
  return Math.floor(aliveCount / 2);
}

function weightFor(player) {
  return player && player.isMayorRevealed ? 3 : 1;
}

// votes: { [voterId]: { targetId, weight } }  →  { [targetId]: toplamAğırlık }
function tallyNomination(votes) {
  const counts = {};
  for (const v in votes) {
    const t = votes[v].targetId;
    if (!t || t === 'SKIP') continue;
    counts[t] = (counts[t] || 0) + (votes[v].weight || 0);
  }
  return counts;
}

// Eşiği KESİN aşan ilk hedefi döndürür, yoksa null.
function findNominee(votes, aliveCount) {
  const threshold = nominationThreshold(aliveCount);
  const counts = tallyNomination(votes);
  for (const targetId in counts) {
    if (counts[targetId] > threshold) return targetId;
  }
  return null;
}

// judgmentVotes: { [voterId]: { verdict: 'GUILTY'|'SPARE', weight } }
function evaluateVerdict(judgmentVotes) {
  let guiltyW = 0, spareW = 0;
  for (const v in judgmentVotes) {
    const jv = judgmentVotes[v];
    if (jv.verdict === 'GUILTY') guiltyW += (jv.weight || 0);
    else if (jv.verdict === 'SPARE') spareW += (jv.weight || 0);
  }
  return guiltyW > spareW ? 'HANG' : 'SPARE';
}

module.exports = { nominationThreshold, weightFor, tallyNomination, findNominee, evaluateVerdict };
