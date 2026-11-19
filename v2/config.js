// Configuración de CargaYa v2 (proyecto Supabase "cargaya-v2").
window.CARGAYA_CONFIG = {
  SUPABASE_URL: 'https://ndjbrtwnlxgkfexnuvbi.supabase.co',
  SUPABASE_KEY: 'sb_publishable_5OPtrVwEnYR15l2sJODxJg_N3_78hlx',

  // Las cuentas se crean con teléfono + PIN. Por dentro, Supabase necesita un
  // "email": se arma como <teléfono>@EMAIL_DOMINIO. No se envían correos.
  EMAIL_DOMINIO: 'cargaya.app',

  // Clave PÚBLICA para los avisos push (la privada va solo en los secretos de Supabase).
  VAPID_PUBLIC: 'BPwaveTAEuIo6jz3s0esoNslzqI1NCnnFsgOMtavN2JPTct6PoSM4jeOqlrCezgnINy2qObiNyHaiPjcnL-ut7U',
};
