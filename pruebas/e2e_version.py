import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset()
with sync_playwright() as p:
    b=p.chromium.launch()
    c,V=ctx(b,'V',URL+'vendedor.html',errs)
    P('encabezado:',V.inner_text('.logo small'));P('pie login:',V.locator('text=CargaYa versión').inner_text())
    V.click('[data-modo=entrar]');V.fill('#lTel','0412-9999999');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500);P('cuenta inexistente:',V.inner_text('#lErr'))
    c.route('**/auth/v1/token*',lambda r:r.abort());V.click('#lGo');V.wait_for_timeout(2500);P('sin conexión:',V.inner_text('#lErr'));c.unroute('**/auth/v1/token*')
    # copia vieja: el servidor dice 9.9
    c2,W=ctx(b,'W',URL+'vendedor.html',errs);
    c2.route('**/v2/version.json*',lambda r:r.fulfill(body='{"v":"9.9"}',content_type='application/json'))
    W.goto(URL+'vendedor.html');W.wait_for_timeout(2500);P('tras detectar versión nueva → url:',W.url.replace(URL,''),'| aviso:',W.locator('#toast').inner_text())
    P('ERRORES:',[e for e in errs if 'ERR_FAILED' not in e])
