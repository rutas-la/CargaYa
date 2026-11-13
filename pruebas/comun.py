import json,urllib.request,psycopg,time
URL='http://127.0.0.1:8780/v2/'
DB='dbname=cy2 user=postgres password=pg host=127.0.0.1'
CONF="window.CARGAYA_CONFIG={SUPABASE_URL:'http://127.0.0.1:8780',SUPABASE_KEY:'sb_publishable_test',EMAIL_DOMINIO:'cargaya.app'};"
def sql(q,a=()):
    with psycopg.connect(DB,autocommit=True) as c:
        cur=c.execute(q,a);return cur.fetchall() if cur.description else None
def reset():
    sql("truncate despachos,pagos,compradores,carretilleros,vendedores,zonas,config,calibracion,actividad,admins; delete from auth.users")
def R(t):return [r[0] for r in sql(f"select data from {t}")]
def hacer_admin(tel_dig,pin='999999'):
    req=urllib.request.Request('http://127.0.0.1:8780/auth/v1/signup',data=json.dumps({'email':tel_dig+'@cargaya.app','password':pin,'data':{}}).encode(),headers={'content-type':'application/json'})
    urllib.request.urlopen(req).read();sql("insert into admins select id from auth.users where email=%s",(tel_dig+'@cargaya.app',))
def stats():return json.load(urllib.request.urlopen('http://127.0.0.1:8780/__stats'))
def ctx(b,name,url,errs,geo=None):
    c=b.new_context(viewport={'width':420,'height':900},accept_downloads=True,**({'geolocation':geo,'permissions':['geolocation']} if geo else {}))
    c.route('**/v2/config.js',lambda r:r.fulfill(body=CONF,content_type='application/javascript'))
    c.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    pg=c.new_page();pg.on('pageerror',lambda e:errs.append(name+': '+str(e)))
    pg.on('console',lambda m:m.type=='error' and 'ERR_FAILED' not in m.text and errs.append(name+' console: '+m.text[:200]))
    pg.add_init_script("window.print=()=>{window.__printed=(window.__printed||0)+1};window.open=(u)=>{window.__opened=u;return null}")
    pg.goto(url);pg.wait_for_timeout(900);return c,pg
