import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
IMG=sys.argv[1] if len(sys.argv)>1 else '/tmp/mapa/sat_prueba.png'
reset();hacer_admin('584141111111')
def pant(pg,sel,x,y):
    return pg.evaluate(f"(()=>{{const s=document.querySelector('{sel}');const p=s.createSVGPoint();p.x={x};p.y={y};const r=p.matrixTransform(s.getScreenCTM());return [r.x,r.y]}})()")
with sync_playwright() as p:
    b=p.chromium.launch()
    c,A=ctx(b,'A',URL+'admin.html',errs);A.set_viewport_size({'width':1100,'height':1500})
    A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(1500)
    A.click('#nav button[data-v=zonas]');A.wait_for_timeout(500)
    A.set_input_files('#fdArchivo',IMG);A.wait_for_timeout(3500)
    f=[x for x in R('config') if x['id']=='fondo'];P('fondo guardado:',bool(f and f[0].get('url')),'| x,w:',f[0].get('x'),round(f[0].get('w')))
    P('imagen en el plano:',A.locator('svg.map image').count())
    A.locator('svg.map').last.screenshot(path='/tmp/gp/fondo.png')
    # mover y achicar
    A.locator('[data-fdm="1,0"]').click();A.locator('[data-fds="0.99"]').click();A.wait_for_timeout(1200)
    f=[x for x in R('config') if x['id']=='fondo'][0];P('tras mover/achicar:',round(f['x'],1),round(f['w'],1))
    A.locator('[data-fdm="-1,0"]').click();A.locator('[data-fds="1.01"]').click();A.wait_for_timeout(1200)
    # ajustar INMERCA
    A.locator('[data-gaj]').nth(5).click();A.wait_for_timeout(600)
    pts0=A.evaluate('plEdit.pts.map(q=>[...q])');P('ajustando:',A.evaluate('plEdit.nombre'),pts0,'| imagen visible:',A.locator('#plPick image').count())
    x,y=pant(A,'#plPick',*pts0[1]);A.mouse.move(x,y);A.mouse.down();A.mouse.move(x+20,y+10,steps=5);A.mouse.up();A.wait_for_timeout(300)
    P('punto movido:',A.evaluate('plEdit.pts[1]'))
    # agregar un punto en el borde entre 2 y 3
    m=[(pts0[2][0]+pts0[3][0])/2,(pts0[2][1]+pts0[3][1])/2];x,y=pant(A,'#plPick',*m);A.mouse.click(x,y);A.wait_for_timeout(300)
    P('puntos tras agregar:',A.evaluate('plEdit.pts.length'))
    A.click('#ajQuitar');A.wait_for_timeout(300);P('puntos tras quitar:',A.evaluate('plEdit.pts.length'))
    A.locator('#plPick').screenshot(path='/tmp/gp/ajustar.png')
    A.click('#plListo');A.wait_for_timeout(1200)
    g=[x for x in R('config') if x['id']=='plano'][0]['galpones'][5];P('guardado:',g['nombre'],g['pts'])
    # ajustar una fila: primero crear una
    A.fill('#fNombre','Fila prueba');A.click('#fAgregar');A.wait_for_timeout(300)
    for q in [(560,470),(620,480)]:x,y=pant(A,'#plPick',*q);A.mouse.click(x,y);A.wait_for_timeout(200)
    A.click('#plListo');A.wait_for_timeout(1000)
    A.locator('[data-faj]').first.click();A.wait_for_timeout(500);P('ajustar fila:',A.evaluate('plEdit.tipo'),A.evaluate('plEdit.pts.length'))
    q=A.evaluate('plEdit.pts[0]');x,y=pant(A,'#plPick',*q);A.mouse.move(x,y);A.mouse.down();A.mouse.move(x-15,y,steps=4);A.mouse.up();A.click('#plListo');A.wait_for_timeout(1000)
    P('fila guardada:',[x for x in R('config') if x['id']=='plano'][0]['filas'][0]['pts'])
    # los demás no ven el fondo
    c2,V=ctx(b,'V',URL+'vendedor.html',errs)
    V.fill('#lNombre','Puesto');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500)
    V.click('#nav button[data-v=miUbic]');V.wait_for_timeout(600);P('vendedor ve la imagen:',V.locator('svg.map image').count())
    P('ERRORES:',errs)
