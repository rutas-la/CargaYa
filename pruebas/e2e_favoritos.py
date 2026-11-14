import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();sql("insert into zonas(id,data) values('Z1','{\"id\":\"Z1\",\"nombre\":\"La Bomba\"}')")
with sync_playwright() as p:
    b=p.chromium.launch()
    def vend(nom,tel):
        c,V=ctx(b,nom,URL+'vendedor.html',errs);V.fill('#lNombre',nom);V.fill('#lTel',tel);V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500);return V
    V1=vend('Zuleta Hortalizas','0412-5550001');V2=vend('Aaa Frutas','0412-5550002');V3=vend('Bbb Vencido','0412-5550003')
    ids={v['nombre']:v['id'] for v in R('vendedores')}
    sql("update vendedores set data=data||'{\"pagadoHasta\":1000}' where data->>'nombre'='Bbb Vencido'")
    c,C=ctx(b,'C',URL+'comprador.html?v='+ids['Zuleta Hortalizas'],errs)
    C.fill('#lNombre','Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.select_option('#rZona',label='La Bomba');C.fill('#rVeh','Ford');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(2000)
    # marca a otro vendedor (alfabéticamente primero) y luego abre la invitación de ese otro
    C.locator(f'[data-fav="{ids["Aaa Frutas"]}"]').click();C.wait_for_timeout(800)
    C.goto(URL+'comprador.html?v='+ids['Aaa Frutas']);C.wait_for_timeout(2000);C.click('#nav button[data-v=vendC]');C.wait_for_timeout(800)
    fav=C.locator('.card:has(h2:has-text("Mis favoritos")) .item b').all_inner_texts();P('favoritos en orden:',fav)
    P('vencido en directorio:',C.locator('text=Bbb Vencido').count())
    P('dato:',[(c.get('invitadoPor')==ids['Zuleta Hortalizas'],len(c.get('favoritos'))) for c in R('compradores')])
    V1.click('#nav button[data-v=miUbic]');V1.wait_for_timeout(1500);P('contador V1:',V1.locator('text=Compradores que entraron').inner_text())
    V2.click('#nav button[data-v=miUbic]');V2.wait_for_timeout(1500);P('contador V2:',V2.locator('text=Compradores que entraron').inner_text())
    C.screenshot(path='/tmp/full/v2fav.png',full_page=True)
    P('ERRORES:',errs)
