// Máy chủ chơi mạng "Sân trường online": phục vụ trang game, đồng bộ vị trí, chat, emoji.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{WebSocketServer}=require('ws');
const FILTER=require('./filter.js');
const PORT=process.env.PORT||3000,MAX_ROOM=+process.env.MAX_ROOM||50,TICK=+process.env.TICK_MS||55;
const MAX_CONN=+process.env.MAX_CONN||500,MAX_ROOMS=+process.env.MAX_ROOMS||100,PER_IP_SOCKETS=12;
const ADMIN_KEY=process.env.ADMIN_KEY||'';          // đặt biến này để chủ server được vào nhiều kết nối từ cùng một địa chỉ mạng
const IP_LIMIT=process.env.IP_LIMIT===undefined?1:+process.env.IP_LIMIT; // số người chơi tối đa mỗi địa chỉ mạng (0 = không giới hạn)
const FILE=path.join(__dirname,'public','index.html');
process.on('uncaughtException',e=>console.error('uncaught',e&&e.message));
process.on('unhandledRejection',e=>console.error('unhandled',e&&e.message));

const srv=http.createServer((q,r)=>{
 if(q.url==='/health'){r.writeHead(200);r.end('ok');return}
 if(q.url.startsWith('/whoami')){let k='';try{k=new URL(q.url,'http://x').searchParams.get('key')||''}catch(e){}const ip=ipOf(q);if(!(ADMIN_KEY?safeEq(k,ADMIN_KEY):isLoop(ip))){r.writeHead(403);r.end('forbidden');return}
  const h=q.headers;r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({dang_dung:ip,cf:h['cf-connecting-ip']||null,trueClient:h['true-client-ip']||null,xff:h['x-forwarded-for']||null,socket:q.socket.remoteAddress},null,1));return}
 if(q.url==='/'||q.url.startsWith('/?')){fs.readFile(FILE,(e,b)=>{if(e){r.writeHead(500);r.end('missing public/index.html');return}r.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});r.end(b)});return}
 r.writeHead(404);r.end('not found')});
const wss=new WebSocketServer({server:srv,path:'/ws',maxPayload:1024,verifyClient:(info,cb)=>{
 const o=info.origin,h=info.req.headers.host;
 if(o){try{if(new URL(o).host!==h){cb(false,403,'bad origin');return}}catch(e){cb(false,403,'bad origin');return}}
 cb(true)}});
const rooms=new Map();               // tên phòng -> Map(id -> {ws,p,ip})
const ipSockets=new Map(),ipPlayers=new Map();
let nsock=0,nid=1;
const SKINS=new Set(['jaki','maya','yasu','steve','vali','boxy','isabel','joy','kayli','lena','luke','nelson','tidus','masta','carrot']);
const num=(v,lo,hi)=>{v=+v;return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):0};
// Lấy địa chỉ mạng thật của người chơi khi đứng sau proxy của Render/Cloudflare: ưu tiên header do Cloudflare đặt,
// nếu không có thì lấy địa chỉ đầu tiên trong X-Forwarded-For. Dùng /whoami?key=ADMIN_KEY để kiểm tra server đang thấy gì.
function ipOf(req){const h=req.headers,one=v=>String(v||'').split(',')[0].trim();return one(h['cf-connecting-ip'])||one(h['true-client-ip'])||one(h['x-forwarded-for'])||req.socket.remoteAddress||'?'}
function isLoop(ip){return ip==='127.0.0.1'||ip==='::1'||ip==='::ffff:127.0.0.1'}
function safeEq(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function cleanName(s){let n=FILTER.clean(s,14)||'Khách';if(FILTER.bad(n))n='Khách';return n}
function cleanP(d){const o={};if(typeof d.n==='string')o.n=cleanName(d.n);if(SKINS.has(d.ch))o.ch=d.ch;if(d.f!==undefined)o.f=Math.round(num(d.f,0,20));if(d.x!==undefined)o.x=+num(d.x,0,400).toFixed(2);if(d.y!==undefined)o.y=+num(d.y,0,400).toFixed(2);if(['u','d','l','r'].includes(d.d))o.d=d.d;if(d.m!==undefined)o.m=d.m?1:0;if(typeof d.c==='string'&&/^#[0-9a-fA-F]{6}$/.test(d.c))o.c=d.c;if(typeof d.s==='string')o.s=['h','s','w'].includes(d.s)?d.s:'';if(d.r!==undefined)o.r=d.r?1:0;if(d.l!==undefined)o.l=d.l?1:0;return o}
function send(ws,o){if(ws.readyState===1)ws.send(JSON.stringify(o))}
function bcast(R,o){const m=JSON.stringify(o);for(const c of R.values())if(c.ws.readyState===1)c.ws.send(m)}

wss.on('connection',(ws,req)=>{
 const ip=ipOf(req);
 if(nsock>=MAX_CONN||(ipSockets.get(ip)||0)>=PER_IP_SOCKETS){ws.close(1013,'busy');return}
 nsock++;ipSockets.set(ip,(ipSockets.get(ip)||0)+1);
 const id='p'+(nid++);let room=null,name=null,joined=false,admin=false,hits=0,win=Date.now(),viol=0,chatAt=0,emoAt=0,strikes=0,muteUntil=0;
 ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});
 const joinTimer=setTimeout(()=>{if(!joined)ws.terminate()},10000);
 ws.on('message',buf=>{
  const now=Date.now();if(now-win>1000){win=now;hits=0}
  if(++hits>40){if(++viol>150){ws.terminate()}return}
  let m;try{m=JSON.parse(buf.toString())}catch(e){return}
  if(!m||typeof m!=='object')return;
  if(m.t==='join'&&!joined){
   const nm=String(m.room||'').toLowerCase();if(!/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(nm)){send(ws,{t:'err',code:'invalid_argument'});return}
   admin=!!(ADMIN_KEY?(m.k&&safeEq(m.k,ADMIN_KEY)):isLoop(ip));
   if(IP_LIMIT>0&&!admin&&(ipPlayers.get(ip)||0)>=IP_LIMIT){send(ws,{t:'err',code:'ip_limit'});return}
   let R=rooms.get(nm);if(!R){if(rooms.size>=MAX_ROOMS){send(ws,{t:'err',code:'limit_reached'});return}R=new Map();rooms.set(nm,R)}
   if(R.size>=MAX_ROOM){send(ws,{t:'err',code:'limit_reached'});return}
   joined=true;clearTimeout(joinTimer);if(!admin)ipPlayers.set(ip,(ipPlayers.get(ip)||0)+1);
   room=R;name=nm;R.set(id,{ws,p:{n:'Khách',ch:'jaki',f:0,x:0,y:0,d:'d',m:0}});send(ws,{t:'hi',id,cap:MAX_ROOM});return}
  if(!joined)return;
  const c=room.get(id);if(!c)return;
  if(m.t==='p'&&m.d&&typeof m.d==='object'){Object.assign(c.p,cleanP(m.d))}
  else if(m.t==='c'){ // chat
   if(now<muteUntil){send(ws,{t:'sys',x:'Bạn đang bị tạm cấm chat '+Math.ceil((muteUntil-now)/1000)+' giây.'});return}
   if(now-chatAt<1200){send(ws,{t:'sys',x:'Bạn chat nhanh quá, đợi một chút.'});return}
   const x=FILTER.clean(m.x,80);if(!x)return;chatAt=now;
   if(FILTER.bad(x)){strikes++;if(strikes>=3){muteUntil=now+60000;strikes=0;send(ws,{t:'sys',x:'Bạn dùng từ không phù hợp nhiều lần nên bị cấm chat 60 giây.'})}else send(ws,{t:'sys',x:'Tin nhắn chứa từ không phù hợp nên không được gửi.'});return}
   bcast(room,{t:'m',id,x})}
  else if(m.t==='e'){ // emoji
   if(now-emoAt<900)return;const k=Math.round(num(m.x,0,11));emoAt=now;bcast(room,{t:'o',id,x:k})}
 });
 ws.on('close',()=>{clearTimeout(joinTimer);nsock--;const n=(ipSockets.get(ip)||1)-1;if(n>0)ipSockets.set(ip,n);else ipSockets.delete(ip);
  if(joined){if(!admin){const k=(ipPlayers.get(ip)||1)-1;if(k>0)ipPlayers.set(ip,k);else ipPlayers.delete(ip)}if(room){room.delete(id);if(!room.size&&rooms.get(name)===room)rooms.delete(name)}}});
 ws.on('error',()=>{});
});
setInterval(()=>{for(const [nm,R] of rooms){const arr=[];for(const [id,c] of R)arr.push([id,c.p.n,c.p.ch,c.p.f,c.p.x,c.p.y,c.p.d,c.p.m,c.p.c||'',c.p.s||'',c.p.r||0,c.p.l||0]);const msg=JSON.stringify({t:'s',ts:Date.now(),a:arr});for(const c of R.values())if(c.ws.readyState===1)c.ws.send(msg)}},TICK);
setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;try{ws.ping()}catch(e){}}},25000);
srv.listen(PORT,()=>console.log('Sân trường online chạy ở cổng '+PORT+(ADMIN_KEY?' (có ADMIN_KEY)':' (không có ADMIN_KEY: chỉ localhost được miễn giới hạn)')));
