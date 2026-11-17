from aiohttp import web
import json
LOG=[]
async def ver(req):
    d=await req.post();LOG.append(('enviar',d['To'],d.get('Channel')))
    if d['To'].endswith('9999'): return web.json_response({'code':60200,'message':'Invalid parameter'},status=400)
    return web.json_response({'status':'pending','to':d['To']},status=201)
async def chk(req):
    d=await req.post();LOG.append(('check',d['To'],d['Code']))
    return web.json_response({'status':'approved' if d['Code']=='424242' else 'pending'})
async def log(req): return web.json_response(LOG)
app=web.Application();app.router.add_post('/v2/Services/VA1/Verifications',ver);app.router.add_post('/v2/Services/VA1/VerificationCheck',chk);app.router.add_get('/log',log)
web.run_app(app,port=8791,print=None)
