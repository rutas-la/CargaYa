import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
def tocar(pg,sel,x,y):
    pt=pg.evaluate(f"(()=>{{const s=document.querySelector('{sel}');const p=s.createSVGPoint();p.x={x};p.y={y};const r=p.matrixTransform(s.getScreenCTM());return [r.x,r.y]}})()")
    pg.mouse.click(pt[0],pt[1]);pg.wait_for_timeout(250)
with sync_playwright() as p:
    b=p.chromium.launch()
    cA,A=ctx(b,'A',URL+'admin.html',errs);A.set_viewport_size({'width':1100,'height':1000});A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(1500)
    A.click('#nav button[data-v=zonas]');A.wait_for_timeout(400)
    P('galpones:',A.locator('[data-gedit]').count(),'filas:',A.locator('[data-fedit]').count())
    # redibujar Nave Cate más ancha
    A.locator('[data-gedit]').nth(4).click();A.wait_for_timeout(300);P('oculto al redibujar:',A.locator('#plPick text:has-text("NAVE CATE")').count()==0)
    for x,y in [(382,330),(470,380),(350,560),(270,510)]:tocar(A,'#plPick',x,y)
    A.click('#plListo');A.wait_for_timeout(700)
    # nuevo galpón
    A.fill('#gNombre','Galpón 4');A.click('#gAgregar');A.wait_for_timeout(300)
    for x,y in [(700,560),(760,580),(740,660),(680,640)]:tocar(A,'#plPick',x,y)
    A.click('#plListo');A.wait_for_timeout(700)
    # fila doble
    A.fill('#fNombre','Frente a INMERCA');A.select_option('#fLado','doble');A.click('#fAgregar');A.wait_for_timeout(300)
    for x,y in [(640,360),(540,560)]:tocar(A,'#plPick',x,y)
    A.click('#plListo');A.wait_for_timeout(700)
    pl=[c for c in R('config') if c['id']=='plano'][0];P('plano:',len(pl['galpones']),'galpones,',len(pl['filas']),'filas; cate:',pl['galpones'][4]['pts'][:2],pl['galpones'][4].get('rot'))
    A.locator('[data-gdel]').last.click();A.locator('[data-gdel]').last.click();A.wait_for_timeout(700);P('tras quitar:',len([c for c in R('config') if c['id']=='plano'][0]['galpones']))
    A.evaluate("window.scrollTo(0,document.body.scrollHeight)");A.wait_for_timeout(300);A.locator('.mapwrap').last.screenshot(path='/tmp/full/gal.png')
    P('cajones dibujados:',A.locator('.mapwrap').last.locator('rect[stroke="#9fa3ab"]').count())
    P('ERRORES:',errs)
