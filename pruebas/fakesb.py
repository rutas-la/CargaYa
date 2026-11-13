"""Supabase de prueba local: auth (GoTrue mínimo), REST (PostgREST real),
storage (archivos en disco) y realtime (protocolo Phoenix con filtros y RLS reales).
Uso: python3 fakesb.py <carpeta_estatica> [puerto]"""
import asyncio, json, os, sys, time, uuid, base64, hmac, hashlib
from aiohttp import web, ClientSession, WSMsgType
import psycopg

ROOT = sys.argv[1]; PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8780
SECRET = b"super-secret-jwt-token-with-at-least-32-characters-long"
DB = "dbname=cy2 user=postgres password=pg host=127.0.0.1"
PGRST = "http://127.0.0.1:3001"
STORE = "/tmp/fakesb-storage"; os.makedirs(STORE, exist_ok=True)
STATS = {"rest": 0, "rest_bytes": 0, "rt_msgs": 0, "rt_conns": 0, "rt_peak": 0}

def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def jwt(claims):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()); p = b64(json.dumps(claims).encode())
    s = b64(hmac.new(SECRET, f"{h}.{p}".encode(), hashlib.sha256).digest()); return f"{h}.{p}.{s}"
def unjwt(tok):
    try:
        h, p, s = tok.split(".")
        if b64(hmac.new(SECRET, f"{h}.{p}".encode(), hashlib.sha256).digest()) != s: return None
        return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
    except Exception: return None

def cors(resp):
    resp.headers.update({"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*",
                         "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "*"}); return resp

def db():
    return psycopg.connect(DB, autocommit=True)

def user_json(r):
    uid, email, meta, created = r
    return {"id": str(uid), "aud": "authenticated", "role": "authenticated", "email": email, "user_metadata": meta or {},
            "app_metadata": {"provider": "email"}, "created_at": created.isoformat(), "email_confirmed_at": created.isoformat()}

def session(r):
    u = user_json(r); now = int(time.time())
    tok = jwt({"sub": u["id"], "role": "authenticated", "aud": "authenticated", "email": u["email"], "exp": now + 3600, "iat": now})
    return {"access_token": tok, "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
            "refresh_token": "r-" + u["id"], "user": u}

async def opts(req): return cors(web.Response())

async def signup(req):
    b = await req.json()
    with db() as c:
        if c.execute("select 1 from auth.users where email=%s", (b["email"],)).fetchone():
            return cors(web.json_response({"code": 422, "error_code": "user_already_exists", "msg": "User already registered"}, status=422))
        r = c.execute("insert into auth.users(email,encrypted_password,raw_user_meta_data) values(%s,crypt(%s,gen_salt('bf')),%s) returning id,email,raw_user_meta_data,created_at",
                      (b["email"], b["password"], json.dumps(b.get("data") or {}))).fetchone()
    return cors(web.json_response(session(r)))

async def token(req):
    b = await req.json(); gt = req.query.get("grant_type")
    with db() as c:
        if gt == "refresh_token":
            r = c.execute("select id,email,raw_user_meta_data,created_at from auth.users where id::text=%s", (b["refresh_token"][2:],)).fetchone()
        else:
            r = c.execute("select id,email,raw_user_meta_data,created_at from auth.users where email=%s and encrypted_password=crypt(%s,encrypted_password)",
                          (b.get("email"), b.get("password"))).fetchone()
    if not r: return cors(web.json_response({"code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials"}, status=400))
    return cors(web.json_response(session(r)))

def claims_of(req):
    a = req.headers.get("Authorization", "")
    return unjwt(a[7:]) if a.startswith("Bearer ") else None

async def getuser(req):
    cl = claims_of(req)
    if not cl: return cors(web.json_response({"msg": "invalid JWT"}, status=401))
    with db() as c:
        r = c.execute("select id,email,raw_user_meta_data,created_at from auth.users where id::text=%s", (cl["sub"],)).fetchone()
    return cors(web.json_response(user_json(r)))

async def logout(req): return cors(web.Response(status=204))

async def rest(req):
    STATS["rest"] += 1
    path = req.match_info["tail"]; body = await req.read()
    h = {k: v for k, v in req.headers.items() if k.lower() in ("accept", "content-type", "prefer", "range", "range-unit", "accept-profile", "content-profile")}
    if claims_of(req): h["Authorization"] = req.headers["Authorization"]
    async with ClientSession() as s:
        async with s.request(req.method, f"{PGRST}/{path}", params=req.query, data=body or None, headers=h) as r:
            data = await r.read(); STATS["rest_bytes"] += len(data)
            resp = web.Response(body=data, status=r.status)
            for k in ("Content-Type", "Content-Range", "Preference-Applied"):
                if k in r.headers: resp.headers[k] = r.headers[k]
            return cors(resp)

async def storage_upload(req):
    bucket, path = req.match_info["bucket"], req.match_info["path"]
    cl = claims_of(req)
    if not cl: return cors(web.json_response({"error": "Unauthorized", "message": "no session", "statusCode": "401"}, status=400))
    if path.split("/")[0] != cl["sub"]:
        return cors(web.json_response({"error": "Unauthorized", "message": "new row violates row-level security policy", "statusCode": "403"}, status=400))
    data = await req.read()
    if req.content_type.startswith("multipart/"):
        reader = await req.multipart() if False else None
    fp = os.path.join(STORE, bucket, path); os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, "wb").write(data)
    return cors(web.json_response({"Key": f"{bucket}/{path}", "Id": str(uuid.uuid4()), "path": path, "id": str(uuid.uuid4()), "fullPath": f"{bucket}/{path}"}))

async def storage_public(req):
    fp = os.path.join(STORE, req.match_info["bucket"], req.match_info["path"])
    if req.match_info["bucket"] != "fotos" or not os.path.exists(fp): return cors(web.Response(status=404))
    return cors(web.FileResponse(fp, headers={"Content-Type": "image/jpeg"}))

async def storage_sign(req):
    bucket, path = req.match_info["bucket"], req.match_info["path"]; cl = claims_of(req)
    if not cl: return cors(web.json_response({"message": "no"}, status=400))
    with db() as c:
        adm = c.execute("select exists(select 1 from admins where uid::text=%s)", (cl["sub"],)).fetchone()[0]
    if not adm and path.split("/")[0] != cl["sub"]: return cors(web.json_response({"message": "Object not found"}, status=400))
    tok = b64(os.urandom(12)); SIGNED[tok] = (bucket, path)
    return cors(web.json_response({"signedURL": f"/object/sign/{bucket}/{path}?token={tok}"}))
SIGNED = {}
async def storage_signed_get(req):
    t = SIGNED.get(req.query.get("token"))
    if not t: return cors(web.Response(status=400))
    return cors(web.FileResponse(os.path.join(STORE, *t), headers={"Content-Type": "image/jpeg"}))

# ---------------- Realtime (Phoenix) ----------------
SOCKS = set()
class Sock:
    def __init__(s, ws, vsn): s.ws, s.vsn, s.subs, s.claims = ws, vsn, [], None
    async def send(s, topic, event, payload, ref=None, join_ref=None):
        if s.vsn == "2": msg = json.dumps([join_ref, ref, topic, event, payload], default=str)
        else: msg = json.dumps({"topic": topic, "event": event, "payload": payload, "ref": ref, "join_ref": join_ref}, default=str)
        try: await s.ws.send_str(msg)
        except Exception: pass

def match_filter(f, rec):
    if not f: return True
    col, rest = f.split("=", 1); op, val = rest.split(".", 1); v = rec.get(col)
    v = None if v is None else str(v).lower() if isinstance(v, bool) else str(v)
    if op == "eq": return v == val
    if op == "in": return v in [x.strip().strip('"') for x in val.strip("()").split(",")]
    return False

async def realtime(req):
    ws = web.WebSocketResponse(); await ws.prepare(req)
    s = Sock(ws, "2" if req.query.get("vsn", "1.0.0").startswith("2") else "1"); SOCKS.add(s)
    STATS["rt_conns"] = len(SOCKS); STATS["rt_peak"] = max(STATS["rt_peak"], len(SOCKS))
    try:
        async for m in ws:
            if m.type != WSMsgType.TEXT: continue
            d = json.loads(m.data)
            if isinstance(d, list): join_ref, ref, topic, event, payload = d
            else: join_ref, ref, topic, event, payload = d.get("join_ref"), d.get("ref"), d["topic"], d["event"], d.get("payload")
            if event == "phx_join":
                cl = unjwt(payload.get("access_token") or "") or {}
                s.claims = cl if cl.get("sub") else s.claims
                pcs = (payload.get("config") or {}).get("postgres_changes") or []
                resp = []
                for pc in pcs:
                    i = len(s.subs) + 1000
                    s.subs.append({"id": i, "topic": topic, "join_ref": join_ref, **pc}); resp.append({"id": i, **pc})
                await s.send(topic, "phx_reply", {"status": "ok", "response": {"postgres_changes": resp}}, ref, join_ref)
                await s.send(topic, "system", {"status": "ok", "message": "Subscribed to PostgreSQL", "extension": "postgres_changes", "channel": topic.split(":",1)[-1]}, None, join_ref)
            elif event == "access_token":
                cl = unjwt(payload.get("access_token") or "") or {}
                if cl.get("sub"): s.claims = cl
                await s.send(topic, "phx_reply", {"status": "ok", "response": {}}, ref, join_ref)
            elif event == "phx_leave":
                s.subs = [x for x in s.subs if x["topic"] != topic]
                await s.send(topic, "phx_reply", {"status": "ok", "response": {}}, ref, join_ref)
            else:
                await s.send(topic, "phx_reply", {"status": "ok", "response": {}}, ref, join_ref)
    finally:
        SOCKS.discard(s); STATS["rt_conns"] = len(SOCKS)
    return ws

def puede_ver(uid, table, pk):
    if table == "actividad": col = "id"
    else: col = "id"
    with db() as c:
        with c.transaction():
            c.execute("set local role authenticated")
            c.execute("select set_config('request.jwt.claims',%s,true)", (json.dumps({"sub": uid, "role": "authenticated"}),))
            return c.execute(f"select 1 from {table} where {col}=%s", (pk,)).fetchone() is not None

async def escuchar():
    while True:
        try: await escuchar1()
        except Exception as e: print('escuchar', repr(e), flush=True); await asyncio.sleep(0.5)
async def escuchar1():
    ac = await psycopg.AsyncConnection.connect(DB, autocommit=True)
    await ac.execute("LISTEN cy_changes")
    async for n in ac.notifies():
        ev = json.loads(n.payload); table, typ = ev["table"], ev["type"]
        def fila():
            with db() as c:
                cur = c.execute(f"select * from {table} where id=%s", (ev["id"],)); cols = [d.name for d in cur.description]; row = cur.fetchone()
                return {k: (v.isoformat() if hasattr(v, "isoformat") else str(v) if isinstance(v, uuid.UUID) else v) for k, v in zip(cols, row)} if row else None
        rec = await asyncio.to_thread(fila)
        if not rec: continue
        for s in list(SOCKS):
            for sub in s.subs:
                if sub.get("table") != table or sub.get("event") not in ("*", typ): continue
                if not match_filter(sub.get("filter"), rec): continue
                uid = (s.claims or {}).get("sub")
                if not uid or not await asyncio.to_thread(puede_ver, uid, table, rec["id"]): continue
                STATS["rt_msgs"] += 1
                await s.send(sub["topic"], "postgres_changes", {"ids": [sub["id"]], "data": {
                    "type": typ, "schema": "public", "table": table, "commit_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "record": rec, "old_record": {}, "columns": [{"name": k, "type": "jsonb" if k == "data" else "text"} for k in rec], "errors": None}}, None, sub["join_ref"])

async def stats(req): return cors(web.json_response({**STATS,'subs':[{'sub':(x.claims or {}).get('sub'),'vsn':x.vsn,'subs':[(y.get('table'),y.get('filter'),y.get('event')) for y in x.subs]} for x in SOCKS]}))
async def reset_stats(req):
    for k in STATS: STATS[k] = len(SOCKS) if k in ("rt_conns", "rt_peak") else 0
    return cors(web.json_response(STATS))

async def start(app): app["l"] = asyncio.create_task(escuchar())

app = web.Application(client_max_size=20 * 1024 * 1024)
app.on_startup.append(start)
r = app.router
r.add_route("OPTIONS", "/{tail:.*}", opts)
r.add_post("/auth/v1/signup", signup); r.add_post("/auth/v1/token", token)
r.add_get("/auth/v1/user", getuser); r.add_post("/auth/v1/logout", logout)
r.add_route("*", "/rest/v1/{tail:.*}", rest)
r.add_get("/storage/v1/object/public/{bucket}/{path:.*}", storage_public)
r.add_post("/storage/v1/object/sign/{bucket}/{path:.*}", storage_sign)
r.add_get("/storage/v1/object/sign/{bucket}/{path:.*}", storage_signed_get)
r.add_post("/storage/v1/object/{bucket}/{path:.*}", storage_upload)
r.add_get("/realtime/v1/websocket", realtime)
r.add_get("/__stats", stats); r.add_post("/__stats/reset", reset_stats)
r.add_static("/", ROOT, show_index=True)
web.run_app(app, port=PORT, print=None)
