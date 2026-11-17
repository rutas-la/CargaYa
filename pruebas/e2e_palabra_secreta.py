import sys,json,urllib.request;sys.path.insert(0,'/home/claude/v2test')
from comun import *
from playwright.sync_api import sync_playwright
errs=[];reset()
def alta(tel,pin,md):
    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8780/auth/v1/signup',data=json.dumps({'email':tel+'@cargaya.app','password':pin,'data':md}).encode(),headers={'Content-Type':'application/json'}))
alta('584141111111','123456',{'rol':'comprador','nombre':'Ana','tel':'0414-1111111','placa':'AB123CD'})  # cuenta vieja, sin palabra
def txt(P,s):
    try: return P.inner_text(s)
    except Exception: return ''
with sync_playwright() as p:
    b=p.chromium.launch()
    c,V=ctx(b,'V',URL+'vendedor.html',errs);V.set_viewport_size({'width':390,'height':844})
    V.fill('#lNombre','Hortalizas El Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456')
    V.click('#lGo');V.wait_for_timeout(400);print('sin palabra:',txt(V,'#lErr'))
    V.fill('#lPal',' Firuláis ');V.screenshot(path='/tmp/pal_reg.png',full_page=True);V.click('#lGo');V.wait_for_timeout(2500)
    print('registrado:',txt(V,'#estado').replace('\n',' '),'| modal palabra:',V.locator('#palModal').count())
    print('palabras en BD:',sql("select count(*) from palabras_secretas")[0][0])
    V.click('#salir');V.wait_for_timeout(1500)
    V.click('[data-modo=entrar]');V.fill('#lTel','0412-5550001');V.click('#lOlvide');V.wait_for_timeout(300)
    print('tel prellenado:',V.input_value('#rTel'))
    V.fill('#rPal','perro');V.fill('#rPin','777777');V.fill('#rPin2','777777');V.click('#rGo');V.wait_for_timeout(1000);print('mala:',txt(V,'#rErr'))
    V.fill('#rPal','FIRULAIS');V.screenshot(path='/tmp/pal_rec.png',full_page=True);V.click('#rGo');V.wait_for_timeout(2500);print('buena:',txt(V,'#estado').replace('\n',' '))
    # comprador viejo: aviso al entrar, la crea
    c2,C=ctx(b,'C',URL+'comprador.html',errs);C.set_viewport_size({'width':390,'height':844})
    C.click('[data-modo=entrar]');C.click('#lOlvide');C.fill('#rTel','0414-1111111');C.fill('#rPal','algo');C.fill('#rPin','555555');C.fill('#rPin2','555555');C.click('#rGo');C.wait_for_timeout(1000);print('sin palabra:',txt(C,'#rErr'))
    C.click('#rAtras');C.fill('#lTel','0414-1111111');C.fill('#lPin','123456');C.click('#lGo');C.wait_for_timeout(3000)
    print('modal al entrar:',C.locator('#palModal').count());C.screenshot(path='/tmp/pal_modal.png')
    C.fill('#pPal','ab');C.click('#pOk');C.wait_for_timeout(300);print('corta:',txt(C,'#pErr'))
    C.fill('#pPal','Caracas');print('valor:',C.input_value('#pPal'),C.evaluate("palabraNormal(document.getElementById('pPal').value)"));C.click('#pOk');C.wait_for_timeout(1500);print('modal cerrado:',C.locator('#palModal').count()==0,txt(C,'#pErr'),C.locator('#palModal').count())
    C.click('#miPalabra');C.wait_for_timeout(300);print('cambiar desde encabezado:',txt(C,'#palModal h2'));C.click('#pNo')
    C.click('#salir');C.wait_for_timeout(1500);C.click('[data-modo=entrar]');C.click('#lOlvide')
    for i in range(5):
        C.fill('#rTel','0414-1111111');C.fill('#rPal','x'*5+str(i));C.fill('#rPin','555555');C.fill('#rPin2','555555');C.click('#rGo');C.wait_for_timeout(700)
    print('5 fallos:',txt(C,'#rErr'))
    C.fill('#rPal','caracas');C.click('#rGo');C.wait_for_timeout(700);print('aun bloqueado con la buena:',txt(C,'#rErr')[:40])
    c3,A=ctx(b,'A',URL+'admin.html',errs);print('admin boton:',A.locator('#lOlvide').count())
    print('ERRORES:',[e for e in errs if '400' not in e])
try:
    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8780/rest/v1/palabras_secretas',headers={'apikey':'x'}));print('tabla visible para anon?')
except Exception as e: print('tabla protegida:',e)
print(sql("select m from actividad order by id"))
