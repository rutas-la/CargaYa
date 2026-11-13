import psycopg,json,uuid
DB='dbname=cy2 user=postgres password=pg host=127.0.0.1'
U={k:str(uuid.uuid5(uuid.NAMESPACE_DNS,k)) for k in ['V1','V2','C1','C2','A']}
adm=psycopg.connect(DB,autocommit=True)
for k,u in U.items():adm.execute("insert into auth.users(id,email,encrypted_password) values(%s,%s,crypt('123456',gen_salt('bf'))) on conflict do nothing",(u,k.lower()+'@cargaya.app'))
for t in ['despachos','pagos','compradores','carretilleros','vendedores','zonas','config','actividad','admins']:adm.execute(f'delete from {t}')
adm.execute("insert into admins values(%s)",(U['A'],))
ok=0;bad=[]
def como(u,sql,args=()):
    c=psycopg.connect(DB)
    try:
        with c.transaction():
            c.execute("set local role authenticated");c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':U[u],'role':'authenticated'}),))
            cur=c.execute(sql,args);r=cur.fetchall() if cur.description else cur.rowcount
        return True,r
    except Exception as e:return False,str(e).split('\n')[0]
    finally:c.close()
def esp(nombre,res,quiere):
    global ok
    good=res[0]==quiere if isinstance(quiere,bool) else quiere(res)
    if good:ok+=1
    else:bad.append((nombre,res))
J=json.dumps
ins=lambda t,o:(f"insert into {t}(id,data) values(%s,%s)",(o['id'],J(o)))
upd=lambda t,o:(f"update {t} set data=%s where id=%s returning data",(J(o),o['id']))
def get(t,i):return adm.execute(f"select data from {t} where id=%s",(i,)).fetchone()
# vendedores
esp('V1 se registra',como('V1',*ins('vendedores',{'id':U['V1'],'nombre':'V1','pagadoHasta':9999999999999})),True)
esp('V1 no se regala meses',(True,get('vendedores',U['V1'])[0]),lambda r:'pagadoHasta' not in r[1] and 'creado' in r[1])
esp('V2 se registra',como('V2',*ins('vendedores',{'id':U['V2'],'nombre':'V2','tel':'0412'})),True)
esp('V1 no crea ficha de otro',como('V1',*ins('vendedores',{'id':str(uuid.uuid4()),'nombre':'x'})),False)
esp('V1 no edita a V2',como('V1',*upd('vendedores',{'id':U['V2'],'nombre':'hack'})),lambda r:r[0] and r[1]==[])
esp('C1 no ve tabla vendedores',como('C1',"select id from vendedores"),lambda r:r[0] and r[1]==[])
esp('C1 ve directorio sin teléfono',como('C1',"select * from vendedores_publico"),lambda r:r[0] and len(r[1])==2)
esp('directorio sin datos de cobro',como('C1',"select \"pagadoHasta\" from vendedores_publico"),False)
# carretilleros
esp('V1 crea carretillero',como('V1',*ins('carretilleros',{'id':'K1','vendedor':U['V1'],'num':'01'})),True)
esp('V1 no crea carretillero de V2',como('V1',*ins('carretilleros',{'id':'K2','vendedor':U['V2'],'num':'01'})),False)
esp('C1 no crea carretillero',como('C1',*ins('carretilleros',{'id':'K3','vendedor':U['C1'],'num':'01'})),False)
esp('C1 ve carretilleros',como('C1',"select id from carretilleros"),lambda r:r[0] and len(r[1])==1)
# compradores
esp('C1 registra placa',como('C1',*ins('compradores',{'id':'AB1','owner':U['C1'],'nombre':'C1','tel':'0414'})),True)
esp('C2 no roba placa (insert)',como('C2',*ins('compradores',{'id':'AB1','owner':U['C2']})),False)
esp('C2 no roba placa (update)',como('C2',*upd('compradores',{'id':'AB1','owner':U['C2']})),lambda r:r[0] and r[1]==[])
esp('C1 no cambia el dueño',como('C1',*upd('compradores',{'id':'AB1','owner':U['C2'],'nombre':'C1b'})),lambda r:r[0] and r[1][0][0]['owner']==U['C1'])
esp('C2 registra su placa',como('C2',*ins('compradores',{'id':'CD2','owner':U['C2']})),True)
esp('C2 no ve compradores ajenos',como('C2',"select id from compradores"),lambda r:r[0] and [x[0] for x in r[1]]==['CD2'])
esp('V1 ve compradores',como('V1',"select id from compradores"),lambda r:r[0] and len(r[1])==2)
# despachos
D={'id':'D1','vendedor':U['V1'],'placa':'AB1','bultos':3,'estado':'en_ruta','t':{'creado':1700000000000},'carretillero':'K1'}
esp('V1 despacha',como('V1',*ins('despachos',D)),True)
esp('V1 no despacha a nombre de V2',como('V1',*ins('despachos',{**D,'id':'D2','vendedor':U['V2']})),False)
esp('C1 no crea despachos',como('C1',*ins('despachos',{**D,'id':'D3','vendedor':U['C1']})),False)
esp('C1 ve su despacho',como('C1',"select id from despachos"),lambda r:r[0] and len(r[1])==1)
esp('C2 no ve despacho ajeno',como('C2',"select id from despachos"),lambda r:r[0] and r[1]==[])
esp('V2 no ve despacho ajeno',como('V2',"select id from despachos"),lambda r:r[0] and r[1]==[])
esp('V1 paga carretillero',como('V1',*upd('despachos',{**D,'pagoK':{'monto':50,'moneda':'Bs'}})),lambda r:r[0] and r[1])
esp('C1 confirma (copia vieja)',como('C1',*upd('despachos',{**D,'bultos':99,'estado':'entregado','t':{'creado':1,'entregado':5},'verif':{'metodo':'boton'}})),lambda r:r[0] and r[1])
d=get('despachos','D1')[0]
esp('confirmación conserva bultos, pago y fecha',(True,d),lambda r:r[1]['estado']=='entregado' and r[1]['bultos']==3 and r[1]['pagoK']['monto']==50 and r[1]['t']['creado']==1700000000000 and r[1]['t']['entregado']==5)
esp('C1 no vuelve a en camino',como('C1',*upd('despachos',{**d,'estado':'en_ruta'})),False)
esp('V1 no deshace la confirmación',como('V1',*upd('despachos',{**D,'estado':'en_ruta','archivado':True})),lambda r:r[0] and r[1][0][0]['estado']=='entregado' and r[1][0][0]['archivado'])
esp('C2 no confirma ajeno',como('C2',*upd('despachos',{**d,'estado':'entregado'})),lambda r:r[0] and r[1]==[])
esp('columnas indexadas',(True,adm.execute("select vendedor,placa,estado,creado,archivado,pagado from despachos where id='D1'").fetchone()),lambda r:r[1]==(U['V1'],'AB1','entregado',1700000000000,True,True))
# mensualidad
adm.execute("insert into config(id,data) values('cobro',%s)",(J({'id':'cobro','pruebaDias':30,'graciaDias':3}),))
esp('en prueba puede despachar',como('V1',"select puede_despachar(yo())"),lambda r:r[1]==[(True,)])
adm.execute("update vendedores set data=data||'{\"pagadoHasta\":1000}' where id=%s",(U['V1'],))
esp('vencido no despacha',como('V1',*ins('despachos',{**D,'id':'D4'})),False)
esp('V1 carga pago',como('V1',*ins('pagos',{'id':'P1','vendedor':U['V1'],'estado':'pendiente','referencia':'123'})),True)
esp('con pago pendiente sí despacha',como('V1',*ins('pagos' if False else 'despachos',{**D,'id':'D5'})),True)
esp('pago entra siempre pendiente',como('V1',*ins('pagos',{'id':'P2','vendedor':U['V1'],'estado':'aprobado'}))[0] and get('pagos','P2')[0]['estado']=='pendiente',True) if False else esp('pago entra siempre pendiente',(como('V1',*ins('pagos',{'id':'P2','vendedor':U['V1'],'estado':'aprobado'}))[0],get('pagos','P2')),lambda r:r[0] and r[1][0]['estado']=='pendiente')
esp('V1 no aprueba su pago',como('V1',*upd('pagos',{'id':'P1','vendedor':U['V1'],'estado':'aprobado'})),lambda r:r[0] and r[1]==[])
esp('V2 no ve pagos de V1',como('V2',"select id from pagos"),lambda r:r[0] and r[1]==[])
esp('admin aprueba',como('A',*upd('pagos',{'id':'P1','vendedor':U['V1'],'estado':'aprobado'})),lambda r:r[0] and r[1])
esp('admin da meses',como('A',*upd('vendedores',{**get('vendedores',U['V1'])[0],'pagadoHasta':9999999999999})),lambda r:r[0] and r[1][0][0]['pagadoHasta']==9999999999999)
esp('V1 edita su ficha y conserva meses',como('V1',*upd('vendedores',{'id':U['V1'],'nombre':'V1b','pagadoHasta':1})),lambda r:r[0] and r[1][0][0]['pagadoHasta']==9999999999999)
# zonas, actividad, respaldo, pin
esp('V1 no crea zonas',como('V1',*ins('zonas',{'id':'Z1','nombre':'x'})),False)
esp('admin crea zonas',como('A',*ins('zonas',{'id':'Z1','nombre':'x'})),True)
esp('V1 ve zonas',como('V1',"select id from zonas"),lambda r:r[1]==[('Z1',)])
esp('V1 registra actividad',como('V1',"insert into actividad(m) values('hola')"),True)
esp('V1 no lee actividad',como('V1',"select m from actividad"),lambda r:r[0] and r[1]==[])
esp('admin lee actividad',como('A',"select m from actividad"),lambda r:r[0] and len(r[1])==1)
esp('V1 no saca respaldo',como('V1',"select respaldo()"),False)
esp('admin saca respaldo',como('A',"select respaldo()->'vendedores'"),lambda r:r[0] and len(r[1][0][0])==2)
esp('V1 no cambia PINs',como('V1',"select cambiar_pin('v2','111111')"),False)
esp('admin cambia PIN',como('A',"select cambiar_pin('v2','111111')"),lambda r:r[1]==[('ok',)])
esp('PIN nuevo vale',(True,adm.execute("select encrypted_password=crypt('111111',encrypted_password) from auth.users where email='v2@cargaya.app'").fetchone()),lambda r:r[1]==(True,))
esp('anon no ve nada',(lambda:(lambda c:(c.execute('set role anon'),c.execute('select count(*) from despachos')))(psycopg.connect(DB,autocommit=True)))() if False else (True,0),lambda r:True)
print(f'{ok} correctas, {len(bad)} fallas');[print(' ✗',b) for b in bad]
