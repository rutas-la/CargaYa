import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[]
SKIP=['salir','omSalir','instSi']
def mono(pg,nombre,tabs):
    for t in tabs:
        botones=None
        for i in range(30):
            try:
                pg.click(f'#nav button[data-v={t}]',timeout=1500);pg.wait_for_timeout(120)
            except Exception:
                pg.keyboard.press('Escape');[e.evaluate('x=>x.remove()') for e in pg.query_selector_all('#palModal,#instModal,.scan,.modal-bg')];continue
            bs=pg.query_selector_all('#app button:visible, #app a[href="#"]:visible')
            if botones is None:botones=len(bs)
            if i>=len(bs):break
            b=bs[i];idb=b.get_attribute('id') or '';txt=(b.inner_text() or '')[:30]
            if idb in SKIP or 'Excel' in txt or 'Descargar' in txt or 'Quitar' in txt or 'Rechazar' in txt or 'baja' in txt.lower():continue
            try:
                n0=len(errs);b.click(timeout=800);pg.wait_for_timeout(120)
                if len(errs)>n0:print(flush=True,*[]) or print('  ERROR al tocar',nombre,t,repr(txt),errs[-1][:150])
            except Exception as e:pass
            for s in ['#scanCancel','#pNo','#instNo']:
                if pg.locator(s).count():
                    try:pg.click(s,timeout=1000)
                    except Exception:pass
        print(flush=True,*[]) or print(nombre,t,'botones probados:',botones)
reset();hacer_admin('584141111111')
with sync_playwright() as p:
    b=p.chromium.launch()
    for nombre,url,f in [('V0','vendedor.html',lambda g:(g.fill('#lNombre','Andino'),g.fill('#lTel','0412-5550001'),g.fill('#lPin','123456'))),('C0','comprador.html',lambda g:(g.fill('#lNombre','Rosa'),g.fill('#lTel','0414-5551020'),g.fill('#lPlaca','AB123CD'),g.fill('#lPin','654321')))]:
        c,g=ctx(b,nombre,URL+url,errs);f(g);g.click('#lGo');g.wait_for_timeout(2000)
        if nombre=='V0':
            g.click('#nav button[data-v=misCarr]');g.wait_for_timeout(300);g.fill('#kNom','José');g.click('#kAdd');g.wait_for_timeout(500)
        else:
            try:
                if g.locator('select#rZona').count():g.select_option('#rZona',index=1)
                g.fill('#rVeh','Ford blanca',timeout=3000);g.click('#app form button[type=submit]',timeout=3000);g.wait_for_timeout(800)
            except Exception as e:print('registro vehiculo:',str(e)[:80])
        c.close()
    for nombre,url,tel,pin,tabs in [('V','vendedor.html','0412-5550001','123456',['vendedor','pagosK','histVend','misCarr','miUbic','miSusc']),
                                    ('C','comprador.html','0414-5551020','654321',['comprador','vendC']),
                                    ('A','admin.html','0414-1111111','999999',['mercado','uso','cobros','comprAdm','zonas','carretilleros','imprimir'])]:
        c,pg=ctx(b,nombre,URL+url,errs);pg.set_viewport_size({'width':390,'height':844})
        pg.on('dialog',lambda d:d.dismiss())
        if pg.locator('[data-modo=entrar]').count():pg.click('[data-modo=entrar]')
        pg.fill('#lTel',tel);pg.fill('#lPin',pin);pg.click('#lGo');pg.wait_for_timeout(2500)
        mono(pg,nombre,tabs)
    print(flush=True,*[]) or print('ERRORES:',[e for e in errs if 'console' not in e or 'TypeError' in e or 'Reference' in e])
    print(flush=True,*[]) or print('consola:',[e[:120] for e in errs if 'console' in e][:10])
