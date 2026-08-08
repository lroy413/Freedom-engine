import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
async function go(w,h,tag,theme){
  const p=await b.newPage({viewport:{width:w,height:h}});
  p.on('pageerror',e=>errs.push(tag+':'+e.message));
  await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
  await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(600);
  await p.evaluate(th=>{
    /* Everything below is positioned relative to today using the app's own
       local-date helpers. Fixed dates rotted this suite: the Coming Up
       scroller only appears once enough bills fall inside the 14-day window,
       and a fixture pinned to July stopped putting them there in August.
       isoOf() rather than toISOString() — the latter shifts the day in any
       timezone behind UTC. */
    const rel=n=>{const d=dayOf(todayISO()); d.setDate(d.getDate()+n); return isoOf(d);};
    const relMonth=n=>{const d=dayOf(todayISO()); d.setDate(1); d.setMonth(d.getMonth()+n); return monthOf(d);};
    const today=dayOf(todayISO()).getDate();
    db.settings.theme=th;
    db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:9476,parentId:null}];
    db.holdings=[{id:"h1",ticker:"VOO",shares:3,price:512,divPerShare:6.2,lots:[{sh:3,px:480}]}];
    db.debts=[{id:"d1",name:"Card",balance:730,start:2000,kind:"card",limit:1000}];
    db.goal={target:15000,deadline:rel(44)};
    db.snapshots=[-4,-3,-2,-1].map((o,i)=>({m:relMonth(o),net:[2100,4300,5800,7900][i]}));
    /* one bill due on each of the next ten days, so the upcoming list is
       always long enough to scroll (it needs six) wherever we are in a month */
    db.recurring=[["Rent",1525],["Car Insurance",169],["Cell Phone",140],["Car Note",173],
                  ["Internet",70],["Electric",95],["Water",45],["Gas Utility",40],
                  ["Subscriptions",100],["Gym",35]]
      .map((x,i)=>({id:"r"+i,name:x[0],category:"Household",amount:x[1],dueDay:((today-1+i)%28)+1}));
    db.income=[{id:"i1",name:"Ozark Law - AC",kind:"production",rate:350,daysPerWeek:5,payEvery:"biweekly",firstPay:rel(-64),start:rel(-80),end:rel(55),taxRate:22},
               {id:"i2",name:"Roommate",kind:"regular",amount:291,payEvery:"weekly",firstPay:rel(-38)}];
    // 40 transactions across 60 days
    const cats=["Food","Auto & Gas","Shopping","Entertainment","Household"];
    db.transactions=Array.from({length:40},(_,i)=>
      ({id:"t"+i,date:rel(-Math.round(i*1.5)),desc:"Merchant "+(i+1),amount:-(15+i*3),category:cats[i%5]}));
    saveAll();},theme);
  await p.waitForTimeout(800);
  return p;
}
const p=await go(1440,1400,'desktop','light');
const r=await p.evaluate(()=>{
  const cu=document.querySelector('#comingUp .scrollrows'), rt=document.querySelector('#recentTx .scrollrows');
  return {
    cuScroll: cu?{h:Math.round(cu.getBoundingClientRect().height),sh:cu.scrollHeight,rows:cu.querySelectorAll('.upitem').length}:null,
    cuNet: document.querySelector('#comingUp > .upitem:last-child .upname').textContent,
    cuNetSub: document.querySelector('#comingUp > .upitem:last-child .upwhen').textContent,
    rtScroll: rt?{h:Math.round(rt.getBoundingClientRect().height),sh:rt.scrollHeight,rows:rt.querySelectorAll('tr').length}:null,
    rtHint: document.getElementById('recentHint').textContent,
    rtScrollHint: (document.querySelector('#recentTx .scrollhint')||{}).textContent,
    heroStats: [...document.querySelectorAll('.dh-stat')].map(x=>x.querySelector('.k').textContent+'='+x.querySelector('.v').textContent)
  };});
console.log(JSON.stringify(r,null,1));
// can it actually scroll?
/* report a missing scroller instead of throwing an opaque TypeError on null —
   the absence is the finding, and it should read as one */
const canScroll=sel=>p.evaluate(s=>{const el=document.querySelector(s);
  if(!el) return 'NO SCROLLER — fewer rows than the fixture intends';
  el.scrollTop=9999; const ok=el.scrollTop>10; el.scrollTop=0; return ok;},sel);
console.log('coming-up scrolls:',await canScroll('#comingUp .scrollrows'));
console.log('recent-tx scrolls:',await canScroll('#recentTx .scrollrows'));
await p.screenshot({path:'/home/claude/dash-scroll.png',fullPage:true});
await p.close();

const m=await go(390,844,'mobile','dark');
await m.screenshot({path:'/home/claude/dash-scroll-m.png',fullPage:true});
await m.close();
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
