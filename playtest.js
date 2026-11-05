// Chơi thử riêng tư: trang game chỉ được giao khi link (token) hợp lệ và đúng thiết bị đã gắn.
// - Trang game nằm trong data/pt.bin, đã nén brotli + mã hóa AES-256-GCM (kho này công khai nên không để HTML thô).
//   Khóa giải mã suy ra từ biến môi trường PT_SECRET (đặt trên Render). Không có PT_SECRET thì chức năng tắt.
// - Link: /p/<id>.<hạn>.<chữ ký>. Chữ ký HMAC bằng PT_SECRET nên không ai tự làm giả được link.
// - Lần đầu mở link: gắn với thiết bị (cookie) + IP của người mở. Sau đó chỉ vào được nếu có cookie đó
//   (đổi 4G/wifi vẫn vào được), hoặc không có cookie nhưng đúng IP đã gắn (xóa cookie/tab ẩn danh cùng mạng).
// - Thu hồi: ghi id vào data/pt-revoked.json (đẩy lên kho) hoặc POST /pt-admin/revoke (có hiệu lực ngay, mất khi server khởi động lại).
const crypto=require('crypto'),fs=require('fs'),path=require('path'),zlib=require('zlib'),os=require('os');
const SECRET=process.env.PT_SECRET||'',ADMIN=process.env.ADMIN_KEY||'';
const BIN=path.join(__dirname,'data','pt.bin'),REVF=path.join(__dirname,'data','pt-revoked.json'),STF=path.join(os.tmpdir(),'pt-state.json');
let ipOf=r=>r.socket.remoteAddress||'?';
const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const hm=s=>b64u(crypto.createHmac('sha256',SECRET).update(s).digest()).slice(0,22);
const eq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
let BR=null,RAW=null;
function load(){if(!SECRET)return;try{const b=fs.readFileSync(BIN),k=crypto.scryptSync(SECRET,'san-truong-pt-v1',32),d=crypto.createDecipheriv('aes-256-gcm',k,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));BR=Buffer.concat([d.update(b.subarray(28)),d.final()]);RAW=null}catch(e){BR=null;console.error('playtest: không giải mã được data/pt.bin (sai PT_SECRET hoặc thiếu file)')}}
const revoked=new Set((process.env.PT_REVOKED||'').split(',').map(s=>s.trim()).filter(Boolean));
try{for(const x of JSON.parse(fs.readFileSync(REVF,'utf8')))revoked.add(String(x))}catch(e){}
const state=new Map();try{for(const [k,v] of Object.entries(JSON.parse(fs.readFileSync(STF,'utf8'))))state.set(k,v)}catch(e){}
let saveT=null;const save=()=>{clearTimeout(saveT);saveT=setTimeout(()=>{try{fs.writeFileSync(STF,JSON.stringify(Object.fromEntries(state)))}catch(e){}},500)};
function mint(days){const id=crypto.randomBytes(5).toString('hex'),exp=Math.floor(Date.now()/1000+days*86400).toString(36);return {id,token:id+'.'+exp+'.'+hm('t|'+id+'|'+exp)}}
function check(tok){const m=/^([0-9a-f]{10})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{22})$/.exec(tok||'');if(!m)return null;if(!eq(m[3],hm('t|'+m[1]+'|'+m[2])))return null;return {id:m[1],exp:parseInt(m[2],36)}}
function cookies(req){const o={};for(const p of String(req.headers.cookie||'').split(';')){const i=p.indexOf('=');if(i>0)o[p.slice(0,i).trim()]=p.slice(i+1).trim()}return o}
function devOf(req,id){const v=cookies(req)['ptd_'+id];if(!v)return null;const [d,s]=v.split('.');return d&&s&&eq(s,hm('d|'+id+'|'+d))?d:null}
const fails=new Map();
function page(res,code,title,msg,extra){res.writeHead(code,Object.assign({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'},extra||{}));res.end('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>'+title+'</title><body style="font:16px system-ui;background:#1b1a24;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center"><div><h2>'+title+'</h2><p>'+msg+'</p></div>')}
function deny(req,res,ip,code,title,msg){const f=fails.get(ip)||{n:0,t:Date.now()};if(Date.now()-f.t>600000){f.n=0;f.t=Date.now()}f.n++;fails.set(ip,f);page(res,code,title,msg)}
function serve(req,res,setCookie){
 if(!BR){page(res,503,'Chưa sẵn sàng','Máy chủ chưa có dữ liệu chơi thử.');return}
 const H={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Vary':'Accept-Encoding'};
 if(setCookie)H['Set-Cookie']=setCookie;
 let body=BR;if(/\bbr\b/.test(String(req.headers['accept-encoding']||'')))H['Content-Encoding']='br';else{if(!RAW)RAW=zlib.brotliDecompressSync(BR);body=RAW}
 H['Content-Length']=body.length;res.writeHead(200,H);res.end(req.method==='HEAD'?undefined:body)}
function admin(req,res,url){
 if(!ADMIN||!SECRET||!eq(req.headers['x-admin-key']||'',ADMIN)){res.writeHead(403);res.end('forbidden');return}
 const J=(c,o)=>{res.writeHead(c,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
 const act=url.pathname.slice('/pt-admin/'.length),q=url.searchParams;
 if(act==='list')return J(200,{revoked:[...revoked],tokens:[...state].map(([id,v])=>({id,ip:v.ip,lan_dau:new Date(v.t0).toISOString(),gan_nhat:new Date(v.last).toISOString(),so_lan:v.n}))});
 if(req.method!=='POST')return J(405,{loi:'dùng POST'});
 if(act==='revoke'){const id=q.get('id')||'';if(!/^[0-9a-f]{10}$/.test(id))return J(400,{loi:'id sai'});revoked.add(id);return J(200,{ok:1,revoked:id})}
 if(act==='reset'){const id=q.get('id')||'';state.delete(id);save();return J(200,{ok:1,reset:id})}
 if(act==='new'){const m=mint(Math.max(.1,Math.min(60,+q.get('days')||7)));const host=req.headers['x-forwarded-host']||req.headers.host;return J(200,{id:m.id,link:'https://'+host+'/p/'+m.token})}
 J(404,{loi:'không có'})}
function handle(req,res){
 let url;try{url=new URL(req.url,'http://x')}catch(e){return false}
 if(url.pathname.startsWith('/pt-admin/')){admin(req,res,url);return true}
 if(!url.pathname.startsWith('/p/'))return false;
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return true}
 const ip=ipOf(req),f=fails.get(ip);
 if(f&&Date.now()-f.t<600000&&f.n>=15){page(res,429,'Thử quá nhiều lần','Đợi 10 phút rồi thử lại.');return true}
 if(!SECRET){page(res,503,'Chưa sẵn sàng','Máy chủ chưa bật chơi thử.');return true}
 const t=check(decodeURIComponent(url.pathname.slice(3)));
 if(!t){deny(req,res,ip,404,'Link không hợp lệ','Link sai hoặc đã bị sửa.');return true}
 if(revoked.has(t.id)){page(res,403,'Link đã bị thu hồi','Liên hệ người gửi link để được cấp link mới.');return true}
 if(Date.now()/1000>t.exp){page(res,403,'Link đã hết hạn','Liên hệ người gửi link để được cấp link mới.');return true}
 const dev=devOf(req,t.id),st=state.get(t.id),https=String(req.headers['x-forwarded-proto']||'')==='https';
 const ck=d=>'ptd_'+t.id+'='+d+'.'+hm('d|'+t.id+'|'+d)+'; Path=/p/; Max-Age=2592000; HttpOnly; SameSite=Lax'+(https?'; Secure':'');
 if(!st){const d=dev||crypto.randomBytes(9).toString('hex'),now=Date.now();state.set(t.id,{dev:d,ip,t0:now,last:now,n:1});save();serve(req,res,dev?null:ck(d));return true}
 if(dev&&dev===st.dev){st.ip=ip;st.last=Date.now();st.n++;save();serve(req,res,null);return true}
 if(!dev&&st.ip===ip){st.last=Date.now();st.n++;save();serve(req,res,ck(st.dev));return true}
 deny(req,res,ip,403,'Link này đã được dùng ở thiết bị khác','Mỗi link chỉ chơi được trên một thiết bị. Liên hệ người gửi nếu bạn là người được mời.');return true}
function init(opts){if(opts&&opts.ipOf)ipOf=opts.ipOf;load();
 if(process.env.RENDER_EXTERNAL_URL&&SECRET)setInterval(()=>{try{fetch(process.env.RENDER_EXTERNAL_URL+'/health').catch(()=>{})}catch(e){}},10*60*1000).unref()}
module.exports={init,handle,mint,check};
