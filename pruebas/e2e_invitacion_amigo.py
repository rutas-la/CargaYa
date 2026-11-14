import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();sql("insert into zonas(id,data) values('Z1','{\"id\":\"Z1\",\"nombre\":\"La Bomba\"}')")
with sync_playwright() as p:
    b=p.chromium.launch()
    def vend(nom,tel):
        c,V=ctx(b,nom,URL+'vendedor.html',errs);V.fill('#lNombre',nom);V.fill('#lTel',tel);V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500);return V
    vend('Zuleta Hortalizas','0412-5550001');vend('Aaa Frutas','0412-5550002');vend('Ccc Papas','0412-5550003')
    ids={v['nombre']:v['id'] for v in R('vendedores')}
    def compr(nom,tel,placa,url):
        c,C=ctx(b,nom,url,errs);C.fill('#lNombre',nom);C.fill('#lTel',tel);C.fill('#lPlaca',placa);C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
        C.select_option('#rZona',label='La Bomba');C.fill('#rVeh','Ford');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(2500);return C
    A=compr('Rosa Pérez','0414-5551020','AB123CD',URL+'comprador.html?v='+ids['Zuleta Hortalizas'])
    A.locator(f'[data-fav="{ids["Aaa Frutas"]}"]').click();A.wait_for_timeout(800)
    link=A.locator('#amCopiar').get_attribute('data-u');P('enlace amigo:',link[-50:])
    A.click('#amQR');A.wait_for_timeout(500);P('QR visible:',A.locator('img[alt="QR de invitación"]').count())
    A.goto(link);A.wait_for_timeout(1500);P('auto-invitación ignorada:',[c.get('referidoPor') for c in R('compradores')])
    B=compr('Luis','0414-5551030','XY987ZZ',link)
    P('toast B:',B.locator('#toast').inner_text())
    rB=[c for c in R('compradores') if c['id']=='XY987ZZ'][0];P('B favoritos:',sorted(next(k for k,v in ids.items() if v==f) for f in rB.get('favoritos',[])),'| referidoPor ok:',rB.get('referidoPor') is not None)
    P('B ve compradores ajenos:',B.evaluate("Object.keys(S.comprador)"))
    A.goto(URL+'comprador.html');A.wait_for_timeout(1500);A.click('#nav button[data-v=vendC]');A.wait_for_timeout(1500);P('A contador:',A.locator('text=Amigos que entraron').inner_text() if A.locator('text=Amigos que entraron').count() else None)
    P('ERRORES:',errs)
