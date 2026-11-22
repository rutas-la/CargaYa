import sys,json;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
OUT='/tmp/cap/';errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
sql("insert into config(id,data) values('cobro',%s)",(json.dumps({'id':'cobro','precioUSD':10,'tasa':45.5,'banco':'0102 Banco de Venezuela','telefono':'0414-1111111','cedula':'V-12345678','titular':'CargaYa','pruebaDias':30,'graciaDias':3}),))
for i,(n,x,y,poly,t) in enumerate([('Detrás del Barco',680,180,[[600,160],[740,160],[735,200],[620,185]],'compradores'),('La Bomba',300,470,[[260,420],[330,430],[320,520],[255,505]],'compradores'),('Patio de camiones',520,420,[[445,330],[590,320],[470,560],[360,540]],'vendedores')]):
    sql("insert into zonas(id,data) values(%s,%s)",('Z%d'%i,json.dumps({'id':'Z%d'%i,'nombre':n,'x':x,'y':y,'pv':2,'poly':poly,'tipo':t})))
def tocar(pg,sel,x,y):
    pt=pg.evaluate(f"(()=>{{const s=document.querySelector('{sel}');const p=s.createSVGPoint();p.x={x};p.y={y};const r=p.matrixTransform(s.getScreenCTM());return [r.x,r.y]}})()")
    pg.mouse.click(pt[0],pt[1]);pg.wait_for_timeout(250)
with sync_playwright() as p:
    b=p.chromium.launch()
    def nuevo(m,ua=None):
        c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,**({'user_agent':ua} if ua else {}),geolocation={'latitude':10.43955,'longitude':-66.92882,'accuracy':8},permissions=['geolocation'])
        c.route('**/v2/config.js*',lambda r:r.fulfill(body=CONF,content_type='application/javascript'));c.route('**/fonts.googleapis.com/**',lambda r:r.abort())
        pg=c.new_page();pg.on('pageerror',lambda e:errs.append(m+': '+str(e)))
        pg.add_init_script("window.print=()=>{};window.open=()=>null")
        pg.goto(URL+m+'.html');pg.wait_for_timeout(1200);return c,pg
    def vista(pg,n,y=None):
        if y is not None:pg.evaluate(f"window.scrollTo(0,{y})");pg.wait_for_timeout(250)
        pg.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'));document.querySelectorAll('#app *').forEach(e=>{if(e.children.length===0&&e.textContent.includes('127.0.0.1'))e.textContent=e.textContent.replace(/http:\\/\\/127\\.0\\.0\\.1:8780/g,'https://rutas-la.github.io/CargaYa')})");pg.wait_for_timeout(300);pg.screenshot(path=OUT+n+'.png')
    def elem(pg,loc,n):
        for i in range(5):
            try:
                pg.wait_for_timeout(400);l=pg.locator(loc).first;l.scroll_into_view_if_needed();pg.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'));document.querySelectorAll('#app *').forEach(e=>{if(e.children.length===0&&e.textContent.includes('127.0.0.1'))e.textContent=e.textContent.replace(/http:\\/\\/127\\.0\\.0\\.1:8780/g,'https://rutas-la.github.io/CargaYa')})");pg.wait_for_timeout(300);l.screenshot(path=OUT+n+'.png');return
            except Exception as e:
                if i==4:raise
    AND='Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
    # ---------- VENDEDOR ----------
    cV,V=nuevo('vendedor',AND)
    V.evaluate("(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e)})()")
    V.fill('#lNombre','Hortalizas El Andino');V.fill('#lTel','0412-555-0001');V.fill('#lPin','123456');V.fill('#lPal','Firulais');vista(V,'v01_registro',0)
    V.click('#lGo');V.wait_for_timeout(2000);vista(V,'v02_instalar');V.click('#instNo');V.wait_for_timeout(300);V.evaluate("document.getElementById('instBar')&&document.getElementById('instBar').remove()")
    vista(V,'v03_inicio',0)
    V.click('#nav button[data-v=miUbic]');V.wait_for_timeout(400);V.click('#mpEditar');V.wait_for_timeout(200);V.fill('#mpProd','Papa, cebolla, zanahoria');V.select_option('#mpZona',label='Patio de camiones');V.fill('#mpRef','Camión rojo, frente a INMERCA')
    elem(V,'.card:has(#mpOk)','v04_puesto');V.click('#mpOk');V.wait_for_timeout(600)
    V.click('#vUbicar');V.wait_for_timeout(300);tocar(V,'#vPick',505,430);vista(V,'v05_marcar',0);V.click('#vListo');V.wait_for_timeout(400)
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300)
    for n in ['José Pérez','Luis Gómez']:V.fill('#kNom',n);V.click('#kAdd');V.wait_for_timeout(600)
    vista(V,'v06_carretilleros',0)
    # comprador para despachar
    cC,C=nuevo('comprador',AND);C.fill('#lNombre','Bodega Rosa');C.fill('#lTel','0414-555-1020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.fill('#lPal','Caracas');vista(C,'c01_registro',0)
    C.evaluate("(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e)})()")
    C.click('#lGo');C.wait_for_timeout(2000);C.click('#instNo');C.wait_for_timeout(300);C.evaluate("document.getElementById('instBar')&&document.getElementById('instBar').remove()")
    C.select_option('#rZona',label='Detrás del Barco');C.fill('#rVeh','Ford 350 blanca');C.fill('#rRef','Al lado del kiosco azul');C.click('#rGPS');C.wait_for_timeout(2500)
    vista(C,'c02_llegue',0);C.evaluate('window.scrollTo(0,420)');C.wait_for_timeout(300);C.screenshot(path=OUT+'c02b_llegue_abajo.png')
    C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1200);vista(C,'c03_inicio',0)
    # despacho
    V.click('#nav button[data-v=vendedor]');V.wait_for_timeout(400);V.fill('#placa','AB123CD');V.dispatch_event('#placa','input');V.wait_for_timeout(1000)
    item(V,0,'Papa');V.locator('.it-bul').first.fill('2');V.click('#itAdd');item(V,1,'Cebolla');V.locator('.it-bul').nth(1).fill('3');V.locator('[data-ksel]').first.click();V.wait_for_timeout(300)
    elem(V,'.card:has(#fDesp)','v07_despachar')
    V.click('#fDesp button[type=submit]');V.wait_for_timeout(1200);vista(V,'v08_ficha',0);V.evaluate("window.scrollTo(0,document.body.scrollHeight)");V.wait_for_timeout(200);V.screenshot(path=OUT+'v08b_ficha_plano.png')
    V.click('#fvListo');V.wait_for_timeout(400);V.evaluate("window.scrollTo(0,0)")
    elem(V,'.card:has(h2:has-text("Mis despachos"))','v09_lista')
    # comprador recibe
    C.wait_for_timeout(1500);did=[r for r in R('despachos')][0]['id']
    elem(C,'.card:has([data-rabrir])','c04_en_camino');C.click(f'[data-rabrir="{did}"]');C.wait_for_timeout(300);elem(C,f'.card:has([data-rok="{did}"])','c05_confirmar')
    C.fill('#rcN','01');C.click(f'[data-rok="{did}"]');C.wait_for_timeout(1500);C.wait_for_timeout(800);P('C tras confirmar:',C.inner_text('#app')[:600].replace(chr(10),' / '));vista(C,'c06_recibido',0)
    V.wait_for_timeout(1500);elem(V,'.card:has(h2:has-text("Mis despachos"))','v10_recibido')
    # pago carretillero
    V.click(f'[data-pagk="{did}"]');V.wait_for_timeout(300);V.fill('.pk-m','60');elem(V,'.stepbox:has(#pkOk)','v11_pagar_carr');V.click('#pkOk');V.wait_for_timeout(800)
    V.click('#nav button[data-v=pagosK]');V.wait_for_timeout(400);vista(V,'v12_pagos',0)
    V.click('#nav button[data-v=histVend]');V.wait_for_timeout(1200);vista(V,'v13_historial',0)
    V.click('#nav button[data-v=miSusc]');V.wait_for_timeout(400);vista(V,'v14_mensualidad',0);V.click('#sPagar');V.wait_for_timeout(300)
    V.fill('#pRef','004512345678');V.fill('#pBanco','Banesco');V.fill('#pTel','0412-555-0001');V.fill('#pMonto','455');elem(V,'.card:has(#fPago)','v15_pago_form');V.click('#fPago button[type=submit]');V.wait_for_timeout(900)
    V.click('#nav button[data-v=miUbic]');V.wait_for_timeout(1200);elem(V,'.card:has(h2:has-text("Invita"))','v16_invitar')
    # comprador: vendedores, amigo, moví
    C.click('#nav button[data-v=vendC]');C.wait_for_timeout(1000);vista(C,'c07_vendedores',0);C.locator('[data-fav]').first.click();C.wait_for_timeout(700);vista(C,'c08_favorito',0)
    if C.locator('#vcYo').count():C.click('#vcYo');C.wait_for_timeout(2500);vista(C,'c09_distancia',0)
    elem(C,'.card:has(h2:has-text("amigo"))','c10_amigo')
    C.click('#nav button[data-v=comprador]');C.wait_for_timeout(400);elem(C,'.card:has(#cEditar)','c11_movi')
    # ---------- ADMIN ----------
    cA=b.new_context(viewport={'width':900,'height':760},device_scale_factor=1.5);cA.route('**/v2/config.js*',lambda r:r.fulfill(body=CONF,content_type='application/javascript'));cA.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    A=cA.new_page();A.on('pageerror',lambda e:errs.append('A: '+str(e)));A.add_init_script("try{['vendedor','comprador','admin'].forEach(m=>localStorage.setItem('cy-inst-'+m,'ok'))}catch(e){};window.print=()=>{}")
    A.goto(URL+'admin.html');A.wait_for_timeout(1000);A.fill('#lTel','0414-111-1111');A.fill('#lPin','999999');A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a01_entrar.png');A.click('#lGo');A.wait_for_timeout(2000)
    A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a02_panel.png')
    elem(A,'.card:has(h2:has-text("Respaldo"))','a03_respaldo');elem(A,'.card:has(h2:has-text("Cambiar PIN"))','a04_pin');elem(A,'.card:has(h2:has-text("Administradores"))','a05_admins')
    A.click('#nav button[data-v=uso]');A.wait_for_timeout(2000);A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a06_uso.png')
    A.click('#nav button[data-v=cobros]');A.wait_for_timeout(800);A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a07_cobros.png')
    A.locator('[data-ct]').last.click();A.wait_for_timeout(500);elem(A,'.card:has(#fCfg)','a08_ajustes')
    A.click('#nav button[data-v=comprAdm]');A.wait_for_timeout(1200);A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a09_compradores.png')
    A.click('#nav button[data-v=zonas]');A.wait_for_timeout(800);A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a10_zonas.png')
    A.click('#nav button[data-v=carretilleros]');A.wait_for_timeout(800);A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a11_carretilleros.png')
    A.click('#nav button[data-v=imprimir]');A.wait_for_timeout(1500);A.evaluate("document.querySelectorAll('.toast').forEach(t=>t.classList.remove('show'))");A.screenshot(path=OUT+'a12_compartir.png')
    # credencial impresa y papeleta (para el instructivo del vendedor)
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300);V.locator('[data-kprint]').first.click();V.wait_for_timeout(1500);V.emulate_media(media='print');V.wait_for_timeout(300)
    V.locator('#print .cred').first.screenshot(path=OUT+'v17_credencial.png');V.emulate_media(media='screen')
    # palabra secreta: cambiarla desde el encabezado y recuperar el PIN sin entrar
    for pg,m,tel,pal,pre in [(V,'vendedor','0412-555-0001','Firulais','v'),(C,'comprador','0414-555-1020','Caracas','c')]:
        pg.goto(URL+m+'.html');pg.wait_for_timeout(2500)
        if pg.locator('#palModal').count():pg.click('#pNo')
        pg.evaluate('window.scrollTo(0,0)');pg.click('#miPalabra');pg.wait_for_timeout(300);pg.fill('#pPal',pal);vista(pg,pre+('18' if pre=='v' else '12')+'_palabra');pg.click('#pNo')
        cR,R=nuevo(m,AND);R.click('[data-modo=entrar]');R.fill('#lTel',tel);R.wait_for_timeout(200);vista(R,pre+('19' if pre=='v' else '13')+'_olvide',0)
        R.click('#lOlvide');R.wait_for_timeout(300);R.fill('#rPal',pal.lower());R.fill('#rPin','112233');R.fill('#rPin2','112233');vista(R,pre+('20' if pre=='v' else '14')+'_recuperar',0)
        R.click('#rGo');R.wait_for_timeout(2500);P(m,'recuperado:',R.inner_text('#estado').replace('\n',' '))
    P('ERRORES:',errs)
