import sys,os,json,time;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
from PIL import Image
if not os.path.exists('/tmp/full/inv.png'):os.makedirs('/tmp/full',exist_ok=True);Image.new('RGB',(200,150),'#888').save('/tmp/full/inv.png')
reset();hacer_admin('584141111111')
def t(pg,s):
    try:return pg.inner_text(s)
    except Exception:return ''
def despachar(V,desc,n):
    V.click('#nav button[data-v=vendedor]');V.wait_for_timeout(400)
    V.fill('#placa','AB123CD');V.dispatch_event('#placa','input');V.wait_for_timeout(800)
    item(V,0,desc);V.locator('.it-bul').first.fill(str(n))
    V.locator('[data-ksel]').first.click();V.wait_for_timeout(200);V.click('#fDesp button[type=submit]');V.wait_for_timeout(1000)
    if V.locator('#fvListo').count():V.click('#fvListo')
    V.wait_for_timeout(500)
with sync_playwright() as p:
    b=p.chromium.launch()
    cV,V=ctx(b,'V',URL+'vendedor.html',errs);V.set_viewport_size({'width':390,'height':844})
    V.fill('#lNombre','Hortalizas El Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1800)
    V.click('#nav button[data-v=misCarr]');V.wait_for_timeout(300);V.fill('#kNom','José');V.click('#kAdd');V.wait_for_timeout(800)
    cC,C=ctx(b,'C',URL+'comprador.html',errs);C.set_viewport_size({'width':390,'height':844})
    C.fill('#lNombre','Bodega Rosa');C.fill('#lTel','0414-5551020');C.fill('#lPlaca','AB123CD');C.fill('#lPin','654321');C.click('#lGo');C.wait_for_timeout(1500)
    C.fill('#rZonaT','La Bomba');C.fill('#rVeh','Ford blanca');C.click('text=Guardar y empezar a comprar');C.wait_for_timeout(1000)
    despachar(V,'Papa',5)
    V.click('#nav button[data-v=histVend]');V.wait_for_timeout(500)   # el vendedor está en otra pestaña
    C.wait_for_timeout(1500);did=R('despachos')[0]['id']
    C.click(f'[data-rabrir="{did}"]');C.wait_for_timeout(300)
    C.click(f'[data-rmal="{did}"]');C.wait_for_timeout(300);P('sin texto:',t(C,'#toast'))
    C.fill('#rcRecl','Llegaron 4 bultos, faltó 1');C.set_input_files('#rcFoto','/tmp/full/inv.png');C.wait_for_timeout(2500)
    P('foto previa visible:',C.evaluate("getComputedStyle(document.getElementById('rcFotoPrev')).display!=='none'"))
    C.screenshot(path='/tmp/rc/c_form.png',full_page=True)
    C.click(f'[data-rmal="{did}"]');C.wait_for_timeout(1500)
    d=R('despachos')[0];P('guardado:',d['estado'],d.get('reclamo'),'foto' if d.get('reclamoFoto') else 'SIN FOTO')
    V.wait_for_timeout(1500);P('vendedor toast:',t(V,'#toast'),'| banner:',t(V,'#bannerRecl'))
    V.screenshot(path='/tmp/rc/v_banner.png')
    V.click('#bannerRecl');V.wait_for_timeout(800);P('tarjeta reclamo:',t(V,'#cardRecl h2'))
    wa=V.locator('#cardRecl a[href*="wa.me"]').first.get_attribute('href');P('whatsapp:',wa[:60],'... incluye reclamo:','falt' in wa)
    V.locator('#cardRecl').screenshot(path='/tmp/rc/v_card.png')
    # el vendedor intenta cambiar el texto del reclamo (no debe poder)
    V.evaluate(f"guardar('despacho',{{...S.despacho['{did}'],reclamo:'todo bien'}})");V.wait_for_timeout(800);P('texto protegido:',R('despachos')[0]['reclamo'])
    V.fill(f'#rsN-{did}','Le llevé el bulto que faltaba');V.click(f'[data-resol="{did}"][data-tipo="repuesto"]');V.wait_for_timeout(1500)
    P('resuelto:',R('despachos')[0].get('resol',{}).get('tipo'),'| tarjeta sigue:',V.locator('#cardRecl').count(),'| banner:',V.locator('#bannerRecl').count())
    C.wait_for_timeout(1500);P('comprador toast:',t(C,'#toast'));P('comprador ve:',C.locator('text=Repuso lo que faltaba').count())
    C.screenshot(path='/tmp/rc/c_resuelto.png',full_page=True)
    # segunda compra: confirma y luego reporta tarde
    despachar(V,'Cebolla',3);C.wait_for_timeout(1500);d2=[x for x in R('despachos') if x['id']!=did][0]['id']
    C.click(f'[data-rabrir="{d2}"]');C.click(f'[data-rok="{d2}"]');C.wait_for_timeout(1500)
    C.click(f'[data-rtarde="{d2}"]');C.wait_for_timeout(300);C.fill('#rcRecl','Una cebolla venía dañada');C.click(f'[data-rmal="{d2}"]');C.wait_for_timeout(1500)
    P('reclamo tardío:',[x['estado'] for x in R('despachos') if x['id']==d2])
    V.wait_for_timeout(1200);P('vendedor tarjeta:',t(V,'#cardRecl h2'))
    V.click(f'[data-resol="{d2}"][data-tipo="descuento"]');V.wait_for_timeout(1000)
    # el comprador reclama de nuevo el primero: vuelve a abrirse
    # admin
    cA,A=ctx(b,'A',URL+'admin.html',errs);A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(3000)
    P('admin:',t(A,'.card:has(h2:text("Reclamos por faltantes")) .kpis').replace('\n',' '))
    A.locator('.card:has(h2:text("Reclamos por faltantes"))').screenshot(path='/tmp/rc/a_card.png')
    # Excel del vendedor incluye la resolución
    V.click('#nav button[data-v=histVend]');V.wait_for_timeout(500)
    with V.expect_download() as dl:V.click('text=Excel')
    import openpyxl,shutil;shutil.copy(dl.value.path(),'/tmp/rc/h.xlsx');ws=openpyxl.load_workbook('/tmp/rc/h.xlsx').active
    col=[c.value for c in ws[1]].index('Reclamo');P('excel:',[ws.cell(r,col+1).value for r in range(2,ws.max_row+1)])
    P('ERRORES:',[e for e in errs if '400' not in e])
