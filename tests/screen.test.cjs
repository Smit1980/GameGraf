const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
const content = name => JSON.parse(fs.readFileSync(path.join(project, 'content', name), 'utf8'));
function fixture() {
  let now = 1000, nextFrame, painted = 0;
  const elements = {};
  const context = new Proxy({
    font: '20px sans-serif',
    measureText(text) { return {width: String(text).length * (parseFloat(this.font.match(/[\d.]+px/)?.[0]) || 20) * .56}; },
    createLinearGradient: () => ({addColorStop(){}}),
    createRadialGradient: () => ({addColorStop(){}}),
    arc(){ painted++; },
  }, {get: (o,k) => k in o ? o[k] : () => {}});
  const canvas = {isConnected: true, clientWidth: 1400, clientHeight: 900, getContext: () => context};
  const root = {querySelector: selector => selector === 'canvas' ? canvas : elements[selector] ??= {style:{}, dataset:{}, classList:{toggle(){}}, getAttribute(){return ''},textContent:'',innerHTML:''}};
  const box = {window:{addEventListener(){}}, document:{documentElement:{style:{setProperty(){}}}}, Image:class {complete=true;naturalWidth=300}, matchMedia:()=>({matches:false}), location:{search:''}, URLSearchParams, performance:{now:()=>now}, requestAnimationFrame:f=>(nextFrame=f,1), cancelAnimationFrame(){}, devicePixelRatio:1, innerWidth:1920, innerHeight:1080};
  vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(project,'public/screen.js'),'utf8'),box);
  const styles=content('interests.json'),teams=content('teams.json'),interests=styles.map(v=>v.name);
  const state={phase:'LOBBY',interests,interestStyles:styles,teams,gameGraph:content('game.json'),players:[],roundData:['Юрий Гагарин','Minecraft'],started:Date.now(),screenReplay:0};
  const player=i=>({id:String(i),nick:'Игрок '+i,interests:[interests[i%12],interests[(i+1)%12],interests[(i+4)%12]],teamId:teams[i%8].id});
  const render=()=>box.window.ConstellationScreen.render(state,root);
  const tick=t=>{now=t;painted=0;nextFrame(t);return painted};
  return {state,player,render,tick,canvas,elements,screen:box.window.ConstellationScreen};
}
function assertGeometry(nodes,width,height) {
  for(const [i,a] of nodes.entries()){
    assert.ok(a.x >= -.5 && a.y >= -.5 && a.x+a.width<=width+.5 && a.y+a.height<=height+.5, a.name+' must fit');
    for(const b of nodes.slice(i+1)){
      const ox=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),oy=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
      assert.ok(ox<.5||oy<.5,a.name+' overlaps '+b.name);
    }
  }
}
test('100–300 participants fit without intersecting planet or label bounds',()=>{
 const f=fixture();
 for(const count of [100,200,300])for(const [w,h] of [[940,634],[1400,950],[2860,1967]]){
  f.state.players=Array.from({length:count},(_,i)=>f.player(i));f.canvas.clientWidth=w;f.canvas.clientHeight=h;f.render();f.tick(2000);assert.equal(f.screen.geometry().length,12);assertGeometry(f.screen.geometry(),w,h);
 }
});
test('existing participants render immediately; a new arrival has no 75-second backlog',()=>{
 const f=fixture();f.state.players=Array.from({length:300},(_,i)=>f.player(i));f.render();assert.ok(f.tick(1000)>900);assert.equal(f.elements['.arrival-toast'].textContent,'');
 f.state.players.push(f.player(300));f.render();f.tick(1400);assert.match(f.elements['.arrival-toast'].textContent,/Игрок 300/);f.tick(3500);assert.equal(f.elements['.arrival-toast'].textContent,'');
 f.state.screenReplay++;f.render();f.tick(3900);assert.notEqual(f.elements['.arrival-toast'].textContent,'');
});
test('knowledge labels avoid one another and remain below the round header',()=>{
 const f=fixture();f.state.phase='ROUND_ACTIVE';
 for(const [w,h] of [[940,634],[1400,950],[2860,1967]]){f.canvas.clientWidth=w;f.canvas.clientHeight=h;f.render();f.tick(3000);const nodes=f.screen.knowledgeGeometry();assert.equal(nodes.length,f.state.gameGraph.nodes.length);assertGeometry(nodes,w,h);assert.ok(nodes.every(n=>n.y>=145*Math.min(w/1400,h/900)-.5));}
});
test('team and final phases do not paint lobby labels',()=>{
 const f=fixture();f.state.players=Array.from({length:300},(_,i)=>f.player(i));f.render();f.tick(1000);
 for(const phase of ['TEAMS_FORM','FINAL']){f.state.phase=phase;f.render();f.tick(6000);assert.equal((f.elements['.team-overlay'].innerHTML.match(/class="team-card"/g)||[]).length,8);assert.equal(f.elements['.bridge-summary'].style.display,'none');assert.equal(f.elements['.arrival-toast'].textContent,'');}
});
