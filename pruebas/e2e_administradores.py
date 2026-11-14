import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from comun import *
from playwright.sync_api import sync_playwright
errs=[];P=lambda *a:print(*a,flush=True)
reset();hacer_admin('584141111111')
with sync_playwright() as p:
    b=p.chromium.launch()
    c,V=ctx(b,'V',URL+'vendedor.html',errs);V.fill('#lNombre','Andino');V.fill('#lTel','0412-5550001');V.fill('#lPin','123456');V.click('#lGo');V.wait_for_timeout(1500)
    cA,A=ctx(b,'A',URL+'admin.html',errs);A.fill('#lTel','0414-1111111');A.fill('#lPin','999999');A.click('#lGo');A.wait_for_timeout(2000)
    P('lista:',A.locator('.card:has(h2:has-text("Administradores")) .list').inner_text().replace('\n',' | '))
    A.fill('#admNuevoTel','0412-5550001');A.click('#admNuevoOk');A.wait_for_timeout(1500);P('tras agregar existente:',A.locator('.card:has(h2:has-text("Administradores")) .list').inner_text().replace('\n',' | '))
    A.fill('#admNuevoTel','0416-7777777');A.click('#admNuevoOk');A.wait_for_timeout(1000);P('sin pin:',A.locator('#toast').inner_text())
    A.fill('#admNuevoTel','0416-7777777');A.fill('#admNuevoPin','555555');A.click('#admNuevoOk');A.wait_for_timeout(1500);P('nuevo:',A.locator('.card:has(h2:has-text("Administradores")) .list').inner_text().replace('\n',' | '))
    # el nuevo entra al módulo admin
    cN,N=ctx(b,'N',URL+'admin.html',errs);N.fill('#lTel','0416-7777777');N.fill('#lPin','555555');N.click('#lGo');N.wait_for_timeout(2000);P('nuevo admin entra:',N.locator('#nav button').count()>0,N.locator('#nav button.on').inner_text() if N.locator('#nav button.on').count() else None)
    # el vendedor ahora es admin: abre admin.html
    V.goto(URL+'admin.html');V.wait_for_timeout(2000);P('vendedor-admin entra:',V.locator('#nav button').count()>0)
    A.locator('[data-admdel]').first.click();A.locator('[data-admdel]').first.click();A.wait_for_timeout(1500);P('tras quitar:',A.locator('.card:has(h2:has-text("Administradores")) .list').inner_text().replace('\n',' | '))
    P('ERRORES:',errs)
