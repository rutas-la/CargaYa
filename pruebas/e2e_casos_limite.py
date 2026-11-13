import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
sql("insert into zonas(id,data) values('Z1','{\"id\":\"Z1\",\"nombre\":\"La Bomba\"}')")
with sync_playwright() as p:
    b=p.chromium.launch()
    toast=lambda pg:pg.locator('#toast').inner_text()
    def vend(nom,tel):
        c,V=ctx(b,nom,URL+'vendedor.html',errs);V.fill('#lNombre',nom);V.fill('#lTel',tel);V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1800);return c,V
    def compr(nom,tel,placa,url=None):
        c,C=ctx(b,nom,url or URL+'comprador.html',errs);C.fill('#lNombre',nom);C.fill('#lTel',tel);C.fill('#lPlaca',placa);C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1800)
        C.select_option('#rZona',label='La Bomba');C.fill('#rVeh','Camión');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1200);return c,C
    cV1,V1=vend('Andino','0412-5550001');cV2,V2=vend('Doña Ana','0412-5550002')
    for V in (V1,V2):V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300);V.fill('#kNom','K de '+V.title()[:3]);V.click('#kAdd');V.wait_for_timeout(700)
    k2=[k for k in R('carretilleros') if k['vendedor']!=R('vendedores')[0]['id'] or True]
    ids={v['nombre']:v['id'] for v in R('vendedores')};kV2=[k for k in R('carretilleros') if k['vendedor']==ids['Doña Ana']][0]
    # comprador se registra DESPUÉS de que el vendedor cargó: búsqueda bajo demanda
    cC1,C1=compr('Rosa','0414-5551020','AB123CD');cC2,C2=compr('Luis','0414-5551030','XY987ZZ')
    V1.click('#nav button[data-v=vendedor]');V1.wait_for_timeout(300);V1.fill('#placa','AB123CD');V1.dispatch_event('#placa','input');V1.wait_for_timeout(1200);P('placa nueva encontrada:',V1.inner_text('#placaInfo')[:30].replace('\n',' '))
    # carretillero ajeno escaneado
    V1.evaluate(f"escanear=async()=>'K:{kV2['id']}'");V1.click('#dScanK');V1.wait_for_timeout(1200);P('ajeno:',toast(V1))
    V1.locator('.it-desc').first.fill('Papa');V1.click('#fDesp button[type=submit]');V1.wait_for_timeout(1200);V1.click('#fvListo');V1.wait_for_timeout(500)
    d=R('despachos')[0];P('despacho con ajeno:',d['carretillero']==kV2['id'])
    P('lista V1 muestra ajeno:',V1.locator('text=Doña Ana').count()>0)
    # privacidad en la app
    C2.wait_for_timeout(800);P('C2 ve despachos ajenos:',C2.evaluate("Object.keys(S.despacho).length"),'| C2 ve compradores:',C2.evaluate("Object.keys(S.comprador)"))
    P('V2 ve despachos de V1:',V2.evaluate("Object.keys(S.despacho).length"),'| V2 ve pagos/vendedores:',V2.evaluate("Object.keys(S.vendedor).length"))
    P('C1 tiene datos de cobro de vendedores:',C1.evaluate("Object.values(S.vendedor).some(v=>'pagadoHasta' in v||'creado' in v)"))
    # comprador confirma con el enlace de la credencial (?k=)
    C1.goto(URL+'comprador.html?k='+kV2['id']);C1.wait_for_timeout(1800);P('?k= abre confirmación:',C1.locator(f'[data-rok="{d["id"]}"]').count())
    # vendedor sin conexión mientras el comprador confirma; al volver se resincroniza
    cV1.set_offline(True);V1.wait_for_timeout(1500)
    C1.click(f'[data-rok="{d["id"]}"]');C1.wait_for_timeout(1200);P('servidor:',R('despachos')[0]['estado'])
    P('V1 offline ve:',V1.evaluate(f"S.despacho['{d['id']}'].estado"))
    cV1.set_offline(False);V1.wait_for_timeout(9000);P('V1 tras reconectar ve:',V1.evaluate(f"S.despacho['{d['id']}'].estado"))
    # despacho sin conexión queda en cola y se envía
    cV1.set_offline(True);V1.fill('#placa','XY987ZZ');V1.dispatch_event('#placa','input');V1.locator('.it-desc').first.fill('Cebolla');V1.locator('[data-ksel]').first.click();V1.click('#fDesp button[type=submit]');V1.wait_for_timeout(800)
    if V1.is_visible('#fvListo'):V1.click('#fvListo')
    P('offline en servidor:',len(R('despachos')));cV1.set_offline(False);V1.evaluate("window.dispatchEvent(new Event('online'))");V1.wait_for_timeout(3000);P('tras volver:',len(R('despachos')))
    # mensualidad vencida: el servidor rechaza aunque la app no lo sepa
    sql("update vendedores set data=data||'{\"pagadoHasta\":1000}' where data->>'nombre'='Doña Ana'")
    V2.wait_for_timeout(1500);P('V2 bloqueado en pantalla:',V2.locator('text=Despachos bloqueados').count()>0)
    V2.evaluate("guardar('despacho',{id:'DX1',vendedor:ME.id,placa:'AB123CD',items:[{desc:'x',bultos:1}],desc:'x',bultos:1,carretillero:null,ficha:null,estado:'en_ruta',t:{creado:Date.now()}})");V2.wait_for_timeout(1500)
    P('vencido servidor:',toast(V2),'| despachos de V2:',sum(1 for x in R('despachos') if x['vendedor']==ids['Doña Ana']))
    # login
    cX,X=ctx(b,'X',URL+'vendedor.html',errs);X.fill('#lNombre','x');X.fill('#lTel','0412-5550001');X.fill('#lPin','111111');X.click('#lGo');X.wait_for_timeout(1000);P('duplicado:',X.inner_text('#lErr'))
    X.click('[data-modo=entrar]');X.fill('#lTel','0412-5550001');X.fill('#lPin','000000');X.click('#lGo');X.wait_for_timeout(1000);P('PIN malo:',X.inner_text('#lErr'))
    # invitación
    link=URL+'comprador.html?v='+ids['Andino'];cI,I=compr('Nuevo','0414-5559999','JJ111KK',url=link);I.wait_for_timeout(1500)
    P('invitación favoritos:',[c.get('favoritos') for c in R('compradores') if c['id']=='JJ111KK'])
    P('red:',{k:v for k,v in stats().items() if k!='subs'})
    P('ERRORES:',[e for e in errs if 'ERR_INTERNET_DISCONNECTED' not in e and 'Failed to fetch' not in e])
