// Dùng: PT_SECRET=... node tools/pt-token.js [số-ngày=7] [số-link=1]   -> in ra "id  /p/token"
const pt=require('../playtest.js');const d=+process.argv[2]||7,n=+process.argv[3]||1;
for(let i=0;i<n;i++){const m=pt.mint(d);console.log(m.id+'  /p/'+m.token)}
