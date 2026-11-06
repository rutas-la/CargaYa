// Configuración de CargaYa. Completá SUPABASE_URL y SUPABASE_KEY con los datos
// de tu proyecto (Supabase > Project Settings > API). Sin estos datos, la app
// funciona en "modo local" (cada teléfono por separado).
window.CARGAYA_CONFIG = {
  SUPABASE_URL: 'https://plepjzpczrcrexiavnrx.supabase.co',
  SUPABASE_KEY: 'sb_publishable_lGsqKJfzh0uZ_zxURMszlw_SITfv31I',

  CLAVE_ADMIN: '2580',       // clave para entrar al panel del mercado. Cambiala.

  GEOCERCA_ACTIVA: false,    // false = permite usarla fuera del mercado (para probar desde otro lugar)
  RADIO_GEOCERCA_M: 800,     // radio alrededor del mercado en metros
  DISTANCIA_ENTREGA_M: 30,   // a cuántos metros del vehículo se habilita "Dejé la mercancía"
};
