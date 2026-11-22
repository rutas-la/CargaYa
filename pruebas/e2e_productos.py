import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset()
def t(pg,s):
    try:return pg.inner_text(s)
    except Exception:return ''
with sync_playwright() as p:
    b=p.chromium.launch()
    cV,V=ctx(b,'V',URL+'vendedor.html',errs);V.set_viewport_size({'width':390,'height':844})
    V.fill('#lNombre','Hortalizas El Andino');V.fill('#lProd','Papa, cebolla , Tomate,papa');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(2000)
    P('productos guardados:',R('vendedores')[0].get('productos'))
    V.screenshot(path='/tmp/gp/prod_form.png')
    P('opciones:',V.locator('.it-sel option').all_inner_texts(),'| input oculto:',not V.locator('.it-desc').first.is_visible())
    # registrar un comprador y un carretillero para despachar
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300);V.fill('#kNom','José');V.click('#kAdd');V.wait_for_timeout(700)
    cC,C=ctx(b,'C',URL+'comprador.html',errs)
    C.fill('#lNombre','Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.fill('#rZonaT','La Bomba');C.fill('#rVeh','Ford');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1000)
    V.click('#nav button[data-v=vendedor]');V.wait_for_timeout(500)
    V.fill('#placa','AB123CD');V.dispatch_event('#placa','input');V.wait_for_timeout(800)
    V.locator('.it-sel').first.select_option(label='Cebolla');V.locator('.it-bul').first.fill('3')
    V.click('#itAdd');V.wait_for_timeout(300);P('fila 1 conserva cebolla:',V.locator('.it-sel').first.input_value())
    V.locator('.it-sel').nth(1).select_option('__otro');P('input visible al elegir Otro:',V.locator('.it-desc').nth(1).is_visible())
    V.locator('.it-desc').nth(1).fill('Ajo porro');V.locator('.it-bul').nth(1).fill('2')
    V.locator('[data-ksel]').first.click();V.click('#fDesp button[type=submit]');V.wait_for_timeout(1500)
    d=R('despachos')[0];P('despacho:',d['items'],d['bultos'])
    P('lista tras despachar:',R('vendedores')[0].get('productos'))
    if V.locator('#fvListo').count():V.click('#fvListo')
    # editor
    V.click('#prodEditar');V.wait_for_timeout(400);P('editor abierto:',t(V,'#cardProd h2'))
    V.fill('#prodNuevo','Zanahoria, Ají dulce');V.click('#prodAdd');V.wait_for_timeout(800)
    V.locator('[data-pdel="0"]').click();V.wait_for_timeout(800);V.locator('[data-pup="2"]').click();V.wait_for_timeout(800)
    P('lista editada:',R('vendedores')[0].get('productos'))
    V.locator('#cardProd').screenshot(path='/tmp/gp/prod_editor.png')
    V.click('#prodListo');V.wait_for_timeout(300);P('editor cerrado:',V.locator('#cardProd').count()==0,'| opciones ahora:',V.locator('.it-sel option').all_inner_texts())
    # el directorio del comprador muestra los productos
    C.reload();C.wait_for_timeout(2500);C.click('#nav button[data-v=vendC]');C.wait_for_timeout(1200);P('comprador ve:',C.locator('text=Zanahoria').count()>0);C.screenshot(path='/tmp/gp/prod_dir.png',full_page=True)
    P('ERRORES:',errs)
