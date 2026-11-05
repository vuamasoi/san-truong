// Dùng: PT_SECRET=... node tools/pt-pack.js duong-dan/play.html   -> ghi data/pt.bin (brotli + AES-256-GCM)
const fs=require('fs'),zlib=require('zlib'),crypto=require('crypto'),path=require('path');
const S=process.env.PT_SECRET;if(!S||!process.argv[2]){console.error('thiếu PT_SECRET hoặc đường dẫn html');process.exit(1)}
const br=zlib.brotliCompressSync(fs.readFileSync(process.argv[2]),{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11,[zlib.constants.BROTLI_PARAM_SIZE_HINT]:fs.statSync(process.argv[2]).size}});
const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.scryptSync(S,'san-truong-pt-v1',32),iv),ct=Buffer.concat([c.update(br),c.final()]);
fs.mkdirSync(path.join(__dirname,'..','data'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'..','data','pt.bin'),Buffer.concat([iv,c.getAuthTag(),ct]));console.log('ok',br.length,'byte nén')
