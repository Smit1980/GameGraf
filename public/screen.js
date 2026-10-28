(()=>{
'use strict';
const colors=['#68A6FF','#FFB570','#78D9E6','#F0B0EB','#A0C4FF','#F3D775','#96E1AD','#FF96A1','#D6B8FF','#F5C6A3','#BBD889','#D6D7E9'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296};
const imageCache=new Map();function asset(file){if(!imageCache.has(file)){let img=new Image();img.src='/assets/'+file;imageCache.set(file,img)}return imageCache.get(file)}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let fontsReady=!document.fonts;if(document.fonts)Promise.all([document.fonts.load('700 32px ScreenUnbounded'),document.fonts.load('600 26px ScreenInter'),document.fonts.load('700 54px ScreenMono')]).then(()=>{fontsReady=true},()=>{fontsReady=true});
let state=null,root=null,canvas=null,ctx=null,frame=0,phase='',phaseAt=0,seen=new Map(),replay=null,layoutKey='',layoutCache=null,knowledgeCache=null,knowledgeKey="",currentPlayers=[],currentLinks=[],lastScheduledAt=0,lastFrame=0,frameSum=0,frameCount=0,particlesEnabled=true;
function demoPlayers(s,count){return Array.from({length:count},(_,i)=>{let n=s.interests.length,a=i%n,b=(a+1+Math.floor(hash('b'+i)*(n-1)))%n,c=(b+1+Math.floor(hash('c'+i)*(n-2)))%n;if(c===a)c=(c+1)%n;return{id:'demo-'+i,nick:'Участник '+(i+1),interests:[s.interests[a],s.interests[b],s.interests[c]],teamId:s.teams?.[i%(s.teams.length||1)]?.id||null}})}
function bridgeList(players,interests){let counts=new Map();for(const p of players){let x=[...new Set((p.interests||[]).filter(z=>interests.includes(z)))];for(let i=0;i<x.length;i++)for(let j=i+1;j<x.length;j++){let k=[x[i],x[j]].sort().join('\u0000');counts.set(k,(counts.get(k)||0)+1)}}return [...counts].map(([k,count])=>{let [source,target]=k.split('\u0000');return{source,target,count}}).sort((a,b)=>b.count-a.count)}
function schedule(players,reset){
 const now=performance.now(),initial=seen.size===0&&!reset;
 if(reset){seen.clear();lastScheduledAt=now-250}
 for(const p of players)if(!seen.has(p.id)){if(initial||reduced){seen.set(p.id,now-4000);continue}lastScheduledAt=Math.max(now,lastScheduledAt+250);seen.set(p.id,lastScheduledAt)}
 const ids=new Set(players.map(p=>p.id));for(const id of seen.keys())if(!ids.has(id))seen.delete(id);
}
function title(p){return p==='LOBBY'?'Подключайтесь — строим граф зала':p==='TEAMS_FORM'?'Собираем команды':p?.startsWith('ROUND')?'Находим связи в графе знаний':p==='FINAL'?'Финал игры':'Знакомьтесь друг с другом'}
function init(){root.innerHTML=`<main class="constellation"><header class="constellation__head"><div><div class="constellation__kicker"><img src="/assets/brand/logo.webp" alt=""> ПАУТИНА ЗАЛА</div><h1 id="constellation-title"></h1></div><div class="constellation__status" id="constellation-status"></div></header><div class="constellation__body"><section class="constellation__stage"><canvas class="constellation__canvas"></canvas><div class="team-overlay"></div><div class="final-podium"></div><div class="round-info"></div><div class="constellation__legend"></div><div class="arrival-toast" aria-live="polite"></div><div class="bridge-summary"></div></section><aside class="constellation__side"><div class="constellation-card"><div class="constellation-card__label">УЧАСТНИКОВ В СЕТИ</div><div class="constellation-card__number"></div><div class="constellation-card__hint">создают общее созвездие</div></div><div class="constellation-card constellation-card--join"><div class="constellation-card__label">ПРИСОЕДИНЯЙТЕСЬ</div><div class="constellation-qr-holder"></div><div class="constellation-url"></div></div><div class="mascot-panel"><img id="screen-mascot" src="/assets/mascot/mascot-point-512.webp" alt=""><p id="mascot-phrase"></p></div></aside></div></main>`;canvas=root.querySelector('canvas');ctx=canvas.getContext('2d');frame=requestAnimationFrame(draw)}
function sync(s){state=s;let d=new URLSearchParams(location.search).get('demo');let demo=d!==null;let n=Math.max(100,Math.min(300,Number(d)||200));currentPlayers=demo?(s.demo?.players||demoPlayers(s,n)):(s.players||[]);currentLinks=demo?(s.demo?.interestLinks||bridgeList(currentPlayers,s.interests||[])):(s.interestLinks||bridgeList(currentPlayers,s.interests||[]));let changed=phase!==s.phase;if(changed){phase=s.phase;phaseAt=performance.now()}let replayChanged=replay!==null&&replay!==s.screenReplay;replay=s.screenReplay;schedule(currentPlayers,replayChanged);layoutKey="";knowledgeKey="";root.querySelector('#constellation-title').textContent=title(phase);root.querySelector('#constellation-status').textContent=demo?'ДЕМО · '+currentPlayers.length+' участников':'В ЭФИРЕ';root.querySelector('.constellation-card__number').textContent=currentPlayers.length;root.querySelector('.constellation__legend').textContent=phase==='LOBBY'?'ПЛАНЕТЫ — ИНТЕРЕСЫ · ЗВЁЗДЫ — ЛЮДИ':phase==='TEAMS_FORM'?'ЗВЁЗДЫ СОБИРАЮТСЯ В КОМАНДЫ':phase.startsWith('ROUND')?'ГРАФ ЗНАНИЙ · УЧАСТНИКИ ПРИГЛУШЕНЫ':'ПАУТИНА ЗАЛА';let qr=root.querySelector('.constellation-qr-holder');let qkey=String(s.joinUrl||'');if(qr.dataset.key!==qkey){qr.dataset.key=qkey;qr.innerHTML=qkey?'<div class="constellation-qr"><img src="/qr.svg" alt="QR-код для входа в игру"></div>':'<span class="constellation__warning">QR появится после настройки HTTPS-адреса</span>'}root.querySelector('.constellation-url').textContent=s.publicUrlDomain||'';let mascot=phase==='LOBBY'?'point':phase==='ROUND_ACTIVE'?'start':phase==='ROUND_REVEAL'?'happy':phase==='TEAMS_FORM'?'weave':phase==='FINAL'?'happy':'think';let image=root.querySelector('#screen-mascot'),src='/assets/mascot/mascot-'+mascot+'-512.webp';if(image.getAttribute('src')!==src)image.src=src;root.querySelector('#mascot-phrase').textContent=phase==='LOBBY'?'Сканируйте QR и присоединяйтесь!':phase==='TEAMS_FORM'?'Пора найти свою команду!':phase==='FINAL'?'Вот это созвездие!':'Какие связи найдём?';syncTeams();syncRound();syncFinal();syncBridges()}
function syncTeams(){const overlay=root.querySelector('.team-overlay');overlay.style.display=(phase==='TEAMS_FORM'||phase==='FINAL')?'grid':'none';overlay.classList.toggle('is-final',phase==='FINAL');if(phase!=='TEAMS_FORM'&&phase!=='FINAL')return;let teams=state.teams||[],cards=teams.map(z=>{let members=currentPlayers.filter(p=>p.teamId===z.id),count=members.length,score=members.reduce((sum,p)=>sum+(p.score||0),0),maxScore=Math.max(1,...teams.map(team=>currentPlayers.filter(p=>p.teamId===team.id).reduce((sum,p)=>sum+(p.score||0),0)));let qr=z.qrUrl?`<img class="team-qr" src="${esc(z.qrUrl)}" alt="QR команды ${esc(z.name)}">`:'<div class="team-qr-empty">QR после настройки MAX</div>';return `<div class="team-card" style="--team-color:${esc(z.color)}"><img class="team-emblem" src="/assets/teams/${esc(z.icon||'team-ai')}-384.webp" alt=""><strong>${esc(z.name)}</strong><span>${count} чел.</span>${phase==='FINAL'?`<span>${score} очков</span><div class="team-score"><i style="width:${Math.round(score/maxScore*100)}%"></i></div>`:''}${qr}</div>`}).join('');let pending=currentPlayers.filter(p=>!p.teamId).length;let key=cards+pending;if(overlay.dataset.key!==key){overlay.dataset.key=key;overlay.innerHTML=cards+(pending?`<div class="team-unassigned">Не выбрали команду: ${pending}</div>`:'')}}
function syncRound(){let box=root.querySelector('.round-info');if(!phase.startsWith('ROUND')){box.style.display='none';return}box.style.display='flex';let r=state.roundData||[];box.innerHTML=`<strong>${esc(r[0]||'')} <span>→</span> ${esc(r[1]||'')}</strong><b id="screen-timer"></b>`}
function syncFinal(){let box=root.querySelector('.final-podium');if(phase!=='FINAL'){box.style.display='none';return}let leaders=[...currentPlayers].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,3);box.style.display='flex';box.innerHTML=leaders.map((p,i)=>`<div><span>0${i+1}</span> <strong>${esc(p.nick)}</strong> <b>${p.score||0} очков</b></div>`).join('')||'Результатов пока нет'}

function syncBridges(){
 const box=root.querySelector('.bridge-summary');box.style.display=phase==='LOBBY'?'grid':'none';
 box.innerHTML=currentLinks.filter(e=>e.count>=2).slice().sort((a,b)=>b.count-a.count).slice(0,3).map(e=>'<div><span>'+esc(e.source)+' ↔ '+esc(e.target)+'</span><b>'+e.count+' чел.</b></div>').join('');
}
function wrapLabel(text,maxWidth){
 const lines=[];let line='';for(const word of text.split(' ')){let next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines;
}
function separateBoxes(nodes,w,top,bottom,pad){
 for(let step=0;step<600;step++){
  let overlap=0;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j],ox=a.hw+b.hw-Math.abs(a.x-b.x),oy=a.hh+b.hh-Math.abs(a.cy-b.cy);
   if(ox>0&&oy>0){overlap++;if(ox<oy){const push=(ox+.1)/2,sign=Math.sign(a.x-b.x)||(i%2?1:-1);a.x+=push*sign;b.x-=push*sign}else{const push=(oy+.1)/2,sign=Math.sign(a.cy-b.cy)||(i%2?1:-1);a.cy+=push*sign;b.cy-=push*sign}}
  }
  for(const q of nodes){q.x=Math.max(pad+q.hw,Math.min(w-pad-q.hw,q.x));q.cy=Math.max(top+q.hh,Math.min(bottom-q.hh,q.cy))}
  if(!overlap)break;
 }
 return !nodes.some((a,i)=>nodes.slice(i+1).some(b=>Math.abs(a.x-b.x)<a.hw+b.hw-.2&&Math.abs(a.cy-b.cy)<a.hh+b.hh-.2));
}
// Preserve the force layout's neighbourhoods, then separate the full visual bounds
// (orbits AND labels). This runs on data/viewport changes, never every frame.
function points(w,h){
 const key=w+':'+h;if(layoutCache&&layoutKey===key)return layoutCache;
 const I=state.interests||[],raw=state.demo?.planetLayout||state.planetLayout||{};
 const counts=new Map(I.map(name=>[name,0])),groups=new Map(I.map(name=>[name,[]]));
 for(const p of currentPlayers){for(const name of new Set(p.interests||[]))if(counts.has(name))counts.set(name,counts.get(name)+1);groups.get(p.interests?.[0])?.push(p)}
 const rawPoints=I.map((name,i)=>raw[name]||{x:Math.cos(i*6.283/I.length),y:Math.sin(i*6.283/I.length)});
 const xs=rawPoints.map(p=>p.x),ys=rawPoints.map(p=>p.y),minx=Math.min(...xs),miny=Math.min(...ys),dx=Math.max(...xs)-minx||1,dy=Math.max(...ys)-miny||1;
 const scale=Math.max(.45,Math.min(w/1400,h/900,2.5)),top=52*scale,bottom=100*scale,pad=20*scale;
 let nodes=[];
 for(let attempt=0;attempt<7;attempt++){
  const unit=scale*Math.pow(.92,attempt),font=24*unit;ctx.font='600 '+font+'px ScreenInter';
  nodes=I.map((name,i)=>{let style=(state.interestStyles||[]).find(x=>x.name===name)||{},n=counts.get(name),size=(58+Math.min(36,Math.sqrt(n)*5))*unit,orbit=size/2+22*unit;
   const lines=wrapLabel(name,180*unit),labelHeight=lines.length*font*1.15+8*unit;
   const hw=Math.max(orbit,...lines.map(line=>ctx.measureText(line).width/2))+9*unit,hh=orbit+labelHeight/2+9*unit;
   return{name,i,n,color:style.color||colors[i%colors.length],icon:style.icon,size,orbit,font,lines,labelHeight,hw,hh,unit,members:groups.get(name),x:pad+hw+(rawPoints[i].x-minx)/dx*Math.max(0,w-2*(pad+hw)),cy:top+hh+(rawPoints[i].y-miny)/dy*Math.max(0,h-top-bottom-2*hh)};
  });
  const collision=!separateBoxes(nodes,w,top,h-bottom,pad);
  if(!collision)break;
 }
 for(const q of nodes){q.y=q.cy-q.labelHeight/2;q.members.sort((a,b)=>String(a.id).localeCompare(String(b.id)));q.slots=new Map(q.members.map((p,i)=>[p.id,i]))}
 layoutKey=key;layoutCache=nodes;return nodes;
}
function person(p,planets,w,h){
 const anchor=planets.find(q=>q.name===p.interests?.[0]);if(!anchor)return null;
 const index=anchor.slots.get(p.id)||0,count=anchor.members.length,rings=Math.max(1,Math.ceil(count/28)),ring=index%rings,perRing=Math.ceil((count-ring)/rings),slot=Math.floor(index/rings);
 const a=slot/Math.max(1,perRing)*Math.PI*2+ring*.73+(reduced?0:performance.now()/90000*Math.PI*2),rad=anchor.size/2+9*anchor.unit+(rings===1?5:14*ring/(rings-1))*anchor.unit;
 return{x:anchor.x+Math.cos(a)*rad,y:anchor.y+Math.sin(a)*rad,anchor,r:anchor.size/2};
}


function knowledgePoints(w,h){
 const key=w+':'+h;if(knowledgeCache&&knowledgeKey===key)return knowledgeCache;
 const g=state.gameGraph||{},scale=Math.max(.45,Math.min(w/1400,h/900,2.5)),top=145*scale,bottom=h-45*scale;
 let nodes=(g.nodes||[]).map((z,i)=>{const id=z.id||z.name||z.label||String(z);return{id,name:z.label||z.name||id,x:.15+.7*hash(id),cy:.15+.7*hash(id+'y')}});
 const map=new Map(nodes.map(n=>[n.id,n]));
 // A small deterministic force simulation keeps related concepts near each other.
 for(let k=0;k<160;k++){
  const forces=new Map(nodes.map(n=>[n.id,{x:(.5-n.x)*.004,y:(.5-n.cy)*.004}]));
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){let a=nodes[i],b=nodes[j],dx=a.x-b.x,dy=a.cy-b.cy,dist=Math.max(.02,Math.hypot(dx,dy)),f=.00012/(dist*dist);forces.get(a.id).x+=dx/dist*f;forces.get(a.id).y+=dy/dist*f;forces.get(b.id).x-=dx/dist*f;forces.get(b.id).y-=dy/dist*f}
  for(const e of g.links||[]){const a=map.get(e.source||e.from),b=map.get(e.target||e.to);if(!a||!b)continue;const dx=b.x-a.x,dy=b.cy-a.cy;forces.get(a.id).x+=dx*.012;forces.get(a.id).y+=dy*.012;forces.get(b.id).x-=dx*.012;forces.get(b.id).y-=dy*.012}
  for(const n of nodes){const f=forces.get(n.id);n.x+=Math.max(-.03,Math.min(.03,f.x));n.cy+=Math.max(-.03,Math.min(.03,f.y))}
 }
 const minx=Math.min(...nodes.map(n=>n.x)),miny=Math.min(...nodes.map(n=>n.cy)),dx=Math.max(...nodes.map(n=>n.x))-minx||1,dy=Math.max(...nodes.map(n=>n.cy))-miny||1;
 const seeds=nodes.map(n=>({...n,x:(n.x-minx)/dx,cy:(n.cy-miny)/dy}));
 for(let attempt=0;attempt<6;attempt++){
  const font=20*scale*Math.pow(.92,attempt);ctx.font='600 '+font+'px ScreenInter';
  nodes=seeds.map(n=>{const lines=wrapLabel(n.name,160*scale),hw=Math.max(...lines.map(t=>ctx.measureText(t).width/2))+14*scale,hh=(lines.length*font*1.2+26*scale)/2;return{...n,font,lines,hw,hh,x:hw+20*scale+n.x*(w-2*hw-40*scale),cy:top+hh+n.cy*(bottom-top-2*hh)}});
  if(separateBoxes(nodes,w,top,bottom,16*scale))break;
 }
 for(const n of nodes)n.y=n.cy+n.hh-10*scale;
 knowledgeKey=key;knowledgeCache=nodes;return nodes;
}

function line(a,b,alpha,width){ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalAlpha=1}
function draw(t){if(!canvas||!state)return;if(!fontsReady){frame=requestAnimationFrame(draw);return}if(lastFrame){frameSum+=t-lastFrame;frameCount++;if(frameCount>=60){if(frameSum/frameCount>1000/45)particlesEnabled=false;frameSum=frameCount=0}}lastFrame=t;let timer=root.querySelector('#screen-timer');if(timer)timer.textContent=phase==='ROUND_ACTIVE'?String(Math.max(0,Math.ceil((45000-(Date.now()-state.started))/1000))).padStart(2,'0')+' с':'';let d=Math.min(devicePixelRatio||1,1.5),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h){frame=requestAnimationFrame(draw);return}if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);if(phase!=='LOBBY')root.querySelector('.arrival-toast').textContent='';let planets=points(w,h),now=performance.now(),teams=state.teams||[],nodeById=new Map();
for(const p of currentPlayers){let pt=person(p,planets,w,h);if(pt)nodeById.set(p.id,pt)}
if(phase==='TEAMS_FORM'){
 let f=reduced?1:Math.max(0,Math.min(1,(now-phaseAt)/3700));f=1-Math.pow(1-f,3);ctx.globalAlpha=1-f;for(const q of planets){ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,q.size/2,0,7);ctx.fill()}ctx.globalAlpha=1;
 currentPlayers.forEach(p=>{let from=nodeById.get(p.id),idx=teams.findIndex(z=>z.id===p.teamId);if(!from||idx<0)return;let col=idx%4,row=Math.floor(idx/4),cx=w*(col+.5)/4,cy=h*(row+.5)/2,a=hash(p.id+'team')*6.283,r=18+hash(p.id+'distance')*38,to={x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};ctx.fillStyle=teams[idx].color;ctx.beginPath();ctx.arc(from.x+(to.x-from.x)*f,from.y+(to.y-from.y)*f,3,0,7);ctx.fill()});
}else if(phase.startsWith('ROUND')){
 currentPlayers.forEach(p=>{let pt=nodeById.get(p.id);if(pt){ctx.fillStyle='rgba(220,235,255,.2)';ctx.beginPath();ctx.arc(pt.x,pt.y,2.5,0,7);ctx.fill()}});
 const graph=state.gameGraph||{},nodes=knowledgePoints(w,h),map=new Map(nodes.map(n=>[n.id,n])),scale=Math.min(w/1400,h/900),path=phase==='ROUND_REVEAL'?(state.shortest||[]):[];
 ctx.strokeStyle='#789ccb';for(const e of graph.links||[]){let a=map.get(e.source||e.from),b=map.get(e.target||e.to);if(a&&b)line(a,b,.18,Math.max(.6,scale));else if(e.type==='interest'){a=planets.find(p=>p.name===(e.interest||e.source));if(a&&b)line(a,b,.08,.7)}}
 if(path.length>1){const steps=reduced?path.length:Math.floor((now-phaseAt)/250);for(let i=0;i<Math.min(steps,path.length-1);i++){let a=map.get(path[i]),b=map.get(path[i+1]);if(a&&b){ctx.strokeStyle='#22d3ee';line(a,b,.95,3*scale)}}}
 for(const n of nodes){const selected=path.includes(n.id)||(state.roundData||[]).slice(0,2).includes(n.id);ctx.fillStyle=selected?'#22d3ee':'#93b8e8';ctx.beginPath();ctx.arc(n.x,n.y,(selected?7:4)*scale,0,7);ctx.fill();ctx.textAlign='center';ctx.font='600 '+n.font+'px ScreenInter';ctx.strokeStyle='#091328';ctx.lineWidth=5*scale;ctx.fillStyle=selected?'#ffffff':'#c0d0e8';n.lines.forEach((line,i)=>{let y=n.y-14*scale-(n.lines.length-1-i)*n.font*1.2;ctx.strokeText(line,n.x,y);ctx.fillText(line,n.x,y)})}

}else if(phase!=='FINAL'){
 let visibleLinks=[...currentLinks].filter(e=>e.count>=2).sort((a,b)=>b.count-a.count).slice(0,18),active=currentPlayers.filter(p=>{let age=now-(seen.get(p.id)||0);return age>=300&&age<1300});ctx.strokeStyle='#a8c9ff';for(const e of visibleLinks){let a=planets.find(q=>q.name===e.source),b=planets.find(q=>q.name===e.target);if(!a||!b)continue;let flash=active.some(p=>p.interests.includes(e.source)&&p.interests.includes(e.target));let bend=.18,dx=b.x-a.x,dy=b.y-a.y,cx=(a.x+b.x)/2-dy*bend,cy=(a.y+b.y)/2+dx*bend,grad=ctx.createLinearGradient(a.x,a.y,b.x,b.y);grad.addColorStop(0,a.color);grad.addColorStop(1,b.color);ctx.strokeStyle=grad;ctx.globalAlpha=flash?.65:.15;ctx.lineWidth=Math.min(5,.7+Math.sqrt(e.count)*.35);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(cx,cy,b.x,b.y);ctx.stroke();ctx.globalAlpha=1;if(!reduced&&particlesEnabled){let amount=1;for(let j=0;j<amount;j++){let t=((now/10000+j/amount)%1),x=(1-t)*(1-t)*a.x+2*(1-t)*t*cx+t*t*b.x,y=(1-t)*(1-t)*a.y+2*(1-t)*t*cy+t*t*b.y;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,1.3,0,7);ctx.fill()}}}
 let nickFlash=[];currentPlayers.forEach(p=>{let q=nodeById.get(p.id),age=now-(seen.get(p.id)||0);if(!q||age<0)return;let appear=reduced?1:Math.min(1,age/300),fly=reduced?1:Math.min(1,age/300),px=(w+15)+(q.x-w-15)*(1-Math.pow(1-fly,3)),py=q.y;ctx.strokeStyle='#d7edff';if(age>=300||reduced)line(q,q.anchor,age<1300?.55:.08,.7);if(fly<1){ctx.strokeStyle='rgba(190,225,255,.5)';line({x:px+30,y:py},{x:px,y:py},.5,2)}if(age<1300&&!reduced){ctx.strokeStyle=`rgba(255,255,255,${.75*(1-age/1300)})`;ctx.beginPath();ctx.arc(q.x,q.y,4+age/60,0,7);ctx.stroke()}ctx.fillStyle=`rgba(255,255,255,${appear})`;ctx.beginPath();ctx.arc(px,py,Math.max(1.4,Math.min(3,2.5*q.anchor.unit)),0,7);ctx.fill();if(fly<1)return;(p.interests||[]).slice(1,3).forEach((interest,i)=>{let n=planets.find(z=>z.name===interest);if(n){ctx.fillStyle=n.color;ctx.beginPath();ctx.arc(q.x+(i?3:-3)*q.anchor.unit,q.y-4*q.anchor.unit,Math.max(1,1.6*q.anchor.unit),0,7);ctx.fill()}});if(age>=300&&age<2300)nickFlash.push({q,p})});
 const arrival=root.querySelector('.arrival-toast'),latest=nickFlash.at(-1);
 arrival.textContent=latest?'✦ '+latest.p.nick+' · '+latest.p.interests[0]:'';
 for(const q of planets){
  const img=asset('interests/'+q.icon+'-384.webp'),size=q.size;
  const glow=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,size*.85);glow.addColorStop(0,q.color+'30');glow.addColorStop(1,q.color+'00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(q.x,q.y,size*.85,0,7);ctx.fill();
  if(img.complete&&img.naturalWidth)ctx.drawImage(img,q.x-size/2,q.y-size/2,size,size);else{ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,size/2,0,7);ctx.fill()}
 }
 // Permanent labels are the final layer; no name can cover them.
 for(const q of planets){ctx.textAlign='center';ctx.font='600 '+q.font+'px ScreenInter';ctx.lineWidth=6*q.unit;ctx.strokeStyle='#091328';ctx.fillStyle='#f2f6ff';q.lines.forEach((line,i)=>{const y=q.y+q.orbit+q.font*(1+i*1.15);ctx.strokeText(line,q.x,y);ctx.fillText(line,q.x,y)})}
}

frame=requestAnimationFrame(draw)}
function render(s,r){if(root!==r||!canvas||!canvas.isConnected){if(frame)cancelAnimationFrame(frame);root=r;canvas=null;seen.clear();phase='';replay=null;init()}sync(s)}
window.ConstellationScreen={render,destroy:()=>{if(frame)cancelAnimationFrame(frame);root=null;canvas=null},knowledgeGeometry:()=>knowledgeCache?.map(q=>({name:q.name,x:q.x-q.hw,y:q.cy-q.hh,width:q.hw*2,height:q.hh*2}))||[],geometry:()=>layoutCache?.map(q=>({name:q.name,x:q.x-q.hw,y:q.cy-q.hh,width:q.hw*2,height:q.hh*2,font:q.font}))||[]};
})();
