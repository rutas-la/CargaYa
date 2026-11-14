import sys,json;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
sql("insert into vendedores(id,data) values('v1','{\"id\":\"v1\",\"nombre\":\"Hortalizas El Andino\"}')")
for i in range(1,131):
    d={'id':f'P{i:05d}','owner':f'00000000-0000-0000-0000-{i:012d}','nombre':('Rosa Pérez' if i==7 else f'Comprador {i}'),'tel':f'0414{i:07d}','vehiculo':'Camión blanco','zona':'La Bomba','activo':i%3!=0,'llegada':1763000000000+i*1000,'creado':1762000000000,'favoritos':['v1'] if i%2 else [],'invitadoPor':'v1' if i==7 else None}
    sql("insert into compradores(id,data) values(%s,%s)",(d['id'],json.dumps(d)))
with sync_playwright() as p:
    b=p.chromium.launch()
    c,A=ctx(b,'A',URL+'admin.html',errs);A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(1500)
    P('pestañas:',A.locator('#nav button').all_inner_texts())
    A.click('#nav button[data-v=comprAdm]');A.wait_for_timeout(1200)
    P('total:',A.locator('.card .hint').first.inner_text(),'| en lista:',A.locator('.list .item').count(),'| ver más:',A.locator('#caMas').inner_text() if A.locator('#caMas').count() else None)
    A.click('#caMas');A.wait_for_timeout(1000);P('tras ver más:',A.locator('.list .item').count())
    A.select_option('#caFiltro','fuera');A.wait_for_timeout(1000);P('se fueron:',A.locator('.card .hint').first.inner_text())
    A.select_option('#caFiltro','todos');A.wait_for_timeout(800)
    for q in ['rosa','P00007','0414000007','blanco']:
        A.fill('#caBusca',q);A.wait_for_timeout(1300);P(f'busca {q}:',A.locator('.card .hint').first.inner_text(),'| foco:',A.evaluate("document.activeElement.id"))
    A.fill('#caBusca','rosa');A.wait_for_timeout(1300);P('item:',A.locator('.list .item').first.inner_text().replace('\n',' | ')[:200])
    A.fill('#caBusca','');A.wait_for_timeout(1300)
    with A.expect_download() as dl:A.click('#caCsv')
    import openpyxl,shutil;shutil.copy(dl.value.path(),'/tmp/full/comp.xlsx');ws=openpyxl.load_workbook('/tmp/full/comp.xlsx').active;P('xlsx:',dl.value.suggested_filename,ws.title,ws.max_row-1,'filas',[c.value for c in ws[1]][:5],ws.freeze_panes,ws.auto_filter.ref,[c.value for c in ws[8]])
    A.screenshot(path='/tmp/full/v2_ca.png',full_page=False)
    P('ERRORES:',errs)
