import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
async function open(w,h,tag){
  const p = await b.newPage({ viewport:{width:w,height:h} });
  p.on('pageerror',e=>errs.push(tag+':'+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push(tag+' C:'+m.text());});
  await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
  await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(600);
  await p.evaluate(()=>{
    db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:9476,parentId:null}];
    db.holdings=[{id:"h1",ticker:"VOO",shares:3,price:512,divPerShare:6.2,lots:[{sh:3,px:480}]}];
    db.debts=[{id:"d1",name:"Card",balance:730,start:2000,kind:"card",limit:1000}];
    db.goal={target:15000,deadline:"2026-09-21"};
    db.snapshots=[{m:"2026-04",net:2100},{m:"2026-05",net:4300},{m:"2026-06",net:5800},{m:"2026-07",net:7900}];
    saveAll(); setView('data');});
  await p.waitForTimeout(500);
  return p;
}
const p = await open(1440,1300,'desktop');
const groups = await p.evaluate(()=>[...document.querySelectorAll('#setRoot .setgrouplabel')].map((g,i)=>({
  label:g.textContent,
  rows:[...g.nextElementSibling.querySelectorAll('.setrow')].map(r=>({
    id:r.dataset.set, label:r.querySelector('.setlabel').childNodes[0].textContent,
    sub:(r.querySelector('.setlabel small')||{}).textContent||'', val:r.querySelector('.setval').textContent,
    h:Math.round(r.getBoundingClientRect().height)}))})));
groups.forEach(g=>{console.log('\n['+g.label+']');
  g.rows.forEach(r=>console.log('  ',r.label.padEnd(24),(r.sub||'').padEnd(28),'→',JSON.stringify(r.val),r.h+'px'));});
console.log('\n-- drill into every pane --');
for(const id of ['appearance','shortcuts','bank','sync','market','cats','rules','backup','about']){
  await p.evaluate(i=>openSetting(i),id); await p.waitForTimeout(300);
  const r=await p.evaluate(id=>({title:document.getElementById('setTitle').textContent,
    backShown:!document.getElementById('setBack').hidden,
    rootHidden:document.getElementById('setRoot').hidden,
    paneShown:!document.getElementById('sp-'+id).hidden,
    otherShown:[...document.querySelectorAll('.setpane')].filter(x=>!x.hidden).length,
    inner:document.getElementById('sp-'+id).innerText.trim().length}),id);
  console.log(`  ${id.padEnd(11)} "${r.title}" back:${r.backShown} rootHidden:${r.rootHidden} pane:${r.paneShown} visiblePanes:${r.otherShown} content:${r.inner}ch`);
  await p.screenshot({path:`/home/claude/set-${id}.png`});
}
await p.evaluate(()=>closeSetting()); await p.waitForTimeout(300);
console.log('back to root ->', await p.evaluate(()=>({t:document.getElementById('setTitle').textContent,root:!document.getElementById('setRoot').hidden})));
await p.screenshot({path:'/home/claude/set-root.png'});
// live value refresh
await p.evaluate(()=>{db.settings.theme='bushido';syncTheme();saveAll();renderSetRoot();});
await p.waitForTimeout(300);
console.log('theme row now:', await p.$eval('[data-set="appearance"] .setval',e=>e.textContent));
// hero invested
await p.evaluate(()=>setView('dash')); await p.waitForTimeout(500);
console.log('hero stats:', await p.$$eval('.dh-stat',e=>e.map(x=>x.querySelector('.k').textContent+'='+x.querySelector('.v').textContent).join(' | ')));
await p.screenshot({path:'/home/claude/hero-inv.png'});
await p.close();

const m = await open(390,844,'mobile');
await m.evaluate(()=>openSetting('cats')); await m.waitForTimeout(300);
await m.screenshot({path:'/home/claude/set-m-cats.png'});
await m.evaluate(()=>closeSetting()); await m.waitForTimeout(300);
await m.screenshot({path:'/home/claude/set-m-root.png'});
await m.evaluate(()=>setView('dash')); await m.waitForTimeout(500);
await m.screenshot({path:'/home/claude/hero-m-inv.png'});
await m.close();
console.log('\nERRORS:', errs.length?errs:'none');
await b.close();
