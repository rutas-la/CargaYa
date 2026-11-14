/* =====================================================================
   CargaYa v2 · base escalable
   - Una tabla por tipo de dato; cada teléfono descarga solo lo suyo
   - Avisos en vivo filtrados por vendedor / placa
   - Datos compartidos en tiempo real con Supabase (config.js)
   - Sin config.js completo funciona en "modo local" (solo este teléfono)
   ===================================================================== */
const CFG=Object.assign({EMAIL_DOMINIO:'cargaya.app',RADIO_ZONA_M:80,SUPABASE_URL:'',SUPABASE_KEY:'',CLAVE_ADMIN:'1234',GEOCERCA_ACTIVA:true,RADIO_GEOCERCA_M:800,DISTANCIA_ENTREGA_M:30},window.CARGAYA_CONFIG||{});
const ONLINE=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_KEY&&window.supabase);
const sb=ONLINE?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_KEY):null;

/* ===================== Plano y geolocalización ===================== */
// Plano trazado sobre la imagen satelital (norte arriba). 1 unidad del plano = 0,618 m.
// Ancla: estación Metro Mercado (L3) 10.439694, -66.926833 en el punto (872,420) del plano.
const M_PX=0.618, ANCLA={x:872,y:420,lat:10.439694,lng:-66.926833};
const PV=2; // versión del plano: lo marcado sobre el plano anterior se vuelve a marcar
const tienePos=o=>!!o&&o.px!=null&&o.pv===PV, zEn=z=>!!z&&z.x!=null&&z.pv===PV;
const VB0='200 20 790 750';
function toLatLng(x,y){return {lat:ANCLA.lat-(y-ANCLA.y)*M_PX/110574,lng:ANCLA.lng+(x-ANCLA.x)*M_PX/109477}}
function fromLatLng(lat,lng){return {x:ANCLA.x+(lng-ANCLA.lng)*109477/M_PX,y:ANCLA.y-(lat-ANCLA.lat)*110574/M_PX}}
const CENTRO=toLatLng(540,330);
function distM(a,b){const R=6371000,r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function rumbo(a,b){const r=Math.PI/180,y=Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r),x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r);const g=(Math.atan2(y,x)/r+360)%360;return {g,txt:['norte','noreste','este','sureste','sur','suroeste','oeste','noroeste'][Math.round(g/45)%8]}}
const enPlano=f=>f&&f.lat!=null&&distM(f,CENTRO)<=1500;
const ANG=-60;
const VZ={cx:520,cy:445}; // patio entre Nave Cate e INMERCA (camiones)
const GEO=[[372,62],[800,62],[792,150],[772,330],[720,520],[690,640],[600,692],[470,620],[275,528],[285,420],[300,330],[340,180]];
const EDIF=[
  {n:'Galpón norte',p:'425,72 497,100 356,354 275,307',l:[386,213],r:-60},
  {n:'Galpón Calle Zea',p:'522,87 750,87 750,148 560,148 515,192 500,140',l:[640,122],r:0},
  {n:'Agua Viva',p:'462,186 544,233 509,294 427,247',l:[486,242],r:-60},
  {n:'Barco Pesca',p:'630,190 685,205 645,300 597,280',l:[641,247],r:-67},
  {n:'Nave Cate',p:'382,330 451,370 347,550 278,510',l:[364,440],r:-60},
  {n:'INMERCA',p:'603,312 661,343 516,613 458,582',l:[560,465],r:-62},
];
const PUESTOS=[[665,345],[775,335],[700,650],[600,692],[516,613]];
// Entradas y pasillos iniciales (aproximados desde la imagen satelital). La administración los corrige en Zonas → Plano.
const PLANO0={id:'plano',v:PV,
  entradas:[{id:'E1',nombre:'Calle Zea (oeste)',x:372,y:66},{id:'E2',nombre:'Calle Zea (Galpón Calle Zea)',x:512,y:70},{id:'E3',nombre:'Calle Zea (hospital)',x:800,y:66},{id:'E4',nombre:'Puerta 1 (Intercomunal)',x:780,y:745}],
  pasillos:[
    {id:'P1',nombre:'Calle interna oeste',sentido:'doble',pts:[[372,66],[300,330],[285,420],[275,525]]},
    {id:'P2',nombre:'Entre Galpón norte y Agua Viva',sentido:'doble',pts:[[512,70],[507,106],[420,262],[372,322],[300,330]]},
    {id:'P3',nombre:'Patio entre naves',sentido:'doble',pts:[[420,262],[525,300],[460,450],[398,565]]},
    {id:'P4',nombre:'Calle sur',sentido:'doble',pts:[[275,525],[398,565],[470,615],[600,662],[700,700],[780,745]]},
    {id:'P5',nombre:'Avenida de los puestos',sentido:'doble',pts:[[800,66],[745,230],[705,340],[650,500],[600,662]]},
    {id:'P6',nombre:'Frente al Galpón Calle Zea',sentido:'doble',pts:[[507,106],[512,160],[560,168],[740,172],[745,230]]},
    {id:'P7',nombre:'Pasillo Barco Pesca',sentido:'doble',pts:[[560,168],[590,250],[560,305],[525,300]]}]};
const planoCfg=()=>{const c=S.config&&S.config.plano;return c&&c.v===PV?c:PLANO0};
function pip(x,y,poly){let a=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)a=!a}return a}
const areaOf=(x,y)=>zonasActivas().find(z=>z.pv===PV&&z.poly&&z.poly.length>2&&pip(x,y,z.poly))||null;
function zonasActivas(){return Object.values(S.zona).filter(z=>!z.baja)}
function nombresZona(){return [...new Set(zonasActivas().map(z=>z.nombre))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}))}
function lugar(f){return f&&f.zona?{zona:f.zona,cerca:f.ref||'',codigo:f.zona}:{zona:'Sin zona',cerca:f?.ref||''}}
const f1=n=>Math.round(n*10)/10;
const XY=f=>{const p=fromLatLng(f.lat,f.lng);return [p.x,p.y]};

/* ===================== GPS del teléfono ===================== */
function errGPS(e){return e&&e.code===1?'Le negaste el permiso de ubicación a la página. Actívalo en los ajustes del navegador (candado junto a la dirección) y prueba de nuevo.':e&&e.code===3?'El GPS tardó demasiado. Prueba al aire libre, lejos de techos.':(e&&e.message)||'No se pudo leer el GPS.'}
function mejorFix(ms=12000){return new Promise((res,rej)=>{
  if(!navigator.geolocation)return rej(new Error('Este teléfono o navegador no permite usar el GPS.'));
  let best=null,done=false;const fin=()=>{if(done)return;done=true;clearTimeout(t);navigator.geolocation.clearWatch(w);best?res(best):rej(new Error('No se obtuvo señal GPS. Prueba al aire libre.'))};
  const w=navigator.geolocation.watchPosition(p=>{const f={lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy)};if(!best||f.acc<best.acc)best=f;if(best.acc<=8)fin()},
    e=>{if(!best&&!done){done=true;clearTimeout(t);navigator.geolocation.clearWatch(w);rej(e)}},{enableHighAccuracy:true,maximumAge:0,timeout:ms});
  const t=setTimeout(fin,ms)})}

/* ===================== Datos ===================== */
const S={vendedor:{},comprador:{},carretillero:{},despacho:{},calibracion:{},zona:{},config:{},pago:{},log:[]};
let conexion=ONLINE?'conectando':'local';
const LKEY='cargaya-v2-local',QKEY='cargaya-v2-cola',MEKEY='cargaya-v2-yo';
let ME=null;try{ME=JSON.parse(localStorage.getItem(MEKEY)||'null')}catch(e){}
function setME(m){ME=m;try{m?localStorage.setItem(MEKEY,JSON.stringify(m)):localStorage.removeItem(MEKEY)}catch(e){}}
let cola=[];try{cola=JSON.parse(localStorage.getItem(QKEY)||'[]')}catch(e){}
const saveCola=()=>{try{localStorage.setItem(QKEY,JSON.stringify(cola))}catch(e){}};
function saveLocal(){if(ONLINE)return;try{localStorage.setItem(LKEY,JSON.stringify(S))}catch(e){}}

const TABLA={vendedor:'vendedores',comprador:'compradores',carretillero:'carretilleros',despacho:'despachos',zona:'zonas',config:'config',pago:'pagos',calibracion:'calibracion'};
const DIA_MS=86400000;
const inicioDia=(d=0)=>{const x=new Date();x.setHours(0,0,0,0);return x.getTime()-d*DIA_MS};
// Trae todas las filas de una consulta, de a 1000 (límite de Supabase por pedido)
async function traerTodo(qf,tipo){const N=1000;let desde=0,n=0;
  for(;;){const r=await qf().order('id').range(desde,desde+N-1);if(r.error)throw r.error;
    r.data.forEach(x=>{const d=x.data||x;if(d&&d.id!=null){S[tipo][d.id]=d;n++}});if(r.data.length<N)break;desde+=N}
  return n}
const sel=t=>()=>sb.from(TABLA[t]).select('data');
async function cargarDatos(){const yo=ME&&ME.id,rol=ME&&ME.rol;const q=[];
  q.push(traerTodo(sel('zona'),'zona'),traerTodo(sel('config'),'config'));
  if(rol==='vendedor'){
    q.push(traerTodo(()=>sel('vendedor')().eq('id',yo),'vendedor'),
      traerTodo(()=>sel('carretillero')().eq('vendedor',yo),'carretillero'),
      traerTodo(()=>sel('pago')().eq('vendedor',yo),'pago'),
      // despachos del último mes que todavía importan: en la lista, sin pagar al carretillero, o de hoy/ayer
      traerTodo(()=>sel('despacho')().eq('vendedor',yo).gte('creado',inicioDia(30)).or(`archivado.eq.false,pagado.eq.false,creado.gte.${inicioDia(1)}`),'despacho'),
      traerTodo(()=>sel('comprador')().eq('activo',true),'comprador').then(()=>{activosDesde=new Date().toISOString()}));
  }else if(rol==='comprador'){
    q.push(traerTodo(()=>sel('comprador')().eq('id',yo),'comprador'),
      traerTodo(()=>sel('despacho')().eq('placa',yo).gte('creado',inicioDia(7)),'despacho'),
      cargarDirectorio());
  }else if(rol==='admin'){
    q.push(traerTodo(sel('vendedor'),'vendedor'),traerTodo(sel('carretillero'),'carretillero'),traerTodo(sel('calibracion'),'calibracion'),
      traerTodo(()=>sel('comprador')().eq('activo',true),'comprador'),
      // de hoy, solo lo que está en curso + los últimos 150 (los números del día los calcula el servidor)
      traerTodo(()=>sel('despacho')().gte('creado',inicioDia(0)).in('estado',['en_ruta','reclamo']),'despacho'),
      sel('despacho')().gte('creado',inicioDia(0)).order('creado',{ascending:false}).limit(150).then(r=>{if(!r.error)r.data.forEach(x=>S.despacho[x.data.id]=x.data)}),
      cargarResumen(),
      traerTodo(()=>sel('pago')().or(`estado.eq.pendiente,updated_at.gte.${new Date(inicioDia(120)).toISOString()}`),'pago'),
      sb.from('actividad').select('t,m').order('id',{ascending:false}).limit(80).then(a=>{if(!a.error)S.log=a.data.map(l=>({t:Date.parse(l.t),m:l.m}))}));
  }
  await Promise.all(q);
  // nombres de carretilleros y compradores que aparecen en los despachos
  const ds=L('despacho');ds.forEach(d=>{if(d.carretillero)pedir('carretillero',d.carretillero);if(rol!=='comprador')pedir('comprador',d.placa)});
  if(rol==='vendedor')L('carretillero').forEach(k=>k.vendedor!==yo&&pedir('vendedor',k.vendedor));
}
// Resumen del día (administración): lo calcula el servidor para no descargar miles de despachos
let RES=null,resT=null;
async function cargarResumen(){if(!ONLINE||!ME||ME.rol!=='admin')return;const r=await sb.rpc('resumen_admin',{desde:inicioDia(0)});if(!r.error){RES=r.data;RES.enRuta=new Set(RES.placas_en_ruta||[]);pedirRender()}}
function resumenLuego(){if(ME&&ME.rol==='admin'){clearTimeout(resT);resT=setTimeout(cargarResumen,3000)}}
setInterval(()=>{if(ME&&ME.rol==='admin'&&!document.hidden)cargarResumen()},60000);
// Directorio de vendedores (comprador): vista sin datos de cobro
let dirT=0;
async function cargarDirectorio(forzar){if(!ONLINE||(!forzar&&Date.now()-dirT<5*60000))return;dirT=Date.now();
  await traerTodo(()=>sb.from('vendedores_publico').select('*'),'vendedor');pedirRender()}
// Compradores nuevos o que cambiaron desde la última vez (vendedor): consulta incremental, sin avisos en vivo
let activosDesde=null;
async function refrescarCompradores(){if(!ONLINE||!ME||ME.rol!=='vendedor'||!activosDesde)return;const t=new Date().toISOString();
  const r=await sb.from('compradores').select('data').gt('updated_at',activosDesde).limit(1000);if(r.error)return;activosDesde=t;
  if(r.data.length){r.data.forEach(x=>S.comprador[x.data.id]=x.data);pedirRender()}}
setInterval(refrescarCompradores,120000);

// Pedidos sueltos: datos que aparecen en pantalla pero no se descargaron (se agrupan en un solo pedido)
const PEND={},NOEX={};let pedirT=null;
function pedir(tipo,id){if(!ONLINE||!ME||id==null||id===''||S[tipo][id]||NOEX[tipo+'|'+id])return;(PEND[tipo]=PEND[tipo]||new Set()).add(id);clearTimeout(pedirT);pedirT=setTimeout(traerPend,40)}
async function traerPend(){const lotes=Object.entries(PEND).map(([t,s])=>[t,[...s]]);for(const k in PEND)delete PEND[k];let algo=false;
  for(const [tipo,ids] of lotes)for(let i=0;i<ids.length;i+=100){const lote=ids.slice(i,i+100);
    const publico=tipo==='vendedor'&&ME.rol!=='admin';
    const r=publico?await sb.from('vendedores_publico').select('*').in('id',lote):await sb.from(TABLA[tipo]).select('data').in('id',lote);
    if(r.error)continue;const vistos=new Set();r.data.forEach(x=>{const d=publico?x:x.data;if(!S[tipo][d.id]){S[tipo][d.id]=d;algo=true}vistos.add(String(d.id))});
    lote.forEach(id=>{if(!vistos.has(String(id)))NOEX[tipo+'|'+id]=Date.now()})}
  if(algo)pedirRender()}
async function asegurar(tipo,ids){[...new Set(ids)].forEach(id=>pedir(tipo,id));clearTimeout(pedirT);await traerPend()}

async function cargar(){
  if(!ONLINE){try{Object.assign(S,JSON.parse(localStorage.getItem(LKEY)||'{}'))}catch(e){}return}
  try{await cargarDatos()}catch(e){conexion='error';toast('No se pudo conectar con la base de datos');return}
  if(cargar.sub)return;cargar.sub=true;suscribir()}
// Avisos en vivo: cada teléfono escucha solo lo suyo
function suscribir(){const yo=ME.id,rol=ME.rol;
  const ch=sb.channel('cy-'+rol+'-'+String(yo).replace(/[^\w-]/g,''));
  const on=(tipo,filter)=>ch.on('postgres_changes',{event:'*',schema:'public',table:TABLA[tipo],...(filter?{filter}:{})},p=>{const x=p.new;if(!x||!x.data)return;const d=x.data;const antes=S[tipo][d.id];S[tipo][d.id]=d;IDX.t=0;delete NOEX[tipo+'|'+d.id];avisar(tipo,antes,d);if(tipo==='despacho')resumenLuego();pedirRender()});
  on('zona');
  if(rol==='vendedor'){on('despacho','vendedor=eq.'+yo);on('carretillero','vendedor=eq.'+yo);on('vendedor','id=eq.'+yo);on('pago','vendedor=eq.'+yo);on('config')}
  else if(rol==='comprador'){on('despacho','placa=eq.'+yo);on('comprador','id=eq.'+yo)}
  else{['despacho','vendedor','comprador','carretillero','pago','config'].forEach(t=>on(t));
    ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'actividad'},p=>{S.log.unshift({t:Date.parse(p.new.t),m:p.new.m});S.log=S.log.slice(0,80);pedirRender()})}
  let caido=false;
  ch.subscribe(st=>{if(st==='SUBSCRIBED'){conexion='en línea';if(caido){caido=false;resincronizar()}}
    else if(st==='CLOSED'||st==='CHANNEL_ERROR'||st==='TIMED_OUT'){conexion='sin conexión';caido=true}pintarEstado()})}
// Tras una caída o con la pantalla apagada se pueden perder avisos: se vuelve a pedir lo propio
let ultResync=Date.now(),ocultoDesde=0;
async function resincronizar(){if(!ONLINE||!ME||Date.now()-ultResync<5000)return;ultResync=Date.now();try{await cargarDatos();pedirRender()}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)ocultoDesde=Date.now();else if(ocultoDesde&&Date.now()-ocultoDesde>60000)resincronizar()});
async function enviar(op){if(op.k!=='r')return sb.from('actividad').insert({m:op.m});
 // Actualizar primero (lo permite la regla de edición: el comprador confirma despachos ajenos); si no existe, crear.
 const T=TABLA[op.tipo];
 const upd=()=>sb.from(T).update({data:op.obj}).eq('id',op.obj.id).select('id');
 let r=await upd();if(r.error||(r.data&&r.data.length))return r;
 r=await sb.from(T).insert({id:op.obj.id,data:op.obj});
 if(r.error&&(r.error.code==='23505'||/duplicate key/i.test(r.error.message||''))){r=await upd();if(!r.error&&!(r.data&&r.data.length))r={error:{code:'42501',message:'row-level security: sin permiso'}}}
 return r}
const errRed=e=>!e||!e.code||/fetch|network|timeout|Failed/i.test(e.message||'');
function msgErr(op,e){const m=(e&&e.message)||'';if(op.k==='r'&&op.tipo==='comprador')return 'Esa placa ya está registrada por otra cuenta. Avísale a la administración.';
  if(op.k==='r'&&op.tipo==='despacho'&&/row-level security|42501/i.test(m+(e.code||'')))return 'No se pudo despachar: tu mensualidad venció. Págala en la pestaña Mensualidad.';
  if(/pago pendiente de revisi/i.test(m))return 'Ya tienes un pago pendiente de revisión. Espera a que la administración lo apruebe.';
  if(/solo puede confirmar/i.test(m))return 'Solo puedes confirmar o reclamar la entrega.';if(/row-level security|permission|42501/i.test(m+(e.code||'')))return 'No tienes permiso para hacer eso.';return 'No se pudo guardar: '+m}
async function recargarRegistro(tipo,id){const r=await sb.from(TABLA[tipo]).select('data').eq('id',id);if(!r.error){if(r.data&&r.data[0])S[tipo][id]=r.data[0].data;else delete S[tipo][id];pedirRender()}}
let vaciando=false;
async function vaciarCola(){if(!ONLINE||!cola.length||vaciando)return;vaciando=true;try{while(cola.length){const op=cola[0];let r;try{r=await enviar(op)}catch(e){r={error:e}}
  if(r&&r.error){if(errRed(r.error)){conexion='sin conexión';pintarEstado();return}cola.shift();saveCola();toast(msgErr(op,r.error));if(op.k==='r')recargarRegistro(op.tipo,op.obj.id);continue}
  cola.shift();saveCola()}}finally{vaciando=false}pintarEstado()}
async function guardar(tipo,obj){S[tipo][obj.id]=obj;IDX.t=0;saveLocal();pedirRender();if(!ONLINE)return;cola.push({k:'r',tipo,obj});saveCola();await vaciarCola()}
async function log(m){if(!ONLINE){S.log.unshift({t:Date.now(),m});S.log=S.log.slice(0,80);saveLocal();return}cola.push({k:'a',m});saveCola();await vaciarCola()}
setInterval(vaciarCola,10000);window.addEventListener('online',vaciarCola);

const L=t=>Object.values(S[t]);
const pl=(n,s,p)=>`${n} ${n==1?s:(p||s+'s')}`;
const vend=id=>S.vendedor[id]||(pedir('vendedor',id),undefined),comp=p=>S.comprador[p]||(p&&String(p).length>=5&&pedir('comprador',p),undefined),carr=id=>S.carretillero[id]||(pedir('carretillero',id),undefined);
const compradoresActivos=()=>L('comprador').filter(c=>c.activo!==false);
const normPlaca=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const hhmm=t=>{if(!t)return '';const d=new Date(t);if(isNaN(d))return '';let hr=d.getHours();const ap=hr<12?'a. m.':'p. m.';hr=hr%12||12;return `${hr}:${String(d.getMinutes()).padStart(2,'0')} ${ap}`};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nuevoId=p=>p+'-'+Date.now().toString(36).slice(-4).toUpperCase()+Math.random().toString(36).slice(2,4).toUpperCase();
function wa(tel){let d=(tel||'').replace(/\D/g,'');if(!d)return null;if(d.startsWith('0'))d='58'+d.slice(1);else if(!d.startsWith('58')&&d.length===10)d='58'+d;return 'https://wa.me/'+d}
function waBtn(tel,txt){const u=wa(tel);return u?`<a class="btn o" style="display:inline-block;text-decoration:none;text-align:center" href="${u}" target="_blank" rel="noopener">💬 ${txt}</a> <span class="hint">${esc(tel)}</span>`:''}
const ETQ={en_ruta:'En camino',entregado:'Entregado',reclamo:'Reclamo'};
function chip(e){return `<span class="chip st-${e==='reclamo'?'en_ruta':e==='en_ruta'?'asignado':e}">${ETQ[e]||e}</span>`}
function tl(d){return `<div class="timeline"><i class="on"></i><i class="${d.estado!=='en_ruta'?'on':''}" ${d.estado==='reclamo'?'style="background:#e0362c"':''}></i></div>`}
function toast(m){const el=document.getElementById('toast');el.textContent=m;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),3000)}
function sonar(){try{const c=sonar.c||(sonar.c=new (window.AudioContext||window.webkitAudioContext)());[0,.18].forEach(s=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.15;o.connect(g);g.connect(c.destination);o.start(c.currentTime+s);o.stop(c.currentTime+s+.12)})}catch(e){}try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}}
function avisar(tipo,antes,d){if(tipo==='pago'&&ME&&ME.rol==='vendedor'&&d.vendedor===ME.id&&antes&&antes.estado!==d.estado){toast(d.estado==='aprobado'?'✓ Tu pago fue aprobado':'✗ Tu pago fue rechazado: '+(d.motivo||''));sonar();return}
  if(tipo!=='despacho'||!ME)return;if(antes&&antes.estado===d.estado)return;let m=null;
  if(ME.rol==='comprador'&&d.placa===ME.id&&!antes)m=`${vend(d.vendedor)?.nombre||'Un vendedor'} despachó ${d.bultos} bultos a tu vehículo`;
  else if(ME.rol==='vendedor'&&d.vendedor===ME.id&&antes&&d.estado!=='en_ruta')m=`${nro(d)} para ${d.placa}: ${ETQ[d.estado]}`;
  if(m){toast(m);sonar()}}

/* ===================== Rutas y mapa ===================== */
function routePts(d){const c=comp(d.placa);if(!c||!enPlano(c))return null;const v=vend(d.vendedor);return rutaXY(v&&enPlano(v)?XY(v):null,XY(c))}
const COL_ZONA={compradores:['#e0ecff','#1f6feb'],vendedores:['#fff3c4','#b08a1a'],puestos:['#f2dfc2','#a0784a'],otro:['#e6e6e6','#6b7078']};
function baseSVG(){const pl=planoCfg();
  let s=`<rect x="-300" y="-300" width="1700" height="1400" fill="#e9e6dc"/>
  <polygon points="${GEO.map(p=>p.join(',')).join(' ')}" fill="#efede6" stroke="#3ddc84" stroke-width="2" stroke-dasharray="6 6"/>
  <g fill="none" stroke="#d3cfc2" stroke-linecap="round" stroke-linejoin="round"><polyline points="120,62 1063,58" stroke-width="18"/><polyline points="1015,70 962,300 905,560 868,780" stroke-width="22"/></g>
  <polygon points="${PUESTOS.map(p=>p.join(',')).join(' ')}" fill="#f2dfc2"/>
  <text x="682" y="575" font-family="Barlow Condensed" font-size="15" fill="#a0784a" text-anchor="middle" transform="rotate(-71 682 575)">PUESTOS / BUHONEROS</text>`;
  // zonas dibujadas (con su color según el tipo)
  zonasActivas().filter(z=>z.pv===PV&&z.poly&&z.poly.length>2).forEach(z=>{const [f,c]=COL_ZONA[z.tipo]||COL_ZONA.otro;
    s+=`<polygon points="${z.poly.map(p=>p.join(',')).join(' ')}" fill="${f}" fill-opacity=".75" stroke="${c}" stroke-opacity=".6" stroke-dasharray="5 4"/>`});
  // pasillos
  s+=`<g fill="none" stroke-linecap="round" stroke-linejoin="round">${(pl.pasillos||[]).map(p=>`<polyline points="${p.pts.map(q=>q.join(',')).join(' ')}" stroke="#d3cfc2" stroke-width="13"/>`).join('')}
    ${(pl.pasillos||[]).map(p=>`<polyline points="${p.pts.map(q=>q.join(',')).join(' ')}" stroke="#fff" stroke-width="1.6" stroke-dasharray="6 6" opacity=".9"/>`).join('')}</g>`;
  (pl.pasillos||[]).filter(p=>p.sentido==='uno'&&p.pts.length>1).forEach(p=>{for(let i=0;i+1<p.pts.length;i++){const [a,b]=[p.pts[i],p.pts[i+1]],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,g=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
    s+=`<path d="M-5,-4 L5,0 L-5,4Z" fill="#7c8089" transform="translate(${f1(mx)} ${f1(my)}) rotate(${f1(g)})"/>`}});
  EDIF.forEach(e=>{s+=`<polygon points="${e.p}" fill="#cbc7bb" stroke="#b8b3a5"/><text x="${e.l[0]}" y="${e.l[1]}" font-family="Barlow Condensed" font-weight="700" font-size="14" fill="#5d6169" text-anchor="middle" transform="rotate(${e.r} ${e.l[0]} ${e.l[1]})">${e.n.toUpperCase()}</text>`});
  (pl.entradas||[]).forEach(e=>{s+=`<g transform="translate(${e.x} ${e.y})"><rect x="-9" y="-9" width="18" height="18" rx="4" fill="#7b3fe4" stroke="#fff" stroke-width="2"/><path d="M-4,-4 L4,0 L-4,4Z" fill="#fff" transform="rotate(90)"/><text y="22" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="12" fill="#7b3fe4" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(e.nombre)}</text></g>`});
  s+=`<text x="620" y="50" font-size="13" font-weight="600" fill="#7c8089">Calle Zea</text>
  <text x="940" y="620" font-size="13" font-weight="600" fill="#7c8089" transform="rotate(-77 940 620)">Av. Intercomunal de El Valle</text>
  <circle cx="872" cy="420" r="13" fill="#1f6feb"/><text x="872" y="425" text-anchor="middle" font-weight="700" font-size="14" fill="#fff">M</text>
  <text x="872" y="450" text-anchor="middle" font-size="11.5" fill="#4a4f58">Metro Mercado</text>
  <circle cx="940" cy="152" r="11" fill="#e0362c"/><text x="940" y="157" text-anchor="middle" font-weight="700" font-size="13" fill="#fff">H</text>
  <g transform="translate(240 70)"><circle r="18" fill="#fff" stroke="#cbc7bb"/><path d="M0,-12 L6,6 L0,2 L-6,6Z" fill="#16181c"/><text y="-22" text-anchor="middle" font-size="11" font-weight="700" fill="#4a4f58">N</text></g>`;
  return s}
// Fotos: se suben a Storage (no se guardan dentro de la base). Vehículos: carpeta pública con nombre al azar.
// Capturas de pago: carpeta privada; se muestran con un enlace temporal.
async function subirFoto(dataURL,bucket){const blob=await (await fetch(dataURL)).blob();
  const path=`${ME.uid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2,10)}.jpg`;
  const r=await sb.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});if(r.error)throw r.error;
  return bucket==='fotos'?sb.storage.from('fotos').getPublicUrl(path).data.publicUrl:bucket+':'+path}
const FIRMAS={};
function srcFoto(f){if(!f)return '';const m=/^comprobantes:(.+)$/.exec(f);if(!m)return f;const c=FIRMAS[m[1]];return c&&c.hasta>Date.now()?c.url:''}
function attrFoto(f){const s=srcFoto(f);return /^comprobantes:/.test(f||'')&&!s?`data-firmar="${esc(f.slice(13))}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="`:`src="${esc(s)}"`}
async function firmarFotos(){if(!ONLINE)return;const els=[...document.querySelectorAll('img[data-firmar]')];for(const el of els){const path=el.dataset.firmar;
  let c=FIRMAS[path];if(!c||c.hasta<Date.now()){const r=await sb.storage.from('comprobantes').createSignedUrl(path,3600);if(r.error||!r.data)continue;c=FIRMAS[path]={url:r.data.signedUrl,hasta:Date.now()+3500000}}
  el.src=c.url;el.removeAttribute('data-firmar')}}
function fotoInput(input,cb,bucket){if(!input)return;input.onchange=()=>{const f=input.files[0];if(!f)return;const img=new Image();img.onload=()=>{const sc=Math.min(1,480/Math.max(img.width,img.height));const cv=document.createElement('canvas');cv.width=img.width*sc;cv.height=img.height*sc;cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);const u=cv.toDataURL('image/jpeg',0.6);if(!ONLINE||!ME){cb(u);return}toast('Subiendo foto…');subirFoto(u,bucket||'fotos').then(url=>{toast('Foto lista');cb(url)}).catch(()=>toast('No se pudo subir la foto. Revisa la conexión y prueba de nuevo.'))};img.src=URL.createObjectURL(f)}}

const RAIZ=location.origin+location.pathname.replace(/[^/]*$/,'');
const BASE=RAIZ;
const MODULO=window.CARGAYA_MODULO||'comprador';
const LINKS={comprador:RAIZ+'comprador.html',vendedor:RAIZ+'vendedor.html',admin:RAIZ+'admin.html'};
const NOMBRE_MOD={comprador:'Comprador',vendedor:'Vendedor',admin:'Administración'};
const urlCarnet=id=>`${RAIZ}comprador.html?k=${id}`;
const pad=(n,l)=>String(n).padStart(l,'0');
function parseCodigo(txt){if(!txt)return null;txt=String(txt).trim();
  try{const u=new URL(txt);const f=u.searchParams.get('f'),k=u.searchParams.get('k');if(f)return parseCodigo('F:'+f);if(k)return parseCodigo('K:'+k)}catch(e){}
  let m=txt.match(/^F:?\s*(\d{1,6})(?:[-\s]+([A-Z0-9]{3}))?$/i);if(m)return {tipo:'f',num:pad(m[1],4),cod:m[2]?m[2].toUpperCase():null};
  m=txt.match(/^K:?\s*([A-Z0-9]{2,12})$/i);if(m)return {tipo:'k',id:(/^K/i.test(m[1])?'':'K')+m[1].toUpperCase()};return null}
const carrPorId=id=>id?S.carretillero[String(id).toUpperCase()]:null;
async function buscarCarr(id){if(!id)return null;id=String(id).toUpperCase();if(!S.carretillero[id]){delete NOEX['carretillero|'+id];await asegurar('carretillero',[id])}const k=S.carretillero[id];if(k&&k.vendedor)await asegurar('vendedor',[k.vendedor]);return k||null}
const nuevoIdK=()=>'K'+[...Array(6)].map(()=>COD_ALF[Math.floor(Math.random()*COD_ALF.length)]).join('');
const ajeno=(k,vid)=>k&&k.vendedor&&k.vendedor!==vid;
const etqCarr=(k,vid)=>k?`#${k.num} ${k.nombre||''}${ajeno(k,vid)?' (de '+(vend(k.vendedor)?.nombre||'otro vendedor')+')':''}`.replace(/\s+\(/,' ('):'';
const misCarr=vid=>(idx().kv[vid]||[]).filter(k=>!k.baja).sort((a,b)=>a.num.localeCompare(b.num));
const itemsDe=d=>Array.isArray(d.items)&&d.items.length?d.items:[{desc:d.desc||'',bultos:+d.bultos||1}];
const resumenItems=d=>itemsDe(d).map(i=>`${i.desc} (${i.bultos})`).join(', ');
const htmlItems=d=>itemsDe(d).length>1?`<ul style="margin:4px 0 0;padding-left:20px">${itemsDe(d).map(i=>`<li>${esc(i.desc)} · <b>${i.bultos}</b> bulto${i.bultos==1?'':'s'}</li>`).join('')}</ul>`:'';
const tituloItems=d=>itemsDe(d).length>1?`${itemsDe(d).length} productos · ${d.bultos} bultos`:`${esc(itemsDe(d)[0].desc)} · ${d.bultos} bulto${d.bultos==1?'':'s'}`;
const nro=d=>d.ficha?'Ficha '+d.ficha.num:'Despacho '+d.id.slice(-4);

/* ===================== Escáner con la cámara ===================== */
function cargarJsQR(){return window.jsQR?Promise.resolve():new Promise((res,rej)=>{const s=document.createElement('script');s.src='lib/jsQR.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
function escanear(titulo,ayuda){return new Promise(async res=>{
  const ov=document.createElement('div');ov.className='scan';
  ov.innerHTML=`<div class="scanbox"><h2>${esc(titulo)}</h2><p class="sub" style="color:#cfd2d6">${esc(ayuda||'Apunta la cámara al código QR')}</p>
   <div class="scanvid"><video playsinline muted></video><div class="scanframe"></div></div><p class="hint" id="scanMsg" style="color:#cfd2d6">Abriendo la cámara…</p>
   <button class="btn o" id="scanCancel" style="width:100%;margin-top:8px">Cancelar</button></div>`;
  document.body.appendChild(ov);const video=ov.querySelector('video');let stream=null,done=false,timer=null;
  const fin=v=>{if(done)return;done=true;clearInterval(timer);try{stream&&stream.getTracks().forEach(t=>t.stop())}catch(e){}ov.remove();res(v)};
  ov.querySelector('#scanCancel').onclick=()=>fin(null);
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});video.srcObject=stream;await video.play();ov.querySelector('#scanMsg').textContent='Buscando el código…'}
  catch(e){ov.querySelector('#scanMsg').textContent='No se pudo abrir la cámara. Revisa el permiso de cámara o escribe el número a mano.';return}
  let det=null;try{if('BarcodeDetector' in window)det=new BarcodeDetector({formats:['qr_code']})}catch(e){}
  if(!det){try{await cargarJsQR()}catch(e){}}
  const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
  timer=setInterval(async()=>{if(done||video.readyState<2)return;try{
    if(det){const r=await det.detect(video);if(r&&r[0]){sonar();fin(r[0].rawValue)}return}
    if(window.jsQR){const w=video.videoWidth,h=video.videoHeight,sc=Math.min(1,640/Math.max(w,h));cv.width=w*sc;cv.height=h*sc;cx.drawImage(video,0,0,cv.width,cv.height);
      const r=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);if(r&&r.data){sonar();fin(r.data)}}}catch(e){}},250)})}

/* ===================== Render ===================== */
let view=null,pendiente=false,cargado=false;
function vistasDe(){if(!ME)return [];if(ME.rol==='admin')return ['mercado','uso','cobros','comprAdm','zonas','carretilleros','imprimir'];if(ME.rol==='vendedor')return ['vendedor','pagosK','histVend','misCarr','miUbic','miSusc'];return ['comprador','vendC']}
const NOMBRES={uso:'Uso',comprAdm:'Compradores',miUbic:'Mi ubicación',miSusc:'Mensualidad',vendC:'Vendedores',pagosK:'Pago carretilleros',histVend:'Historial',misCarr:'Mis carretilleros',mercado:'Panel',cobros:'Cobros',zonas:'Plano y zonas',carretilleros:'Carretilleros',imprimir:'Compartir',calibrar:'Calibrar plano',vendedor:'Despachar',comprador:'Mis compras'};
function leerItems(){const f=document.getElementById('fDesp');if(!f)return null;return [...f.querySelectorAll('.it-row')].map(r=>({desc:r.querySelector('.it-desc').value,bultos:r.querySelector('.it-bul').value}))}
function guardarFormDesp(){const f=document.getElementById('fDesp');if(!f)return;desp.placa=f.querySelector('#placa')?.value??desp.placa;const it=leerItems();if(it)desp.items=it}
function pedirRender(){const a=document.activeElement;if(!(a&&a.matches&&a.matches('input,textarea,select')))guardarFormDesp();if(a&&a.matches&&a.matches('input,textarea,select')||ocupado()){pendiente=true;return}render()}
document.addEventListener('focusout',()=>setTimeout(()=>{if(pendiente&&!(document.activeElement&&document.activeElement.matches('input,textarea,select'))&&!ocupado()){pendiente=false;render()}},50));
const formSucio=()=>[...document.querySelectorAll('#app input:not([type=file]):not([type=range]):not(#fDesp input),#app textarea')].some(i=>i.value!==i.defaultValue);
const ocupado=()=>!!otroModulo||!!yoBuscando||!!editPuesto||!!vcMapa||!!pagandoK||!!pagandoLote||!!(reg&&reg.ocupado)||!!pagando||!!rechazando||!!zonaUbicando||!!zonaDib||!!plEdit||!!ubicandoCamion||!!document.querySelector('.scan')||!!fichaVista||!!recibiendo||formSucio();
function pintarEstado(){const el=document.getElementById('estado');if(!el)return;const col={'en línea':'#3ddc84','local':'#ffc400','conectando':'#9aa0a8'}[conexion]||'#e0362c';
  el.innerHTML=`<i style="background:${col}"></i>${conexion==='local'?'Modo local (solo este teléfono)':conexion==='en línea'?'En línea':conexion==='conectando'?'Conectando…':'Sin conexión: se guarda y se envía al volver la señal'}${cola.length?` · ${cola.length} por enviar`:''}${ME?` · ${esc(ME.nombre)} <a href="#" id="salir" style="color:#ffc400">${ONLINE?'salir':'cambiar'}</a>`:''}`;
  const s=document.getElementById('salir');if(s)s.onclick=e=>{e.preventDefault();if(ONLINE){salir();return}setME(null);view=null;render()}}
function render(){IDX.t=0;
  const vs=vistasDe();if(ME&&!vs.includes(view))view=vs[0];
  const nav=document.getElementById('nav');nav.innerHTML=vs.length>1?vs.map(v=>`<button data-v="${v}" class="${v===view?'on':''}">${NOMBRES[v]}</button>`).join(''):'';
  nav.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.v!==view){gpsErr='';ubicandoCamion=false;editPuesto=false;pagando=false;pagandoK=null;pagandoLote=null;fichaVista=null}view=b.dataset.v;if(view==='comprAdm')CA.key=null;if(view==='uso')cargarMetricas();if(view==='histVend')histC.key=null;if(view==='vendC')cargarDirectorio();render();window.scrollTo(0,0)};
  pintarEstado();
  const app=document.getElementById('app');
  if(fichaURL){app.innerHTML=vFichaURL();bindFichaURL();return}
  if(!ME){if(ONLINE){app.innerHTML=vLogin();bindLogin()}else{app.innerHTML=vInicio();bind.inicio()}return}
  if(!cargado){app.innerHTML='<div class="card empty">Cargando datos…</div>';return}
  if(otroModulo){app.innerHTML=vOtroModulo();if($('omSalir'))$('omSalir').onclick=()=>salir();return}
  app.innerHTML=({uso:vUso,comprAdm:vComprAdm,miUbic:vMiUbic,miSusc:vMiSusc,vendC:vVendC,pagosK:vPagosK,histVend:vHistVend,misCarr:vMisCarr,mercado:vMercado,cobros:vCobros,zonas:vZonas,carretilleros:vCarretilleros,imprimir:vImprimir,vendedor:vVendedor,comprador:vComprador})[view]();
  bind[view]&&bind[view]();firmarFotos();
}
let otroModulo=null;
function vOtroModulo(){const r=otroModulo;return `<div class="card" style="max-width:520px;margin:0 auto"><h2>Este es el módulo de ${NOMBRE_MOD[MODULO]}</h2><p class="sub">Tu cuenta es de <b>${NOMBRE_MOD[r]}</b>. Ábrela en su módulo:</p>
  <a class="btn y big" style="display:block;text-align:center;text-decoration:none" href="${LINKS[r]}">Ir al módulo de ${NOMBRE_MOD[r]}</a><button class="btn o" id="omSalir" style="width:100%;margin-top:10px">Salir y usar otra cuenta</button></div>`}
function itemDesp(d,who){const v=vend(d.vendedor),c=comp(d.placa),k=carr(d.carretillero);
  return `<div class="item"><div class="top"><div><b>${esc(nro(d))}</b> · ${tituloItems(d)}</div>${chip(d.estado)}</div>${htmlItems(d)}
   <div class="meta">${who!=='vendedor'?`De <b>${esc(v?v.nombre:d.vendedor)}</b> · `:''}${who!=='comprador'&&c?`Para <span class="plate">${esc(d.placa)}</span> <span class="loc">${esc(lugar(c).zona)}</span> · `:''}${k?`Carretillero <b>#${esc(k.num)}</b> ${esc(k.nombre||'')}${ajeno(k,d.vendedor)?` <span class="hint">(de ${esc(vend(k.vendedor)?.nombre||'otro vendedor')})</span>`:''}`:'Sin carretillero'}</div>
   ${tl(d)}<div class="meta">Salió ${hhmm(d.t.creado)}${d.t.entregado?` · Recibido ${hhmm(d.t.entregado)} (${Math.max(1,Math.round((d.t.entregado-d.t.creado)/60000))} min)`:''}${d.estado==='entregado'?` · ✓ ${({carnet:'el comprador escaneó el carnet del carretillero',ficha:'el comprador escaneó la ficha',boton:'confirmó el comprador',vendedor:'confirmado por el vendedor'}[d.verif?.metodo]||'')+(d.verif?.carrOk===true&&d.verif?.metodo!=='carnet'?' · N° de carretillero verificado':d.verif?.carrOk===false?' · ⚠ dijo otro N° de carretillero ('+esc(d.verif.carrDicho)+')':'')}`:''}${d.estado==='reclamo'?` · ⚠ ${esc(d.reclamo||'falta mercancía')}`:''}</div></div>`}

/* ---- Inicio ---- */
let rolElegido=null;
try{const q=new URLSearchParams(location.search).get('rol');if(['vendedor','comprador'].includes(q))rolElegido=q}catch(e){}
function vInicio(){
  if(!rolElegido)return `<div class="card" style="max-width:520px;margin:0 auto"><h2>¿Cómo vas a usar CargaYa?</h2><p class="sub">Se elige una vez en este teléfono.</p>
   <div class="grid" style="margin-top:12px">${[['vendedor','🚚 Soy vendedor','Despacho mercancía desde mi camión'],['comprador','🛒 Soy comprador','Compro y la mercancía llega a mi vehículo'],['admin','📊 Administración','Zonas, carretilleros, impresión y panel (pide clave)']].map(([r,t,d])=>`<button class="btn o" style="text-align:left;padding:14px" data-rol="${r}"><div style="font-size:18px">${t}</div><div class="hint" style="font-weight:500">${d}</div></button>`).join('')}</div>
   <p class="hint" style="margin-top:12px">Los carretilleros no necesitan teléfono: solo su número.</p>
   ${ONLINE?'':'<div class="notfound" style="margin-top:14px">Modo local: falta completar config.js. Los datos no se comparten con otros teléfonos.</div>'}</div>`;
  const r=rolElegido;
  return `<div class="card" style="max-width:520px;margin:0 auto"><h2>${{vendedor:'Datos del vendedor',comprador:'Datos del comprador',admin:'Administración'}[r]}</h2>
   <form id="fYo">${r==='admin'?'<label>Clave</label><input id="yClave" type="password" inputmode="numeric" required>':`
    <label>${r==='vendedor'?'Nombre del puesto o negocio':'Nombre o negocio'}</label><input id="yNombre" required>
    <label>Teléfono (WhatsApp)</label><input id="yTel" inputmode="tel" placeholder="0414-000-0000" required>
    ${r==='comprador'?'<label>Placa de tu vehículo</label><input id="yPlaca" placeholder="Ej: AB123CD" required>':''}`}
    <div class="row" style="margin-top:16px"><button class="btn o" type="button" id="atras">Atrás</button><button class="btn y" type="submit">Entrar</button></div></form></div>`}

/* ---- Cuentas: teléfono + PIN ---- */
let modoCuenta='crear',USER=null;
function telDigitos(t){let d=String(t||'').replace(/\D/g,'');if(d.startsWith('0'))d='58'+d.slice(1);else if(d.length===10)d='58'+d;return d}
const emailDeTel=t=>telDigitos(t)+'@'+CFG.EMAIL_DOMINIO;
async function entrar(user){USER=user;const md=user.user_metadata||{};let admin=false;
  try{const r=await sb.from('admins').select('uid').eq('uid',user.id);admin=!r.error&&!!(r.data&&r.data.length)}catch(e){}
  if(admin)setME({rol:'admin',id:'admin',nombre:md.nombre||'Administración',uid:user.id});
  else if(md.rol==='vendedor')setME({rol:'vendedor',id:user.id,nombre:md.nombre||'',tel:md.tel||'',uid:user.id});
  else if(md.rol==='comprador'&&md.placa)setME({rol:'comprador',id:md.placa,nombre:md.nombre||'',tel:md.tel||'',uid:user.id});
  else setME(null);
  return admin}
async function trasEntrar(){await cargar();cargado=true;
  if(ME&&ME.rol==='vendedor'&&!S.vendedor[ME.id]){await guardar('vendedor',{id:ME.id,nombre:ME.nombre,tel:ME.tel,creado:Date.now()});try{await traerTodo(sel('config'),'config')}catch(e){}};
  rolElegido=null;render();aplicarFavPend().then(aplicarAmigo)}
async function salir(){try{await sb.auth.signOut()}catch(e){}setME(null);try{localStorage.removeItem(QKEY)}catch(e){}location.href=location.pathname}
function vLogin(){
  const r=MODULO,crear=modoCuenta==='crear'&&r!=='admin';
  return `<div class="card" style="max-width:520px;margin:0 auto"><h2>${r==='admin'?'Administración':crear?(r==='vendedor'?'Crea tu cuenta de vendedor':'Crea tu cuenta de comprador'):'Entra a tu cuenta'}</h2>
   ${r!=='admin'?`<div class="seg" style="margin:8px 0 4px">${[['crear','Soy nuevo'],['entrar','Ya tengo cuenta']].map(([k,t])=>`<button type="button" class="${modoCuenta===k?'on':''}" data-modo="${k}">${t}</button>`).join('')}</div>`:''}
   ${r==='comprador'&&favPend().length?'<div class="found" style="margin:8px 0">⭐ Te invitó un vendedor: cuando entres, quedará en tus favoritos.</div>':''}
   ${r==='comprador'&&amigoPend()?'<div class="found" style="margin:8px 0">👥 Te invitó un amigo: cuando registres tu vehículo, recibirás sus vendedores favoritos.</div>':''}
   <form id="fLogin">
    ${crear?`<label>${r==='vendedor'?'Nombre de tu puesto o negocio':'Tu nombre o negocio'}</label><input id="lNombre" required autocomplete="organization">`:''}
    <label>Teléfono</label><input id="lTel" inputmode="tel" placeholder="0414-000-0000" required autocomplete="username">
    ${crear&&r==='comprador'?'<label>Placa de tu vehículo</label><input id="lPlaca" placeholder="Ej: AB123CD" required autocapitalize="characters">':''}
    <label>${crear?'Inventa un PIN de 6 números':'PIN'}</label><input id="lPin" type="password" inputmode="numeric" ${crear?'maxlength="6" pattern="[0-9]{6}"':''} required autocomplete="${crear?'new-password':'current-password'}">
    <label style="display:flex;gap:8px;align-items:center;font-weight:500;margin-top:6px"><input type="checkbox" id="lVer" style="width:auto"> Mostrar PIN</label>
    ${crear?'<p class="hint">Anota tu PIN: lo necesitas si cambias de teléfono. Este teléfono queda con la sesión abierta.</p>':'<p class="hint">¿Olvidaste tu PIN? Pídele a la administración que te lo cambie.</p>'}
    <div id="lErr"></div>
    <button class="btn y big" type="submit" id="lGo" style="margin-top:14px">${crear?'Crear cuenta':'Entrar'}</button></form>
   ${r!=='admin'?`<p class="hint" style="margin-top:14px;text-align:center">¿Eres ${r==='vendedor'?'comprador':'vendedor'}? <a href="${LINKS[r==='vendedor'?'comprador':'vendedor']}">Entra aquí</a></p>`:''}</div>`}
function bindLogin(){
  document.querySelectorAll('[data-modo]').forEach(b=>b.onclick=()=>{modoCuenta=b.dataset.modo;render()});
  if($('lVer'))$('lVer').onchange=()=>{$('lPin').type=$('lVer').checked?'text':'password'};
  const f=$('fLogin');if(!f)return;
  f.onsubmit=async e=>{e.preventDefault();const r=MODULO,crear=modoCuenta==='crear'&&r!=='admin';const err=m=>{$('lErr').innerHTML=`<div class="notfound" style="margin-top:10px">${m}</div>`};
    const tel=$('lTel').value.trim(),pin=$('lPin').value.trim();if(telDigitos(tel).length<11)return err('Revisa el teléfono (ej: 0414-123-4567).');
    if(crear&&!/^\d{6}$/.test(pin))return err('El PIN debe tener 6 números.');if(pin.length<6)return err('El PIN tiene al menos 6 caracteres.');
    const btn=$('lGo'),txt=btn.textContent,listo=()=>{btn.disabled=false;btn.textContent=txt};btn.disabled=true;btn.textContent='Un momento…';
    try{let user;
      if(crear){const nombre=$('lNombre').value.trim();const md={rol:r,nombre,tel};
        if(r==='comprador'){const p=normPlaca($('lPlaca').value);if(p.length<6){listo();return err('Revisa la placa.')}md.placa=p}
        const {data,error}=await sb.auth.signUp({email:emailDeTel(tel),password:pin,options:{data:md}});
        if(error){const m=error.message||'';listo();
          if(/already|registered|exists/i.test(m))return err('Ese teléfono ya tiene cuenta. Toca "Ya tengo cuenta" y entra con tu PIN.');
          if(/invalid/i.test(m)&&/email/i.test(m))return err('Supabase rechazó la cuenta (email inválido). Administración: cambia EMAIL_DOMINIO en config.js.');
          return err('No se pudo crear la cuenta: '+esc(m))}
        if(!data.session){listo();return err('La cuenta se creó, pero Supabase pide confirmar el email. Administración: en Supabase desactiva "Confirm email".')}
        user=data.user}
      else{const {data,error}=await sb.auth.signInWithPassword({email:emailDeTel(tel),password:pin});
        if(error){listo();return err('Teléfono o PIN incorrecto.')}user=data.user}
      const admin=await entrar(user);
      if(!ME){await sb.auth.signOut();listo();return err('Esta cuenta no tiene un rol válido.')}
      if(r==='admin'&&!admin){await sb.auth.signOut();setME(null);listo();return err('Esta cuenta no es de administración.')}
      if(r!=='admin'&&ME.rol!==r){const rr=ME.rol;await sb.auth.signOut();setME(null);listo();return err(`Esta cuenta es de <b>${NOMBRE_MOD[rr]}</b>. <a href="${LINKS[rr]}">Ábrela en su módulo</a>.`)}
      if(crear)log(`Nueva cuenta de ${r}: ${ME.nombre}${r==='comprador'?' ('+ME.id+')':''}`);
      await trasEntrar()}
    catch(ex){listo();err('No hay conexión. Prueba de nuevo.')}}}

/* ---- Ficha abierta desde un QR (cámara normal del teléfono) ---- */
let fichaURL=null,kURL=null;
/* Invitación de un vendedor: comprador.html?v=<id> lo deja en favoritos */
const FAVP='cy-favpend';const favPend=()=>{try{return JSON.parse(localStorage.getItem(FAVP))||[]}catch(e){return []}};
try{const vv=new URLSearchParams(location.search).get('v');if(vv&&/^[\w-]{6,60}$/.test(vv)){const a=favPend();if(!a.includes(vv))a.push(vv);localStorage.setItem(FAVP,JSON.stringify(a));history.replaceState(null,'',location.pathname)}}catch(e){}
const urlInvita=v=>LINKS.comprador+'?v='+encodeURIComponent(v.id);
/* Invitación de un comprador a un amigo o vecino: comprador.html?a=<código>
   El amigo crea su cuenta y recibe los vendedores favoritos de quien lo invitó. */
const AMIGOP='cy-amigo';const amigoPend=()=>{try{return localStorage.getItem(AMIGOP)||''}catch(e){return ''}};
try{const aa=new URLSearchParams(location.search).get('a');if(aa&&/^[\w-]{6,60}$/.test(aa)){localStorage.setItem(AMIGOP,aa);history.replaceState(null,'',location.pathname)}}catch(e){}
const urlAmigo=()=>LINKS.comprador+'?a='+encodeURIComponent(ME.uid);
async function datosAmigo(cod){const r=await sb.rpc('invitacion_amigo',{codigo:cod});return r.error||!r.data?null:r.data}
async function aplicarAmigo(){const cod=amigoPend();if(!cod||!ME||ME.rol!=='comprador')return;const c=comp(ME.id);if(!c||!c.vehiculo)return;
  try{localStorage.removeItem(AMIGOP)}catch(e){}if(cod===ME.uid)return;
  let a=null;try{a=await datosAmigo(cod)}catch(e){}if(!a)return;await cargarDirectorio(true);
  const c2=S.comprador[c.id];const ya=c2.favoritos||[];const nuevos=(a.favoritos||[]).filter(id=>vend(id)&&vend(id).alDia!==false&&!ya.includes(id));
  await guardar('comprador',{...c2,favoritos:[...ya,...nuevos],referidoPor:c2.referidoPor||cod});
  if(!c2.referidoPor)log(`👥 ${c2.id} entró invitado por un amigo (${a.nombre||'comprador'})`);
  toast(nuevos.length?`👥 ${a.nombre||'Tu amigo'} te recomendó ${nuevos.length} vendedor${nuevos.length==1?'':'es'}: ya están en tus favoritos`:`👥 Entraste invitado por ${a.nombre||'un amigo'}`);view='vendC';render()}
async function aplicarFavPend(){const pend=favPend();if(!pend.length||!ME||ME.rol!=='comprador')return;const c=comp(ME.id);if(!c||!c.vehiculo)return;
  const validos=pend.filter(id=>vend(id));const nuevos=validos.filter(id=>!(c.favoritos||[]).includes(id));try{localStorage.removeItem(FAVP)}catch(e){}
  // el primer vendedor que lo invitó queda fijo de primero en sus favoritos
  const inv=c.invitadoPor||validos[0]||null;
  if(!nuevos.length&&inv===c.invitadoPor)return;await guardar('comprador',{...S.comprador[c.id],favoritos:[...(c.favoritos||[]),...nuevos],invitadoPor:inv});
  if(!nuevos.length)return;
  toast(`⭐ ${nuevos.map(id=>vend(id).nombre).join(', ')} quedó en tus favoritos`);view='vendC';render()}
try{const sp=new URLSearchParams(location.search);const f=sp.get('f'),k=sp.get('k');if(f)fichaURL=parseCodigo('F:'+f);if(k)kURL=parseCodigo('K:'+k)}catch(e){}
function despDeFicha(p){return L('despacho').filter(d=>d.ficha&&d.ficha.num===p.num&&(!d.ficha.cod||!p.cod||d.ficha.cod===p.cod)).sort((a,b)=>b.t.creado-a.t.creado)[0]}
function vFichaURL(){const p=fichaURL;const d=despDeFicha(p);
  const cerrar='<button class="btn o" id="fuCerrar" style="width:100%;margin-top:10px">Ir a la app</button>';
  if(!cargado)return `<div class="card empty">Buscando la ficha ${esc(p.num)}…</div>`;
  if(!d)return `<div class="card" style="max-width:520px;margin:0 auto"><h2>Ficha ${esc(p.num)}</h2><p class="sub">Esta ficha todavía no está asociada a ningún despacho.</p>${cerrar}</div>`;
  const v=vend(d.vendedor),k=carr(d.carretillero);
  const esMio=ME&&ME.rol==='comprador'&&ME.id===d.placa;
  return `<div class="card" style="max-width:520px;margin:0 auto"><h2>Ficha ${esc(p.num)}</h2>
   <div class="item" style="margin-top:8px"><div class="top"><b>${tituloItems(d)}</b>${chip(d.estado)}</div>${htmlItems(d)}
    <div class="meta">De <b>${esc(v?.nombre||'')}</b> · Para <span class="plate">${esc(d.placa)}</span>${k?` · Carretillero #${esc(k.num)} ${esc(k.nombre||'')}`:''}</div></div>
   ${d.estado==='en_ruta'?(esMio?`<p class="sub" style="margin-top:12px">Revisa la mercancía y confirma.</p>
      <button class="btn g big" id="fuOk">Recibí ${d.bultos} bultos completos</button>
      <label>¿Falta algo? Escribe qué</label><input id="fuRecl" placeholder="Ej: llegaron 5 bultos, faltó 1"><button class="btn o" id="fuMal" style="width:100%;margin-top:8px">Reportar faltante</button>`
      :`<div class="notfound" style="margin-top:12px">${ME&&ME.rol==='comprador'?`Esta ficha es para el vehículo ${esc(d.placa)}, no para el tuyo (${esc(ME.id)}).`:`Para confirmar, entra a la app como comprador con la placa ${esc(d.placa)} y vuelve a escanear la ficha.`}</div>`)
    :`<div class="found" style="margin-top:12px">${d.estado==='entregado'?`Ya fue recibida a las ${hhmm(d.t.entregado)}.`:'Tiene un reclamo registrado.'}</div>`}${cerrar}</div>`}
function bindFichaURL(){const salir=()=>{fichaURL=null;try{history.replaceState(null,'',location.pathname)}catch(e){}render()};
  if($('fuCerrar'))$('fuCerrar').onclick=salir;
  const d=despDeFicha(fichaURL);
  if($('fuOk'))$('fuOk').onclick=async()=>{await confirmar(d,'ficha');salir()};
  if($('fuMal'))$('fuMal').onclick=async()=>{await reclamar(d,$('fuRecl').value.trim());salir()}}
async function confirmar(d,metodo,extra){await guardar('despacho',{...d,estado:'entregado',t:{...d.t,entregado:Date.now()},verif:{metodo,...(extra||{})}});log(`${nro(d)} recibido en ${d.placa} (${metodo==='vendedor'?'lo confirmó el vendedor':metodo==='carnet'?'el comprador escaneó el carnet #'+extra.carrDicho:'confirmó el comprador'}${extra?.carrOk===true&&metodo!=='carnet'?', N° de carretillero correcto':extra?.carrOk===false?', ⚠ N° de carretillero distinto':''})`);toast('Recepción confirmada ✓')}
async function reclamar(d,txt){await guardar('despacho',{...d,estado:'reclamo',reclamo:txt||'falta mercancía',t:{...d.t,reclamo:Date.now()}});log(`⚠ ${d.placa} reportó un faltante en ${nro(d)}: ${txt||'sin detalle'}`);toast('Se avisó al vendedor')}

/* ---- Plano sin GPS: posiciones marcadas tocando el mapa ---- */
const zonaPorNombre=n=>zonasActivas().find(z=>z.nombre===n);
function posComp(c){if(!c)return null;if(tienePos(c))return [c.px,c.py];const z=zonaPorNombre(c.zona);return zEn(z)?[z.x,z.y]:null}
const posVend=v=>{if(!v)return null;if(tienePos(v))return [v.px,v.py];const z=zonaPorNombre(v.sector);return zEn(z)?[z.x,z.y]:null};
// Red de pasillos: se cortan los cruces y se busca el camino más corto (respetando un solo sentido si lo hay)
function redPasillos(){const ps=planoCfg().pasillos||[];const key=JSON.stringify(ps);if(redPasillos.k===key)return redPasillos.g;
  const segs=[];ps.forEach(p=>{for(let i=0;i+1<(p.pts||[]).length;i++)segs.push({a:p.pts[i],b:p.pts[i+1],uno:p.sentido==='uno',ts:[0,1]})});
  const proj=(q,s)=>{const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],L2=dx*dx+dy*dy||1;const t=Math.max(0,Math.min(1,((q[0]-s.a[0])*dx+(q[1]-s.a[1])*dy)/L2));return {t,x:s.a[0]+t*dx,y:s.a[1]+t*dy,d:Math.hypot(q[0]-s.a[0]-t*dx,q[1]-s.a[1]-t*dy)}};
  for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const s=segs[i],r=segs[j];
    const d1=[s.b[0]-s.a[0],s.b[1]-s.a[1]],d2=[r.b[0]-r.a[0],r.b[1]-r.a[1]],den=d1[0]*d2[1]-d1[1]*d2[0];
    if(Math.abs(den)>1e-9){const t=((r.a[0]-s.a[0])*d2[1]-(r.a[1]-s.a[1])*d2[0])/den,u=((r.a[0]-s.a[0])*d1[1]-(r.a[1]-s.a[1])*d1[0])/den;
      if(t>0.001&&t<0.999&&u>0.001&&u<0.999){s.ts.push(t);r.ts.push(u)}}
    // uniones en T: un extremo que queda a menos de 14 unidades de otro pasillo se conecta
    [[s,r],[r,s]].forEach(([x,y])=>[x.a,x.b].forEach(q=>{const k=proj(q,y);if(k.d<14&&k.t>0.001&&k.t<0.999)y.ts.push(k.t)}))}
  const nodes=[],E=[];const nodo=(x,y)=>{for(let i=0;i<nodes.length;i++)if(Math.hypot(nodes[i][0]-x,nodes[i][1]-y)<14)return i;nodes.push([x,y]);return nodes.length-1};
  segs.forEach(s=>{const ts=[...new Set(s.ts.map(t=>Math.round(t*1e4)/1e4))].sort((a,b)=>a-b);let prev=null;
    ts.forEach(t=>{const n=nodo(s.a[0]+t*(s.b[0]-s.a[0]),s.a[1]+t*(s.b[1]-s.a[1]));if(prev!=null&&prev!==n)E.push({u:prev,v:n,uno:s.uno,w:Math.hypot(nodes[n][0]-nodes[prev][0],nodes[n][1]-nodes[prev][1])});prev=n})});
  redPasillos.k=key;redPasillos.g={nodes,E,proj};return redPasillos.g}
function caminoCorto(nodes,E,ini,fin,dirigido){const n=nodes.length,dist=Array(n).fill(Infinity),prev=Array(n).fill(-1),hecho=Array(n).fill(false);const ady=Array.from({length:n},()=>[]);
  E.forEach(e=>{ady[e.u].push([e.v,e.w]);if(!e.uno||!dirigido)ady[e.v].push([e.u,e.w])});dist[ini]=0;
  for(;;){let u=-1;for(let i=0;i<n;i++)if(!hecho[i]&&dist[i]<Infinity&&(u<0||dist[i]<dist[u]))u=i;if(u<0||u===fin)break;hecho[u]=true;ady[u].forEach(([v,w])=>{if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u}})}
  if(dist[fin]===Infinity)return null;const cam=[];for(let u=fin;u>=0;u=prev[u])cam.unshift(u);return cam}
function rutaXY(a,b){const ini=a||[VZ.cx,VZ.cy];const g=redPasillos();if(!g.E.length)return [ini,b];
  // se engancha cada extremo al tramo de pasillo más cercano (nodo temporal)
  const pegar=(q,nodes,E)=>{let best=null;E.forEach((e,i)=>{const k=g.proj(q,{a:nodes[e.u],b:nodes[e.v]});if(!best||k.d<best.k.d)best={k,e}});
    const id=nodes.length;nodes.push([best.k.x,best.k.y]);E.push({u:best.e.u,v:id,uno:best.e.uno,w:best.k.t*best.e.w},{u:id,v:best.e.v,uno:best.e.uno,w:(1-best.k.t)*best.e.w});return id};
  const nodes=g.nodes.slice(),E=g.E.slice();const s=pegar(ini,nodes,E),t=pegar(b,nodes,E);
  const cam=caminoCorto(nodes,E,s,t,true)||caminoCorto(nodes,E,s,t,false);if(!cam)return [ini,b];
  const pts=[ini,...cam.map(i=>nodes[i]),b];return pts.filter((q,i)=>i===0||Math.hypot(q[0]-pts[i-1][0],q[1]-pts[i-1][1])>1)}
function svgXY(svg,ev){const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const r=pt.matrixTransform(svg.getScreenCTM().inverse());return {x:Math.round(r.x),y:Math.round(r.y)}}
function planoSVG(o={}){
  let vb=VB0;const ruta=o.ruta&&o.dest?rutaXY(o.ruta,o.dest):null;if(ruta&&o.zoom)o={...o,zoom:[...o.zoom.filter(Boolean),...ruta]};
  if(o.zoom&&o.zoom.length){const xs=o.zoom.map(q=>q[0]),ys=o.zoom.map(q=>q[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    let w=Math.max(x1-x0+160,o.minW||380),h=Math.max(y1-y0+160,260);if(w/h<1.35)w=h*1.35;else h=w/1.35;vb=`${f1((x0+x1)/2-w/2)} ${f1((y0+y1)/2-h/2)} ${f1(w)} ${f1(h)}`}
  let s=`<svg class="map" ${o.id?`id="${o.id}"`:''} viewBox="${vb}" role="img" aria-label="Plano del Mercado Mayor de Coche" ${o.pick?'style="cursor:crosshair;touch-action:manipulation"':''}>${baseSVG()}`;
  zonasActivas().filter(zEn).forEach(z=>{const hl=o.zonaHL&&z.nombre===o.zonaHL,w=Math.max(30,12+z.nombre.length*6.2);
    s+=`<g transform="translate(${z.x} ${z.y})" opacity="${o.zonaHL&&!hl?.55:1}"><rect x="${-w/2}" y="-10" width="${w}" height="20" rx="5" fill="${hl?'#16181c':'#12a150'}" stroke="#fff" stroke-width="2"/><text y="4.5" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="12" fill="${hl?'#ffc400':'#fff'}">${esc(z.nombre)}</text></g>`});
  if(o.todos){compradoresActivos().forEach(c=>{const q=posComp(c);if(!q)return;const enc=(RES&&ME&&ME.rol==='admin'?RES.enRuta:idx().er).has(c.id);
    s+=`<circle cx="${q[0]}" cy="${q[1]+(tienePos(c)?0:16)}" r="6" fill="${enc?'#f07b14':'#16181c'}" stroke="#fff" stroke-width="2"><title>${esc(c.id)} · ${esc(c.vehiculo||'')}</title></circle>`});
    L('vendedor').forEach(v=>{const q=posVend(v);if(q)s+=`<g transform="translate(${q[0]} ${q[1]}) rotate(${ANG})"><rect x="-13" y="-7" width="26" height="14" rx="3" fill="#16181c"/><title>${esc(v.nombre)}</title></g>`})}
  if(o.extra)s+=o.extra;
  if(ruta){const r=ruta;s+=`<polyline points="${r.map(q=>f1(q[0])+','+f1(q[1])).join(' ')}" fill="none" stroke="#e0362c" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" class="route"/>`}
  if(o.yo){const q=o.yo;s+=`<g transform="translate(${f1(q[0])} ${f1(q[1])})"><circle r="24" fill="#1f6feb" fill-opacity=".15"/><circle r="9" fill="#1f6feb" stroke="#fff" stroke-width="3"/><text y="26" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="13" fill="#1f6feb" stroke="#fff" stroke-width="3" paint-order="stroke">TÚ</text></g>`}
  if(o.camion){const q=o.camion;s+=`<g transform="translate(${q[0]} ${q[1]})"><g transform="rotate(${ANG})"><rect x="-16" y="-9" width="32" height="18" rx="3" fill="#ffc400" stroke="#16181c" stroke-width="2"/></g><text y="-14" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="13" fill="#16181c" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(o.camionTxt||'CAMIÓN')}</text></g>`}
  if(o.dest){const q=o.dest;s+=`<circle cx="${q[0]}" cy="${q[1]}" r="20" fill="none" stroke="#e0362c" stroke-width="3" class="pulse"/><circle cx="${q[0]}" cy="${q[1]}" r="9" fill="#e0362c" stroke="#fff" stroke-width="3"/>${o.destTxt?`<text x="${q[0]}" y="${q[1]+38}" text-anchor="middle" font-family="Share Tech Mono" font-size="14" fill="#16181c" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(o.destTxt)}</text>`:''}`}
  s+='</svg>';
  return `<div class="mapwrap">${s}${o.nota?`<div class="legend">${o.nota}</div>`:''}</div>`}

/* ---- Panel ---- */
function vMercado(){
  const ds=L('despacho').filter(d=>d.t&&d.t.creado>=inicioDia(0)),ent=ds.filter(d=>d.estado==='entregado'&&d.t.entregado);
  const prom=ent.length?Math.round(ent.reduce((a,d)=>a+(d.t.entregado-d.t.creado),0)/ent.length/60000):0;
  const zs=[...new Set([...nombresZona(),...compradoresActivos().map(c=>c.zona).filter(Boolean)])];
  const zonaDe={};compradoresActivos().forEach(c=>zonaDe[c.id]=c.zona||'Sin zona');const porZona={};ds.forEach(d=>{const z=zonaDe[d.placa]||S.comprador[d.placa]?.zona||'Sin zona';(porZona[z]=porZona[z]||[]).push(d)});
  const fila=z=>{const cs=compradoresActivos().filter(c=>(c.zona||'Sin zona')===z).map(c=>c.id);const dz=porZona[z]||[];
    return `<tr><td><b>${esc(z)}</b></td><td>${cs.length}</td>${(()=>{const r=RES&&ME.rol==='admin'?(RES.zonas[z]||{}):null;return r?`<td>${r.en_ruta||0}</td><td>${r.entregados||0}</td><td>${r.reclamos||0}</td>`:`<td>${dz.filter(d=>d.estado==='en_ruta').length}</td><td>${dz.filter(d=>d.estado==='entregado').length}</td><td>${dz.filter(d=>d.estado==='reclamo').length}</td>`})()}</tr>`};
  return `<div class="grid"><div class="kpis">
   <div class="kpi"><b>${RES?RES.total:ds.length}</b><span>Despachos hoy</span></div>
   <div class="kpi"><b>${RES?RES.entregados:ent.length}</b><span>Recibidos y confirmados</span></div>
   <div class="kpi"><b>${RES?RES.en_ruta:ds.filter(d=>d.estado==='en_ruta').length}</b><span>En camino o sin confirmar</span></div>
   <div class="kpi"><b>${RES?RES.prom_min:prom} min</b><span>Promedio hasta confirmar</span></div>
   <div class="kpi"><b>${RES?RES.reclamos:ds.filter(d=>d.estado==='reclamo').length}</b><span>Reclamos</span></div></div>
  ${planoSVG({todos:true,nota:'<span><i style="background:#16181c;border-radius:50%"></i>Vehículo</span><span><i style="background:#f07b14;border-radius:50%"></i>Mercancía en camino</span><span><i style="background:#12a150"></i>Zona</span><span><i style="background:#16181c"></i>Camión vendedor</span>'})}
  <div class="grid g2"><div class="card"><h2>Por zona</h2>
    <table class="tz"><tr><th>Zona</th><th>Vehículos</th><th>En camino</th><th>Recibidos</th><th>Reclamos</th></tr>${zs.map(fila).join('')}${compradoresActivos().some(c=>!c.zona)?fila('Sin zona'):''}</table>
    ${zs.length?'':'<div class="empty">Todavía no hay zonas. Cárgalas en la pestaña Zonas.</div>'}</div>
   <div class="card"><h2>Actividad</h2><p class="sub">Cada paso queda registrado con la hora.</p>
    <div class="log">${S.log.map(l=>`<div><time>${hhmm(l.t)}</time>${esc(l.m)}</div>`).join('')||'<div class="empty">Sin actividad todavía</div>'}</div></div></div>
  <div class="card"><h2>Despachos</h2><div class="list">${ds.sort((a,b)=>b.t.creado-a.t.creado).slice(0,150).map(d=>itemDesp(d)+(d.archivado?'<div class="hint" style="margin-top:-6px">Archivado por el vendedor</div>':'')).join('')||'<div class="empty">Todavía no hay despachos</div>'}</div></div></div>
  <div class="grid g2"><div class="card"><h2>Respaldo</h2><p class="sub">Descarga un Excel con una hoja por tema: vendedores, compradores, carretilleros, pagos de mensualidad, zonas y los despachos de los últimos 7 días. Guárdalo en tu computadora una vez por semana.</p>
    <button class="btn y" id="admResp" style="width:100%">⬇ Descargar respaldo en Excel</button>
    <button class="btn o" id="admRespJ" style="width:100%;margin-top:8px">Copia técnica (.json, para restaurar datos)</button></div>
   <div class="card"><h2>Cambiar PIN de un usuario</h2><p class="sub">Para quien olvidó su PIN. Escribe su teléfono y un PIN nuevo de 6 números, y díselo por WhatsApp.</p>
    <div class="row"><div><label>Teléfono</label><input id="admPinTel" inputmode="tel" placeholder="0414-000-0000"></div><div><label>PIN nuevo</label><input id="admPinNuevo" inputmode="numeric" maxlength="6" placeholder="6 números"></div></div>
    <button class="btn o" id="admPinOk" style="width:100%;margin-top:10px">Cambiar PIN</button></div></div>
  <div class="card"><h2>Administradores</h2><p class="sub">Tienen acceso total a este módulo. Para agregar a alguien que ya tiene cuenta (de vendedor o comprador) basta su teléfono; si no tiene cuenta, escribe también un PIN para crearla.</p>
   <div class="list">${(ADMS||[]).map(a=>`<div class="row" style="align-items:center"><div>👤 <b>${esc(a.nombre||'Administrador')}</b> <span class="hint">· ${esc(fmtTel(a.tel))}${a.soy?' · tú':''}</span></div>${a.soy?'':`<button class="btn o" style="flex:0 0 auto" data-admdel="${esc(a.uid)}">Quitar</button>`}</div>`).join('')||'<div class="hint">Cargando…</div>'}</div>
   <div class="row" style="margin-top:10px"><div><label>Teléfono</label><input id="admNuevoTel" inputmode="tel" placeholder="0414-000-0000"></div><div style="flex:0 0 120px"><label>PIN (si es nueva)</label><input id="admNuevoPin" inputmode="numeric" maxlength="6" placeholder="6 números"></div></div>
   <button class="btn y" id="admNuevoOk" style="width:100%;margin-top:10px">Agregar administrador</button></div></div>`}
let ADMS=null;async function cargarAdmins(){if(!ONLINE||!ME||ME.rol!=='admin')return;const r=await sb.rpc('admins_lista');if(!r.error){ADMS=r.data;pedirRender()}}
const fmtTel=d=>{d=String(d||'');const m=/^58(\d{3})(\d{7})$/.exec(d);return m?`0${m[1]}-${m[2].slice(0,3)}-${m[2].slice(3)}`:'+'+d};


/* ---- Zonas ---- */
let zonaUbicando=null,zonaDib=null,dibPts=[],plEdit=null;
const TIPOS_ZONA=[['compradores','Estacionamiento de compradores'],['vendedores','Camiones de vendedores'],['puestos','Puestos'],['otro','Otro']];
const centroide=ps=>[Math.round(ps.reduce((a,p)=>a+p[0],0)/ps.length),Math.round(ps.reduce((a,p)=>a+p[1],0)/ps.length)];
function trazoSVG(ps,cerrar,color){if(!ps.length)return '';return `${ps.length>1?`<${cerrar&&ps.length>2?'polygon':'polyline'} points="${ps.map(q=>q.join(',')).join(' ')}" fill="${cerrar&&ps.length>2?color:'none'}" fill-opacity=".35" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>`:''}${ps.map((q,i)=>`<circle cx="${q[0]}" cy="${q[1]}" r="${i===ps.length-1?7:5}" fill="${color}" stroke="#fff" stroke-width="2"/>`).join('')}`}
function vZonas(){const ns=nombresZona();const pl=planoCfg();
  if(zonaUbicando){const z=S.zona[zonaUbicando];return `<div class="card"><h2>Centro de "${esc(z.nombre)}"</h2><p class="sub">Toca en el plano el centro de esa zona (ahí se ubica el vehículo de quien elige la zona). Puedes tocar otra vez para corregir.</p>
    ${planoSVG({id:'zPick',pick:true,dest:zEn(z)?[z.x,z.y]:null,destTxt:z.nombre})}
    <div class="row" style="margin-top:10px"><button class="btn y" id="zListo">Listo</button></div></div>`}
  if(zonaDib){const z=S.zona[zonaDib];return `<div class="card"><h2>Área de "${esc(z.nombre)}"</h2><p class="sub">Toca las esquinas de la zona una por una, siguiendo el borde. Con 3 o más puntos queda cerrada.</p>
    ${planoSVG({id:'zDib',pick:true,extra:trazoSVG(dibPts,true,'#1f6feb')})}
    <div class="row" style="margin-top:10px"><button class="btn o" id="dDeshacer" ${dibPts.length?'':'disabled'}>↶ Deshacer punto</button><button class="btn o" id="dCancelar">Cancelar</button><button class="btn y" id="dListo" ${dibPts.length>2?'':'disabled'}>Guardar área (${dibPts.length} puntos)</button></div></div>`}
  if(plEdit){const ent=plEdit.tipo==='entrada';return `<div class="card"><h2>${ent?'Marcar entrada':'Dibujar pasillo'}: "${esc(plEdit.nombre)}"</h2>
    <p class="sub">${ent?'Toca en el plano dónde está la entrada o portón.':`Toca los puntos del recorrido en orden${plEdit.sentido==='uno'?' (en el sentido en que se circula)':''}. Para que se conecte con otro pasillo, empieza o termina encima de él.`}</p>
    ${planoSVG({id:'plPick',pick:true,extra:trazoSVG(plEdit.pts,false,ent?'#7b3fe4':'#e0362c')})}
    <div class="row" style="margin-top:10px">${ent?'':`<button class="btn o" id="plDeshacer" ${plEdit.pts.length?'':'disabled'}>↶ Deshacer punto</button>`}<button class="btn o" id="plCancelar">Cancelar</button><button class="btn y" id="plListo" ${(ent?plEdit.pts.length===1:plEdit.pts.length>1)?'':'disabled'}>Guardar</button></div></div>`}
  return `<div class="grid g2"><div class="card"><h2>Zonas y sectores</h2>
   <p class="sub">Escribe los nombres que usa la gente para cada parte del mercado: dónde estacionan los compradores (ej: "Detrás del Barco", "La bomba"), dónde se ponen los camiones y dónde están los puestos (ej: "Zona de la cebolla"). Dibuja el área de cada una en el plano y marca su centro.</p>
   <div class="row"><div><label>Nombre de la zona</label><input id="zNombre" placeholder="Ej: Detrás del Barco" autocomplete="off"></div><button class="btn y" style="flex:0 0 auto;align-self:flex-end" id="zGuardar">Agregar</button></div></div>
   <div class="card"><h2>${ns.length} zonas</h2><div class="list">${ns.map(n=>{const z=zonasActivas().find(x=>x.nombre===n);const veh=compradoresActivos().filter(c=>c.zona===n).length;const area=z.pv===PV&&z.poly&&z.poly.length>2;
     return `<div class="item"><div class="top"><b style="font-size:19px">${esc(n)}</b><span class="hint">${veh} vehículo${veh===1?'':'s'} ahora</span></div>
      <select data-ztipo="${esc(z.id)}" style="margin-top:6px">${TIPOS_ZONA.map(([k,t])=>`<option value="${k}" ${(z.tipo||'compradores')===k?'selected':''}>${t}</option>`).join('')}</select>
      <div class="row" style="flex-wrap:wrap;margin-top:6px"><button class="btn ${area?'o':'y'}" data-zdib="${esc(z.id)}">✏️ ${area?'Redibujar área':'Dibujar área'}</button><button class="btn ${zEn(z)?'o':'y'}" data-zmap="${esc(z.id)}">📍 ${zEn(z)?'Mover centro':'Marcar centro'}</button><button class="btn o" style="flex:0 0 auto" data-zdel="${esc(z.id)}">Quitar</button></div></div>`}).join('')||'<div class="empty">Todavía no hay zonas</div>'}</div></div>
   <div class="card"><h2>Entradas y portones</h2><p class="sub">Aparecen en el plano en morado.</p>
    <div class="list">${(pl.entradas||[]).map(e=>`<div class="row" style="align-items:center"><div>🚪 <b>${esc(e.nombre)}</b></div><button class="btn o" style="flex:0 0 auto" data-eedit="${esc(e.id)}">Mover</button><button class="btn o" style="flex:0 0 auto" data-edel="${esc(e.id)}">Quitar</button></div>`).join('')||'<div class="empty">Sin entradas</div>'}</div>
    <div class="row" style="margin-top:8px"><div><label>Nueva entrada</label><input id="eNombre" placeholder="Ej: Portón Calle Zea" autocomplete="off"></div><button class="btn y" style="flex:0 0 auto;align-self:flex-end" id="eAgregar">Marcar en el plano</button></div></div>
   <div class="card"><h2>Pasillos y calles internas</h2><p class="sub">Por aquí se calculan las rutas que ve el carretillero. Si un pasillo es de un solo sentido, dibújalo en el sentido de circulación.</p>
    <div class="list">${(pl.pasillos||[]).map(q=>`<div class="row" style="align-items:center"><div>🛣 <b>${esc(q.nombre)}</b>${q.sentido==='uno'?' <span class="hint">· un solo sentido</span>':''}</div><button class="btn o" style="flex:0 0 auto" data-pedit="${esc(q.id)}">Redibujar</button><button class="btn o" style="flex:0 0 auto" data-pdel="${esc(q.id)}">Quitar</button></div>`).join('')||'<div class="empty">Sin pasillos: las rutas se muestran en línea recta</div>'}</div>
    <div class="row" style="margin-top:8px"><div><label>Nuevo pasillo</label><input id="pNombre" placeholder="Ej: Pasillo de la cebolla" autocomplete="off"></div><div style="flex:0 0 140px"><label>Sentido</label><select id="pSentido"><option value="doble">Doble sentido</option><option value="uno">Un solo sentido</option></select></div></div>
    <button class="btn y" id="pAgregar" style="width:100%;margin-top:8px">Dibujar en el plano</button>
    ${S.config.plano?`<button class="btn o" id="plReset" style="width:100%;margin-top:8px">Volver a las entradas y pasillos iniciales</button>`:''}</div>
   <div style="grid-column:1/-1">${planoSVG({nota:'<span><i style="background:#7b3fe4"></i>Entrada</span><span><i style="background:#d3cfc2"></i>Pasillo</span><span><i style="background:#e0ecff"></i>Compradores</span><span><i style="background:#fff3c4"></i>Camiones</span><span><i style="background:#f2dfc2"></i>Puestos</span><span><i style="background:#12a150"></i>Centro de zona</span>'})}</div></div>`}
async function guardarPlano(cambio,msg){const pl=JSON.parse(JSON.stringify(planoCfg()));cambio(pl);pl.id='plano';pl.v=PV;await guardar('config',pl);if(msg)log(msg);render()}

/* ---- Uso de la app (administración): métricas calculadas en el servidor ---- */
let MET=null,metT=0,metCargando=false,metErr='',usoQ='',usoTab='compradores',usoOrden='d30';
async function cargarMetricas(forzar){if(!ONLINE||metCargando||(!forzar&&MET&&Date.now()-metT<120000))return;metCargando=true;metErr='';pedirRender();
  const r=await sb.rpc('metricas_admin');metCargando=false;if(r.error){metErr='No se pudieron calcular las métricas. Revisa la conexión.'}else{MET=r.data;metT=Date.now()}pedirRender()}
const pct=(a,b)=>b?Math.round(a*100/b)+' %':'—';
const fmtN=n=>Number(n||0).toLocaleString('es-VE');
const fFecha=t=>t?fmtFecha(+t):'—';
// Gráfico de barras simple (SVG) para una serie diaria o semanal
function barras(serie,campo,color,etq){const W=640,H=150,pad=28,n=serie.length;if(!n)return '<div class="empty">Sin datos todavía</div>';
  const max=Math.max(1,...serie.map(x=>+x[campo]||0));const bw=(W-pad-6)/n;
  return `<svg viewBox="0 0 ${W} ${H+24}" style="width:100%;height:auto;display:block">
   <text x="${pad}" y="12" font-size="11" fill="#7c8089">${esc(etq)} · máx. ${fmtN(max)}</text>
   ${serie.map((x,i)=>{const v=+x[campo]||0,hh=Math.round(v/max*H);const X=pad+i*bw;return `<rect x="${f1(X+1)}" y="${H+16-hh}" width="${f1(Math.max(1,bw-2))}" height="${hh}" rx="2" fill="${color}"><title>${esc((x.d||x.s).split('-').reverse().join('/'))}: ${fmtN(v)}</title></rect>${(n<=16||i%5===0)?`<text x="${f1(X+bw/2)}" y="${H+24}" font-size="9" fill="#7c8089" text-anchor="middle">${(x.d||x.s).slice(5).split('-').reverse().join('/')}</text>`:''}`}).join('')}</svg>`}
function kpi(v,t,sub){return `<div class="kpi"><b>${v}</b><span>${t}</span>${sub?`<small style="display:block;color:var(--mute);font-size:11.5px;margin-top:2px">${sub}</small>`:''}</div>`}
function vUso(){if(!MET&&!metCargando&&!metErr)cargarMetricas();
  if(!MET)return `<div class="card empty">${metErr?`<span class="bad">${esc(metErr)}</span><br><button class="btn o" id="usoRef" style="margin-top:10px">Reintentar</button>`:'Calculando métricas…'}</div>`;
  const C=MET.compradores,V=MET.vendedores,D=MET.despachos,P=MET.pagos;const q=normTxt(usoQ);
  const ord={d30:(a,b)=>b.d30-a.d30,total:(a,b)=>b.total-a.total,ultimo:(a,b)=>(b.ultimo||0)-(a.ultimo||0),nombre:(a,b)=>(a.nombre||'').localeCompare(b.nombre||'')}[usoOrden]||(()=>0);
  const lc=MET.compradores_det.filter(c=>!q||normTxt((c.nombre||'')+' '+c.id+' '+(c.zona||'')).includes(q)).sort(ord);
  const lv=MET.vendedores_det.filter(v=>!q||normTxt((v.nombre||'')+' '+(v.sector||'')+' '+(v.productos||'')).includes(q)).sort(ord);
  const sinUso=MET.compradores_det.filter(c=>!c.total).length;
  return `<div class="grid">
   <div class="card"><div class="top" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h2>Uso real de la app</h2>
     <span class="hint">Calculado ${hhmm(MET.generado)} · <a href="#" id="usoRef">${metCargando?'actualizando…':'actualizar'}</a> · <a href="#" id="usoXls">⬇ Excel</a></span></div>
    <h3 style="margin:10px 0 6px">Compradores</h3>
    <div class="kpis">${kpi(fmtN(C.total),'Registrados',`+${fmtN(C.nuevos_30d)} en 30 días · +${fmtN(C.nuevos_7d)} en 7`)}${kpi(fmtN(C.con_despacho_30d),'Recibieron mercancía (30 d)',pct(C.con_despacho_30d,C.total)+' de los registrados')}${kpi(fmtN(C.activos_ahora),'En el mercado ahora','')}${kpi(fmtN(C.con_despacho_total),'Usaron la app alguna vez',`${fmtN(sinUso)} nunca recibieron un despacho`)}${kpi(fmtN(C.invitados_vendedor+C.invitados_amigo),'Llegaron por invitación',`${fmtN(C.invitados_vendedor)} de vendedores · ${fmtN(C.invitados_amigo)} de amigos`)}${kpi(fmtN(C.con_favoritos),'Con vendedores favoritos',pct(C.con_favoritos,C.total))}</div>
    <h3 style="margin:14px 0 6px">Vendedores</h3>
    <div class="kpis">${kpi(fmtN(V.total),'Registrados',`+${fmtN(V.nuevos_30d)} en 30 días`)}${kpi(fmtN(V.con_despacho_7d),'Despacharon esta semana',pct(V.con_despacho_7d,V.total))}${kpi(fmtN(V.con_despacho_30d),'Despacharon en 30 días',pct(V.con_despacho_30d,V.total))}${kpi(fmtN(V.al_dia),'Pueden despachar (al día o en prueba)',`${fmtN(V.pagaron_alguna_vez)} pagaron alguna vez`)}${kpi(fmtN(V.carretilleros_activos),'Carretilleros activos','')}${kpi(fmtN(P.aprobados_30d),'Mensualidades cobradas (30 d)',`US$ ${fmtN(P.monto_usd_30d)} · ${fmtN(P.pendientes)} por aprobar`)}</div>
    <h3 style="margin:14px 0 6px">Despachos</h3>
    <div class="kpis">${kpi(fmtN(D.hoy),'Hoy','')}${kpi(fmtN(D.d7),'Últimos 7 días','')}${kpi(fmtN(D.d30),'Últimos 30 días',`${fmtN(D.bultos_30d)} bultos`)}${kpi(pct(D.confirmados_30d,D.d30),'Confirmados por el comprador (30 d)',`${pct(D.por_carnet_30d,D.d30)} escaneando la credencial · ${pct(D.por_vendedor_30d,D.d30)} de palabra`)}${kpi(pct(D.reclamos_30d,D.d30),'Con reclamo (30 d)',fmtN(D.reclamos_30d)+' reclamos')}${kpi(D.prom_min_30d+' min','Del despacho a la confirmación','promedio 30 días')}</div></div>
   <div class="grid g2">
    <div class="card"><h2>Despachos por día · 30 días</h2>${barras(MET.por_dia,'despachos','#1f6feb','Despachos')}</div>
    <div class="card"><h2>Compradores que recibieron por día · 30 días</h2>${barras(MET.por_dia,'compradores','#12a150','Compradores distintos')}</div>
    <div class="card"><h2>Despachos por semana · 16 semanas</h2>${barras(MET.por_semana,'despachos','#1f6feb','Despachos')}</div>
    <div class="card"><h2>Compradores nuevos por semana · 16 semanas</h2>${barras(MET.por_semana,'nuevos_compradores','#b08a1a','Registros nuevos')}<p class="hint">Vendedores activos por semana: ${MET.por_semana.slice(-4).map(x=>fmtN(x.vendedores_activos)).join(' · ')} (últimas 4)</p></div></div>
   <div class="card"><div class="seg" style="margin-bottom:10px"><button type="button" class="${usoTab==='compradores'?'on':''}" data-usotab="compradores">Por comprador (${fmtN(MET.compradores_det.length)})</button><button type="button" class="${usoTab==='vendedores'?'on':''}" data-usotab="vendedores">Por vendedor (${fmtN(MET.vendedores_det.length)})</button></div>
    <div class="row"><input id="usoQ" placeholder="🔍 Buscar…" value="${esc(usoQ)}" autocomplete="off"><div style="flex:0 0 170px"><select id="usoOrden">${[['d30','Más activos (30 d)'],['total','Más despachos (total)'],['ultimo','Último despacho'],['nombre','Nombre']].map(([k,t])=>`<option value="${k}" ${usoOrden===k?'selected':''}>${t}</option>`).join('')}</select></div></div>
    <div style="overflow-x:auto;margin-top:10px"><table class="tz" style="min-width:900px">${usoTab==='compradores'
      ?`<thead><tr><th>Comprador</th><th>Zona</th><th>Registrado</th><th>Último despacho</th><th>Días con compras</th><th>7 d</th><th>30 d</th><th>Total</th><th>Vendedores</th><th>Confirmó</th><th>Reclamos</th><th>Llegó por</th></tr></thead>
       <tbody>${lc.slice(0,300).map(c=>`<tr><td><span class="plate" style="font-size:13px">${esc(c.id)}</span> ${esc(c.nombre||'')}</td><td>${esc(c.zona||'')}</td><td>${fFecha(c.creado)}</td><td>${c.ultimo?fmtFecha(+c.ultimo)+' '+hhmm(+c.ultimo):'nunca'}</td><td>${fmtN(c.dias_activo)}</td><td>${fmtN(c.d7)}</td><td>${fmtN(c.d30)}</td><td>${fmtN(c.total)}</td><td>${fmtN(c.vendedores)}</td><td>${pct(c.confirmados,c.total)}</td><td>${fmtN(c.reclamos)}</td><td>${c.invitado==='vendedor'?'⭐ vendedor':c.invitado==='amigo'?'👥 amigo':'—'}</td></tr>`).join('')}</tbody>`
      :`<thead><tr><th>Vendedor</th><th>Sector</th><th>Registrado</th><th>Mensualidad</th><th>Carretilleros</th><th>Último despacho</th><th>Días activo</th><th>Hoy</th><th>7 d</th><th>30 d</th><th>Total</th><th>Compradores</th><th>Reclamos</th><th>Invitó</th></tr></thead>
       <tbody>${lv.slice(0,300).map(v=>`<tr><td><b>${esc(v.nombre||'')}</b><div class="meta">${esc(v.productos||'')}</div></td><td>${esc(v.sector||'')}</td><td>${fFecha(v.creado)}</td><td>${v.al_dia?'<span class="chip st-entregado">Al día</span>':'<span class="chip st-en_ruta">Vencida</span>'}</td><td>${fmtN(v.carretilleros)}</td><td>${v.ultimo?fmtFecha(+v.ultimo)+' '+hhmm(+v.ultimo):'nunca'}</td><td>${fmtN(v.dias_activo)}</td><td>${fmtN(v.hoy)}</td><td>${fmtN(v.d7)}</td><td>${fmtN(v.d30)}</td><td>${fmtN(v.total)}</td><td>${fmtN(v.compradores)}</td><td>${fmtN(v.reclamos)}</td><td>${fmtN(v.invitados)}</td></tr>`).join('')}</tbody>`}</table></div>
    ${(usoTab==='compradores'?lc:lv).length>300?'<p class="hint">Se muestran 300. El Excel trae todos.</p>':''}
    ${usoTab==='compradores'&&MET.compradores_det.length>=500?'<p class="hint">La tabla incluye los 500 compradores con actividad más reciente.</p>':''}</div></div>`}
function excelUso(){const M=MET;const f=t=>t?new Date(+t).toLocaleDateString('es-VE'):'';const C=M.compradores,V=M.vendedores,D=M.despachos,P=M.pagos;
  const res=[['Compradores registrados',C.total],['Compradores nuevos (30 días)',C.nuevos_30d],['Compradores nuevos (7 días)',C.nuevos_7d],['Compradores que recibieron mercancía (30 días)',C.con_despacho_30d],['Compradores que usaron la app alguna vez',C.con_despacho_total],['Compradores en el mercado ahora',C.activos_ahora],['Compradores invitados por vendedores',C.invitados_vendedor],['Compradores invitados por amigos',C.invitados_amigo],['Compradores con favoritos',C.con_favoritos],
    ['Vendedores registrados',V.total],['Vendedores nuevos (30 días)',V.nuevos_30d],['Vendedores que despacharon (7 días)',V.con_despacho_7d],['Vendedores que despacharon (30 días)',V.con_despacho_30d],['Vendedores al día o en prueba',V.al_dia],['Vendedores que pagaron alguna vez',V.pagaron_alguna_vez],['Carretilleros activos',V.carretilleros_activos],
    ['Despachos hoy',D.hoy],['Despachos 7 días',D.d7],['Despachos 30 días',D.d30],['Despachos total',D.total],['Bultos 30 días',D.bultos_30d],['Confirmados por el comprador (30 días)',D.confirmados_30d],['Confirmados escaneando credencial (30 días)',D.por_carnet_30d],['Confirmados con el botón (30 días)',D.por_boton_30d],['Confirmados de palabra por el vendedor (30 días)',D.por_vendedor_30d],['Reclamos (30 días)',D.reclamos_30d],['Minutos promedio hasta confirmar (30 días)',D.prom_min_30d],
    ['Mensualidades aprobadas (30 días)',P.aprobados_30d],['Monto cobrado US$ (30 días)',+P.monto_usd_30d],['Pagos pendientes de aprobar',P.pendientes]].map(([a,b])=>[a,+b||0]);
  descargarLibro(`CargaYa-uso-${hoyLocal()}`,[
    {nombre:'Resumen',cab:['Indicador','Valor'],filas:res},
    {nombre:'Por día',cab:['Día','Despachos','Compradores distintos','Vendedores distintos','Reclamos'],filas:M.por_dia.map(x=>[x.d.split('-').reverse().join('/'),+x.despachos,+x.compradores,+x.vendedores,+x.reclamos])},
    {nombre:'Por semana',cab:['Semana (lunes)','Despachos','Compradores activos','Vendedores activos','Compradores nuevos','Vendedores nuevos'],filas:M.por_semana.map(x=>[x.s.split('-').reverse().join('/'),+x.despachos,+x.compradores_activos,+x.vendedores_activos,+x.nuevos_compradores,+x.nuevos_vendedores])},
    {nombre:'Compradores',cab:['Placa','Nombre','Teléfono','Zona','En el mercado','Registrado','Última llegada','Último despacho','Días con compras','Despachos 7 d','Despachos 30 d','Despachos total','Vendedores distintos','Confirmados','Reclamos','Favoritos','Llegó por'],
     filas:M.compradores_det.map(c=>[c.id,c.nombre,c.tel,c.zona,c.activo?'Sí':'No',f(c.creado),f(c.llegada),f(c.ultimo),+c.dias_activo,+c.d7,+c.d30,+c.total,+c.vendedores,+c.confirmados,+c.reclamos,+c.favoritos,c.invitado==='vendedor'?'Vendedor':c.invitado==='amigo'?'Amigo':''])},
    {nombre:'Vendedores',cab:['Nombre','Teléfono','Qué vende','Sector','Registrado','Puede despachar','Pagado hasta','Carretilleros','Último despacho','Días activo','Hoy','7 d','30 d','Total','Compradores distintos','Reclamos','Compradores que invitó'],
     filas:M.vendedores_det.map(v=>[v.nombre,v.tel,v.productos,v.sector,f(v.creado),v.al_dia?'Sí':'No',f(v.pagado_hasta),+v.carretilleros,f(v.ultimo),+v.dias_activo,+v.hoy,+v.d7,+v.d30,+v.total,+v.compradores,+v.reclamos,+v.invitados])}]);
  toast('Archivo descargado')}

/* ---- Compradores registrados (administración) ---- */
let caBusca='',caFiltro='todos',caN=100,CA={key:null,rows:[],total:0,cargando:false,error:null};
const caLimpio=q=>q.replace(/[,()*%\\]/g,' ').trim();
function filtroCA(){const q=caLimpio(caBusca),key=caFiltro+'|'+q+'|'+caN;
  if(CA.key!==key){CA={...CA,key,cargando:true,error:null};traerCA(q,key)}
  return CA.rows}
function consultaCA(q){let x=sb.from('compradores').select('data',{count:'exact'});if(caFiltro==='activos')x=x.eq('activo',true);if(caFiltro==='fuera')x=x.eq('activo',false);
  if(q){const pl=normPlaca(q);x=x.or([pl?`id.ilike.%${pl}%`:null,`data->>nombre.ilike.%${q}%`,`data->>tel.ilike.%${q.replace(/\D/g,'')||q}%`,`data->>vehiculo.ilike.%${q}%`].filter(Boolean).join(','))}
  return x.order('updated_at',{ascending:false})}
async function traerCA(q,key){const r=await consultaCA(q).range(0,caN-1);if(CA.key!==key)return;
  if(r.error){CA.cargando=false;CA.error='No se pudo cargar la lista. Revisa la conexión.';renderCA();return}
  CA.rows=r.data.map(x=>x.data);CA.total=r.count||CA.rows.length;CA.cargando=false;renderCA()}
// se re-dibuja aunque el cursor esté en el buscador (y se le devuelve el foco)
function renderCA(){if(view!=='comprAdm')return;const el=$('caBusca'),foco=el&&document.activeElement===el,pos=foco?el.selectionStart:0;render();const nb=$('caBusca');if(foco&&nb){nb.focus();nb.setSelectionRange(pos,pos)}}
async function todosCA(){const q=caLimpio(caBusca),out=[];for(let i=0;;i+=1000){const r=await consultaCA(q).range(i,i+999);if(r.error)throw r.error;r.data.forEach(x=>out.push(x.data));if(r.data.length<1000)break}return out}
function invitadoTxt(c){if(c.invitadoPor){const v=vend(c.invitadoPor);return `⭐ Invitado por ${v?esc(v.nombre):'un vendedor'}`}return c.referidoPor?'👥 Invitado por un amigo':''}
function vComprAdm(){const ls=filtroCA();
  return `<div class="grid"><div class="card"><h2>Compradores registrados</h2><p class="sub">Todos los compradores con cuenta. Busca por placa, nombre, teléfono o vehículo.</p>
   <input id="caBusca" placeholder="🔍 Ej: AB123CD, Rosa, 0414…" value="${esc(caBusca)}" autocomplete="off">
   <div class="row" style="margin-top:8px"><div><label>Mostrar</label><select id="caFiltro">${[['todos','Todos'],['activos','En el mercado ahora'],['fuera','Se fueron']].map(([k,t])=>`<option value="${k}" ${caFiltro===k?'selected':''}>${t}</option>`).join('')}</select></div>
    <button class="btn y" id="caCsv" style="flex:0 0 auto;align-self:flex-end" ${CA.total?'':'disabled'}>⬇ Excel</button></div>
   <p class="hint" style="margin-top:8px">${CA.cargando?'Cargando…':CA.error?`<span class="bad">${esc(CA.error)}</span>`:`${CA.total} comprador${CA.total==1?'':'es'}${caBusca?(CA.total==1?' encontrado':' encontrados'):''}`}</p></div>
  <div class="card"><div class="list">${ls.map(c=>{const z=c.activo!==false;const inv=invitadoTxt(c);
    return `<div class="item"><div class="top"><span><span class="plate">${esc(c.id)}</span> <b style="font-size:18px">${esc(c.nombre||'')}</b></span><span class="chip ${z?'st-entregado':''}">${z?'En el mercado':'Se fue'}</span></div>
     <div class="meta">🚚 ${esc(c.vehiculo||'Sin vehículo registrado')}${c.zona?` · 📍 ${esc(c.zona)}`:''}${c.ref?` · ${esc(c.ref)}`:''}</div>
     <div class="meta">${c.llegada?`Última llegada: ${fmtFecha(c.llegada)} ${hhmm(c.llegada)}`:''}${c.creado?` · Registrado: ${fmtFecha(c.creado)}`:''}${(c.favoritos||[]).length?` · ${pl((c.favoritos||[]).length,'vendedor favorito','vendedores favoritos')}`:''}</div>
     ${inv?`<div class="meta">${inv}</div>`:''}
     ${c.tel?`<div class="row" style="margin-top:6px">${waBtn(c.tel,'WhatsApp')}</div>`:''}</div>`}).join('')||`<div class="empty">${CA.cargando?'Cargando…':'No hay compradores'+(caBusca?' con esa búsqueda':' registrados todavía')}</div>`}</div>
   ${CA.total>ls.length&&!CA.cargando?`<button class="btn o" id="caMas" style="width:100%;margin-top:10px">Ver más (${CA.total-ls.length} restantes)</button>`:''}</div></div>`}
/* ---- Excel (.xlsx) sin librerías: hoja con encabezado en negrita, filtro y fila fija ---- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipStore(files){const enc=new TextEncoder(),partes=[],dir=[];let off=0;
  const u16=n=>[n&255,(n>>>8)&255],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  files.forEach(([nombre,txt])=>{const nb=enc.encode(nombre),db=enc.encode(txt),crc=crc32(db);
    const loc=[0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0)];
    partes.push(new Uint8Array(loc),nb,db);
    dir.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
    off+=loc.length+nb.length+db.length});
  const tam=dir.reduce((a,x)=>a+x.length,0);
  return new Blob([...partes,...dir,new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(tam),...u32(off),0,0])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
function descargarXLSX(archivo,hoja,cab,filas){descargarLibro(archivo,[{nombre:hoja,cab,filas}])}
// Libro de Excel con varias hojas: [{nombre,cab,filas}]
function descargarLibro(archivo,hojas){const x=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
  const col=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
  const celda=(v,r,c,est)=>{const ref=col(c)+r;if(v==null||v==='')return '';if(typeof v==='number'&&isFinite(v))return `<c r="${ref}"${est?` s="${est}"`:''}><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr"${est?` s="${est}"`:''}><is><t xml:space="preserve">${x(v)}</t></is></c>`};
  const nombres=[];hojas=hojas.map(hj=>{let n=x(String(hj.nombre).replace(/[\\\/?*\[\]:]/g,' ').slice(0,31))||'Hoja';while(nombres.includes(n))n=n.slice(0,28)+'_'+nombres.length;nombres.push(n);return {...hj,n}});
  const hojaXML=hj=>{const todas=[hj.cab,...hj.filas];const anchos=hj.cab.map((_,i)=>Math.min(45,Math.max(8,...todas.slice(0,2000).map(f=>String(f[i]==null?'':f[i]).length+2))));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${anchos.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${todas.map((f,ri)=>`<row r="${ri+1}">${f.map((v,ci)=>celda(v,ri+1,ci,ri===0?1:0)).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(hj.cab.length-1)}${hj.filas.length+1}"/></worksheet>`};
  const blob=zipStore([
    ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((hj,i)=>`<sheet name="${hj.n}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${hojas.map((hj,i)=>`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${hj.n}'!$A$1:$${col(hj.cab.length-1)}$${hj.filas.length+1}</definedName>`).join('')}</definedNames></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC400"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ...hojas.map((hj,i)=>[`xl/worksheets/sheet${i+1}.xml`,hojaXML(hj)])]);
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=archivo.replace(/[^\w.-]+/g,'-')+'.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

function hojaCompradores(ls){const f=t=>t?new Date(t):null;
  const cab=['Placa','Nombre','Teléfono','Vehículo','Zona','Referencia','Estado','Última llegada','Registrado','Vendedores favoritos','Invitado por'];
  const filas=ls.map(c=>{const ll=f(c.llegada),cr=f(c.creado);return [c.id,c.nombre,c.tel,c.vehiculo,c.zona,c.ref,c.activo!==false?'En el mercado':'Se fue',ll?ll.toLocaleDateString('es-VE')+' '+hhmm(ll):'',cr?cr.toLocaleDateString('es-VE'):'',(c.favoritos||[]).length||0,
    c.invitadoPor?(vend(c.invitadoPor)?.nombre||'Vendedor'):c.referidoPor?'Amigo':'']});
  return {nombre:'Compradores',cab,filas}}
function csvCompradores(ls){const hj=hojaCompradores(ls);descargarXLSX(`CargaYa-compradores-${hoyLocal()}`,hj.nombre,hj.cab,hj.filas)}

/* ---- Respaldo en Excel (administración) ---- */
async function respaldoExcel(){const r=await sb.rpc('respaldo');if(r.error)throw r.error;const R=r.data;const f=t=>t?new Date(+t):null,fe=t=>{const d=f(t);return d&&!isNaN(d)?d.toLocaleDateString('es-VE'):''},fh=t=>{const d=f(t);return d&&!isNaN(d)?d.toLocaleDateString('es-VE')+' '+hhmm(d):''};
  const vn={};(R.vendedores||[]).forEach(v=>vn[v.id]=v.nombre||'');const kn={};(R.carretilleros||[]).forEach(k=>kn[k.id]=k);
  // despachos de los últimos 7 días (de a 1000)
  const ds=[];for(let i=0;;i+=1000){const q=await sb.from('despachos').select('data').gte('creado',inicioDia(7)).order('creado',{ascending:false}).range(i,i+999);if(q.error)throw q.error;q.data.forEach(x=>ds.push(x.data));if(q.data.length<1000||ds.length>=200000)break}
  const nk={};ds.forEach(d=>{if(d.carretillero)nk[d.carretillero]=(nk[d.carretillero]||0)+1});const kv={};(R.carretilleros||[]).forEach(k=>{if(!k.baja)kv[k.vendedor]=(kv[k.vendedor]||0)+1});
  const hojas=[
    {nombre:'Vendedores',cab:['Nombre','Teléfono','Qué vende','Sector','Referencia del puesto','Registrado','Pagado hasta','Mensualidad','Carretilleros activos'],
     filas:(R.vendedores||[]).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).map(v=>{const s=suscripcion(v);return [v.nombre,v.tel,v.productos,v.sector,v.refPuesto,fe(v.creado),v.pagadoHasta?fe(v.pagadoHasta):'',(ETQS[s.estado]||[s.estado])[0],kv[v.id]||0]})},
    hojaCompradores((R.compradores||[]).sort((a,b)=>(b.llegada||0)-(a.llegada||0))),
    {nombre:'Carretilleros',cab:['Número','Nombre','Vendedor','Estado','Viajes últimos 7 días','Código de credencial'],
     filas:(R.carretilleros||[]).sort((a,b)=>(vn[a.vendedor]||'').localeCompare(vn[b.vendedor]||'')||String(a.num).localeCompare(String(b.num))).map(k=>['#'+k.num,k.nombre,vn[k.vendedor]||'',k.baja?'De baja':'Activo',nk[k.id]||0,k.id])},
    {nombre:'Pagos de mensualidad',cab:['Cargado','Vendedor','Fecha del pago','Referencia','Banco','Teléfono que pagó','Monto Bs','Monto US$','Tasa','Estado','Motivo del rechazo'],
     filas:(R.pagos||[]).sort((a,b)=>(b.t||0)-(a.t||0)).map(p=>[fh(p.t),vn[p.vendedor]||'',/^\d{4}-\d\d-\d\d$/.test(p.fecha||'')?p.fecha.split('-').reverse().join('/'):p.fecha,p.referencia,p.banco,p.telefono,+p.monto||0,+p.montoUSD||0,+p.tasa||0,({pendiente:'Pendiente',aprobado:'Aprobado',rechazado:'Rechazado'})[p.estado]||p.estado,p.motivo||''])},
    {nombre:'Zonas',cab:['Nombre','Tipo','Área dibujada','Centro marcado','Estado'],
     filas:(R.zonas||[]).map(z=>[z.nombre,(TIPOS_ZONA.find(t=>t[0]===(z.tipo||'compradores'))||['',''])[1],z.pv===PV&&z.poly&&z.poly.length>2?'Sí':'No',zEn(z)?'Sí':'No',z.baja?'Quitada':'Activa'])},
    {nombre:'Despachos 7 días',cab:['Fecha','Salida','Recibido','Vendedor','Despacho','Placa','Mercancía','Bultos','Carretillero','Estado','Cómo se confirmó','Reclamo','Pago carretillero','Moneda','Forma de pago'],
     filas:ds.map(d=>{const k=kn[d.carretillero];return [fe(d.t.creado),hhmm(d.t.creado),d.t.entregado?hhmm(d.t.entregado):'',vn[d.vendedor]||'',nro(d),d.placa,resumenItems(d),+d.bultos||0,k?'#'+k.num+' '+(k.nombre||''):'',ETQ[d.estado]||d.estado,
       ({carnet:'Escaneó la credencial',boton:'Confirmó el comprador',vendedor:'Confirmó el vendedor',ficha:'Ficha'})[d.verif?.metodo]||'',d.reclamo||'',d.pagoK?(+d.pagoK.monto||0):'',d.pagoK?MON[d.pagoK.moneda]:'',d.pagoK?(d.pagoK.metodo==='pago_movil'?'Pago Móvil':'Efectivo'):(d.estado!=='en_ruta'&&d.carretillero?'SIN PAGAR':'')]})}];
  descargarLibro(`CargaYa-respaldo-${hoyLocal()}`,hojas);toast('Respaldo descargado')}

/* ---- Carretilleros ---- */
// Índices por pantalla: evitan recorrer todos los despachos por cada carretillero o vendedor
const IDX={t:0};function idx(){if(Date.now()-IDX.t<500)return IDX;const h0=inicioDia(0),k={},pv={},kv={};const pc={},er=new Set();L('despacho').forEach(d=>{if(d.carretillero&&d.t&&d.t.creado>=h0)(k[d.carretillero]=k[d.carretillero]||[]).push(d);if(d.carretillero&&!d.pagoK&&d.estado!=='en_ruta')pc[d.carretillero]=(pc[d.carretillero]||0)+1;if(d.estado==='en_ruta')er.add(d.placa)});L('pago').forEach(p=>(pv[p.vendedor]=pv[p.vendedor]||[]).push(p));L('carretillero').forEach(c=>(kv[c.vendedor]=kv[c.vendedor]||[]).push(c));Object.assign(IDX,{t:Date.now(),k,pv,kv,pc,er});return IDX}
function statsK(k){if(ME&&ME.rol==='admin'&&RES){const r=RES.carr[k.id]||{};return {hoy:r.hoy||0,ok:r.ok||0,recl:r.recl||0,porCobrar:(RES.por_cobrar||{})[k.id]||0}}
  const ds=idx().k[k.id]||[];
  return {hoy:ds.length,ok:ds.filter(d=>d.estado==='entregado').length,recl:ds.filter(d=>d.estado==='reclamo').length,porCobrar:idx().pc[k.id]||0}}
function vCarretilleros(){const vs=L('vendedor').sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));const total=L('carretillero').filter(k=>!k.baja).length;
  return `<div class="grid"><div class="card"><h2>Carretilleros de todos los vendedores</h2><p class="sub">Puedes agregar carretilleros a cualquier vendedor e imprimir sus credenciales. Cada vendedor también puede hacerlo desde su módulo.</p>
   <label style="display:flex;gap:8px;align-items:center;font-size:15px;color:var(--ink)"><input type="checkbox" id="akDorso" checked style="width:auto"> Imprimir también el dorso (doble faz)</label>
   <button class="btn y" id="akTodos" style="width:100%;margin-top:8px" ${total?'':'disabled'}>🖨 Imprimir credenciales de todos (${total})</button></div>
   ${vs.map(v=>{const ks=misCarr(v.id);return `<div class="card"><div class="top" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="font-size:20px">${esc(v.nombre)}</h2><span class="hint">${ks.length} carretillero${ks.length===1?'':'s'}</span></div>
     <div class="list">${ks.map(k=>{const s=statsK(k);return `<div class="row" style="align-items:center;border-bottom:1px solid var(--line);padding:6px 0"><div><b>#${esc(k.num)} · ${esc(k.nombre||'sin nombre')}</b><div class="meta">${pl(s.hoy,'viaje')} hoy · ${pl(s.ok,'confirmado')}${s.recl?` · ⚠ ${pl(s.recl,'reclamo')}`:''}${s.porCobrar?` · 💵 ${s.porCobrar} por cobrar`:''}</div></div><button class="btn o" style="flex:0 0 auto;padding:6px 10px" data-akp="${esc(k.id)}">🖨</button></div>`}).join('')||'<div class="hint">Todavía no tiene carretilleros.</div>'}</div>
     <div class="row" style="margin-top:10px"><input placeholder="Nombre del nuevo carretillero" data-akn="${esc(v.id)}"><button class="btn o" style="flex:0 0 auto" data-aka="${esc(v.id)}">Agregar</button></div>
     ${ks.length?`<button class="btn o" style="width:100%;margin-top:8px" data-akv="${esc(v.id)}">🖨 Imprimir las ${ks.length} credenciales de ${esc(v.nombre)}</button>`:''}</div>`}).join('')||'<div class="card empty">Todavía no hay vendedores registrados</div>'}</div>`}
async function agregarCarretillero(v,nombre){const ks=L('carretillero').filter(k=>k.vendedor===v.id);const num=pad(ks.reduce((m,k)=>Math.max(m,parseInt(k.num)||0),0)+1,2);
  const k={id:nuevoIdK(),vendedor:v.id,num,nombre,creado:Date.now()};await guardar('carretillero',k);log(`${ME.rol==='admin'?'Administración':v.nombre} agregó al carretillero #${num}${nombre?' '+nombre:''} (${v.nombre})`);toast(`Carretillero #${num} agregado a ${v.nombre}`);return k}
function vendActual(){return ME.rol==='vendedor'?vend(ME.id):L('vendedor')[0]}
function vMisCarr(){const v=vendActual();if(!v)return '<div class="card empty">Cargando…</div>';const ks=misCarr(v.id);
  return `<div class="grid g2"><div class="grid" style="align-content:start"><div class="card"><h2>Nuevo carretillero</h2><p class="sub">Solo su nombre o apodo. El número se asigna solo.</p>
    <div class="row"><input id="kNom" placeholder="Ej: José Luis" autocomplete="off"><button class="btn y" style="flex:0 0 auto" id="kAdd">Agregar</button></div></div>
    <div class="card"><h2>Credenciales</h2><p class="sub">Cada carretillero lleva su credencial colgada. El comprador la escanea al recibir. Tamaño A6, 4 por hoja A4: recorta, plastifica y perfora.</p>
     <label style="display:flex;gap:8px;align-items:center;font-size:15px;color:var(--ink)"><input type="checkbox" id="kDorso" checked style="width:auto"> Imprimir también el dorso (doble faz)</label>
     <button class="btn o" id="kPrintAll" style="width:100%;margin-top:8px" ${ks.length?'':'disabled'}>🖨 Imprimir credenciales de todos (${ks.length})</button></div></div>
   <div class="card"><h2>Mis carretilleros</h2><div class="list">${ks.map(k=>{const s=statsK(k);return `<div class="item"><div class="top"><b style="font-size:20px">#${esc(k.num)} · ${esc(k.nombre||'sin nombre')}</b><span class="hint">${pl(s.hoy,'viaje')} hoy</span></div>
     <div class="meta">${pl(s.ok,'confirmado')} hoy${s.recl?` · ⚠ ${pl(s.recl,'reclamo')}`:''}</div>
     <div class="row"><button class="btn o" data-kprint="${esc(k.id)}">🖨 Credencial</button><button class="btn o" style="flex:0 0 auto" data-kbaja="${esc(k.id)}">Dar de baja</button></div></div>`}).join('')||'<div class="empty">Todavía no tienes carretilleros. Agrega el primero.</div>'}</div></div></div>`}
async function imprimirCredenciales(ks,dorso,vNombre){await cargarQRlib();
  const cred=k=>!k?'<div class="cred vacia"></div>':`<div class="cred"><div class="in"><div class="top"><i class="hole l"></i><i class="hole r"></i><span>perforar</span></div><div class="band">CARRETILLERO</div>
    <div class="num"><small>N°</small>${esc(k.num)}</div><img src="${qrImg(urlCarnet(k.id),400)}" alt=""><div class="esc">Comprador: escanea este código<br>al recibir tu mercancía</div>
    <div class="nom">Nombre: ${esc(k.nombre||'')}</div><div class="foot"><b>CargaYa</b> · ${esc(vNombre||vend(k.vendedor)?.nombre||'Mercado Mayor de Coche')}</div></div></div>`;
  let html='';for(let i=0;i<ks.length;i+=4){const g=[0,1,2,3].map(j=>ks[i+j]||null);html+=`<div class="hoja-cred">${g.map(cred).join('')}</div>`;if(dorso)html+=`<div class="hoja-cred">${[g[1],g[0],g[3],g[2]].map(cred).join('')}</div>`}
  await imprimir(html)}

/* ---- Imprimir ---- */
const MSJ_QR={vendedor:'Hola 👋 Te invito a usar *CargaYa* en el Mercado Mayor de Coche: despacha a la placa del comprador y controla cada entrega con tus carretilleros. Crea tu cuenta aquí (1 minuto): ',
  comprador:'Hola 👋 Con *CargaYa* tus compras del Mercado Mayor de Coche llegan directo a tu vehículo y confirmas cada entrega. Crea tu cuenta aquí (1 minuto): '};
function vImprimir(){
  const card=(m,tit,sub)=>`<div class="card"><h2>${tit}</h2><p class="sub">${sub}</p>
    <img src="${qrRol(m)}" alt="QR ${tit}" style="width:100%;max-width:300px;display:block;margin:6px auto 10px;border:1px solid var(--line);border-radius:12px">
    <button class="btn y big" data-qshare="${m}">📲 Compartir imagen (WhatsApp)</button>
    <a class="btn g" style="display:block;text-align:center;text-decoration:none;margin-top:8px;color:#fff" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(MSJ_QR[m]+LINKS[m])}">💬 Enviar link por WhatsApp</a>
    <div class="row" style="margin-top:8px"><a class="btn o" style="text-align:center;text-decoration:none" href="${qrRol(m)}" download="CargaYa-QR-${m}.png">⬇ Descargar imagen</a>${copiaBtn(LINKS[m]).replace('>Copiar<','>Copiar link<')}</div>
    <p class="hint" style="margin-top:6px;word-break:break-all">${LINKS[m]}</p></div>`;
  return `<div class="grid g2">${card('vendedor','QR para vendedores','Para que los vendedores creen su cuenta.')}${card('comprador','QR para compradores','Para que los compradores creen su cuenta.')}</div>
  <div class="card" style="margin-top:16px"><h2>Imprimir</h2><p class="sub">Los dos QR en hojas A4 para pegar en el mercado.</p><a class="btn o" style="display:block;text-align:center;text-decoration:none" href="qr.html" target="_blank" rel="noopener">🖨 Abrir para imprimir</a>
   <p class="hint" style="margin-top:10px">Las credenciales de los carretilleros las imprime cada vendedor desde su módulo.</p></div>`}
// QR de registro generado en el momento (sirve en cualquier dirección o dominio)
const QRC={};function qrRol(m){if(!window.qrcode){cargarQRlib().then(()=>pedirRender()).catch(()=>{});return 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}return QRC[m]||(QRC[m]=qrImg(LINKS[m],600))}
function cargarQRlib(){return window.qrcode?Promise.resolve():new Promise((res,rej)=>{const s=document.createElement('script');s.src='lib/qrcode.js';s.onload=res;s.onerror=()=>{toast('No se pudo cargar el generador de QR. Revisa la conexión.');rej()};document.head.appendChild(s)})}
function qrImg(txt,px){const q=qrcode(0,'M');q.addData(txt);q.make();const n=q.getModuleCount();return q.createDataURL(Math.max(2,Math.floor(px/(n+4))),2)}
const COD_ALF='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function imprimir(html){const pa=document.getElementById('print');pa.innerHTML=html;await new Promise(r=>setTimeout(r,300));window.print()}

/* ---- Cobro mensual por Pago Móvil ---- */
const DIA=86400000;
const hoyLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const BANCOS=['Banco de Venezuela','Banesco','Mercantil','Provincial','BNC','Bancamiga','Banco del Tesoro','Bicentenario','Bancaribe','Banco Exterior','BFC (Fondo Común)','Banco Plaza','Banplus','Banco Activo','100% Banco','Sofitasa','Banco Caroní','Venezolano de Crédito','Del Sur','Banco Agrícola','Banfanb','Bancrecer','Mi Banco','R4'];
function cfgCobro(){return Object.assign({precioUSD:10,tasa:0,tasaFecha:null,banco:'',telefono:'',cedula:'',titular:'',pruebaDias:30,graciaDias:3,adminTel:''},S.config.cobro||{})}
const montoBs=c=>Math.round(c.precioUSD*c.tasa*100)/100;
const fmtBs=n=>'Bs '+Number(n||0).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtFecha=t=>t?new Date(t).toLocaleDateString('es-VE',{day:'numeric',month:'short',year:'numeric'}):'';
function sumarMes(t){const d=new Date(t);const dia=d.getDate();d.setMonth(d.getMonth()+1);if(d.getDate()<dia)d.setDate(0);return d.getTime()}
const pagosDe=id=>(idx().pv[id]||[]).slice().sort((a,b)=>b.t-a.t);
function suscripcion(v){const c=cfgCobro(),now=Date.now();const prueba=(v.creado||now)+c.pruebaDias*DIA;const hasta=Math.max(v.pagadoHasta||0,v.pagadoHasta?0:prueba);
  const pend=pagosDe(v.id).find(p=>p.estado==='pendiente');const enPrueba=!v.pagadoHasta;
  let estado=now<=hasta?(enPrueba?'prueba':'activa'):now<=hasta+c.graciaDias*DIA?'gracia':'vencida';
  const dias=Math.ceil((hasta-now)/DIA);return {estado,hasta,dias,pend,puedeDespachar:estado!=='vencida'||!!pend,enPrueba}}
const ETQS={prueba:['Prueba gratis','st-asignado'],activa:['Al día','st-entregado'],gracia:['Vencida · días de gracia','st-en_vehiculo'],vencida:['Vencida','st-en_ruta']};
function chipSus(s){const [t,c]=ETQS[s.estado];return `<span class="chip ${s.estado==='vencida'?'':c}" ${s.estado==='vencida'?'style="background:#fde3e1;color:#b3261e"':''}>${t}</span>`}
function copiaBtn(txt){return `<button type="button" class="btn o" style="flex:0 0 auto;padding:6px 10px;font-size:13px" data-copiar="${esc(txt)}">Copiar</button>`}
let pagando=false,pagoForm={};
function cardSuscripcion(v){const s=suscripcion(v),c=cfgCobro();
  const txt=s.estado==='prueba'?`Prueba gratis hasta el ${fmtFecha(s.hasta)} (${Math.max(0,s.dias)} días).`:s.estado==='activa'?`Pagado hasta el ${fmtFecha(s.hasta)} (${Math.max(0,s.dias)} días).`:s.estado==='gracia'?`Venció el ${fmtFecha(s.hasta)}. Paga pronto para no quedar bloqueado.`:`Venció el ${fmtFecha(s.hasta)}. Paga para volver a despachar.`;
  if(!pagando)return `<div class="card" style="${s.estado==='vencida'||s.estado==='gracia'?'border:2px solid #e0362c':''}"><div class="top" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>Mi mensualidad</h2>${chipSus(s)}</div>
    <p class="sub">${txt}</p>${(()=>{const ult=L('pago').filter(x=>x.vendedor===v.id).sort((x,y)=>(y.t||y.tRech||0)-(x.t||x.tRech||0))[0];return !s.pend&&ult&&ult.estado==='rechazado'?`<div class="notfound" style="margin-bottom:8px">✗ Tu último pago (ref. ${esc(ult.referencia)}) fue <b>rechazado</b>: ${esc(ult.motivo||'sin detalle')}. Revisa los datos y vuelve a cargarlo.</div>`:''})()}${s.pend?`<div class="found">Pago de ${fmtBs(s.pend.monto)} (ref. ${esc(s.pend.referencia)}) en revisión. Puedes seguir despachando.</div>`:''}
    <button class="btn ${s.estado==='vencida'||s.estado==='gracia'||(s.dias<=5)?'y':'o'}" id="sPagar" style="width:100%;margin-top:8px">💳 Pagar mes · US$ ${c.precioUSD}${c.tasa?` (${fmtBs(montoBs(c))})`:''}</button></div>`;
  const ok=c.banco&&c.telefono&&c.cedula;
  return `<div class="card" style="border:2px solid var(--yel)"><h2>Pagar con Pago Móvil</h2>
   ${ok?`<p class="sub">1 · Haz un Pago Móvil desde tu banco con estos datos:</p>
   <div class="list">${[['Banco',c.banco],['Teléfono',c.telefono],['Cédula / RIF',c.cedula],...(c.titular?[['Titular',c.titular]]:[]),['Monto',c.tasa?fmtBs(montoBs(c)):'US$ '+c.precioUSD]].map(([k,val])=>`<div class="row" style="align-items:center"><div><div class="hint">${k}</div><b style="font-size:19px">${esc(val)}</b></div>${copiaBtn(k==='Monto'&&c.tasa?montoBs(c).toFixed(2).replace('.',','):val)}</div>`).join('')}</div>
   ${c.tasa?`<p class="hint">US$ ${c.precioUSD} a tasa ${c.tasa.toLocaleString('es-VE')} Bs/US$ (actualizada ${fmtFecha(c.tasaFecha)}).</p>`:''}
   <p class="sub" style="margin-top:12px">2 · Cuando el banco te confirme, carga los datos del pago:</p>
   <form id="fPago"><label>Número de referencia</label><input id="pRef" inputmode="numeric" placeholder="Ej: 004512345678" value="${esc(pagoForm.ref||'')}" required>
    <div class="row"><div><label>Banco desde donde pagaste</label><input id="pBanco" list="bancosVE" value="${esc(pagoForm.banco||'')}" required><datalist id="bancosVE">${BANCOS.map(b=>`<option value="${b}">`).join('')}</datalist></div>
    <div><label>Teléfono que pagó</label><input id="pTel" inputmode="tel" placeholder="0414-000-0000" value="${esc(pagoForm.tel||v.tel||'')}" required></div></div>
    <div class="row"><div><label>Monto pagado (Bs)</label><input id="pMonto" inputmode="decimal" value="${esc(pagoForm.monto||(c.tasa?montoBs(c).toFixed(2).replace('.',','):''))}" required></div><div><label>Fecha</label><input id="pFecha" type="date" value="${esc(pagoForm.fecha||hoyLocal())}" required></div></div>
    <label>Captura del pago (recomendado)</label><div class="row"><label class="btn o" style="margin:0;text-align:center">${pagoForm.foto?'Cambiar captura':'📷 Adjuntar captura'}<input type="file" accept="image/*" id="pFoto" class="hidden"></label>${pagoForm.foto?`<img class="photo sm" style="flex:0 0 96px" ${attrFoto(pagoForm.foto)} alt="">`:''}</div>
    <div class="row" style="margin-top:14px"><button class="btn o" type="button" id="pCancel">Cancelar</button><button class="btn y" type="submit">Enviar pago</button></div></form>`
   :`<div class="notfound">Todavía no están cargados los datos de Pago Móvil. Avísale a la administración.</div><button class="btn o" type="button" id="pCancel" style="margin-top:10px;width:100%">Volver</button>`}</div>`}

let cobroTab='pend',rechazando=null;
function vCobros(){const c=cfgCobro();const pagos=L('pago').sort((a,b)=>b.t-a.t);const pend=pagos.filter(p=>p.estado==='pendiente');
  const mes=new Date();mes.setDate(1);mes.setHours(0,0,0,0);const cobradoMes=pagos.filter(p=>p.estado==='aprobado'&&p.tAprob>=mes.getTime());
  const vs=L('vendedor').map(v=>({v,s:suscripcion(v)}));
  const pagoItem=p=>{const v=vend(p.vendedor);return `<div class="item"><div class="top"><b>${esc(v?.nombre||p.vendedor)}</b><span class="chip ${p.estado==='aprobado'?'st-entregado':p.estado==='rechazado'?'':'st-en_vehiculo'}" ${p.estado==='rechazado'?'style="background:#fde3e1;color:#b3261e"':''}>${{pendiente:'Por revisar',aprobado:'Aprobado',rechazado:'Rechazado'}[p.estado]}</span></div>
    <div style="font-size:18px"><b>${fmtBs(p.monto)}</b> · ref. <b>${esc(p.referencia)}</b></div>
    <div class="meta">${esc(p.banco)} · ${esc(p.telefono)} · ${esc(p.fecha)} · cargado ${fmtFecha(p.t)} ${hhmm(p.t)}${p.motivo?` · motivo: ${esc(p.motivo)}`:''}</div>
    ${p.foto?`<details><summary class="hint">Ver captura</summary><img class="photo" ${attrFoto(p.foto)} alt="Captura del pago"></details>`:''}
    ${p.estado==='pendiente'?(rechazando===p.id?`<label>Motivo del rechazo</label><input id="rMot" placeholder="Ej: no aparece en el banco"><div class="row" style="margin-top:8px"><button class="btn o" data-prechok="${esc(p.id)}">Rechazar</button><button class="btn o" id="rCancel">Cancelar</button></div>`
      :`<div class="row"><button class="btn g" data-papr="${esc(p.id)}">✓ Aprobar (+1 mes)</button><button class="btn o" style="flex:0 0 auto" data-prech="${esc(p.id)}">Rechazar</button></div>`):''}</div>`};
  return `<div class="grid"><div class="kpis">
    <div class="kpi"><b>${pend.length}</b><span>Pagos por revisar</span></div>
    <div class="kpi"><b>${fmtBs(cobradoMes.reduce((a,p)=>a+(+p.monto||0),0))}</b><span>Cobrado este mes</span></div>
    <div class="kpi"><b>${vs.filter(x=>x.s.estado==='activa').length}</b><span>Vendedores al día</span></div>
    <div class="kpi"><b>${vs.filter(x=>x.s.estado==='prueba').length}</b><span>En prueba gratis</span></div>
    <div class="kpi"><b>${vs.filter(x=>x.s.estado==='vencida'||x.s.estado==='gracia').length}</b><span>Vencidos</span></div></div>
   <div class="seg" id="cTabs" style="max-width:520px">${[['pend','Por revisar'],['vend','Vendedores'],['hist','Historial'],['conf','Ajustes']].map(([k,t])=>`<button class="${cobroTab===k?'on':''}" data-ct="${k}">${t}</button>`).join('')}</div>
   ${cobroTab==='pend'?`<div class="card"><h2>Pagos por revisar</h2><p class="sub">Revisa en tu banco que el pago haya llegado (referencia y monto) y apruébalo.</p><div class="list">${pend.map(pagoItem).join('')||'<div class="empty">No hay pagos por revisar</div>'}</div></div>`:''}
   ${cobroTab==='hist'?`<div class="card"><h2>Historial de pagos</h2><div class="list">${pagos.filter(p=>p.estado!=='pendiente').map(pagoItem).join('')||'<div class="empty">Sin pagos todavía</div>'}</div></div>`:''}
   ${cobroTab==='vend'?`<div class="card"><h2>Vendedores</h2><div class="list">${vs.sort((a,b)=>a.s.hasta-b.s.hasta).map(({v,s})=>`<div class="item"><div class="top"><b>${esc(v.nombre)}</b>${chipSus(s)}</div>
      <div class="meta">${s.estado==='prueba'?'Prueba':'Pagado'} hasta ${fmtFecha(s.hasta)}${s.dias>=0?` · faltan ${s.dias} días`:` · vencido hace ${-s.dias} días`} · ${pagosDe(v.id).filter(p=>p.estado==='aprobado').length} pagos${v.tel?' · '+esc(v.tel):''}</div>
      <div class="row"><button class="btn o" data-pmes="${esc(v.id)}">+1 mes sin pago</button>${v.tel?waBtn(v.tel,'Escribir'):''}</div></div>`).join('')||'<div class="empty">Todavía no hay vendedores</div>'}</div></div>`:''}
   ${cobroTab==='conf'?`<div class="card" style="max-width:640px"><h2>Ajustes de cobro</h2><form id="fCfg">
     <div class="row"><div><label>Precio mensual (US$)</label><input id="cfPrecio" inputmode="decimal" value="${c.precioUSD}"></div><div><label>Tasa del día (Bs por US$)</label><input id="cfTasa" inputmode="decimal" value="${c.tasa||''}" placeholder="Ej: tasa BCV"></div></div>
     <p class="hint">${c.tasa?`Monto actual: <b>${fmtBs(montoBs(c))}</b> · tasa actualizada ${fmtFecha(c.tasaFecha)}`:'Carga la tasa para que el vendedor vea el monto en bolívares.'}</p>
     <h3 style="margin-top:14px">Tus datos de Pago Móvil (para recibir)</h3>
     <div class="row"><div><label>Banco (con código)</label><input id="cfBanco" value="${esc(c.banco)}" placeholder="Ej: 0102 Banco de Venezuela"></div><div><label>Teléfono</label><input id="cfTel" value="${esc(c.telefono)}" placeholder="0414-000-0000"></div></div>
     <div class="row"><div><label>Cédula o RIF</label><input id="cfCed" value="${esc(c.cedula)}" placeholder="V-12345678"></div><div><label>Titular (opcional)</label><input id="cfTit" value="${esc(c.titular)}"></div></div>
     <div class="row"><div><label>Días de prueba gratis</label><input id="cfPrueba" type="number" min="0" value="${c.pruebaDias}"></div><div><label>Días de gracia al vencer</label><input id="cfGracia" type="number" min="0" value="${c.graciaDias}"></div></div>
     <label>Tu WhatsApp (te avisan cuando cargan un pago)</label><input id="cfAdminTel" value="${esc(c.adminTel)}" placeholder="+54 9 11 0000-0000">
     <button class="btn y" type="submit" style="width:100%;margin-top:14px">Guardar ajustes</button></form></div>`:''}
  </div>`}

/* ---- Pago al carretillero por viaje ---- */
let pagandoK=null,pagandoLote=null,pkMetodo='efectivo';
const MON={Bs:'Bs',USD:'US$'};
const fmtMon=(m,mon)=>mon==='USD'?'US$ '+Number(m||0).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):fmtBs(m);
const monPref=()=>{try{return localStorage.getItem('cy-pkmon')||'Bs'}catch(e){return 'Bs'}};
const numES=x=>parseFloat(String(x||'').replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'))||0;
function txtPagoK(d){const pk=d.pagoK;return pk?`✓ Pagado al carretillero: <b>${fmtMon(pk.monto,pk.moneda)}</b> · ${pk.metodo==='pago_movil'?'Pago Móvil'+(pk.ref?' ref. '+esc(pk.ref):''):'efectivo'} · ${hhmm(pk.t)}`:''}
function formPagoK(d,v,lote){const k=carr(lote?lote[0].carretillero:d.carretillero);const mon=monPref();
  return `<div class="stepbox" style="margin-top:8px;border-style:solid;border-color:var(--yel)"><h3 style="font-size:17px">💵 Pagar a ${esc(etqCarr(k,v.id))}${lote&&lote.length>1?` · ${lote.length} viajes`:''}</h3>
   ${!lote&&d.estado==='en_ruta'?'<p class="bad" style="font-size:14px">Ojo: el comprador todavía no confirmó la entrega.</p>':''}
   <p class="hint" style="margin:2px 0 6px">Escribe lo que acordaste con el carretillero${lote&&lote.length>1?' por cada viaje':''}.</p>
   ${(lote||[d]).map(x=>`<div class="row" style="align-items:center;margin-top:6px"><div style="font-size:14px">${lote?`${hhmm(x.t.creado)} · ${esc(resumenItems(x))} → ${esc(x.placa)}`:'Monto acordado'}</div>
     <input class="pk-m" data-id="${esc(x.id)}" inputmode="decimal" placeholder="0" style="flex:0 0 110px;font-size:18px;text-align:right" autocomplete="off"></div>`).join('')}
   <div class="row" style="margin-top:8px;align-items:center"><div><label style="margin:0">Moneda</label><select id="pkMon">${['Bs','USD'].map(m=>`<option value="${m}" ${mon===m?'selected':''}>${MON[m]}</option>`).join('')}</select></div>
    ${lote&&lote.length>1?`<div style="text-align:right"><div class="hint">Total</div><b id="pkTot" style="font-size:20px">${fmtMon(0,mon)}</b></div>`:''}</div>
   <div class="seg" style="margin-top:10px">${[['efectivo','💵 Efectivo'],['pago_movil','📱 Pago Móvil']].map(([k2,tx])=>`<button type="button" class="${pkMetodo===k2?'on':''}" data-pkm="${k2}">${tx}</button>`).join('')}</div>
   <div id="pkRefBox" style="${pkMetodo==='pago_movil'?'':'display:none'}"><label>Referencia del Pago Móvil</label><input id="pkRef" inputmode="numeric" placeholder="Ej: 004512345678"></div>
   <div class="row" style="margin-top:10px"><button class="btn o" type="button" id="pkCancel">Cancelar</button><button class="btn g" type="button" id="pkOk">Registrar pago</button></div></div>`}
function porPagar(vid){return L('despacho').filter(d=>d.vendedor===vid&&!d.pagoK&&d.estado!=='en_ruta'&&d.carretillero)}
function vPagosK(){const v=vendActual();if(!v)return '<div class="card empty">Cargando…</div>';const pend=porPagar(v.id);
  const grupos={};pend.forEach(d=>{(grupos[d.carretillero]=grupos[d.carretillero]||[]).push(d)});
  const hoy=new Date().setHours(0,0,0,0);const pagHoy=L('despacho').filter(d=>d.vendedor===v.id&&d.pagoK&&d.pagoK.t>=hoy);
  const tot={};pagHoy.forEach(d=>{const key=d.pagoK.metodo+'|'+d.pagoK.moneda;tot[key]=(tot[key]||0)+(+d.pagoK.monto||0)});
  return `<div class="grid g2">
   <div class="card"><h2>Por pagar a carretilleros</h2><p class="sub">Viajes ya entregados que todavía no pagaste. El monto es el que acuerdes con cada carretillero.</p>
    <div class="list">${Object.entries(grupos).map(([kid,ds])=>{const k=carr(kid);ds.sort((a,b)=>a.t.creado-b.t.creado);
      return `<div class="item"><div class="top"><b style="font-size:19px">${esc(etqCarr(k,v.id))}</b><span class="chip st-en_vehiculo">${ds.length} por pagar</span></div>
       ${pagandoLote===kid?formPagoK(null,v,ds):`${ds.map(d=>`<div class="meta">${hhmm(d.t.creado)} · ${esc(resumenItems(d))} → ${esc(d.placa)}${d.estado==='reclamo'?' · <span class="bad">reclamo</span>':''}</div>`).join('')}
       <button class="btn y" data-plote="${esc(kid)}">💵 Pagar ${ds.length} viaje${ds.length>1?'s':''}</button>`}</div>`}).join('')||'<div class="empty">No tienes viajes por pagar 👍</div>'}</div></div>
   <div class="card" style="align-self:start"><h2>Pagado hoy</h2>${Object.keys(tot).length?Object.entries(tot).map(([key,m])=>{const [met,mon]=key.split('|');return `<div class="row" style="align-items:center"><div>${met==='pago_movil'?'📱 Pago Móvil':'💵 Efectivo'}</div><b style="flex:0 0 auto;font-size:19px">${fmtMon(m,mon)}</b></div>`}).join(''):'<div class="empty">Todavía no pagaste hoy</div>'}
    <p class="hint">${pagHoy.length} viaje${pagHoy.length==1?'':'s'} pagado${pagHoy.length==1?'':'s'} hoy.</p></div></div>`}
async function registrarPagoK(ds,v,montos){const mon=$('pkMon').value,ref=$('pkRef')?$('pkRef').value.trim():'';
  if(ds.some(d=>!(montos[d.id]>0))){toast(ds.length>1?'Escribe el monto de cada viaje':'Escribe el monto acordado');const f=[...document.querySelectorAll('.pk-m')].find(x=>!(numES(x.value)>0));f&&f.focus();return false}
  if(pkMetodo==='pago_movil'&&ref.length<4){toast('Escribe la referencia del Pago Móvil');$('pkRef').focus();return false}
  try{localStorage.setItem('cy-pkmon',mon)}catch(e){}
  const tt=Date.now();const total=ds.reduce((a,d)=>a+montos[d.id],0);
  for(const d of ds){await guardar('despacho',{...S.despacho[d.id],pagoK:{monto:Math.round(montos[d.id]*100)/100,moneda:mon,metodo:pkMetodo,ref,t:tt}})}
  const k=carr(ds[0].carretillero);log(`💵 ${v.nombre} pagó ${fmtMon(total,mon)} a ${etqCarr(k,v.id)} por ${ds.length} viaje${ds.length>1?'s':''} (${pkMetodo==='pago_movil'?'Pago Móvil'+(ref?' ref. '+ref:''):'efectivo'})`);
  toast('Pago registrado');return true}
function bindPagoForm(getDs,v,lote,fin){
  const leer=()=>{const o={};document.querySelectorAll('.pk-m').forEach(x=>o[x.dataset.id]=numES(x.value));return o};
  const sumar=()=>{if($('pkTot')){const s=Object.values(leer()).reduce((a,x)=>a+x,0);$('pkTot').textContent=fmtMon(s,$('pkMon').value)}};
  document.querySelectorAll('.pk-m').forEach(x=>x.oninput=sumar);if($('pkMon'))$('pkMon').onchange=sumar;
  const first=document.querySelector('.pk-m');if(first&&!first.dataset.f){first.dataset.f=1;setTimeout(()=>first.focus(),50)}
  // cambiar método sin re-dibujar (así no se borran los montos escritos)
  document.querySelectorAll('[data-pkm]').forEach(b=>b.onclick=()=>{pkMetodo=b.dataset.pkm;document.querySelectorAll('[data-pkm]').forEach(x=>x.classList.toggle('on',x===b));$('pkRefBox').style.display=pkMetodo==='pago_movil'?'':'none';if(pkMetodo==='pago_movil')$('pkRef').focus()});
  if($('pkCancel'))$('pkCancel').onclick=()=>{pagandoK=null;pagandoLote=null;render()};
  if($('pkOk'))$('pkOk').onclick=async()=>{const ds=getDs();if(!ds.length){pagandoK=null;pagandoLote=null;render();return}
    $('pkOk').disabled=true;const ok=await registrarPagoK(ds,v,leer());if($('pkOk'))$('pkOk').disabled=false;
    if(ok){pagandoK=null;pagandoLote=null;fin&&fin();render()}}}

/* ---- Historial del vendedor ---- */
let hPer='7',hEst='todos';
let histC={key:null,rows:[],cargando:false,error:null};
function filtroHist(vid){const desde=hPer==='todo'?0:hPer==='hoy'?new Date().setHours(0,0,0,0):Date.now()-(+hPer)*DIA;
  if(!ONLINE)return L('despacho').filter(d=>d.vendedor===vid&&d.t.creado>=desde&&(hEst==='todos'||d.estado===hEst)).sort((a,b)=>b.t.creado-a.t.creado);
  const key=vid+'|'+hPer+'|'+hEst;if(histC.key!==key){histC={key,rows:[],cargando:true,error:null};cargarHist(vid,desde,key)}
  // lo que cambió después de la consulta (archivar, pagar, confirmar) se ve al instante
  return histC.rows.map(d=>S.despacho[d.id]||d).filter(d=>hEst==='todos'||d.estado===hEst)}
async function cargarHist(vid,desde,key){const rows=[];const N=1000;
  try{for(let i=0;;i+=N){let q=sb.from('despachos').select('data').eq('vendedor',vid).gte('creado',desde);if(hEst!=='todos')q=q.eq('estado',hEst);
      const r=await q.order('creado',{ascending:false}).range(i,i+N-1);if(r.error)throw r.error;r.data.forEach(x=>rows.push(x.data));if(r.data.length<N||rows.length>=20000)break}
  }catch(e){if(histC.key===key){histC.cargando=false;histC.error='No se pudo cargar el historial. Revisa la conexión.';pedirRender()}return}
  if(histC.key!==key)return;histC.rows=rows;histC.cargando=false;
  asegurar('comprador',rows.map(d=>d.placa));asegurar('carretillero',rows.map(d=>d.carretillero).filter(Boolean));pedirRender()}
function vHistVend(){const v=vendActual();if(!v)return '<div class="card empty">Cargando…</div>';const ds=filtroHist(v.id);
  const n=e=>ds.filter(d=>d.estado===e).length,bultos=ds.reduce((a,d)=>a+(+d.bultos||0),0);
  return `<div class="grid"><div class="card"><h2>Historial de despachos</h2><p class="sub">Todos tus envíos quedan guardados aquí, también los que quitaste de la lista.</p>
   <div class="row"><div><label>Período</label><select id="hPer">${[['hoy','Hoy'],['7','Últimos 7 días'],['30','Últimos 30 días'],['todo','Todo']].map(([k,t])=>`<option value="${k}" ${hPer===k?'selected':''}>${t}</option>`).join('')}</select></div>
    <div><label>Estado</label><select id="hEst">${[['todos','Todos'],['entregado','Recibidos'],['en_ruta','En camino'],['reclamo','Reclamos']].map(([k,t])=>`<option value="${k}" ${hEst===k?'selected':''}>${t}</option>`).join('')}</select></div></div>
   <button class="btn y" id="hCsv" style="width:100%;margin-top:12px" ${ds.length&&!histC.cargando?'':'disabled'}>⬇ Descargar en Excel (${ds.length})</button>${histC.cargando?'<p class="hint" style="margin-top:8px">Cargando historial…</p>':''}${histC.error?`<p class="bad" style="margin-top:8px">${esc(histC.error)}</p>`:''}</div>
  <div class="kpis"><div class="kpi"><b>${ds.length}</b><span>Despachos</span></div><div class="kpi"><b>${bultos}</b><span>Bultos</span></div><div class="kpi"><b>${n('entregado')}</b><span>Recibidos</span></div><div class="kpi"><b>${n('en_ruta')}</b><span>En camino</span></div><div class="kpi"><b>${n('reclamo')}</b><span>Reclamos</span></div>${(()=>{const t={};ds.filter(d=>d.pagoK).forEach(d=>{t[d.pagoK.moneda]=(t[d.pagoK.moneda]||0)+(+d.pagoK.monto||0)});return `<div class="kpi"><b style="font-size:24px">${Object.entries(t).map(([m,x])=>fmtMon(x,m)).join(' + ')||'—'}</b><span>Pagado a carretilleros</span></div>`})()}</div>
  <div class="card">${ds.length>300?`<p class="hint">Se muestran los 300 más recientes de ${ds.length}. El Excel trae todos.</p>`:''}<div class="list">${ds.slice(0,300).map(d=>`${itemDesp(d,'vendedor')}${d.pagoK?`<div class="hint" style="margin-top:-4px">${txtPagoK(d)}</div>`:d.estado!=='en_ruta'&&d.carretillero?'<div class="hint bad" style="margin-top:-4px">Carretillero sin pagar</div>':''}${d.archivado?`<div class="row"><span class="hint">Quitado de la lista</span><button class="btn o" style="flex:0 0 auto" data-desarch="${esc(d.id)}">Volver a la lista</button></div>`:''}`).join('')||(histC.cargando?'<div class="empty">Cargando…</div>':'<div class="empty">No hay despac')+'hos en este período</div>'}</div></div></div>`}
function csvHist(v,ds){const f=t=>t?new Date(t):null;
  const cab=['Fecha','Salida','Recibido','Despacho','Placa','Comprador','Zona','Mercancía','Bultos','Carretillero','Estado','Cómo se confirmó','Reclamo','Pago carretillero','Moneda','Forma de pago','Referencia','Hora de pago'];
  const filas=ds.map(d=>{const c=comp(d.placa),k=carr(d.carretillero),s=f(d.t.creado),r=f(d.t.entregado);
    return [s?s.toLocaleDateString('es-VE'):'',s?hhmm(s):'',r?hhmm(r):'',nro(d),d.placa,c?.nombre||'',c?.zona||'',resumenItems(d),+d.bultos||0,k?etqCarr(k,d.vendedor):'',ETQ[d.estado]||d.estado,
      ({carnet:'Escaneó la credencial',boton:'Confirmó el comprador',vendedor:'Confirmó el vendedor',ficha:'Ficha'})[d.verif?.metodo]||'',d.reclamo||'',
      d.pagoK?(+d.pagoK.monto||0):'',d.pagoK?MON[d.pagoK.moneda]:'',d.pagoK?(d.pagoK.metodo==='pago_movil'?'Pago Móvil':'Efectivo'):(d.estado!=='en_ruta'&&d.carretillero?'SIN PAGAR':''),d.pagoK?.ref||'',d.pagoK?hhmm(d.pagoK.t):'']});
  descargarXLSX(`CargaYa-${(v.nombre||'despachos')}-${hoyLocal()}`,'Despachos',cab,filas)}

/* ---- Vendedor ---- */
let desp={},fichaVista=null,ubicandoCamion=false,editPuesto=false;
function vVendedor(){
  const v=ME.rol==='vendedor'?vend(ME.id):L('vendedor')[0];
  if(!v)return '<div class="card empty">Todavía no hay vendedores registrados.</div>';
  if(fichaVista){const d=S.despacho[fichaVista];const c=comp(d.placa),l=lugar(c),k=carr(d.carretillero);
    return `<div class="trip" style="max-width:640px;margin:0 auto"><div class="hint">Muéstrale esta pantalla al carretillero${k?` <b>${esc(etqCarr(k,d.vendedor))}</b>`:''}</div>
     <div class="hint" style="margin-top:8px;text-transform:uppercase;letter-spacing:1px">Zona</div><div style="font-family:'Barlow Condensed';font-weight:800;font-size:${l.zona.length<=10?72:l.zona.length<=18?54:40}px;line-height:1.02">${esc(l.zona)}</div>
     <div class="carbox" style="margin-top:12px">${c.foto?`<img class="photo" style="width:140px;height:105px" src="${c.foto}" alt="Foto del vehículo">`:''}
      <div><div style="font-size:22px;font-weight:700">${esc(c.vehiculo)}</div><span class="plate" style="font-size:24px">${esc(c.id)}</span>${c.ref?`<div style="font-size:17px;margin-top:4px">📌 ${esc(c.ref)}</div>`:''}</div></div>
     <div class="stepbox" style="margin-top:12px;border-style:solid"><div class="hint">Lleva</div>${itemsDe(d).map(i=>`<div style="font-size:20px"><b>${i.bultos}</b> × ${esc(i.desc)}</div>`).join('')}<div class="hint">Total: ${d.bultos} bultos</div></div>
     ${c.foto?`<img class="photo" style="margin-top:10px;max-height:320px" src="${c.foto}" alt="">`:''}
     ${posComp(c)?`<div style="margin-top:12px">${planoSVG({zoom:[posComp(c),...(posVend(vend(d.vendedor))?[posVend(vend(d.vendedor))]:[])],minW:420,zonaHL:c.zona,dest:posComp(c),destTxt:c.id,camion:posVend(vend(d.vendedor)),camionTxt:'TÚ ESTÁS AQUÍ',ruta:posVend(vend(d.vendedor))})}</div>
       <p class="hint" style="margin-top:4px">${tienePos(c)?'El punto rojo es donde el comprador marcó su vehículo.':'El punto rojo es la zona; el comprador no marcó el lugar exacto.'}${posVend(vend(d.vendedor))?'':' Ubica tu camión en el plano para ver el camino.'}</p>`:''}
     <button class="btn y big" id="fvListo" style="margin-top:12px">Listo, salió</button></div>`}
  const mis=L('despacho').filter(d=>d.vendedor===v.id&&!d.archivado).sort((a,b)=>b.t.creado-a.t.creado);
  const cerrados=mis.filter(d=>d.estado==='entregado').length;
  const k=desp.k?carr(desp.k):null;
  return `<div class="grid g2"><div class="grid" style="align-content:start">
   ${avisoSusc(v)||`<div class="hint" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--line);border-radius:10px"><span>💳 Mensualidad: <b>${(ETQS[suscripcion(v).estado]||[''])[0]}</b>${suscripcion(v).hasta?' hasta el '+fmtFecha(suscripcion(v).hasta):''}</span><a href="#" data-irv="miSusc" style="white-space:nowrap">Ver / Pagar</a></div>`}
   <div class="card" style="${suscripcion(v).puedeDespachar?'':'opacity:.45;pointer-events:none'}"><h2>Nuevo despacho</h2>
   <form id="fDesp"><label>1 · Placa del comprador</label>
    <input id="placa" list="placas" placeholder="Ej: AB123CD" autocomplete="off" value="${esc(desp.placa||'')}" required>
    <datalist id="placas">${compradoresActivos().map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}</datalist>
    <div id="placaInfo"></div>
    <label>2 · Mercancía</label>
    <datalist id="misProductos">${String(v.productos||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>`<option value="${esc(s)}">`).join('')}</datalist>
    ${(desp.items&&desp.items.length?desp.items:[{desc:'',bultos:1}]).map((it,i,arr)=>`<div class="row it-row" style="margin-top:6px;align-items:center"><input class="it-desc" list="misProductos" placeholder="Ej: Papa" value="${esc(it.desc||'')}" autocomplete="off">
      <input class="it-bul" type="number" min="1" inputmode="numeric" style="flex:0 0 76px" value="${esc(it.bultos||1)}" aria-label="Bultos">
      ${arr.length>1?`<button type="button" class="btn o" style="flex:0 0 auto;padding:8px 12px" data-itdel="${i}" aria-label="Quitar">✕</button>`:''}</div>`).join('')}
    <div class="row" style="margin-top:8px;align-items:center"><button type="button" class="btn o" id="itAdd">➕ Agregar ítem</button><div class="hint" style="text-align:right" id="itTot">Total: ${((n)=>`<b>${n}</b> bulto${n==1?'':'s'}`)((desp.items||[{bultos:1}]).reduce((a,x)=>a+(parseInt(x.bultos)||0),0))}</div></div>
    <label>3 · Carretillero</label>
    ${misCarr(v.id).length?`<div style="display:flex;flex-wrap:wrap;gap:8px">${misCarr(v.id).map(x=>`<button type="button" class="btn ${desp.k===x.id?'y':'o'}" style="padding:10px 12px" data-ksel="${esc(x.id)}">#${esc(x.num)} ${esc(x.nombre||'')}</button>`).join('')}</div>`
      :`<p class="hint">Todavía no tienes carretilleros propios (créalos en <a href="#" id="irCarr">Mis carretilleros</a>). Puedes usar el de otro vendedor escaneando su credencial.</p>`}
    ${desp.k&&ajeno(carr(desp.k),v.id)?`<div class="found" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px"><span>✓ <b>${esc(etqCarr(carr(desp.k),v.id))}</b> · credencial escaneada</span><a href="#" id="kQuitar">quitar</a></div>`:''}
    <button type="button" class="btn o" id="dScanK" style="width:100%;margin-top:8px">📷 Escanear credencial${misCarr(v.id).length?' (también de otro vendedor)':''}</button>
    <div style="margin-top:14px"><button class="btn y big" type="submit">Despachar</button></div></form></div>
  <div class="card"><div class="top" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>Mis despachos</h2>${cerrados?`<button class="btn o" style="padding:6px 10px;font-size:14px" id="archTodos">🗂 Quitar los ${cerrados} recibidos</button>`:''}</div>
   <p class="hint">Lo que quitas de la lista queda guardado en <a href="#" id="irHist">Historial</a>.</p>
   <div class="list">${mis.map(d=>`${itemDesp(d,'vendedor')}<div class="row">${d.estado==='en_ruta'?`<button class="btn o" data-ver="${esc(d.id)}">Ver destino</button><button class="btn o" data-vok="${esc(d.id)}">El comprador confirmó de palabra</button>`:''}${d.estado==='reclamo'&&comp(d.placa)?.tel?waBtn(comp(d.placa).tel,'Escribir al comprador'):''}<button class="btn o" style="flex:0 0 auto" data-arch="${esc(d.id)}">🗂 Quitar</button></div>
     ${d.pagoK?`<div class="found" style="font-size:14px">${txtPagoK(d)}</div>`:pagandoK===d.id?formPagoK(d,v):d.carretillero?`<button class="btn ${d.estado==='en_ruta'?'o':'y'}" data-pagk="${esc(d.id)}">💵 Pagar al carretillero</button>`:''}`).join('')||'<div class="empty">No hay despachos en la lista</div>'}</div></div></div>`}


/* ---- Pestañas del vendedor: Mi ubicación y Mensualidad ---- */
function vendYo(){return ME.rol==='vendedor'?vend(ME.id):L('vendedor')[0]}
function avisoSusc(v){const s=suscripcion(v);
  if(!s.puedeDespachar)return `<div class="notfound" style="font-size:16px"><b>Despachos bloqueados:</b> tu mensualidad venció. <a href="#" data-irv="miSusc">Paga el mes aquí</a> para seguir usando CargaYa.</div>`;
  if(s.estado==='gracia')return `<div class="notfound" style="font-size:15px">Tu mensualidad venció el ${fmtFecha(s.hasta)}. <a href="#" data-irv="miSusc">Paga pronto</a> para no quedar bloqueado.</div>`;
  if(s.dias<=3&&!s.pend)return `<div class="hint" style="padding:8px 10px;border:1px solid var(--yel);border-radius:10px">Tu ${s.estado==='prueba'?'prueba gratis':'mensualidad'} vence en ${Math.max(0,s.dias)} día${s.dias==1?'':'s'}. <a href="#" data-irv="miSusc">Ver Mensualidad</a></div>`;
  return ''}
let invN={id:null,n:null,t:0};
function invitados(v){if(invN.id!==v.id||Date.now()-invN.t>60000){invN={id:v.id,n:invN.id===v.id?invN.n:null,t:Date.now()};
    sb.from('compradores').select('id',{count:'exact',head:true}).eq('data->>invitadoPor',v.id).then(r=>{if(!r.error&&invN.id===v.id&&invN.n!==r.count){invN.n=r.count;pedirRender()}})}
  return invN.n}
function cardInvita(v){const u=urlInvita(v);
  if(!window.qrcode)cargarQRlib().then(()=>pedirRender()).catch(()=>{});
  const txt=`Hola 👋 Soy ${v.nombre} en el Mercado Mayor de Coche. Con *CargaYa* ves dónde está mi puesto y controlas cada entrega a tu vehículo. Entra aquí y quedo en tus favoritos: `;
  return `<div class="card"><h2>📣 Invita a tus compradores</h2><p class="sub">Comparte este QR o el enlace. El comprador que entre con él te tendrá automáticamente en sus <b>favoritos</b>.</p>
   <div style="text-align:center">${window.qrcode?`<img id="invQR" src="${qrImg(u,260)}" alt="QR de invitación" style="width:220px;height:220px;image-rendering:pixelated">`:'<div class="hint" style="padding:40px 0">Generando QR…</div>'}</div>
   <button class="btn y" id="invShare" style="width:100%;margin-top:8px">📲 Compartir imagen del QR (WhatsApp)</button>
   <a class="btn g" style="display:block;text-align:center;text-decoration:none;margin-top:8px;color:#fff" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt+u)}">💬 Enviar enlace por WhatsApp</a>
   <div class="row" style="margin-top:8px"><button class="btn o" id="invDesc">⬇ Descargar QR</button><button class="btn o" style="flex:0 0 auto" data-copiar="${esc(u)}">Copiar enlace</button></div>
   <p class="hint" style="word-break:break-all;margin-top:6px">${esc(u)}</p>
   ${invitados(v)!=null?`<div class="found" style="margin-top:8px">👥 Compradores que entraron con tu invitación: <b>${invitados(v)}</b></div>`:''}</div>`}
async function imagenInvita(v){await cargarQRlib();const u=urlInvita(v);const W=720,H=900,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#16181c';x.fillRect(0,0,W,130);x.fillStyle='#ffc400';x.fillRect(0,130,W,14);
  x.fillStyle='#ffc400';x.font='bold 64px sans-serif';x.textAlign='center';x.fillText('CargaYa',W/2,78);x.fillStyle='#fff';x.font='24px sans-serif';x.fillText('Mercado Mayor de Coche',W/2,114);
  x.fillStyle='#16181c';x.font='bold 40px sans-serif';const nom=v.nombre.length>28?v.nombre.slice(0,27)+'…':v.nombre;x.fillText(nom,W/2,205);
  x.font='26px sans-serif';x.fillStyle='#555';if(v.productos)x.fillText(('🛒 '+v.productos).slice(0,44),W/2,245);
  const img=new Image();img.src=qrImg(u,480);await new Promise(r=>{img.onload=r;img.onerror=r});x.imageSmoothingEnabled=false;x.drawImage(img,(W-480)/2,270,480,480);
  x.fillStyle='#16181c';x.font='bold 30px sans-serif';x.fillText('Escanéame con la cámara',W/2,800);x.font='24px sans-serif';x.fillStyle='#555';x.fillText('y quedo en tus vendedores favoritos',W/2,840);
  return await new Promise(r=>cv.toBlob(r,'image/png'))}
function vMiUbic(){const v=vendYo();if(!v)return '<div class="card empty">Cargando…</div>';
  if(ubicandoCamion)return `<div class="card"><h2>Ubica tu camión en el plano</h2><p class="sub">${tienePos(v)&&v.ubicMetodo==='gps'?`Te ubicamos por GPS (±${v.ubicAcc||'?'} m). Si el punto no es exacto, toca en el plano dónde está tu camión.`:'Toca dónde está tu camión. Se hace una sola vez; cámbialo si te mueves.'}</p>
    ${planoSVG({id:'vPick',pick:true,zoom:[tienePos(v)?[v.px,v.py]:[VZ.cx,VZ.cy]],minW:420,camion:posVend(v),camionTxt:'MI CAMIÓN'})}<div class="row" style="margin-top:10px"><button class="btn y" id="vListo">Listo</button></div></div>`;
  return `<div class="grid" style="max-width:640px;margin:0 auto">
   <div class="card"><h2>Mi puesto</h2><p class="sub">Los compradores te encuentran en su lista de vendedores.</p>
    ${editPuesto?`<label>¿Qué vendes?</label><input id="mpProd" placeholder="Ej: Papa, cebolla, zanahoria" value="${esc(v.productos||'')}">
      <label>¿En qué sector está tu puesto?</label>${selZona('mpZona',v.sector||'')}
      <label>Referencia del puesto</label><input id="mpRef" placeholder="Ej: camión rojo, al lado de la columna 5" value="${esc(v.refPuesto||'')}">
      <div class="row" style="margin-top:10px"><button class="btn o" id="mpCancel">Cancelar</button><button class="btn y" id="mpOk">Guardar</button></div>`
     :`<div style="font-size:17px"><b>${esc(v.productos||'¿Qué vendes? Sin indicar')}</b></div>
      <div class="meta">Sector: <b>${esc(v.sector||'sin indicar')}</b>${v.refPuesto?' · 📌 '+esc(v.refPuesto):''}</div>
      <div class="meta">${tienePos(v)?`📍 Ubicado ${txtUbic(v)}${v.ubicT?' · '+fmtFecha(v.ubicT)+' '+hhmm(v.ubicT):''}`:posVend(v)?'📍 Ubicado por su sector':v.sector?'<span class="hint">Tu sector todavía no está ubicado en el plano (lo hace la administración). Si quieres, marca tu lugar exacto.</span>':'<span class="bad">Falta indicar tu sector</span>'}</div>
      <button class="btn ${v.sector&&v.productos?'o':'y'}" id="mpEditar" style="width:100%;margin-top:8px">✏️ Qué vendo, sector y referencia</button>
      <p class="hint" style="margin:10px 0 0">${tienePos(v)?'Cambiar mi lugar exacto:':'Mi lugar exacto (opcional):'}</p>
      <div class="row" style="margin-top:4px"><button class="btn o" id="vGPS" ${gpsBusca?'disabled':''}>${gpsBusca?'Buscando… (hasta 12 s)':'📡 Usar mi GPS'}</button><button class="btn o" id="vUbicar">🗺 Marcar en el plano</button></div>
      ${gpsErr&&!ubicandoCamion?`<div class="notfound" style="margin-top:8px">${esc(gpsErr)}</div>`:''}`}</div>
   ${cardInvita(v)}
   ${posVend(v)?`<div class="card"><h2>Así te ven en el plano</h2>${planoSVG({zoom:[posVend(v)],minW:420,camion:posVend(v),camionTxt:'MI PUESTO'})}</div>`:''}</div>`}
function vMiSusc(){const v=vendYo();if(!v)return '<div class="card empty">Cargando…</div>';
  return `<div style="max-width:640px;margin:0 auto">${cardSuscripcion(v)}
   ${pagando?'':'<p class="hint" style="margin-top:10px">Pagas el mes por Pago Móvil y cargas la referencia aquí. La administración lo revisa y lo aprueba; mientras tanto puedes seguir despachando.</p>'}</div>`}

/* ---- Directorio de vendedores para el comprador ---- */
let vcBusca='',vcMapa=null,yoGPS=null,yoErr=null,yoBuscando=false;
const normTxt=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function distVend(v){if(!yoGPS)return null;const pv=posVend(v);if(!pv)return null;const ll=toLatLng(pv[0],pv[1]);return {m:distM(yoGPS,ll),r:rumbo(yoGPS,ll)}}
const fmtDist=m=>m<1000?`≈ ${Math.max(10,Math.round(m/10)*10)} m`:`≈ ${(m/1000).toFixed(1).replace('.',',')} km`;
function vVendC(){const c=ME.rol==='comprador'?comp(ME.id):null;const favs=(c&&c.favoritos)||[];
  const activos=L('vendedor').filter(v=>v.alDia!==undefined?v.alDia!==false:suscripcion(v).estado!=='vencida');
  const q=normTxt(vcBusca);const yoEn=yoGPS&&enPlano(yoGPS);const yoXY=yoEn?XY(yoGPS):null;
  const orden=(a,b)=>{const da=yoEn?distVend(a):null,db=yoEn?distVend(b):null;if(da&&db)return da.m-db.m;if(da)return -1;if(db)return 1;return (a.nombre||'').localeCompare(b.nombre||'')};
  const lista=activos.filter(v=>!q||normTxt(v.nombre+' '+(v.productos||'')+' '+(v.sector||'')+' '+(v.refPuesto||'')).includes(q)).sort(orden);
  const tarjeta=v=>{const fav=favs.includes(v.id),pv=posVend(v),dv=yoEn?distVend(v):null;return `<div class="item"><div class="top"><b style="font-size:19px">${fav?'⭐ ':''}${esc(v.nombre)}${c&&c.invitadoPor===v.id&&fav?' <span class="chip st-entregado" style="font-size:12px;vertical-align:middle">Tu vendedor</span>':''}</b><button class="btn ${fav?'y':'o'}" style="flex:0 0 auto;padding:6px 10px" data-fav="${esc(v.id)}">${fav?'★ Favorito':'☆ Favorito'}</button></div>
    <div style="font-size:16px">${v.productos?'🛒 '+esc(v.productos):'<span class="hint">No indicó qué vende</span>'}</div>
    <div class="meta">📍 Sector: <b>${esc(v.sector||'sin indicar')}</b>${v.refPuesto?' · '+esc(v.refPuesto):''}</div>
    ${dv?`<div class="dist" style="padding:8px 12px;margin-top:6px"><div class="arrow" style="width:40px;height:40px;flex:0 0 40px"><svg width="22" height="22" viewBox="-13 -13 26 26" style="transform:rotate(${Math.round(dv.r.g)}deg)"><path d="M0,-11 L8,8 L0,3 L-8,8Z" fill="#16181c"/></svg></div><div><b style="font-size:26px">${fmtDist(dv.m)}</b><div>hacia el ${dv.r.txt}</div></div></div>`:''}
    ${vcMapa===v.id&&pv?`<div style="margin-top:6px">${planoSVG({zoom:[pv,...(yoXY?[yoXY]:[])],minW:420,camion:pv,camionTxt:v.nombre.slice(0,18).toUpperCase(),zonaHL:v.sector,yo:yoXY})}</div>`:''}
    <div class="row" style="flex-wrap:wrap">${pv?`<button class="btn o" data-vcmap="${esc(v.id)}">🗺 ${vcMapa===v.id?'Ocultar mapa':'Ver en el mapa'}</button>`:''}${v.tel&&wa(v.tel)?`<a class="btn g" style="text-align:center;text-decoration:none;color:#fff" target="_blank" rel="noopener" href="${wa(v.tel)}">💬 WhatsApp</a>`:''}</div></div>`};
  const inv=c&&c.invitadoPor;const lf=lista.filter(v=>favs.includes(v.id)).sort((a,b)=>(b.id===inv)-(a.id===inv)),lo=lista.filter(v=>!favs.includes(v.id));
  return `<div class="grid"><div class="card"><h2>Vendedores</h2><p class="sub">Busca por producto o sector y marca tus favoritos.</p>
    <input id="vcBusca" placeholder="🔍 Ej: tomate, papa, Nave A…" value="${esc(vcBusca)}" autocomplete="off">
    <button class="btn ${yoGPS?'o':'y'}" id="vcYo" style="width:100%;margin-top:10px" ${yoBuscando?'disabled':''}>${yoBuscando?'Buscando tu ubicación… (hasta 12 s)':yoGPS?'📍 Actualizar dónde estoy':'📍 ¿Dónde estoy? Ver distancias'}</button>
    ${yoErr?`<div class="notfound" style="margin-top:8px">${esc(yoErr)}</div>`:yoGPS?(yoEn?`<p class="hint" style="margin-top:6px">Ubicado ${hhmm(yoGPS.t)} (±${yoGPS.acc} m). Distancias aproximadas, en línea recta. La flecha indica la dirección respecto del norte; usa el sector para orientarte.</p>`:`<div class="notfound" style="margin-top:8px">Parece que no estás en el mercado: el GPS te ubica a ${fmtDist(distM(yoGPS,CENTRO))} del centro.</div>`):''}</div>
   ${lf.length?`<div class="card"><h2>⭐ Mis favoritos</h2><div class="list">${lf.map(tarjeta).join('')}</div></div>`:''}
   <div class="card"><h2>${q?`Resultados (${lo.length})`:lf.length?(yoEn?'Otros vendedores, los más cerca primero':'Otros vendedores'):yoEn?'Los más cerca primero':'Todos los vendedores'}</h2><div class="list">${lo.map(tarjeta).join('')||`<div class="empty">${q?(lf.length?'Ningún otro vendedor coincide con la búsqueda':'Ningún vendedor coincide con la búsqueda'):lf.length?'No hay otros vendedores':'Todavía no hay vendedores'}</div>`}</div></div>
   ${c&&c.vehiculo?cardAmigo(c):''}</div>`}
let amigosN={t:0,n:null};
function amigosInvitados(){if(Date.now()-amigosN.t>60000){amigosN.t=Date.now();sb.rpc('amigos_invitados').then(r=>{if(!r.error&&amigosN.n!==r.data){amigosN.n=r.data;pedirRender()}})}return amigosN.n}
function cardAmigo(c){const u=urlAmigo();if(!window.qrcode)cargarQRlib().then(()=>pedirRender()).catch(()=>{});const n=amigosInvitados();
  const nf=(c.favoritos||[]).length;const txt=`Hola 👋 Uso *CargaYa* en el Mercado Mayor de Coche para recibir mi mercancía y ubicar a mis vendedores. Entra con este enlace y te paso mis ${nf?nf+' ':''}vendedores de confianza: `;
  return `<div class="card"><h2>👥 Invita a un amigo o vecino</h2><p class="sub">Tu amigo crea su cuenta con este enlace o escaneando el QR desde tu teléfono, y recibe tus vendedores favoritos${nf?` (${nf})`:''}.</p>
   ${amigoQR?`<div style="text-align:center">${window.qrcode?`<img src="${qrImg(u,260)}" alt="QR de invitación" style="width:230px;height:230px;image-rendering:pixelated">`:'<div class="hint" style="padding:40px 0">Generando QR…</div>'}<p class="hint">Que tu amigo lo escanee con la cámara de su teléfono.</p></div>`:''}
   <a class="btn g" style="display:block;text-align:center;text-decoration:none;margin-top:8px;color:#fff" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt+u)}">💬 Invitar por WhatsApp</a>
   <div class="row" style="margin-top:8px"><button class="btn o" id="amQR">${amigoQR?'Ocultar QR':'📱 Mostrar QR'}</button><button class="btn o" style="flex:0 0 auto" id="amCopiar" data-u="${esc(u)}">Copiar enlace</button></div>
   ${n!=null&&n>0?`<div class="found" style="margin-top:8px">👥 Amigos que entraron con tu invitación: <b>${n}</b></div>`:''}</div>`}
let amigoQR=false;

/* ---- Comprador ---- */
let reg=null,corrigiendo=null,recibiendo=null,carnetOk={};
// Ubicación por GPS sobre el plano (con margen de unos 40 m alrededor del mercado)
async function ubicarGPS(){const f=await mejorFix(12000);const q=fromLatLng(f.lat,f.lng);
  const xs=GEO.map(p=>p[0]),ys=GEO.map(p=>p[1]),m=65;
  if(!(pip(q.x,q.y,GEO)||(q.x>Math.min(...xs)-m&&q.x<Math.max(...xs)+m&&q.y>Math.min(...ys)-m&&q.y<Math.max(...ys)+m)))
    throw new Error(`Tu GPS te ubica fuera del mercado (a unos ${(d=>d>2000?Math.round(d/1000)+' km':Math.round(d)+' m')(distM(f,CENTRO))} del centro). Márcalo a mano en el plano.`);
  return {x:Math.round(q.x),y:Math.round(q.y),acc:f.acc}}
const txtUbic=o=>o.ubicMetodo==='gps'?`por GPS (±${o.ubicAcc||'?'} m)`:'a mano en el plano';
let gpsBusca=false,gpsErr='';
function selZona(id,actual){const ns=nombresZona();if(!ns.length)return `<input id="${id}T" placeholder="Ej: Detrás del Barco" value="${esc(actual||'')}">`;
  const otra=actual&&!ns.includes(actual);
  return `<select id="${id}"><option value="">— Elige la zona —</option>${ns.map(n=>`<option ${actual===n?'selected':''}>${esc(n)}</option>`).join('')}<option value="__otra" ${otra?'selected':''}>Otra…</option></select>
   <input id="${id}T" placeholder="Escribe cómo le dicen a esa zona" value="${otra?esc(actual):''}" style="margin-top:6px;${otra?'':'display:none'}">`}
function leerZona(id){const s=$(id),t=$(id+'T');if(!s)return t?t.value.trim():'';return s.value==='__otra'?(t?t.value.trim():''):s.value}
function vComprador(){
  const c=ME.rol==='comprador'?comp(ME.id):compradoresActivos()[0];
  if(ME.rol==='comprador'&&(!c||!c.vehiculo||c.activo===false||reg))return vRegistro(c);
  if(!c)return '<div class="card empty">Todavía no hay compradores registrados.</div>';
  const mis=L('despacho').filter(d=>d.placa===c.id).sort((a,b)=>b.t.creado-a.t.creado);
  const enCamino=mis.filter(d=>d.estado==='en_ruta');
  return `<div class="grid g2"><div class="grid" style="align-content:start">
   <div class="card"><h2>Mi vehículo</h2>
    <div class="carbox" style="margin-top:6px">${c.foto?`<img class="photo sm" src="${c.foto}" alt="Foto del vehículo">`:'<div class="photo sm" style="display:grid;place-items:center;color:#8a9099;font-size:12px">Sin foto</div>'}
     <div><span class="plate">${esc(c.id)}</span> ${esc(c.vehiculo)}<div class="hint" style="margin-top:4px">Zona</div><div class="loc" style="font-size:${c.zona?28:20}px">${esc(c.zona||'Sin zona')}</div>${c.ref?`<div class="meta">📌 ${esc(c.ref)}</div>`:''}</div></div>
    ${posComp(c)?`<div style="margin-top:10px">${planoSVG({zoom:[posComp(c)],minW:420,zonaHL:c.zona,dest:posComp(c),destTxt:c.id})}</div>`:''}
    ${ME.rol==='comprador'?`<div class="row" style="margin-top:12px"><button class="btn o" id="cEditar">Moví el vehículo / editar</button><button class="btn o" id="meVoy">Ya me fui del mercado</button></div>`:''}</div>
   <div class="card" style="${enCamino.length?'border:2px solid var(--yel)':''}"><h2>Por recibir</h2>
    <p class="sub">Cuando te llegue la mercancía, revísala y escanea el carnet del carretillero para confirmar.</p>
    ${enCamino.map(d=>{const abierto=recibiendo===d.id;return `<div class="item" style="margin-top:10px"><div class="top"><b>${tituloItems(d)}</b>${chip(d.estado)}</div>${htmlItems(d)}
      <div class="meta">De ${esc(vend(d.vendedor)?.nombre||'')} · salió ${hhmm(d.t.creado)}</div>
      ${abierto?`${carnetOk[d.id]?`<div class="found" style="margin-top:8px;font-size:17px">✓ Carnet <b>#${esc(carnetOk[d.id])}</b> verificado: es el carretillero de este despacho</div>`
        :`<button class="btn y big" data-rscan="${esc(d.id)}" style="margin-top:8px">📷 Escanear el carnet del carretillero</button>
        <label>¿No puedes escanearlo? Escribe su número (si lo viste)</label><input id="rcN" inputmode="numeric" placeholder="Ej: 07">`}
        <button class="btn g big" data-rok="${esc(d.id)}" style="margin-top:10px">Recibí ${d.bultos} bultos completos</button>
        <label>¿Falta algo? Escribe qué</label><input id="rcRecl" placeholder="Ej: llegaron 5 bultos, faltó 1"><div class="row" style="margin-top:8px"><button class="btn o" data-rmal="${esc(d.id)}">Reportar faltante</button><button class="btn o" style="flex:0 0 auto" id="rcCancel">Cancelar</button></div>`
       :`<button class="btn y" data-rabrir="${esc(d.id)}">Ya me llegó</button>`}</div>`}).join('')||'<div class="empty">No tienes mercancía en camino</div>'}</div></div>
  <div class="card"><h2>Mis compras</h2><p class="sub">${enCamino.length} por recibir · ${mis.length-enCamino.length} cerradas</p>
   <div class="list">${mis.map(d=>`${itemDesp(d,'comprador')}${d.estado!=='entregado'&&vend(d.vendedor)?.tel?waBtn(vend(d.vendedor).tel,'Escribir al vendedor'):''}`).join('')||'<div class="empty">Cuando un vendedor despache a tu placa, lo vas a ver aquí</div>'}</div></div></div>`}
function vRegistro(c){
  const r=reg||(reg={veh:c?.vehiculo||'',ref:c?.ref||'',foto:c?.foto||null,zona:c?.zona||'',px:c?.px??null,py:c?.py??null,pv:c?.pv,metodo:c?.ubicMetodo,acc:c?.ubicAcc});
  return `<div class="card" style="max-width:560px;margin:0 auto">
   <h2>Llegué y estacioné</h2><p class="sub">Antes de irte a comprar, dinos dónde quedó tu vehículo. Así el carretillero lo encuentra sin que estés ahí.</p>
   <form id="fReg"><div class="found"><span class="plate">${esc(ME.id)}</span> ${esc(ME.nombre)}</div>
    <label>¿En qué zona estacionaste?</label>${selZona('rZona',r.zona)}
    ${(()=>{const z=zonaPorNombre(r.zona);const q=r.px!=null&&r.pv===PV?[r.px,r.py]:null;const verMapa=q||r.manual;
      return `<label>¿Dónde exactamente quedó tu vehículo? (opcional)</label>
      <div class="row"><button type="button" class="btn ${q&&r.metodo==='gps'?'y':'o'}" id="rGPS" ${gpsBusca?'disabled':''}>${gpsBusca?'Buscando… (hasta 12 s)':'📡 Usar mi GPS'}</button><button type="button" class="btn ${verMapa&&r.metodo!=='gps'?'y':'o'}" id="rManual">🗺 Marcar en el plano</button></div>
      ${gpsErr?`<div class="notfound" style="margin-top:8px">${esc(gpsErr)}</div>`:''}
      ${verMapa?`${planoSVG({id:'rPick',pick:true,zoom:[q||(zEn(z)?[z.x,z.y]:[VZ.cx,VZ.cy])],minW:360,zonaHL:z?z.nombre:null,dest:q,destTxt:q?ME.id:''})}
      <p class="hint" style="margin-top:4px">${q?(r.metodo==='gps'?`✓ Ubicado por GPS (±${r.acc||'?'} m). Si no es exacto, toca el plano para corregir.`:'✓ Marcado. Toca otra vez para corregir.'):'Toca en el plano dónde quedó tu vehículo.'}</p>`
      :`<p class="hint" style="margin-top:4px">${q?'':'Si no lo marcas, el carretillero verá solo la zona.'}</p>`}`})()}
    <label>Vehículo (tipo y color)</label><input id="rVeh" placeholder="Ej: Camión 350 blanco" value="${esc(r.veh)}" required>
    <label>Referencia para encontrarlo (opcional)</label><input id="rRef" placeholder="Ej: detrás del camión cava azul" value="${esc(r.ref)}">
    <label>Foto del vehículo y lo que lo rodea (recomendado)</label>
    <div class="row"><label class="btn o" style="margin:0;text-align:center">${r.foto?'Cambiar foto':'📷 Tomar foto'}<input type="file" accept="image/*" capture="environment" id="rFoto" class="hidden"></label>${r.foto?`<img class="photo sm" style="flex:0 0 96px" src="${r.foto}" alt="">`:''}</div>
    <div class="row" style="margin-top:16px">${c&&c.vehiculo&&c.activo!==false?'<button class="btn o" type="button" id="cancelReg">Cancelar</button>':''}<button class="btn y" type="submit">Guardar y empezar a comprar</button></div></form></div>`}

/* ===================== Acciones ===================== */
const $=id=>document.getElementById(id);
async function procesarScanFicha(){const t=await escanear('Escanea la ficha','El QR impreso en la ficha de entrega');if(!t)return null;const p=parseCodigo(t);if(!p||p.tipo!=='f'){toast('Ese código no es una ficha de CargaYa');return null}return p}
const bind={
  inicio(){
    document.querySelectorAll('[data-rol]').forEach(b=>b.onclick=()=>{rolElegido=b.dataset.rol;render()});
    if($('atras'))$('atras').onclick=()=>{rolElegido=null;render()};
    if($('fYo'))$('fYo').onsubmit=async e=>{e.preventDefault();const r=rolElegido;
      if(r==='admin'){if($('yClave').value!==String(CFG.CLAVE_ADMIN)){toast('Clave incorrecta');return}setME({rol:'admin',id:'admin',nombre:'Administración'});rolElegido=null;view='mercado';render();return}
      const nombre=$('yNombre').value.trim(),tel=$('yTel').value.trim();
      if(r==='comprador'){const p=normPlaca($('yPlaca').value);if(p.length<6){toast('Revisa la placa');return}
        const prev=comp(p);setME({rol:'comprador',id:p,nombre,tel});if(prev){await guardar('comprador',{...prev,nombre,tel,activo:true})}rolElegido=null;reg=null;render();return}
      const id=nuevoId('V');await guardar('vendedor',{id,nombre,tel,creado:Date.now()});setME({rol:'vendedor',id,nombre});log(`Se registró el vendedor ${nombre}`);rolElegido=null;render()};
  },
  mercado(){
    if(!ADMS)cargarAdmins();
    if($('admNuevoOk'))$('admNuevoOk').onclick=async()=>{const tel=telDigitos($('admNuevoTel').value),pin=$('admNuevoPin').value.trim();
      if(tel.length<10){toast('Escribe el teléfono completo');return}if(pin&&!/^\d{6}$/.test(pin)){toast('El PIN debe tener 6 números');return}
      $('admNuevoOk').disabled=true;const r=await sb.rpc('agregar_admin',{tel_digitos:tel,pin_nuevo:pin||null});if($('admNuevoOk'))$('admNuevoOk').disabled=false;
      if(r.error){toast('No se pudo agregar: '+r.error.message);return}if(r.data!=='ok'){toast(r.data);return}
      $('admNuevoTel').value='';$('admNuevoPin').value='';toast('Administrador agregado');ADMS=null;cargarAdmins()};
    document.querySelectorAll('[data-admdel]').forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='¿Seguro? Toca otra vez';return}
      const r=await sb.rpc('quitar_admin',{uid_quitar:b.dataset.admdel});if(r.error){toast('No se pudo quitar: '+r.error.message);return}if(r.data!=='ok'){toast(r.data);return}toast('Administrador quitado');ADMS=null;cargarAdmins()});
    if($('admResp'))$('admResp').onclick=async()=>{$('admResp').disabled=true;toast('Preparando el respaldo…');try{await respaldoExcel()}catch(e){toast('No se pudo generar el respaldo')}if($('admResp'))$('admResp').disabled=false};
    if($('admRespJ'))$('admRespJ').onclick=async()=>{const r=await sb.rpc('respaldo');if(r.error){toast('No se pudo generar la copia');return}const blob=new Blob([JSON.stringify(r.data,null,1)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`CargaYa-copia-tecnica-${hoyLocal()}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Copia técnica descargada')};
    if($('admPinOk'))$('admPinOk').onclick=async()=>{const tel=telDigitos($('admPinTel').value),pin=$('admPinNuevo').value.trim();
      if(tel.length<10){toast('Escribe el teléfono completo');return}if(tel.length<11&&!/^58/.test(tel)){toast('Escribe el teléfono con el código de país (ej: +54 9 11…)');return}if(!/^\d{6}$/.test(pin)){toast('El PIN debe tener 6 números');return}
      $('admPinOk').disabled=true;const r=await sb.rpc('cambiar_pin',{tel_digitos:tel,pin_nuevo:pin});if($('admPinOk'))$('admPinOk').disabled=false;
      if(r.error){toast('No se pudo cambiar: '+r.error.message);return}if(r.data!=='ok'){toast(r.data);return}
      $('admPinTel').value='';$('admPinNuevo').value='';toast('PIN cambiado. Avísale al usuario.')};
  },
  cobros(){
    document.querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>{cobroTab=b.dataset.ct;rechazando=null;render()});
    document.querySelectorAll('[data-papr]').forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Toca otra vez para aprobar';return}
      const p=S.pago[b.dataset.papr],v=vend(p.vendedor);const s=suscripcion(v);const base=Math.max(Date.now(),s.hasta);const hasta=sumarMes(base);
      await guardar('vendedor',{...v,pagadoHasta:hasta});await guardar('pago',{...p,estado:'aprobado',tAprob:Date.now(),hasta});log(`✓ Pago aprobado: ${v.nombre}, ${fmtBs(p.monto)} (ref. ${p.referencia}). Al día hasta ${fmtFecha(hasta)}`);toast('Pago aprobado');render()});
    document.querySelectorAll('[data-prech]').forEach(b=>b.onclick=()=>{rechazando=b.dataset.prech;render()});
    if($('rCancel'))$('rCancel').onclick=()=>{rechazando=null;render()};
    document.querySelectorAll('[data-prechok]').forEach(b=>b.onclick=async()=>{const p=S.pago[b.dataset.prechok];const m=$('rMot').value.trim()||'sin detalle';rechazando=null;
      await guardar('pago',{...p,estado:'rechazado',motivo:m,tRech:Date.now()});log(`✗ Pago rechazado: ${vend(p.vendedor)?.nombre} (ref. ${p.referencia}): ${m}`);render()});
    document.querySelectorAll('[data-pmes]').forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Toca otra vez para dar +1 mes';return}
      const v=vend(b.dataset.pmes);const s=suscripcion(v);const hasta=sumarMes(Math.max(Date.now(),s.hasta));await guardar('vendedor',{...v,pagadoHasta:hasta});log(`Mes sin pago a ${v.nombre}: al día hasta ${fmtFecha(hasta)}`);render()});
    if($('fCfg'))$('fCfg').onsubmit=async e=>{e.preventDefault();const num=x=>parseFloat(String(x).replace(/\./g,'').replace(',','.'))||0;const prev=cfgCobro();const tasa=num($('cfTasa').value);
      await guardar('config',{id:'cobro',precioUSD:num($('cfPrecio').value)||prev.precioUSD,tasa,tasaFecha:tasa!==prev.tasa?Date.now():prev.tasaFecha,banco:$('cfBanco').value.trim(),telefono:$('cfTel').value.trim(),cedula:$('cfCed').value.trim(),titular:$('cfTit').value.trim(),
        pruebaDias:Math.max(0,parseInt($('cfPrueba').value)||0),graciaDias:Math.max(0,parseInt($('cfGracia').value)||0),adminTel:$('cfAdminTel').value.trim()});log('Ajustes de cobro actualizados');toast('Ajustes guardados');render()};
  },
  uso(){
    if($('usoRef'))$('usoRef').onclick=e=>{e.preventDefault();cargarMetricas(true)};
    if($('usoXls'))$('usoXls').onclick=e=>{e.preventDefault();if(MET)excelUso()};
    document.querySelectorAll('[data-usotab]').forEach(b=>b.onclick=()=>{usoTab=b.dataset.usotab;render()});
    if($('usoOrden'))$('usoOrden').onchange=()=>{usoOrden=$('usoOrden').value;render()};
    if($('usoQ')){let t=null;$('usoQ').oninput=()=>{usoQ=$('usoQ').value;clearTimeout(t);t=setTimeout(()=>{const pos=$('usoQ').selectionStart;render();const nb=$('usoQ');nb.focus();nb.setSelectionRange(pos,pos)},300)}}
  },
  comprAdm(){
    const b=$('caBusca');let t=null;b.oninput=()=>{caBusca=b.value;caN=100;clearTimeout(t);t=setTimeout(()=>{const pos=$('caBusca').selectionStart;CA.key=null;render();const nb=$('caBusca');nb.focus();nb.setSelectionRange(pos,pos)},350)};
    $('caFiltro').onchange=()=>{caFiltro=$('caFiltro').value;caN=100;CA.key=null;render()};
    if($('caMas'))$('caMas').onclick=()=>{caN+=200;render()};
    $('caCsv').onclick=async()=>{$('caCsv').disabled=true;try{csvCompradores(await todosCA());toast('Archivo descargado')}catch(e){toast('No se pudo descargar la lista')}if($('caCsv'))$('caCsv').disabled=false};
  },
  zonas(){
    const add=async()=>{const n=$('zNombre').value.trim().replace(/\s+/g,' ');if(!n){toast('Escribe el nombre de la zona');return}
      if(nombresZona().some(x=>x.toLowerCase()===n.toLowerCase())){toast('Esa zona ya existe');return}
      const id=n.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').slice(0,30)+'-'+Date.now().toString(36);await guardar('zona',{id,nombre:n,tipo:'compradores',t:Date.now()});log(`Zona agregada: "${n}"`);$('zNombre').value='';render()};
    if(zonaUbicando){const svg=$('zPick');svg.onclick=async ev=>{const q=svgXY(svg,ev);const z=S.zona[zonaUbicando];const area=z.pv===PV&&z.poly?z.poly:null;await guardar('zona',{...z,x:q.x,y:q.y,pv:PV,poly:area});render()};
      $('zListo').onclick=()=>{log(`Zona "${S.zona[zonaUbicando].nombre}" ubicada en el plano`);zonaUbicando=null;render()};return}
    if(zonaDib){const svg=$('zDib');svg.onclick=ev=>{const q=svgXY(svg,ev);dibPts.push([q.x,q.y]);render()};
      $('dDeshacer').onclick=()=>{dibPts.pop();render()};$('dCancelar').onclick=()=>{zonaDib=null;dibPts=[];render()};
      $('dListo').onclick=async()=>{const z=S.zona[zonaDib];const c=centroide(dibPts);const centroOk=zEn(z)&&pip(z.x,z.y,dibPts);
        await guardar('zona',{...z,poly:dibPts,pv:PV,x:centroOk?z.x:c[0],y:centroOk?z.y:c[1]});log(`Área de la zona "${z.nombre}" dibujada en el plano`);zonaDib=null;dibPts=[];render()};return}
    if(plEdit){const svg=$('plPick');const ent=plEdit.tipo==='entrada';
      svg.onclick=ev=>{const q=svgXY(svg,ev);if(ent)plEdit.pts=[[q.x,q.y]];else plEdit.pts.push([q.x,q.y]);render()};
      if($('plDeshacer'))$('plDeshacer').onclick=()=>{plEdit.pts.pop();render()};$('plCancelar').onclick=()=>{plEdit=null;render()};
      $('plListo').onclick=async()=>{const e=plEdit;plEdit=null;
        if(ent)await guardarPlano(pl=>{const o={id:e.id,nombre:e.nombre,x:e.pts[0][0],y:e.pts[0][1]};const i=pl.entradas.findIndex(x=>x.id===e.id);i>=0?pl.entradas[i]=o:pl.entradas.push(o)},`Entrada "${e.nombre}" marcada en el plano`);
        else await guardarPlano(pl=>{const o={id:e.id,nombre:e.nombre,sentido:e.sentido,pts:e.pts};const i=pl.pasillos.findIndex(x=>x.id===e.id);i>=0?pl.pasillos[i]=o:pl.pasillos.push(o)},`Pasillo "${e.nombre}" dibujado en el plano`)};return}
    document.querySelectorAll('[data-zmap]').forEach(b=>b.onclick=()=>{zonaUbicando=b.dataset.zmap;render();window.scrollTo(0,0)});
    document.querySelectorAll('[data-zdib]').forEach(b=>b.onclick=()=>{zonaDib=b.dataset.zdib;dibPts=[];render();window.scrollTo(0,0)});
    document.querySelectorAll('[data-ztipo]').forEach(s=>s.onchange=async()=>{const z=S.zona[s.dataset.ztipo];await guardar('zona',{...z,tipo:s.value});render()});
    $('zGuardar').onclick=add;$('zNombre').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
    document.querySelectorAll('[data-zdel]').forEach(b=>b.onclick=async()=>{const z=S.zona[b.dataset.zdel];if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Toca otra vez para quitar';return}
      await guardar('zona',{...z,baja:true});log(`Zona quitada: "${z.nombre}"`);render()});
    const pl=planoCfg();
    $('eAgregar').onclick=()=>{const n=$('eNombre').value.trim();if(!n){toast('Escribe el nombre de la entrada');return}plEdit={tipo:'entrada',id:'E'+Date.now().toString(36),nombre:n,pts:[]};render();window.scrollTo(0,0)};
    $('pAgregar').onclick=()=>{const n=$('pNombre').value.trim();if(!n){toast('Escribe el nombre del pasillo');return}plEdit={tipo:'pasillo',id:'P'+Date.now().toString(36),nombre:n,sentido:$('pSentido').value,pts:[]};render();window.scrollTo(0,0)};
    document.querySelectorAll('[data-eedit]').forEach(b=>b.onclick=()=>{const e=pl.entradas.find(x=>x.id===b.dataset.eedit);plEdit={tipo:'entrada',id:e.id,nombre:e.nombre,pts:[[e.x,e.y]]};render();window.scrollTo(0,0)});
    document.querySelectorAll('[data-pedit]').forEach(b=>b.onclick=()=>{const q=pl.pasillos.find(x=>x.id===b.dataset.pedit);plEdit={tipo:'pasillo',id:q.id,nombre:q.nombre,sentido:q.sentido,pts:[]};render();window.scrollTo(0,0)});
    const quitar=(attr,campo,txt)=>document.querySelectorAll(`[${attr}]`).forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='¿Seguro?';return}const id=b.getAttribute(attr);const x=pl[campo].find(o=>o.id===id);
      await guardarPlano(p=>{p[campo]=p[campo].filter(o=>o.id!==id)},`${txt} quitado del plano: "${x?.nombre||id}"`)});
    quitar('data-edel','entradas','Entrada');quitar('data-pdel','pasillos','Pasillo');
    if($('plReset'))$('plReset').onclick=async()=>{const b=$('plReset');if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Toca otra vez para confirmar';return}await guardar('config',{...PLANO0});log('Entradas y pasillos vueltos a los iniciales');render()};
  },
  carretilleros(){const dorso=()=>$('akDorso').checked;
    $('akTodos').onclick=()=>{const ks=L('vendedor').sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'')).flatMap(v=>misCarr(v.id));imprimirCredenciales(ks,dorso(),null)};
    document.querySelectorAll('[data-akv]').forEach(b=>b.onclick=()=>{const v=vend(b.dataset.akv);imprimirCredenciales(misCarr(v.id),dorso(),v.nombre)});
    document.querySelectorAll('[data-akp]').forEach(b=>b.onclick=()=>{const k=S.carretillero[b.dataset.akp];imprimirCredenciales([k],dorso(),vend(k.vendedor)?.nombre)});
    document.querySelectorAll('[data-aka]').forEach(b=>b.onclick=async()=>{const v=vend(b.dataset.aka);const inp=document.querySelector(`[data-akn="${b.dataset.aka}"]`);const n=inp.value.trim();inp.value='';await agregarCarretillero(v,n);render()});
    document.querySelectorAll('[data-akn]').forEach(i=>i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();document.querySelector(`[data-aka="${i.dataset.akn}"]`).click()}});
  },
  misCarr(){const v=vendActual();if(!v)return;
    const add=async()=>{const n=$('kNom').value.trim();$('kNom').value='';await agregarCarretillero(v,n);render()};
    $('kAdd').onclick=add;$('kNom').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
    document.querySelectorAll('[data-kprint]').forEach(b=>b.onclick=()=>imprimirCredenciales([S.carretillero[b.dataset.kprint]],$('kDorso').checked,v.nombre));
    $('kPrintAll').onclick=()=>imprimirCredenciales(misCarr(v.id),$('kDorso').checked,v.nombre);
    document.querySelectorAll('[data-kbaja]').forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Toca otra vez';return}const k=S.carretillero[b.dataset.kbaja];
      await guardar('carretillero',{...k,baja:true});log(`${v.nombre} dio de baja al carretillero #${k.num}`);render()});
  },
  imprimir(){document.querySelectorAll('[data-copiar]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copiar);toast('Link copiado')}catch(e){toast('No se pudo copiar')}});
    document.querySelectorAll('[data-qshare]').forEach(b=>b.onclick=async()=>{const m=b.dataset.qshare;const txt=MSJ_QR[m]+LINKS[m];
      try{const blob=await (await fetch(qrRol(m))).blob();const file=new File([blob],`CargaYa-QR-${m}.png`,{type:'image/png'});
        if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text:txt});return}
        if(navigator.share){await navigator.share({title:'CargaYa',text:txt,url:LINKS[m]});return}}catch(e){if(e&&e.name==='AbortError')return}
      window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');toast('Este navegador no comparte imágenes: se abrió WhatsApp con el link')})},
  pagosK(){const v=vendActual();if(!v)return;
    document.querySelectorAll('[data-plote]').forEach(b=>b.onclick=()=>{pagandoLote=b.dataset.plote;pagandoK=null;pkMetodo='efectivo';render()});
    if(pagandoLote){const kid=pagandoLote;bindPagoForm(()=>porPagar(v.id).filter(d=>d.carretillero===kid),v,true)}
  },
  histVend(){const v=vendActual();if(!v)return;
    $('hPer').onchange=()=>{hPer=$('hPer').value;render()};$('hEst').onchange=()=>{hEst=$('hEst').value;render()};
    $('hCsv').onclick=async()=>{const ds=filtroHist(v.id);$('hCsv').disabled=true;await asegurar('comprador',ds.map(d=>d.placa));await asegurar('carretillero',ds.map(d=>d.carretillero).filter(Boolean));csvHist(v,ds);if($('hCsv'))$('hCsv').disabled=false;toast('Archivo descargado')};
    document.querySelectorAll('[data-desarch]').forEach(b=>b.onclick=async()=>{const d=S.despacho[b.dataset.desarch];await guardar('despacho',{...d,archivado:false});render()});
  },
  miUbic(){const v=vendYo();if(!v)return;
    document.querySelectorAll('[data-copiar]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copiar);toast('Enlace copiado')}catch(e){toast('No se pudo copiar')}});
    const nomArch='CargaYa-'+v.nombre.replace(/[^\w]+/g,'-').slice(0,30)+'.png';
    if($('invDesc'))$('invDesc').onclick=async()=>{const bl=await imagenInvita(v);const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=nomArch;document.body.appendChild(a);a.click();a.remove();toast('QR descargado')};
    if($('invShare'))$('invShare').onclick=async()=>{const u=urlInvita(v);const txt=`Hola 👋 Soy ${v.nombre}. Entra a CargaYa con este enlace y quedo en tus favoritos: `;
      try{const bl=await imagenInvita(v);const f=new File([bl],nomArch,{type:'image/png'});
        if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],text:txt+u});return}
        if(navigator.share){await navigator.share({title:'CargaYa',text:txt,url:u});return}}catch(e){if(e&&e.name==='AbortError')return}
      window.open('https://wa.me/?text='+encodeURIComponent(txt+u),'_blank');toast('Se abrió WhatsApp con el enlace')};
    if(ubicandoCamion){const svg=$('vPick');svg.onclick=async ev=>{const q=svgXY(svg,ev);await guardar('vendedor',{...S.vendedor[v.id],px:q.x,py:q.y,pv:PV,ubicMetodo:'manual',ubicAcc:null,ubicT:Date.now(),gpsT:null,lat:null,lng:null});render()};$('vListo').onclick=()=>{ubicandoCamion=false;render()};return}
    if($('vUbicar'))$('vUbicar').onclick=()=>{gpsErr='';ubicandoCamion=true;render()};
    if($('vGPS'))$('vGPS').onclick=async()=>{gpsBusca=true;gpsErr='';render();try{const q=await ubicarGPS();
        await guardar('vendedor',{...S.vendedor[v.id],px:q.x,py:q.y,pv:PV,ubicMetodo:'gps',ubicAcc:q.acc,ubicT:Date.now()});
        if(q.acc>30)toast(`Precisión baja (±${q.acc} m): revisa el punto y corrígelo tocando el plano`);ubicandoCamion=true}
      catch(e){gpsErr=errGPS(e)}gpsBusca=false;render()};
    if($('mpEditar'))$('mpEditar').onclick=()=>{editPuesto=true;render()};
    if($('mpCancel'))$('mpCancel').onclick=()=>{editPuesto=false;render()};
    if($('mpZona'))$('mpZona').onchange=()=>{const t=$('mpZonaT');t.style.display=$('mpZona').value==='__otra'?'':'none'};
    if($('mpOk'))$('mpOk').onclick=async()=>{const prod=$('mpProd').value.trim(),ref=$('mpRef').value.trim(),sec=leerZona('mpZona');const prev=S.vendedor[v.id];editPuesto=false;
      await guardar('vendedor',{...prev,productos:prod,refPuesto:ref,sector:sec,...(sec!==prev.sector?{px:null,py:null,ubicT:Date.now()}:{})});toast('Guardado');render()};
  },
  miSusc(){const v=vendYo();if(!v)return;
    if($('sPagar'))$('sPagar').onclick=()=>{pagando=true;render()};
    document.querySelectorAll('[data-copiar]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copiar);toast('Copiado: '+b.dataset.copiar)}catch(e){toast('No se pudo copiar')}});
    if(pagando){const keepP=()=>{if(!$('fPago'))return;pagoForm={...pagoForm,ref:$('pRef').value,banco:$('pBanco').value,tel:$('pTel').value,monto:$('pMonto').value,fecha:$('pFecha').value}};
      $('pCancel').onclick=()=>{pagando=false;render()};
      fotoInput($('pFoto'),url=>{keepP();pagoForm.foto=url;render()},'comprobantes');
      if($('fPago'))$('fPago').onsubmit=async e=>{e.preventDefault();keepP();const ref=pagoForm.ref.replace(/\s/g,'');if(ref.length<4){toast('Revisa el número de referencia');return}
        if(L('pago').some(p=>p.referencia===ref&&p.estado!=='rechazado')){toast('Esa referencia ya fue cargada');return}
        const c=cfgCobro();const monto=parseFloat(String(pagoForm.monto).replace(/\./g,'').replace(',','.'))||0;
        const pg={id:nuevoId('P'),vendedor:v.id,referencia:ref,banco:pagoForm.banco.trim(),telefono:pagoForm.tel.trim(),monto,montoUSD:c.precioUSD,tasa:c.tasa,fecha:pagoForm.fecha,foto:pagoForm.foto||null,estado:'pendiente',t:Date.now()};
        await guardar('pago',pg);log(`💳 ${v.nombre} cargó un pago de ${fmtBs(monto)} (ref. ${ref}) para revisar`);pagando=false;pagoForm={};render();
        toast('Pago enviado. Te avisamos cuando se apruebe.');
        if(c.adminTel){const u=wa(c.adminTel);if(u){const msg=`Hola, soy ${v.nombre} (CargaYa). Pagué la suscripción por Pago Móvil: ${fmtBs(monto)}, referencia ${ref}, desde ${pg.banco}, el ${pg.fecha}.`;
          const a=document.createElement('div');a.className='found';a.style.marginTop='10px';a.innerHTML=`Pago enviado ✓ <a class="btn o" style="display:block;text-align:center;text-decoration:none;margin-top:8px" target="_blank" rel="noopener" href="${u}?text=${encodeURIComponent(msg)}">💬 Avisar por WhatsApp a la administración</a>`;
          const card=document.querySelector('#app .card');card&&card.after(a)}}}}
  },
  vendedor(){
    const v=ME.rol==='vendedor'?vend(ME.id):L('vendedor')[0];if(!v)return;
    if(fichaVista){$('fvListo').onclick=()=>{fichaVista=null;render()};return}
    document.querySelectorAll('[data-irv]').forEach(a=>a.onclick=e=>{e.preventDefault();view=a.dataset.irv;render()});
    const keep=()=>{desp.placa=$('placa').value;desp.items=leerItems()};
    const tot=()=>{const it=leerItems()||[];if($('itTot'))$('itTot').innerHTML=`Total: ${((n)=>`<b>${n}</b> bulto${n==1?'':'s'}`)(it.reduce((a,x)=>a+(parseInt(x.bultos)||0),0))}`};
    document.querySelectorAll('.it-bul').forEach(x=>x.oninput=tot);
    if($('itAdd'))$('itAdd').onclick=()=>{keep();desp.items=[...desp.items,{desc:'',bultos:1}];render();const ds=document.querySelectorAll('.it-desc');ds[ds.length-1].focus()};
    document.querySelectorAll('[data-itdel]').forEach(b=>b.onclick=()=>{keep();desp.items.splice(+b.dataset.itdel,1);render()});
    const pin=$('placa'),info=$('placaInfo');
    const mostrar=()=>{const p=normPlaca(pin.value);if(p.length<5){info.innerHTML='';return}const c=S.comprador[p];
      if(!c&&ONLINE&&!NOEX['comprador|'+p]){info.innerHTML='<div class="hint">Buscando placa…</div>';clearTimeout(mostrar.t);mostrar.t=setTimeout(async()=>{await asegurar('comprador',[p]);if($('placa')&&normPlaca($('placa').value)===p)mostrar()},350);return}
      info.innerHTML=c&&c.activo!==false&&c.vehiculo?`<div class="found carbox">${c.foto?`<img class="photo sm" src="${c.foto}" alt="">`:''}<div><span class="plate">${esc(c.id)}</span> ${esc(c.nombre)}<br>${esc(c.vehiculo)}<br><b class="loc" style="font-size:22px">${esc(lugar(c).zona)}</b>${c.ref?`<div class="hint">📌 ${esc(c.ref)}</div>`:''}</div></div>`:`<div class="notfound">Esa placa no está registrada. Pídele al comprador que registre su vehículo en la app.</div>`};
    pin.oninput=mostrar;if(pin.value)mostrar();
    document.querySelectorAll('[data-ksel]').forEach(b=>b.onclick=()=>{keep();desp.k=desp.k===b.dataset.ksel?null:b.dataset.ksel;desp.kScan=null;render()});
    if($('irCarr'))$('irCarr').onclick=e=>{e.preventDefault();view='misCarr';render()};
    if($('dScanK'))$('dScanK').onclick=async()=>{keep();const t=await escanear('Escanea la credencial','El QR de la credencial del carretillero');if(!t)return;const p=parseCodigo(t);
      if(!p||p.tipo!=='k'){toast('Ese código no es una credencial de CargaYa');return}const k=await buscarCarr(p.id);
      if(!k||k.baja){toast('Esa credencial no está registrada o fue dada de baja');return}desp.k=k.id;desp.kScan=k.id;if(ajeno(k,v.id))toast(`Carretillero ${etqCarr(k,v.id)}`);render()};
    if($('kQuitar'))$('kQuitar').onclick=e=>{e.preventDefault();keep();desp.k=null;desp.kScan=null;render()};
    $('fDesp').onsubmit=async e=>{e.preventDefault();keep();if(!suscripcion(v).puedeDespachar){toast('Tu suscripción venció. Paga para seguir despachando.');return}const p=normPlaca(desp.placa);if(ONLINE&&!S.comprador[p]){delete NOEX['comprador|'+p];await asegurar('comprador',[p])}const c=comp(p);if(!c||c.activo===false){toast('Placa no registrada');return}
      const kk=carr(desp.k);if(!kk||kk.baja||(ajeno(kk,v.id)&&desp.kScan!==kk.id)){toast('Elige el carretillero que lleva la mercancía (si es de otro vendedor, escanea su credencial)');return}
      const items=(desp.items||[]).map(x=>({desc:String(x.desc||'').trim(),bultos:Math.max(1,parseInt(x.bultos)||1)})).filter(x=>x.desc);
      if(!items.length){toast('Escribe al menos una mercancía');return}
      const id=nuevoId('D');const d={id,vendedor:v.id,placa:p,items,desc:items.map(x=>x.desc).join(', '),bultos:items.reduce((a,x)=>a+x.bultos,0),carretillero:desp.k,ficha:null,estado:'en_ruta',t:{creado:Date.now()},verif:null};
      {const f0=$('fDesp');if(f0)f0.remove()}desp={};fichaVista=id;await guardar('despacho',d);const k=carr(d.carretillero);log(`${v.nombre} despachó ${nro(d)} (${resumenItems(d)}; ${d.bultos} bultos) a ${p} en ${lugar(c).zona} con el carretillero ${etqCarr(k,v.id)}`);render()};
    document.querySelectorAll('[data-ver]').forEach(b=>b.onclick=()=>{fichaVista=b.dataset.ver;render()});
    document.querySelectorAll('[data-pagk]').forEach(b=>b.onclick=()=>{pagandoK=b.dataset.pagk;pagandoLote=null;pkMetodo='efectivo';render()});
    if(pagandoK)bindPagoForm(()=>[S.despacho[pagandoK]],v,false);
    if($('irHist'))$('irHist').onclick=e=>{e.preventDefault();view='histVend';render()};
    document.querySelectorAll('[data-arch]').forEach(b=>b.onclick=async()=>{const d=S.despacho[b.dataset.arch];
      if(d.estado==='en_ruta'&&b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Aún no se recibió. ¿Quitar?';return}
      await guardar('despacho',{...d,archivado:true});render()});
    if($('archTodos'))$('archTodos').onclick=async()=>{const ds=L('despacho').filter(d=>d.vendedor===v.id&&!d.archivado&&d.estado==='entregado');for(const d of ds)await guardar('despacho',{...d,archivado:true});toast(`${ds.length} despachos quitados de la lista`);render()};
    document.querySelectorAll('[data-vok]').forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Toca otra vez para confirmar';return}await confirmar(S.despacho[b.dataset.vok],'vendedor')});
  },
  vendC(){const c=ME.rol==='comprador'?comp(ME.id):null;
    if($('amQR'))$('amQR').onclick=()=>{amigoQR=!amigoQR;render()};
    if($('amCopiar'))$('amCopiar').onclick=async()=>{try{await navigator.clipboard.writeText($('amCopiar').dataset.u);toast('Enlace copiado')}catch(e){toast('No se pudo copiar')}};
    const b=$('vcBusca');b.oninput=()=>{vcBusca=b.value;const pos=b.selectionStart;render();const nb=$('vcBusca');nb.focus();nb.setSelectionRange(pos,pos)};
    document.querySelectorAll('[data-fav]').forEach(x=>x.onclick=async()=>{if(!c){toast('Primero registra tu vehículo');return}const id=x.dataset.fav;const f=new Set(c.favoritos||[]);f.has(id)?f.delete(id):f.add(id);
      await guardar('comprador',{...S.comprador[c.id],favoritos:[...f]});render()});
    document.querySelectorAll('[data-vcmap]').forEach(x=>x.onclick=()=>{vcMapa=vcMapa===x.dataset.vcmap?null:x.dataset.vcmap;render()});
    $('vcYo').onclick=async()=>{yoBuscando=true;yoErr=null;render();try{const f=await mejorFix();yoGPS={...f,t:Date.now()}}catch(e){yoErr=errGPS(e)}yoBuscando=false;render()};
  },
  comprador(){
    const c=ME.rol==='comprador'?comp(ME.id):compradoresActivos()[0];
    if(ME.rol==='comprador'&&(!c||!c.vehiculo||c.activo===false||reg)){
      const keep=()=>{reg.veh=$('rVeh').value;reg.ref=$('rRef').value;reg.zona=leerZona('rZona')};
      if($('rZona'))$('rZona').onchange=()=>{const t=$('rZonaT');t.style.display=$('rZona').value==='__otra'?'':'none';if($('rZona').value==='__otra'){t.focus();return}keep();reg.px=reg.py=null;setTimeout(render,0)};
      if($('rPick'))$('rPick').onclick=ev=>{keep();const q=svgXY($('rPick'),ev);reg.px=q.x;reg.py=q.y;reg.pv=PV;reg.metodo='manual';reg.acc=null;render()};
      if($('rManual'))$('rManual').onclick=()=>{keep();gpsErr='';reg.manual=true;render()};
      if($('rGPS'))$('rGPS').onclick=async()=>{keep();gpsBusca=true;gpsErr='';render();try{const q=await ubicarGPS();reg.px=q.x;reg.py=q.y;reg.pv=PV;reg.metodo='gps';reg.acc=q.acc;reg.manual=true;
          if(q.acc>30)toast(`Precisión baja (±${q.acc} m): revisa el punto y corrígelo tocando el plano`)}catch(e){gpsErr=errGPS(e)}gpsBusca=false;render()};
      fotoInput($('rFoto'),url=>{keep();reg.foto=url;render()});
      if($('cancelReg'))$('cancelReg').onclick=()=>{reg=null;render()};
      $('fReg').onsubmit=async e=>{e.preventDefault();keep();if(!reg.zona){toast('Elige la zona donde estacionaste');return}
        const nuevo=!c||c.activo===false;
        const obj={...(c||{}),creado:c?.creado||Date.now(),id:ME.id,owner:ME.uid||c?.owner,nombre:ME.nombre,tel:c?.tel||ME.tel||'',vehiculo:reg.veh.trim(),ref:reg.ref.trim(),zona:reg.zona,px:reg.pv===PV?reg.px??null:null,py:reg.pv===PV?reg.py??null:null,pv:PV,ubicMetodo:reg.pv===PV&&reg.px!=null?(reg.metodo||'manual'):null,ubicAcc:reg.metodo==='gps'?reg.acc:null,llegada:nuevo?Date.now():c.llegada,foto:reg.foto||null,activo:true};
        reg=null;await guardar('comprador',obj);setTimeout(()=>aplicarFavPend().then(aplicarAmigo),300);log(`${obj.id} (${obj.nombre}, ${obj.vehiculo}) ${nuevo?'llegó y estacionó en':'ahora está en'} "${obj.zona}"`);toast('Vehículo guardado');render()};
      return}
    if(!c)return;
    if($('cEditar'))$('cEditar').onclick=()=>{reg={veh:c.vehiculo,ref:c.ref||'',foto:c.foto||null,zona:c.zona||'',px:c.px??null,py:c.py??null,pv:c.pv,metodo:c.ubicMetodo,acc:c.ubicAcc};render()};
    if($('meVoy'))$('meVoy').onclick=async()=>{if($('meVoy').dataset.ok!=='1'){$('meVoy').dataset.ok='1';$('meVoy').textContent='Toca otra vez para confirmar';return}await guardar('comprador',{...c,activo:false});log(`${c.id} se fue del mercado`);if(!ONLINE)setME(null);render()};
    document.querySelectorAll('[data-rabrir]').forEach(b=>b.onclick=()=>{recibiendo=b.dataset.rabrir;render()});
    if($('rcCancel'))$('rcCancel').onclick=()=>{recibiendo=null;render()};
    document.querySelectorAll('[data-rok]').forEach(b=>b.onclick=async()=>{const d=S.despacho[b.dataset.rok];const k=carr(d.carretillero);
      if(carnetOk[d.id]){const num=carnetOk[d.id];delete carnetOk[d.id];recibiendo=null;await confirmar(d,'carnet',{carrDicho:num,carrOk:true});return}
      const n=$('rcN')?$('rcN').value.replace(/\D/g,''):'';const extra=n?{carrDicho:pad(n,2),carrOk:!!k&&k.num===pad(n,2)}:{};recibiendo=null;await confirmar(d,'boton',extra)});
    document.querySelectorAll('[data-rscan]').forEach(b=>b.onclick=async()=>{const d=S.despacho[b.dataset.rscan];const t=await escanear('Escanea el carnet','El QR del carnet del carretillero que te trajo la mercancía');if(!t)return;
      const q=parseCodigo(t);if(!q||q.tipo!=='k'){toast('Ese código no es una credencial de CargaYa');return}const k=carr(d.carretillero);const qk=await buscarCarr(q.id);
      if(k&&k.id===q.id){carnetOk[d.id]=k.num;render()}else{toast(`Esa credencial es del #${qk?.num||'?'}${qk?' de '+(vend(qk.vendedor)?.nombre||''):''}, pero este despacho lo lleva el #${k?.num||'?'}`);log(`⚠ ${d.placa} escaneó otra credencial en ${nro(d)} (asignado al #${k?.num||'?'})`)}});
    document.querySelectorAll('[data-rmal]').forEach(b=>b.onclick=async()=>{const d=S.despacho[b.dataset.rmal];const t=$('rcRecl').value.trim();recibiendo=null;await reclamar(d,t)});
  }
};

/* ===================== Arranque ===================== */
(async()=>{
  if(ONLINE){setME(null);render();let ses=null;try{ses=(await sb.auth.getSession()).data.session}catch(e){}
    if(!ses){conexion='en línea';render();return}
    const adm=await entrar(ses.user);if(!ME){await sb.auth.signOut();render();return}
    if(MODULO==='admin'&&!adm){otroModulo=ME.rol;cargado=true;render();return}if(MODULO!=='admin'&&ME.rol!==MODULO){otroModulo=ME.rol;cargado=true;render();return}
    await cargar();cargado=true;if(ME.rol==='vendedor'&&!S.vendedor[ME.id]){await guardar('vendedor',{id:ME.id,nombre:ME.nombre,tel:ME.tel,creado:Date.now()});try{await traerTodo(sel('config'),'config')}catch(e){}}}
  else{render();await cargar();cargado=true}
  if(kURL&&!fichaURL){const k=ONLINE?await buscarCarr(kURL.id):carrPorId(kURL.id);
    const d=ME&&ME.rol==='comprador'&&k?L('despacho').filter(x=>x.placa===ME.id&&x.estado==='en_ruta'&&x.carretillero===k.id).sort((a,b)=>a.t.creado-b.t.creado)[0]:null;
    if(d){recibiendo=d.id;carnetOk[d.id]=k.num;view='comprador'}
    else if(ME&&ME.rol==='comprador')toast(`El carretillero #${k?.num||'?'} no tiene entregas pendientes para tu vehículo`);
    else toast(k?`Carretillero #${k.num} ${k.nombre||''}`:'Credencial no encontrada');
    try{history.replaceState(null,'',location.pathname)}catch(e){}}
  if(conexion==='conectando')conexion=ONLINE?'en línea':'local';
  render();vaciarCola();aplicarFavPend().then(aplicarAmigo)})();
setInterval(()=>{if(ME)pedirRender()},30000);

