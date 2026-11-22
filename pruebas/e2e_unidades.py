import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset()
with sync_playwright() as p:
    b=p.chromium.launch()
    cV,V=ctx(b,'V',URL+'vendedor.html',errs);V.set_viewport_size({'width':390,'height':844})
    V.fill('#lNombre','Frutas Coche');V.fill('#lProd','Piña, Papa');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(2000)
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300);V.fill('#kNom','José');V.click('#kAdd');V.wait_for_timeout(700)
    cC,C=ctx(b,'C',URL+'comprador.html',errs)
    C.fill('#lNombre','Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.fill('#rZonaT','La Bomba');C.fill('#rVeh','Ford');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1000)
    def despachar(filas):
        V.click('#nav button[data-v=vendedor]');V.wait_for_timeout(500)
        V.fill('#placa','AB123CD');V.dispatch_event('#placa','input');V.wait_for_timeout(800)
        for i,(prod,n,u) in enumerate(filas):
            if i:V.click('#itAdd');V.wait_for_timeout(300)
            item(V,i,prod,u);V.locator('.it-bul').nth(i).fill(str(n));V.locator('.it-bul').nth(i).dispatch_event('input')
        P('total en form:',V.inner_text('#itTot'))
        V.screenshot(path='/tmp/gp/unid_form.png')
        V.locator('[data-ksel]').first.click();V.click('#fDesp button[type=submit]');V.wait_for_timeout(1500);P('toast:',V.locator('.toast').all_inner_texts() if V.locator('.toast').count() else '')
    despachar([('Piña',5,'unidad'),('Papa',2,'saco')])
    d=R('despachos')[0];P('items:',d['items'],'| resumen:',d.get('resumen'),'| bultos:',d['bultos'])
    P('ficha:',V.inner_text('body').count('5 unidades'),'unidades;',V.inner_text('body').count('2 sacos'),'sacos')
    V.screenshot(path='/tmp/gp/unid_ficha.png')
    P('uProd:',R('vendedores')[0].get('uProd'))
    if V.locator('#fvListo').count():V.click('#fvListo')
    # segundo despacho: al elegir Papa se pone "saco" solo
    V.wait_for_timeout(300);V.fill('#placa','AB123CD');V.locator('.it-sel').first.select_option(label='Papa');V.wait_for_timeout(200)
    P('unidad recordada para Papa:',V.locator('.it-uni').first.input_value(),'| total:',V.inner_text('#itTot'))
    C.reload();C.wait_for_timeout(2500);body=C.inner_text('body');P('comprador:',[l for l in body.split('\n') if 'unidad' in l or 'Recib' in l][:6]);P('comprador ve:', 'Recibí todo completo (5 unidades + 2 sacos)' in body, '5 unidades' in body)
    C.screenshot(path='/tmp/gp/unid_comp.png',full_page=True)
    # despacho viejo sin unidad se ve como bultos
    sql("insert into despachos(id,data) values('DVIEJO','{\"id\":\"DVIEJO\",\"vendedor\":\"x\",\"placa\":\"AB123CD\",\"desc\":\"Yuca\",\"bultos\":3,\"estado\":\"en_ruta\",\"t\":{\"creado\":1}}')") if False else None
    P('ERRORES:',errs)
