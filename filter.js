// Bộ lọc từ cấm (tiếng Việt + tiếng Anh cơ bản): từ thô tục, 18+, chính trị / phản động, bạo lực khủng bố.
// Dùng chung cho máy chủ (server.js) và trang game (được chèn vào index.html). Bạn có thể thêm từ vào các danh sách bên dưới.
// Từ trong danh sách viết KHÔNG DẤU, viết liền, chữ thường.
(function(root){
 // Từ ngắn: chỉ chặn khi đứng riêng thành một từ (tránh chặn nhầm từ bình thường)
 const SHORT=['dm','dmm','dcm','dcmm','dkm','vcl','vkl','clgt','cmm','cmn','dit','xxx','jav','sex','nude','nudes','porn','isis'];
 // Từ dài: chặn khi xuất hiện ở bất kỳ đâu, kể cả khi bị viết cách chữ hay thay số
 const LONG=[
  // thô tục
  'ditme','ditmay','ditcon','dumay','duma','dume','demay','deome','concac','cailon','lonmay','lonqua','vailon','vaicalon','occho','thangcho','conchocon','matdich','oclon','mebay','memay','conmemay',
  // 18+
  'lamtinh','khieudam','hiepdam','dambu','dammai','clipnong','clipsex','lotclip','phimsex','phimnguoilon','hentai','pornhub','xvideos','bucu','liem','thuyda','gaigoi','mandam','chimto','vu to',
  // chính trị / phản động
  'chinhtri','phandong','viettan','bieutinh','congsan','dangcongsan','lattodo','daodang','tongbithu','chuquyen','bieutinhdan','khoinghia',
  // bạo lực cực đoan
  'khungbo','nazi','hitler','giattien','dattbom','datbom'
 ].map(w=>w.replace(/\s+/g,''));
 const sq=s=>s.replace(/(.)\1+/g,'$1');
 const LONGQ=LONG.map(sq),SHORTQ=SHORT.map(sq);
 function plain(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d')}
 function leet(s){return s.replace(/[@4]/g,'a').replace(/3/g,'e').replace(/[1!|]/g,'i').replace(/0/g,'o').replace(/[$5]/g,'s').replace(/7/g,'t')}
 function bad(text){
  const p=plain(text);if(!p.trim())return false;
  const raw=p.split(/[^a-z0-9]+/).filter(Boolean),toks0=[];for(const t of raw){if(t.length===1&&toks0.length&&toks0[toks0.length-1].run){toks0[toks0.length-1].t+=t}else toks0.push({t,run:t.length===1})}const toks=toks0.map(o=>sq(o.t));
  for(const t of toks)if(SHORTQ.includes(t))return true;
  // tiền tố "sex" như sexy, sexual
  if(toks.some(t=>t.length>3&&t.indexOf('sex')===0))return true;
  const col1=sq(p.replace(/[^a-z0-9]/g,'')),col2=sq(leet(p).replace(/[^a-z0-9]/g,''));
  for(const w of LONGQ)if(w.length>=4&&(col1.includes(w)||col2.includes(w)))return true;
  return false}
 function clean(text,max){let s=String(text==null?'':text).replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim();return s.slice(0,max||80)}
 const api={bad,clean};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NETFILTER=api;
})(typeof window!=='undefined'?window:globalThis);
