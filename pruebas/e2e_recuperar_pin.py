import sys,json,urllib.request;sys.path.insert(0,'/home/claude/v2test')
from comun import *
from playwright.sync_api import sync_playwright
errs=[];reset()
import psycopg
with psycopg.connect("dbname=cy2 user=postgres password=pg host=127.0.0.1",autocommit=True) as c: c.execute("delete from recuperacion")
def alta(tel,pin,md):
    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8780/auth/v1/signup',data=json.dumps({'email':tel+'@cargaya.app','password':pin,'data':md}).encode(),headers={'Content-Type':'application/json'}))
alta('584125550001','123456',{'rol':'vendedor','nombre':'Hortalizas El Andino','tel':'0412-5550001'})
alta('584141111111','123456',{'rol':'comprador','nombre':'Ana','tel':'0414-1111111','placa':'AB123CD'})
alta('584145551020','123456',{'rol':'comprador','nombre':'Luis','tel':'0414-5551020','placa':'XY987ZZ'})
def txt(P,s):
    try: return P.inner_text(s)
    except Exception: return ''
with sync_playwright() as p:
    b=p.chromium.launch()
    c,V=ctx(b,'V',URL+'vendedor.html',errs);V.set_viewport_size({'width':390,'height':844})
    V.click('[data-modo=entrar]');V.fill('#lTel','0412-5550001');V.click('#lOlvide');V.wait_for_timeout(300)
    print('tel prellenado:',V.input_value('#rTel'));V.screenshot(path='/tmp/rec1.png')
    V.click('#rGo');V.wait_for_timeout(1200);print('paso2:',txt(V,'.found'),'ERR:',txt(V,'#rErr'),errs)
    V.click('#rOtra');V.wait_for_timeout(500);print('reenvio pronto:',txt(V,'#rErr'))
    V.fill('#rCod','111111');V.fill('#rPin','777777');V.fill('#rPin2','777777');V.click('#rGo');V.wait_for_timeout(1200);print('codigo malo:',txt(V,'#rErr'))
    V.fill('#rPin2','777778');V.fill('#rCod','424242');V.click('#rGo');V.wait_for_timeout(300);print('pins distintos:',txt(V,'#rErr'))
    V.screenshot(path='/tmp/rec2.png')
    V.fill('#rPin2','777777');V.click('#rGo');V.wait_for_timeout(2500);print('tras cambiar:',txt(V,'#estado').replace('\n',' '))
    V.click('#salir');V.wait_for_timeout(1500);V.click('[data-modo=entrar]');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1200)
    print('PIN viejo:',txt(V,'#lErr')[:40]);V.fill('#lPin','777777');V.click('#lGo');V.wait_for_timeout(2000);print('PIN nuevo:',txt(V,'#estado').replace('\n',' '))
    # comprador: telefono inexistente y luego el bueno
    c2,C=ctx(b,'C',URL+'comprador.html',errs);C.set_viewport_size({'width':390,'height':844})
    C.click('[data-modo=entrar]');C.click('#lOlvide');C.fill('#rTel','0412-0000000');C.click('#rGo');C.wait_for_timeout(1000);print('comp inexistente:',txt(C,'#rErr'))
    C.fill('#rTel','0414-1111111');C.click('#rGo');C.wait_for_timeout(1000);print('comp paso2:',txt(C,'.found')[:60])
    C.fill('#rCod','424242');C.fill('#rPin','555555');C.fill('#rPin2','555555');C.click('#rGo');C.wait_for_timeout(2500);print('comp entra:',txt(C,'#estado').replace('\n',' '))
    # admin no tiene el boton
    c3,A=ctx(b,'A',URL+'admin.html',errs);print('admin boton olvide:',A.locator('#lOlvide').count())
    print('ERRORES:',errs)
# limite: 3 por hora
r=lambda: json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8780/functions/v1/recuperar-pin',data=json.dumps({'accion':'enviar','tel':'584145551020'}).encode(),headers={'Content-Type':'application/json'})).read())
print('envio directo:',r(), r())
with psycopg.connect("dbname=cy2 user=postgres password=pg host=127.0.0.1",autocommit=True) as c:
    c.execute("update recuperacion set ultimo=now()-interval '2 min', envios=3"); print('4to envio:',r())
    print('anon puede llamar rpc?', urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8780/rest/v1/rpc/recup_fijar_pin',data=b'{"tel_digitos":"584125550001","pin_nuevo":"000000"}',headers={'Content-Type':'application/json'})).status if False else '')
try:
    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8780/rest/v1/rpc/recup_fijar_pin',data=b'{"tel_digitos":"584125550001","pin_nuevo":"000000"}',headers={'Content-Type':'application/json'}));print('ANON PUDO — MAL')
except Exception as e: print('anon bloqueado:',e)
print(urllib.request.urlopen('http://127.0.0.1:8791/log').read().decode()[:300])
