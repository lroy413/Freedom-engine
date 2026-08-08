import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const fixture=()=>{
  db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:9476,parentId:null}];
  db.debts=[{id:"d1",name:"Card",balance:730,start:2000,kind:"card",limit:1000},
            {id:"d2",name:"Car",balance:3200,start:3600,kind:"auto",limit:0}];
  db.recurring=[{id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1},
                {id:"r2",name:"Phone",category:"Phone",amount:140,dueDay:3}];
  db.budgets={Food:400,"Auto & Gas":150};
  db.goal={target:15000,deadline:"2026-09-21"};
  db.paychecks=[{id:"p1",date:"2026-07-15",source:"Gig",gross:3500,net:2900}];
  db.snapshots=[{m:"2026-02",net:1200},{m:"2026-03",net:2600},{m:"2026-04",net:2100},
                {m:"2026-05",net:4300},{m:"2026-06",net:5800},{m:"2026-07",net:7900}];
  db.transactions=[{id:"t2",date:"2026-07-05",desc:"Groceries",amount:-260,category:"Food"},
                   {id:"t3",date:"2026-07-08",desc:"Gas",amount:-90,category:"Auto & Gas"}];
  saveAll();};

async function run(w,h,tag,seed){
  const p = await b.newPage({ viewport:{width:w,height:h} });
  p.on('pageerror',e=>errs.push(tag+':'+e.message));
  await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
  await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(600);
  if(seed) await p.evaluate(fixture);
  await p.waitForTimeout(700);
  const m = await p.evaluate(()=>{
    const hero=document.querySelector('.dashhero'), sp=document.querySelector('.dh-spark');
    const st=[...document.querySelectorAll('.dh-stat')].map(x=>({k:x.querySelector('.k').textContent,v:x.querySelector('.v').textContent,w:Math.round(x.getBoundingClientRect().width)}));
    const g=document.querySelector('.dh-goal');
    const r=hero.getBoundingClientRect();
    return {heroW:Math.round(r.width),heroH:Math.round(r.height),
      sparkVisible: sp?getComputedStyle(sp).display!=='none':false,
      sparkW: sp?Math.round(sp.getBoundingClientRect().width):0,
      stats:st, goal:g?g.querySelector('.k').textContent:null,
      goalBar:g?Math.round(g.querySelector('.dh-gbar span').getBoundingClientRect().width):0,
      val:document.querySelector('.dh-val').textContent,
      delta:document.querySelector('.dh-delta').textContent};
  });
  console.log(`\n== ${tag} (${w}x${h}) ==`);
  console.log('  hero box', m.heroW+'x'+m.heroH, '| net', m.val, '|', m.delta);
  console.log('  spark', m.sparkVisible?('visible '+m.sparkW+'px'):'hidden');
  m.stats.forEach(s=>console.log('   ', s.k.padEnd(13), s.v.padEnd(10), s.w+'px'));
  console.log('  goal:', m.goal, 'bar fill', m.goalBar+'px');
  await p.screenshot({path:`/home/claude/hero-${tag}.png`});
  await p.close();
}
await run(1440,1100,'desktop',true);
await run(390,844,'mobile',true);
await run(1440,1100,'empty',false);
console.log('\nERRORS:', errs.length?errs:'none');
await b.close();
