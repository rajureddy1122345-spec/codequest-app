// Logic Legends Club - Code Quest: secure game server (no dependencies, Node 18+)
// Lives, timers, hints, scores and medals are all decided HERE, so students cannot cheat from the app.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const QS=require('./questions.json'),TIME=30,HOUR=36e5,PORT=process.env.PORT||3000;
const DB=path.join(__dirname,'data','db.json');fs.mkdirSync(path.dirname(DB),{recursive:true});
let db={users:{},sessions:{}},dirty=false;try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch(e){}
const save=()=>{dirty=true},flush=()=>{if(!dirty)return;dirty=false;fs.writeFileSync(DB+'.tmp',JSON.stringify(db));fs.renameSync(DB+'.tmp',DB)};
setInterval(flush,1000);process.on('SIGINT',()=>{flush();process.exit()});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),hashPw=(p,s)=>crypto.scryptSync(p,s,64).toString('hex');
const hits={};function limited(ip){const m=Math.floor(Date.now()/6e4),h=hits[ip]=(hits[ip]&&hits[ip].m==m)?hits[ip]:{m,c:0};return ++h.c>10}
const refill=s=>{if(s.lives<=0&&Date.now()>=s.until)s.lives=5};
const cur=s=>{let n=1;while((s.stars[n]||0)>=2)n++;return n};
function route(act,b,u,ip){
 if(act=='register'||act=='login'){
  if(limited(ip))return[429,{error:'Too many attempts. Wait a minute.'}];
  const email=String(b.email||'').trim().toLowerCase(),pw=String(b.password||'');
  if(!/^[^@\s]{1,64}@[^@\s]{1,255}$/.test(email))return[400,{error:'Enter a valid email'}];
  let usr=db.users[email];
  if(act=='register'){
   if(pw.length<8||pw.length>100)return[400,{error:'Password must be 8 to 100 characters'}];
   if(usr)return[409,{error:'This email is already registered'}];
   const salt=crypto.randomBytes(16).toString('hex');
   usr=db.users[email]={name:String(b.name||'Legend').replace(/[<>]/g,'').slice(0,30)||'Legend',salt,hash:hashPw(pw,salt),state:{lives:5,until:0,stars:{},tries:{},xp:0,att:null}};
  }else{
   const ok=usr&&crypto.timingSafeEqual(Buffer.from(hashPw(pw,usr.salt)),Buffer.from(usr.hash));
   if(!ok)return[401,{error:'Wrong email or password'}];
  }
  const token=crypto.randomBytes(32).toString('hex');db.sessions[sha(token)]={email,exp:Date.now()+7*864e5};save();
  return[200,{ok:true,token}];
 }
 if(!u)return[401,{error:'Please log in'}];
 const st=u.state;refill(st);
 if(act=='state')return[200,{ok:true,name:u.name,lives:st.lives,until:st.until,stars:st.stars,tries:st.tries,xp:st.xp}];
 if(act=='start'){
  const n=+b.level;if(!Number.isInteger(n)||n!=cur(st)||n>QS.length)return[400,{error:'This level is not open'}];
  if(st.lives<=0)return[403,{error:'No lives left. Wait for the cooldown.'}];
  if(st.att)st.tries[st.att.n]=(st.tries[st.att.n]||0)+1; // leaving a level mid-play counts as a retry
  st.att={n,t0:Date.now(),hints:0};save();const q=QS[n-1];
  return[200,{ok:true,time:TIME,tries:st.tries[n]||0,q:q.q,code:q.code,options:q.o}];
 }
 if(act=='hint'){
  const a=st.att;if(!a||a.hints>=2)return[400,{error:'No hint available'}];
  const h=QS[a.n-1].h[a.hints++];save();return[200,{ok:true,hint:h,used:a.hints}];
 }
 if(act=='answer'){
  const a=st.att;if(!a)return[400,{error:'No active level'}];st.att=null;
  const n=a.n,q=QS[n-1],el=Date.now()-a.t0,c=Number(b.choice),f=st.tries[n]||0;
  const result=(c===-1||el>(TIME+3)*1e3)?'time':(c===q.a?'ok':'bad');
  const out={ok:true,result,answer:q.a,explanation:q.ex};
  if(result=='ok'){
   const bronze=a.hints||f;out.stars=bronze?2:3;
   out.score=Math.max(10,100-a.hints*20-f*15)+(bronze?0:Math.max(0,TIME-Math.ceil(el/1e3)));
   out.why=a.hints&&f?'hints and retries':a.hints?'hints used':'passed after a retry';
   st.stars[n]=out.stars;st.xp+=out.score;
  }else{
   st.tries[n]=f+1;
   if(result=='time')st.stars[n]=Math.max(st.stars[n]||0,1);
   else{st.lives--;if(st.lives<=0)st.until=Date.now()+HOUR}
  }
  save();out.lives=st.lives;out.until=st.until;return[200,out];
 }
 return[404,{error:'Not found'}];
}
http.createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 const url=req.url.split('?')[0],send=(c,o)=>{res.writeHead(c,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
 if(!url.startsWith('/api/')){
  if(req.method=='GET'&&(url=='/'||url=='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'public','index.html')))}
  res.writeHead(404);return res.end('Not found');
 }
 let raw='';req.on('data',d=>{raw+=d;if(raw.length>1e4)req.destroy()});
 req.on('end',()=>{
  let b={};try{b=raw?JSON.parse(raw):{}}catch(e){return send(400,{error:'Bad request'})}
  const tk=(req.headers.authorization||'').replace('Bearer ',''),s=tk&&db.sessions[sha(tk)];
  const u=s&&s.exp>Date.now()?db.users[s.email]:null;
  try{const[c,o]=route(url.slice(5),b,u,req.socket.remoteAddress);send(c,o)}catch(e){send(500,{error:'Server error'})}
 });
}).listen(PORT,'0.0.0.0',()=>console.log('Logic Legends Code Quest running on http://localhost:'+PORT));
