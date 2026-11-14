import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();sql("insert into zonas(id,data) values('Z1','{\"id\":\"Z1\",\"nombre\":\"La Bomba\",\"x\":680,\"y\":180,\"pv\":2}')")
DENTRO={'latitude':10.439554,'longitude':-66.92882,'accuracy':8};FUERA={'latitude':-34.60,'longitude':-58.38,'accuracy':10}
with sync_playwright() as p:
    b=p.chromium.launch()
    cV,V=ctx(b,'V',URL+'vendedor.html',errs,geo=FUERA);V.fill('#lNombre','Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500)
    V.click('#nav button[data-v=miUbic]');V.wait_for_timeout(300);V.click('#vGPS');V.wait_for_timeout(2500);P('fuera:',V.locator('.notfound').first.inner_text()[:90])
    cV.set_geolocation(DENTRO);V.click('#vGPS');V.wait_for_timeout(2500)
    v=R('vendedores')[0];P('GPS vendedor:',v.get('px'),v.get('py'),v.get('ubicMetodo'),v.get('ubicAcc'),'| muestra mapa:',V.is_visible('#vPick'))
    V.click('#vListo');V.wait_for_timeout(300);P('texto:',V.locator('text=Ubicado por GPS').count())
    V.click('#vUbicar');V.wait_for_timeout(300);bb=V.locator('#vPick').bounding_box();V.mouse.click(bb['x']+bb['width']*0.6,bb['y']+bb['height']*0.5);V.wait_for_timeout(600);V.click('#vListo')
    v=R('vendedores')[0];P('manual vendedor:',v.get('px'),v.get('py'),v.get('ubicMetodo'))
    cC,C=ctx(b,'C',URL+'comprador.html',errs,geo=DENTRO);C.fill('#lNombre','Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.select_option('#rZona',label='La Bomba');C.fill('#rVeh','Ford');C.click('#rGPS');C.wait_for_timeout(2500);P('C hint:',C.locator('text=Ubicado por GPS').count())
    C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1200)
    c=R('compradores')[0];P('GPS comprador:',c.get('px'),c.get('py'),c.get('ubicMetodo'),c.get('ubicAcc'),c.get('pv'))
    C.click('#cEditar');C.wait_for_timeout(400);C.click('#rManual');C.wait_for_timeout(300);bb=C.locator('#rPick').bounding_box();C.mouse.click(bb['x']+bb['width']*0.3,bb['y']+bb['height']*0.4);C.wait_for_timeout(300)
    C.click('form#fReg button[type=submit]');C.wait_for_timeout(1000);c=R('compradores')[0];P('manual comprador:',c.get('px'),c.get('py'),c.get('ubicMetodo'))
    V.screenshot(path='/tmp/full/v2_gps_v.png',full_page=True)
    P('ERRORES:',errs)
