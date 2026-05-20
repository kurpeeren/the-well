const ROLES = {
  // Masumlar
  'Şifacı': { align: 'Masum', team: 'Köylüler', limit: 2 },
  'Bekçi': { align: 'Masum', team: 'Köylüler' },
  'Avcı': { align: 'Masum', team: 'Köylüler', limit: 3 },
  'Muhtar': { align: 'Masum', team: 'Köylüler' }, 
  'Gözcü': { align: 'Masum', team: 'Köylüler' }, 
  'Falcı': { align: 'Masum', team: 'Köylüler' }, 
  'Gassal': { align: 'Masum', team: 'Köylüler' }, 
  'Eskort': { align: 'Masum', team: 'Köylüler' }, 
  // Eşkıyalar
  'Eşkıya Başı': { align: 'Eşkıya', team: 'Eşkıyalar', nightImmune: true },
  'Münafık': { align: 'Eşkıya', team: 'Eşkıyalar' }, 
  'Eşkıya': { align: 'Eşkıya', team: 'Eşkıyalar' },
  'Tefeci': { align: 'Eşkıya', team: 'Eşkıyalar' }, 
  'Meyhaneci': { align: 'Eşkıya', team: 'Eşkıyalar' }, 
  // Tarafsızlar
  'Garip': { align: 'Tarafsız', team: 'Bireysel' }, 
  'Seri Katil': { align: 'Tarafsız', team: 'Bireysel', nightImmune: true }, 
  'Kan Davalı': { align: 'Tarafsız', team: 'Bireysel', nightImmune: true }, 
  'Kundakçı': { align: 'Kötü', team: 'Bireysel', nightImmune: true }, 
  'Kaçak': { align: 'Tarafsız', team: 'Bireysel', limit: 4 }, 
};

function getInvestResults(role) {
   if (['Bekçi', 'Kan Davalı', 'Seri Katil'].includes(role)) return 'Bekçi, Kan Davalı veya Seri Katil';
   if (['Şifacı', 'Seri Katil', 'Falcı'].includes(role)) return 'Şifacı, Seri Katil veya Falcı';
   if (['Gözcü', 'Münafık', 'Garip'].includes(role)) return 'Gözcü, Münafık veya Garip';
   if (['Eşkıya Başı', 'Muhtar', 'Kaçak'].includes(role)) return 'Eşkıya Başı, Muhtar veya Kaçak';
   if (['Gassal', 'Tefeci', 'Kundakçı'].includes(role)) return 'Gassal, Tefeci veya Kundakçı';
   if (['Avcı', 'Eşkıya', 'Meyhaneci', 'Eskort'].includes(role)) return 'Avcı, Eşkıya, Meyhaneci veya Eskort';
   return 'Bu kişiyi okuyamadın (Şüphe uyandırıcı)'; 
}

function getColorAlignment(role) {
   if (!role) return 'Gri';
   const r = ROLES[role];
   if (!r) return 'Gri';
   if (r.team === 'Köylüler') return 'Yeşil';
   if (r.team === 'Eşkıyalar') return 'Kırmızı';
   return 'Gri';
}

// Falci kehaneti: 3 takimdan 1'er rol + bazen rastgele 4. rol.
// Hedefin gercek rolu her zaman icinde yer alir (framed ise eskıya disguise).
// %75 olasilikla 4 rol, %25 olasilikla 3 rol gosterilir.
function getProphecy(targetRole, framed = false) {
  const masum = ['Şifacı', 'Bekçi', 'Avcı', 'Muhtar', 'Gözcü', 'Falcı', 'Gassal', 'Eskort'];
  const eskiya = ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'];
  const tarafsiz = ['Garip', 'Seri Katil', 'Kan Davalı', 'Kundakçı', 'Kaçak'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Framed iken hedef bir eskıya rolu gibi gosterilir
  const effective = framed ? pick(eskiya) : targetRole;
  const team = ROLES[effective]?.team;
  const align = team === 'Köylüler' ? 'masum' : team === 'Eşkıyalar' ? 'eskiya' : 'tarafsiz';

  const slots = [
    align === 'masum' ? effective : pick(masum),
    align === 'eskiya' ? effective : pick(eskiya),
    align === 'tarafsiz' ? effective : pick(tarafsiz),
  ];

  // 4. slot bazen var bazen yok
  if (Math.random() < 0.75) {
    const all = [...masum, ...eskiya, ...tarafsiz];
    const candidates = all.filter(r => !slots.includes(r));
    if (candidates.length > 0) slots.push(pick(candidates));
  }

  // Pozisyonu rastgelele — hedef rolu bilinmesin diye
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  if (slots.length === 4) return `${slots[0]}, ${slots[1]}, ${slots[2]} veya ${slots[3]}`;
  return `${slots[0]}, ${slots[1]} veya ${slots[2]}`;
}

module.exports = {
  ROLES,
  getInvestResults,
  getColorAlignment,
  getProphecy,
};
