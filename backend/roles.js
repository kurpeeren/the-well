const ROLES = {
  // Masumlar
  'Şifacı': { align: 'Masum', team: 'Köylüler', limit: 2 },
  'Bekçi': { align: 'Masum', team: 'Köylüler' },
  'Avcı': { align: 'Masum', team: 'Köylüler', limit: 3 },
  'Muhtar': { align: 'Masum', team: 'Köylüler' }, 
  'Dedikoducu': { align: 'Masum', team: 'Köylüler' }, 
  'Falcı': { align: 'Masum', team: 'Köylüler' }, 
  'Gassal': { align: 'Masum', team: 'Köylüler' }, 
  'Eskort': { align: 'Masum', team: 'Köylüler' }, 
  // Eşkıyalar
  'Eşkıya Başı': { align: 'Eşkıya', team: 'Eşkıyalar', nightImmune: true },
  'Münafık': { align: 'Eşkıya', team: 'Eşkıyalar' }, 
  'Eşkıya': { align: 'Eşkıya', team: 'Eşkıyalar' },
  'Tefeci': { align: 'Eşkıya', team: 'Eşkıyalar' }, 
  'Consort': { align: 'Eşkıya', team: 'Eşkıyalar' }, 
  // Tarafsızlar
  'Köy Delisi': { align: 'Tarafsız', team: 'Bireysel' }, 
  'Seri Katil': { align: 'Tarafsız', team: 'Bireysel', nightImmune: true }, 
  'Kan Davalı': { align: 'Tarafsız', team: 'Bireysel', nightImmune: true }, 
  'Kundakçı': { align: 'Kötü', team: 'Bireysel', nightImmune: true }, 
  'Kaçak': { align: 'Tarafsız', team: 'Bireysel', limit: 4 }, 
};

function getInvestResults(role) {
   if (['Bekçi', 'Kan Davalı', 'Seri Katil'].includes(role)) return 'Bekçi, Kan Davalı veya Seri Katil';
   if (['Şifacı', 'Seri Katil', 'Falcı'].includes(role)) return 'Şifacı, Seri Katil veya Falcı';
   if (['Dedikoducu', 'Münafık', 'Köy Delisi'].includes(role)) return 'Dedikoducu, Münafık veya Köy Delisi';
   if (['Eşkıya Başı', 'Muhtar', 'Kaçak'].includes(role)) return 'Eşkıya Başı, Muhtar veya Kaçak';
   if (['Gassal', 'Tefeci', 'Kundakçı'].includes(role)) return 'Gassal, Tefeci veya Kundakçı';
   if (['Avcı', 'Eşkıya', 'Consort'].includes(role)) return 'Avcı, Eşkıya veya Consort';
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

module.exports = {
  ROLES,
  getInvestResults,
  getColorAlignment
};
