import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
from PIL import Image
if not os.path.exists('/tmp/full/inv.png'):os.makedirs('/tmp/full',exist_ok=True);Image.new('RGB',(200,150),'#888').save('/tmp/full/inv.png')
reset();hacer_admin('584141111111')
shot=lambda pg,n:pg.screenshot(path=f'/tmp/km/{n}.png',full_page=True)
def t(pg,s):
    try:return pg.inner_text(s)
    except Exception:return ''
with sync_playwright() as p:
    b=p.chromium.launch()
    cA,A=ctx(b,'ADMIN',URL+'admin.html',errs)
    A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(1500)
    A.click('#nav button[data-v=zonas]');A.wait_for_timeout(300)
    for z in ['Detrás del Barco','La Bomba']:A.fill('#zNombre',z);A.click('#zGuardar');A.wait_for_timeout(600)
    cV,V=ctx(b,'V',URL+'vendedor.html',errs);V.set_viewport_size({'width':390,'height':844})
    V.fill('#lNombre','Hortalizas El Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(2000)
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300);V.fill('#kNom','José');V.click('#kAdd');V.wait_for_timeout(800)
    P('apagado: botón activar en vendedor =',V.locator('[data-kmov]').count())
    # carretillero abre la app con el interruptor apagado
    cK0,K0=ctx(b,'K0',URL+'carretillero.html?act=ABCDEF',errs);K0.set_viewport_size({'width':390,'height':844});K0.wait_for_timeout(1500)
    P('apagado: carretillero ve =',t(K0,'#aErr')[:80]);cK0.close()
    # admin enciende
    A.click('#nav button[data-v=carretilleros]');A.wait_for_timeout(500);P('interruptor:',t(A,'#movilSw'));A.click('#movilSw');A.wait_for_timeout(900)
    A.evaluate("document.querySelectorAll('#app p.hint b').forEach(e=>e.textContent=e.textContent.replace(/https?:\\/\\/127\.0\.0\.1:\\d+\\/v2\\//,'rutas-la.github.io/CargaYa/v2/'))");A.locator('#movilSw').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot(path='/tmp/km/a_movil.png');P('config movil:',[c for c in R('config') if c.get('id')=='movil'],'| interruptor ahora:',t(A,'#movilSw'))
    V.wait_for_timeout(1500);V.click('#nav button[data-v=vendedor]');V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(500)
    P('encendido: botón activar =',V.locator('[data-kmov]').count())
    V.locator('[data-kmov]').first.click();V.wait_for_timeout(1500);cod=t(V,'#actCod').strip();P('código:',cod);V.evaluate("document.querySelectorAll('#actModal *').forEach(e=>{if(e.children.length===0&&e.textContent.includes('127.0.0.1'))e.textContent=e.textContent.replace(/https?:\\/\\/127\.0\.0\.1:\\d+\\/v2\\//,'rutas-la.github.io/CargaYa/v2/')})");V.locator('#actModal .card').screenshot(path='/tmp/km/v_activar.png')
    V.click('#actOk');V.wait_for_timeout(500)
    # comprador con vehículo ubicado
    cC,C=ctx(b,'C',URL+'comprador.html',errs,geo={'latitude':10.439806,'longitude':-66.928368,'accuracy':5})
    C.fill('#lNombre','Bodega Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','ab-123cd');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(2000)
    C.select_option('#rZona',label='Detrás del Barco');C.fill('#rVeh','Ford 350 blanca');C.fill('#rRef','al lado del poste azul');C.click('#rGPS');C.wait_for_timeout(4000);shot(C,'c_gps');P('gps comprador:',[x for x in C.locator('#app .hint').all_inner_texts() if 'GPS' in x or 'plano' in x][:2])
    C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1200)
    P('comprador:',[(c['id'],c.get('zona'),c.get('px')) for c in R('compradores')])
    # carretillero activa su teléfono (GPS dentro del mercado)
    cK,K=ctx(b,'K',URL+f'carretillero.html?act={cod}',errs,geo={'latitude':10.440644,'longitude':-66.929215,'accuracy':9});K.set_viewport_size({'width':390,'height':844});K.wait_for_timeout(1800)
    P('K ve:',t(K,'.found')[:80]);shot(K,'k_activar')
    K.fill('#aTel','0416-7770001');K.fill('#aPin','111222');K.fill('#aPal','carreta');K.click('#aGo');K.wait_for_timeout(3000)
    P('K estado:',t(K,'#estado').replace('\n',' '),'| vínculo:',sql("select count(*) from carretilleros_movil")[0][0])
    if K.locator('#instNo').count():K.click('#instNo')
    P('K entregas:',t(K,'#app')[:120].replace('\n',' '));shot(K,'k_vacio')
    P('código reusado:',sql("select count(*) from activaciones")[0][0])
    # vendedor ve "con teléfono"
    V.click('#nav button[data-v=vendedor]');V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(2000);P('V ve con teléfono:',V.locator('[data-kmovq]').count());V.locator('[data-kmovq]').first.locator('xpath=ancestor::div[contains(@class,"item")][1]').screenshot(path='/tmp/km/v_contel.png')
    # despacho asignado a José
    V.click('#nav button[data-v=vendedor]');V.wait_for_timeout(500)
    V.fill('#placa','AB123CD');V.dispatch_event('#placa','input');V.wait_for_timeout(900)
    V.locator('.it-desc').first.fill('Papa');V.locator('.it-bul').first.fill('4')
    V.locator('[data-ksel]').first.click();V.wait_for_timeout(200);V.click('#fDesp button[type=submit]');V.wait_for_timeout(1000)
    if V.locator('#fvListo').count():V.click('#fvListo')
    K.wait_for_timeout(2500);P('K recibe en vivo:',K.locator('[data-kir]').count(),'| toast:',t(K,'#toast'));shot(K,'k_lista')
    K.wait_for_timeout(3200);K.locator('[data-kir]').first.click();K.wait_for_timeout(3000);P('K llévame:',t(K,'#kMapaWrap')[:80].replace('\n',' '));shot(K,'k_llevame')
    P('ruta dibujada:',K.locator('#kMapaWrap polyline.route').count(),'| punto yo:',K.locator('#kMapaWrap text:has-text("TÚ")').count())
    K.click('#kCredBtn');K.wait_for_timeout(1200);P('credencial QR:',K.locator('img[alt="Mi credencial"]').count());shot(K,'k_cred');K.click('#kCredX');K.wait_for_timeout(500)
    # el comprador confirma escaneando (simulado con su app)
    did=R('despachos')[0]['id'];C.wait_for_timeout(1000);C.click('#nav button[data-v=comprador]');C.wait_for_timeout(500)
    C.click(f'[data-rabrir="{did}"]');C.fill('#rcN',R('carretilleros')[0]['num'][-2:]);C.click(f'[data-rok="{did}"]');C.wait_for_timeout(2500)
    P('estado:',R('despachos')[0]['estado'],'| K vuelve a la lista:',K.locator('#kVolver').count()==0,'| K hoy:',t(K,'#app')[-80:].replace('\n',' '))
    # permisos: K no ve otros despachos ni otros compradores
    P('K ve compradores (sin entregas):',K.evaluate("sb.from('compradores').select('id').then(r=>r.data.length)"))
    # vendedor quita el teléfono
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(500);V.locator('[data-kmovq]').first.click();V.locator('[data-kmovq]').first.click();V.wait_for_timeout(1000)
    P('vínculo tras quitar:',sql("select count(*) from carretilleros_movil")[0][0])
    K.reload();K.wait_for_timeout(2500);P('K tras quitar:',t(K,'#app')[:90].replace('\n',' '))
    # admin apaga
    A.click('#nav button[data-v=mercado]');A.click('#nav button[data-v=carretilleros]');A.wait_for_timeout(400);A.click('#movilSw');A.click('#movilSw');A.wait_for_timeout(900)
    P('apagado otra vez:',[c.get('activo') for c in R('config') if c.get('id')=='movil'])
    P('ERRORES:',[e for e in errs if '400' not in e and '401' not in e and 'example.com' not in e])
