"""Sube la versión visible de CargaYa v2: python3 pruebas/subir_version.py 2.5 18/11/2026
Actualiza app.js (VERSION), version.json y los ?v= de los HTML para que los teléfonos bajen la copia nueva."""
import re,sys,os
v,fecha=sys.argv[1],sys.argv[2];d=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','v2')
p=os.path.join(d,'app.js');s=open(p).read();s=re.sub(r"const VERSION='[^']*',VERSION_FECHA='[^']*';",f"const VERSION='{v}',VERSION_FECHA='{fecha}';",s);open(p,'w').write(s)
open(os.path.join(d,'version.json'),'w').write('{"v":"%s","fecha":"%s"}\n'%(v,fecha))
for f in ['vendedor.html','comprador.html','admin.html','carretillero.html','index.html']:
    p=os.path.join(d,f);s=open(p).read();s=re.sub(r'(app\.css|app\.js|config\.js)\?v=[^"]*',lambda m:m.group(1)+'?v='+v,s);open(p,'w').write(s)
p=os.path.join(d,'sw.js');s=open(p).read();s=re.sub(r"const CACHE='[^']*';",f"const CACHE='cargaya-v{v}';",s);open(p,'w').write(s)
print('versión',v,fecha)
