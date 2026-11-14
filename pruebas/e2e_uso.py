import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
sql("delete from admins; insert into admins values('00000000-0000-0000-0002-000000000001')")
with sync_playwright() as p:
    b=p.chromium.launch()
    c,A=ctx(b,'A',URL+'admin.html',errs);A.set_viewport_size({'width':1200,'height':1000});A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(1500)
    A.click('#nav button[data-v=uso]');A.wait_for_function("()=>document.querySelector('.kpi')",timeout=30000);A.wait_for_timeout(500)
    P('kpis:',A.locator('.kpi b').all_inner_texts()[:8]);P('barras:',A.locator('svg rect').count())
    A.screenshot(path='/tmp/full/uso.png',full_page=True)
    A.click('[data-usotab=vendedores]');A.wait_for_timeout(300);P('filas vendedores:',A.locator('tbody tr').count())
    A.fill('#usoQ','Vendedor 7');A.wait_for_timeout(600);P('busca:',A.locator('tbody tr').count())
    with A.expect_download() as dl:A.click('#usoXls')
    import openpyxl,shutil;shutil.copy(dl.value.path(),'/tmp/full/uso.xlsx');wb=openpyxl.load_workbook('/tmp/full/uso.xlsx');P('excel:',{ws.title:ws.max_row-1 for ws in wb})
    P('ERRORES:',errs)
