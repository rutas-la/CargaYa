import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset()
with sync_playwright() as p:
    b=p.chromium.launch()
    for m,ua in [('vendedor','Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'),('comprador','Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')]:
        c=b.new_context(viewport={'width':390,'height':844},user_agent=ua)
        c.route('**/v2/config.js*',lambda r:r.fulfill(body=CONF,content_type='application/javascript'));c.route('**/fonts.googleapis.com/**',lambda r:r.abort())
        pg=c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.goto(URL+m+'.html');pg.wait_for_timeout(1500)
        cdp=c.new_cdp_session(pg);ie=cdp.send('Page.getInstallabilityErrors');P(m,'instalable según Chrome:',ie.get('installabilityErrors') or 'sí')
        if m=='vendedor':
            pg.evaluate("(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompt=1};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e)})()")
            pg.fill('#lNombre','Andino');pg.fill('#lTel','0412-5550001');pg.fill('#lPin','123456')
        else:
            pg.fill('#lNombre','Rosa');pg.fill('#lTel','0414-5551020');pg.fill('#lPlaca','AB123CD');pg.fill('#lPin','654321')
        pg.click('#lGo');pg.wait_for_timeout(2000)
        P(m,'ventana tras registro:',pg.locator('#instModal h2').inner_text() if pg.locator('#instModal').count() else None,'| botón instalar:',pg.locator('#instSi').count(),'| pasos:',pg.locator('#instModal ol li').count())
        
        if pg.locator('#instSi').count():pg.click('#instSi');pg.wait_for_timeout(500);P(m,'abrió diálogo del sistema:',pg.evaluate('window.__prompt'),'| ventana cerrada:',pg.locator('#instModal').count()==0)
        else:
            pg.click('#instNo');pg.wait_for_timeout(500);P(m,'tras "Ahora no" barra:',pg.locator('#instBar').count())
    P('ERRORES:',errs)
