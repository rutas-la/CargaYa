import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
def tocar(pg,sel,x,y):
    # convierte coordenadas del plano a pantalla y toca
    pt=pg.evaluate(f"(()=>{{const s=document.querySelector('{sel}');const p=s.createSVGPoint();p.x={x};p.y={y};const r=p.matrixTransform(s.getScreenCTM());return [r.x,r.y]}})()")
    pg.mouse.click(pt[0],pt[1]);pg.wait_for_timeout(250)
with sync_playwright() as p:
    b=p.chromium.launch()
    cA,A=ctx(b,'A',URL+'admin.html',errs);A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(1500)
    A.click('#nav button[data-v=zonas]');A.wait_for_timeout(300);P('pestaña:',A.locator('#nav button.on').inner_text())
    A.fill('#zNombre','Detrás del Barco');A.click('#zGuardar');A.wait_for_timeout(500)
    A.fill('#zNombre','Patio de camiones');A.click('#zGuardar');A.wait_for_timeout(500)
    zid=[z['id'] for z in R('zonas') if z['nombre']=='Patio de camiones'][0]
    A.select_option(f'[data-ztipo="{zid}"]','vendedores');A.wait_for_timeout(400)
    A.click(f'[data-zdib="{zid}"]');A.wait_for_timeout(300)
    for x,y in [(445,330),(590,320),(470,560),(360,540)]:tocar(A,'#zDib',x,y)
    A.click('#dListo');A.wait_for_timeout(600)
    zb=[z['id'] for z in R('zonas') if z['nombre']=='Detrás del Barco'][0]
    A.click(f'[data-zdib="{zb}"]');A.wait_for_timeout(300)
    for x,y in [(600,160),(740,160),(735,200),(690,205),(620,185)]:tocar(A,'#zDib',x,y)
    A.click('#dListo');A.wait_for_timeout(600)
    P('zonas:',[(z['nombre'],z.get('tipo'),len(z.get('poly') or []),z.get('x'),z.get('y'),z.get('pv')) for z in R('zonas')])
    A.fill('#eNombre','Portón de prueba');A.click('#eAgregar');A.wait_for_timeout(300);tocar(A,'#plPick',300,600);A.click('#plListo');A.wait_for_timeout(600)
    A.fill('#pNombre','Pasillo nuevo');A.select_option('#pSentido','uno');A.click('#pAgregar');A.wait_for_timeout(300)
    for x,y in [(300,600),(285,420)]:tocar(A,'#plPick',x,y)
    A.click('#plListo');A.wait_for_timeout(700)
    pl=[c for c in R('config') if c['id']=='plano'][0];P('plano guardado:',len(pl['entradas']),'entradas,',len(pl['pasillos']),'pasillos; nuevo:',pl['pasillos'][-1])
    A.screenshot(path='/tmp/full/v2_zonas.png',full_page=True)
    # vendedor marca su lugar dentro del patio; comprador elige zona -> ruta
    cV,V=ctx(b,'V',URL+'vendedor.html',errs);V.fill('#lNombre','Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500)
    V.click('#nav button[data-v=miUbic]');V.wait_for_timeout(300);V.click('#vUbicar');V.wait_for_timeout(300);tocar(V,'#vPick',500,450);V.click('#vListo');V.wait_for_timeout(500)
    P('vendedor:',[(v.get('px'),v.get('py'),v.get('pv')) for v in R('vendedores')])
    V.click('#nav button[data-v=misCarr]');V.fill('#kNom','José');V.click('#kAdd');V.wait_for_timeout(600)
    cC,C=ctx(b,'C',URL+'comprador.html',errs);C.fill('#lNombre','Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.select_option('#rZona',label='Detrás del Barco');C.fill('#rVeh','Ford');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1200)
    V.click('#nav button[data-v=vendedor]');V.wait_for_timeout(400);V.fill('#placa','AB123CD');V.dispatch_event('#placa','input');V.wait_for_timeout(900);V.locator('.it-desc').first.fill('Papa');V.locator('[data-ksel]').first.click();V.click('#fDesp button[type=submit]');V.wait_for_timeout(1200)
    P('ruta en ficha:',V.locator('polyline.route').count(),'puntos:',(V.locator('polyline.route').first.get_attribute('points') or '').count(' ')+1 if V.locator('polyline.route').count() else 0)
    V.screenshot(path='/tmp/full/v2_ficha.png',full_page=True)
    C.click('#nav button[data-v=vendC]');C.wait_for_timeout(800);C.screenshot(path='/tmp/full/v2_vendc.png',full_page=True)
    P('ERRORES:',errs)
