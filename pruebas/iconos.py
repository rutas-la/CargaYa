import subprocess,os
ROLES={'':(None,None),'vendedor':('V','#16181c'),'comprador':('C','#1f6feb'),'admin':('A','#12a150')}
def svg(letra,col,maskable=False):
    # Fondo amarillo CargaYa, carretilla negra con dos bultos; insignia del rol abajo a la derecha
    pad=0 if not maskable else 0  # el dibujo ya está dentro de la zona segura (80 % central)
    s=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd54a"/><stop offset="1" stop-color="#ffb300"/></linearGradient></defs>
<rect width="512" height="512" rx="{0 if maskable else 112}" fill="url(#g)"/>
<g transform="{'translate(256 256) scale(.78) translate(-256 -256)' if maskable else ''}">
<g transform="translate(76 86)">
 <!-- bultos -->
 <rect x="62" y="150" width="150" height="92" rx="12" fill="#16181c"/>
 <rect x="80" y="62" width="118" height="78" rx="12" fill="#16181c"/>
 <rect x="78" y="168" width="118" height="12" rx="6" fill="#ffd54a" opacity=".9"/>
 <rect x="96" y="80" width="86" height="10" rx="5" fill="#ffd54a" opacity=".9"/>
 <!-- plataforma y mango -->
 <path d="M40 258 H232 a16 16 0 0 1 16 16 v10 a16 16 0 0 1 -16 16 H40 Z" fill="#16181c"/>
 <path d="M228 0 h22 a14 14 0 0 1 14 14 v244 h-36 Z" fill="#16181c"/>
 <circle cx="242" cy="20" r="30" fill="#16181c"/>
 <!-- ruedas -->
 <circle cx="88" cy="322" r="42" fill="#16181c"/><circle cx="88" cy="322" r="16" fill="#ffd54a"/>
 <circle cx="228" cy="322" r="42" fill="#16181c"/><circle cx="228" cy="322" r="16" fill="#ffd54a"/>
 <!-- líneas de movimiento -->
 <rect x="-30" y="110" width="70" height="18" rx="9" fill="#16181c" opacity=".55"/>
 <rect x="-52" y="156" width="92" height="18" rx="9" fill="#16181c" opacity=".4"/>
 <rect x="-30" y="202" width="70" height="18" rx="9" fill="#16181c" opacity=".25"/>
</g>'''
    if letra:
        s+=f'''<circle cx="400" cy="400" r="86" fill="{col}" stroke="#fff" stroke-width="14"/>
<text x="400" y="440" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="112" fill="#fff">{letra}</text>'''
    return s+'</g></svg>'
out='/home/claude/repo-cargaya'
for rol,(l,c) in ROLES.items():
    suf=('-'+rol) if rol else ''
    for d in [out,out+'/v2']:
        open(f'{d}/icon{suf}.svg','w').write(svg(l,c))
        open(f'{d}/icon{suf}-maskable.svg','w').write(svg(l,c,True))
        for n in [192,512]:
            subprocess.run(['rsvg-convert','-w',str(n),'-h',str(n),'-o',f'{d}/icon{suf}-{n}.png',f'{d}/icon{suf}.svg'],check=True)
            subprocess.run(['rsvg-convert','-w',str(n),'-h',str(n),'-o',f'{d}/icon{suf}-maskable-{n}.png',f'{d}/icon{suf}-maskable.svg'],check=True)
        subprocess.run(['rsvg-convert','-w','180','-h','180','-o',f'{d}/icon{suf}-180.png',f'{d}/icon{suf}-maskable.svg'],check=True)
print('ok')
