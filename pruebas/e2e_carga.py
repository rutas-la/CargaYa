import sys,time;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
import urllib.request
errs=[];P=lambda *a:print(*a,flush=True)
def rs():urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8780/__stats/reset',method='POST'))
with sync_playwright() as p:
    b=p.chromium.launch()
    def medir(nombre,url,tel,pin,listo):
        rs();c,pg=ctx(b,nombre,url,errs)
        if pg.locator('[data-modo=entrar]').count():pg.click('[data-modo=entrar]')
        pg.fill('#lTel',tel);pg.fill('#lPin',pin);t=time.time();pg.click('#lGo')
        pg.wait_for_function(listo,timeout=60000);dt=time.time()-t;st=stats()
        n=pg.evaluate("({desp:Object.keys(S.despacho).length,comp:Object.keys(S.comprador).length,vend:Object.keys(S.vendedor).length,carr:Object.keys(S.carretillero).length})")
        P(f"{nombre}: {dt:.1f} s hasta ver datos · {st['rest']} pedidos · {st['rest_bytes']/1024:.0f} KB · en memoria {n}");return c,pg
    medir('Vendedor','%svendedor.html'%URL,'0412-0000001','123456',"()=>typeof cargado!=='undefined'&&cargado&&document.querySelector('#fDesp')")
    cC,C=medir('Comprador','%scomprador.html'%URL,'0414-0000001','654321',"()=>typeof cargado!=='undefined'&&cargado&&document.querySelector('#nav button')")
    C.click('#nav button[data-v=vendC]');C.wait_for_timeout(1500);P('  directorio:',C.locator('[data-fav]').count(),'vendedores')
    cA,A=medir('Admin','%sadmin.html'%URL,'0414-1111111','999999',"()=>typeof cargado!=='undefined'&&cargado&&document.querySelector('.kpi')")
    for v in ['cobros','carretilleros','mercado']:
        t=time.time();A.click(f'#nav button[data-v={v}]');A.wait_for_timeout(100);P(f'  admin pestaña {v}: {time.time()-t:.2f} s')
    # historial del vendedor: 30 días
    rs();cV,V=ctx(b,'V',URL+'vendedor.html',errs);V.click('[data-modo=entrar]') if V.locator('[data-modo=entrar]').count() else None
    V.fill('#lTel','0412-0000001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_selector('#fDesp')
    V.click('#nav button[data-v=histVend]');V.select_option('#hPer','30');t=time.time();V.wait_for_function("()=>!histC.cargando",timeout=60000);P(f'Historial 30 días: {time.time()-t:.1f} s, {V.evaluate("histC.rows.length")} despachos')
    with V.expect_download() as dl:V.click('#hCsv')
    P('  Excel filas:',len(open(dl.value.path(),encoding='utf-8-sig').read().splitlines())-1)
    P('ERRORES:',errs)
