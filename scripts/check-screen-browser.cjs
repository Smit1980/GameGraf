const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 fs.mkdirSync('artifacts/screen',{recursive:true});
 for(const [width,height,count] of [[1920,1080,300],[1920,1080,200],[1920,1080,100],[1280,720,300],[2713,1218,105],[3840,2160,300],[1024,768,300]]){
  await page.setViewportSize({width,height});await page.goto('http://localhost:3000/screen?demo='+count+'&phase=LOBBY');
  await page.waitForFunction(()=>window.ConstellationScreen?.geometry().length===12);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  const check=await page.evaluate(()=>{
   const root=document.querySelector('.constellation'),stage=document.querySelector('.constellation__stage'),rect=root.getBoundingClientRect(),sr=stage.getBoundingClientRect(),nodes=window.ConstellationScreen.geometry();
   const overlaps=[];nodes.forEach((a,i)=>nodes.slice(i+1).forEach(b=>{if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5)overlaps.push([a.name,b.name])}));
   return{rect:rect.toJSON(),stage:sr.toJSON(),area:sr.width*sr.height/innerWidth/innerHeight,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,overlaps,outside:nodes.filter(n=>n.x<0||n.y<0||n.x+n.width>sr.width||n.y+n.height>sr.height),minFont:Math.min(...nodes.map(n=>n.font)),animation:getComputedStyle(root).animationName,arrival:document.querySelector('.arrival-toast').textContent};
  });
  console.log(JSON.stringify({width,height,count,...check}));
  await page.screenshot({path:`artifacts/screen/lobby-${width}-${count}.png`});
  assert.equal(check.overflow,false,'viewport overflow');assert.equal(check.animation,'none');assert.ok(check.rect.right<=width+.5&&check.rect.bottom<=height+.5);assert.ok(check.area>=.6,'graph must occupy 60% of viewport');assert.deepEqual(check.overlaps,[]);assert.deepEqual(check.outside,[]);assert.equal(check.arrival,'','existing participants must not replay on load');
 }
 await page.setViewportSize({width:1920,height:1080});
 for(const phase of ['ROUND_ACTIVE','ROUND_REVEAL','TEAMS_FORM','FINAL']){
  await page.goto('http://localhost:3000/screen?demo=300&phase='+phase);await page.waitForFunction(()=>window.ConstellationScreen?.geometry().length===12);await page.waitForTimeout(phase==='TEAMS_FORM'?4000:500);
  const result=await page.evaluate(()=>{const selectors=['.constellation','.constellation__side','.constellation-card--join','.team-card','.round-info','.final-podium'];return selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(e=>getComputedStyle(e).display!=='none').map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON(),overflows:e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2}))});
  assert.ok(result.every(e=>e.rect.x>=0&&e.rect.y>=0&&e.rect.right<=1921&&e.rect.bottom<=1081),phase+' bounds');
  assert.ok(result.every(e=>!e.overflows),phase+' content overflow '+JSON.stringify(result.filter(e=>e.overflows)));
  await page.screenshot({path:'artifacts/screen/'+phase.toLowerCase()+'.png'});if(phase.startsWith('ROUND')){
   const overlaps=await page.evaluate(()=>{const n=window.ConstellationScreen.knowledgeGeometry();return n.flatMap((a,i)=>n.slice(i+1).filter(b=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5).map(b=>[a.name,b.name]))});assert.deepEqual(overlaps,[],'knowledge label collisions');
  }
  console.log('PASS '+phase);
 }
 await page.goto('http://localhost:3000/screen?demo=100&phase=LOBBY');await page.waitForFunction(()=>window.ConstellationScreen?.geometry().length===12);
 await page.evaluate(async()=>{const s=await(await fetch('/api/state')).json(),demo=await(await fetch('/api/demo?count=100')).json();window.screenTestState={...s,phase:'LOBBY',demo};window.ConstellationScreen.render(window.screenTestState,document.querySelector('#app'));});
 await page.waitForTimeout(100);
 await page.evaluate(()=>{const s=window.screenTestState;s.demo.players.push({...s.demo.players[0],id:'browser-arrival',nick:'Новый участник с очень длинным именем'});window.ConstellationScreen.render(s,document.querySelector('#app'))});
 await page.waitForTimeout(450);assert.match(await page.locator('.arrival-toast').textContent(),/Новый участник/,'new participant must arrive promptly, without an existing-player backlog');
 await page.waitForTimeout(2400);assert.equal(await page.locator('.arrival-toast').textContent(),'');
 await page.evaluate(()=>{window.screenTestState.screenReplay++;window.ConstellationScreen.render(window.screenTestState,document.querySelector('#app'))});await page.waitForTimeout(650);assert.notEqual(await page.locator('.arrival-toast').textContent(),'','admin replay must still animate');
 console.log('PASS initial-load, live arrival, nickname expiry and replay');
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: browser layout, collisions, 100/105/300 participants and all projection phases');
})().catch(e=>{console.error(e);process.exit(1)});
