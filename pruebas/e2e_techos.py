import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
with sync_playwright() as p:
    b=p.chromium.launch()
    c,A=ctx(b,'A',URL+'admin.html',errs);A.set_viewport_size({'width':1100,'height':900})
    A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(1500)
    A.click('#nav button[data-v=zonas]');A.wait_for_timeout(500)
    A.locator('svg.map').first.screenshot(path='/tmp/gp/antes.png')
    gal=A.evaluate("planoCfg().galpones.filter(g=>g.pts&&g.pts.length>2).map(g=>[g.id,g.nombre,g.pts])")
    P('galpones:',[(g[1],len(g[2])) for g in gal])
    A.fill('#fNombre','Puestos bajo techo');A.click('#fAgregar');A.wait_for_timeout(500)
    gid,gn,pts=gal[0];A.select_option('#plVista',gid);A.wait_for_timeout(500)
    P('vista de cerca:',A.locator('#plPick').get_attribute('viewBox'))
    xs=[q[0] for q in pts];ys=[q[1] for q in pts];x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
    # dos puntos dentro del galpón, a lo largo
    def clic(x,y):
        box=A.locator('#plPick').bounding_box();vb=[float(v) for v in A.locator('#plPick').get_attribute('viewBox').split()]
        sx=box['width']/vb[2];sy=box['height']/vb[3];s=min(sx,sy);ox=box['x']+(box['width']-vb[2]*s)/2;oy=box['y']+(box['height']-vb[3]*s)/2
        A.mouse.click(ox+(x-vb[0])*s,oy+(y-vb[1])*s);A.wait_for_timeout(300)
    if x1-x0>y1-y0:clic(x0+8,(y0+y1)/2);clic(x1-8,(y0+y1)/2)
    else:clic((x0+x1)/2,y0+8);clic((x0+x1)/2,y1-8)
    A.locator('#plPick').screenshot(path='/tmp/gp/editor.png')
    A.click('#plListo');A.wait_for_timeout(1200)
    P('filas guardadas:',A.evaluate("planoCfg().filas.map(f=>f.nombre+' '+f.pts.length)"))
    A.locator('svg.map').first.screenshot(path='/tmp/gp/despues.png')
    P('ERRORES:',errs)
