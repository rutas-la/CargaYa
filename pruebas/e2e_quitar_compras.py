import sys,os,json,time;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
import psycopg
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
def t(pg,s):
    try:return pg.inner_text(s)
    except Exception:return ''
with sync_playwright() as p:
    b=p.chromium.launch()
    cV,V=ctx(b,'V',URL+'vendedor.html',errs)
    V.fill('#lNombre','Hortalizas El Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500)
    cC,C=ctx(b,'C',URL+'comprador.html',errs);C.set_viewport_size({'width':390,'height':900})
    C.fill('#lNombre','Bodega Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.fill('#rZonaT','La Bomba');C.fill('#rVeh','Ford blanca');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1000)
    vid=sql("select id from vendedores")[0][0];now=int(time.time()*1000)
    with psycopg.connect("dbname=cy2 user=postgres password=pg host=127.0.0.1",autocommit=True) as cn:
        for i,(est,mins) in enumerate([('entregado',300),('entregado',200),('reclamo',150),('en_ruta',10)]):
            d={'id':f'D{i}','vendedor':vid,'placa':'AB123CD','estado':est,'bultos':i+1,'items':[{'desc':f'Papa {i}','bultos':i+1}],'t':{'creado':now-mins*60000}}
            cn.execute("insert into despachos(id,data) values(%s,%s)",(d['id'],json.dumps(d)))
    C.reload();C.wait_for_timeout(2500)
    C.screenshot(path='/tmp/quitar0.png');P('inicio:',t(C,'.card:has(h2:text("Mis compras")) .sub'),'| botones quitar:',C.locator('[data-cquit]').count())
    C.locator('[data-cquit="D0"]').click();C.wait_for_timeout(1000)
    P('tras quitar D0:',t(C,'.card:has(h2:text("Mis compras")) .sub'),'| guardado:',sql("select data->'ocultos' from compradores")[0][0])
    C.click('#quitTodas');C.click('#quitTodas');C.wait_for_timeout(1000)
    P('tras quitar todas:',t(C,'.card:has(h2:text("Mis compras")) .sub'),'| en camino visible:',C.locator('.card:has(h2:text("Mis compras")) .list >> text=Papa 3').count())
    C.screenshot(path='/tmp/quitar1.png',full_page=True)
    C.click('#verQuit');C.wait_for_timeout(400);P('ver quitadas:',C.locator('[data-cvolver]').count())
    C.locator('[data-cvolver="D2"]').click();C.wait_for_timeout(1000);P('tras volver D2:',t(C,'.card:has(h2:text("Mis compras")) .sub'))
    C.reload();C.wait_for_timeout(2500);P('tras recargar:',t(C,'.card:has(h2:text("Mis compras")) .sub'))
    # el vendedor sigue viendo todo
    V.reload();V.wait_for_timeout(2500);V.click('#nav button[data-v=histVend]');V.wait_for_timeout(800);P('vendedor ve:',V.locator('text=AB123CD').count(),'despachos en historial')
    # confirmar el que estaba en camino: no se oculta solo
    C.click('[data-rabrir="D3"]');C.click('[data-rok="D3"]');C.wait_for_timeout(1500);P('D3 recibido visible:',C.locator('[data-cquit="D3"]').count())
    P('ERRORES:',[e for e in errs if '400' not in e])
