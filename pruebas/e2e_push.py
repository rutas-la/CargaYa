import sys,os,json;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
import psycopg
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
X=lambda q,a=():psycopg.connect(DB,autocommit=True).execute(q,a)
X("delete from push_conf");X("delete from net.log")
FAKE="""(()=>{let sub=null;const mk=n=>({endpoint:'https://push.example/'+n,options:{applicationServerKey:null},toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'BP'+n,auth:'au'+n}}},unsubscribe:async()=>{sub=null;return true}});
  PushManager.prototype.getSubscription=async function(){return sub};
  PushManager.prototype.subscribe=async function(o){sub=mk(Math.random().toString(36).slice(2,8));return sub}})()"""
def t(pg,s):
    try:return pg.inner_text(s)
    except Exception:return ''
with sync_playwright() as p:
    b=p.chromium.launch(channel='chromium')
    cV,V=ctx(b,'V',URL+'vendedor.html',errs);V.set_viewport_size({'width':390,'height':844})
    V.fill('#lNombre','Hortalizas El Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1800)
    P('sin configurar: tarjeta vendedor =',V.locator('#cardPush').count())
    X("select push_configurar('https://fn.example/functions/v1/enviar-push','s3cr3t')")
    cC,C=ctx(b,'C',URL+'comprador.html',errs);C.set_viewport_size({'width':390,'height':844})
    cC.add_init_script(FAKE);cC.grant_permissions(['notifications'],origin=URL.split('/v2/')[0])
    C.reload();C.wait_for_timeout(800)
    C.fill('#lNombre','Bodega Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.fill('#rZonaT','La Bomba');C.fill('#rVeh','Ford blanca');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1500)
    P('permiso:',C.evaluate('Notification.permission'),'| tarjeta comprador:',C.locator('#cardPush').count(),'| push_subs:',sql("select count(*) from push_subs")[0][0])
    # el permiso ya estaba concedido: se anota sola; probamos el botón en un tercer teléfono sin permiso
    cK,K=ctx(b,'K',URL+'comprador.html',errs);K.set_viewport_size({'width':390,'height':844});cK.add_init_script(FAKE);K.reload();K.wait_for_timeout(800)
    K.fill('#lNombre','Luis');K.fill('#lTel','0414-5552030');K.fill('#lPlaca','XY987ZZ');K.fill('#lPin','654321');K.click('#lGo');K.wait_for_timeout(1500)
    K.fill('#rZonaT','La Bomba');K.fill('#rVeh','Toyota roja');K.click('text=Guardar y empezar a comprar');K.wait_for_timeout(1500)
    P('tarjeta sin permiso:',t(K,'#cardPush h2'),'| botón:',K.locator('#pushSi').count());K.evaluate('scrollTo(0,0)');K.screenshot(path='/tmp/rc/push_card.png')
    cK.grant_permissions(['notifications'],origin=URL.split('/v2/')[0]);K.click('#pushSi');K.wait_for_timeout(1500)
    P('tras activar:',K.locator('#cardPush').count(),'| toast:',t(K,'#toast'),'| subs:',sql("select modulo,count(*) from push_subs group by modulo"))
    # despacho → aviso al comprador
    X("delete from net.log")
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300);V.fill('#kNom','José');V.click('#kAdd');V.wait_for_timeout(800)
    V.click('#nav button[data-v=vendedor]');V.wait_for_timeout(400);V.fill('#placa','AB123CD');V.dispatch_event('#placa','input');V.wait_for_timeout(800)
    item(V,0,'Papa');V.locator('.it-bul').first.fill('5');V.locator('[data-ksel]').first.click();V.click('#fDesp button[type=submit]');V.wait_for_timeout(1500)
    lg=sql("select body from net.log");P('avisos enviados:',[(m['titulo'],m['texto'],[s['endpoint'][:30] for s in m['subs']]) for r in lg for m in r[0]['msgs']])
    # el service worker muestra el aviso
    cdp=cC.new_cdp_session(C);regs=[]
    cdp.on('ServiceWorker.workerRegistrationUpdated',lambda e:regs.extend(e['registrations']));cdp.send('ServiceWorker.enable');C.wait_for_timeout(1000)
    rid=[r['registrationId'] for r in regs if not r.get('isDeleted')][0]
    cdp.send('ServiceWorker.deliverPushMessage',{'origin':URL.split('/v2/')[0],'registrationId':rid,'data':json.dumps({'titulo':'📦 Te despacharon mercancía','texto':'Hortalizas El Andino despachó 5 bultos','url':'comprador.html','tag':'d-1'})})
    C.wait_for_timeout(1500);P('notificación mostrada:',C.evaluate("navigator.serviceWorker.ready.then(r=>r.getNotifications()).then(n=>n.map(x=>x.title+' | '+x.body+' | '+x.data.url))"))
    # salir: el teléfono deja de recibir
    n0=sql("select count(*) from push_subs")[0][0];K.click('#salir');K.wait_for_timeout(1500);P('subs antes/después de salir:',n0,sql("select count(*) from push_subs")[0][0])
    P('ERRORES:',[e for e in errs if '400' not in e])
X("delete from push_conf")
