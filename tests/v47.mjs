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
    db.settings.theme=th;
    db.accounts=[{id:"a1",name:"Checking",kind:"checking",value:9476,parentId:null}];
    db.holdings=[{id:"h1",ticker:"VOO",shares:3,price:512,divPerShare:6.2,lots:[{sh:3,px:480}]}];
    db.debts=[{id:"d1",name:"Card",balance:730,start:2000,kind:"card",limit:1000}];
    db.goal={target:15000,deadline:"2026-09-21"};
    db.snapshots=[{m:"2026-04",net:2100},{m:"2026-05",net:4300},{m:"2026-06",net:5800},{m:"2026-07",net:7900}];
    // many bills -> many upcoming items
    db.recurring=[["Rent",1525,1],["Car Insurance",169,1],["Cell Phone",140,1],["Car Note",173,5],
                  ["Internet",70,8],["Electric",95,10],["Water",45,12],["Gas Utility",40,3],
                  ["Subscriptions",100,6],["Gym",35,9]].map((x,i)=>({id:"r"+i,name:x[0],category:"Household",amount:x[1],dueDay:x[2]}));
    db.income=[{id:"i1",name:"Ozark Law - AC",kind:"production",rate:350,daysPerWeek:5,payEvery:"biweekly",firstPay:"2026-06-05",start:"2026-05-20",end:"2026-10-01",taxRate:22},
               {id:"i2",name:"Roommate",kind:"regular",amount:291,payEvery:"weekly",firstPay:"2026-07-01"}];
    // 40 transactions across 60 days
    const cats=["Food","Auto & Gas","Shopping","Entertainment","Household"];
    db.transactions=Array.from({length:40},(_,i)=>{
      const d=new Date(2026,6,29); d.setDate(d.getDate()-i*1.5);
      return {id:"t"+i,date:d.toISOString().slice(0,10),desc:"Merchant "+(i+1),amount:-(15+i*3),category:cats[i%5]};});
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
const scrolled=await p.evaluate(()=>{const cu=document.querySelector('#comingUp .scrollrows');cu.scrollTop=9999;return cu.scrollTop>10;});
console.log('coming-up scrolls:',scrolled);
const s2=await p.evaluate(()=>{const rt=document.querySelector('#recentTx .scrollrows');rt.scrollTop=9999;return rt.scrollTop>10;});
console.log('recent-tx scrolls:',s2);
await p.evaluate(()=>{document.querySelector('#comingUp .scrollrows').scrollTop=0;document.querySelector('#recentTx .scrollrows').scrollTop=0;});
await p.screenshot({path:'/home/claude/dash-scroll.png',fullPage:true});
await p.close();

const m=await go(390,844,'mobile','dark');
await m.screenshot({path:'/home/claude/dash-scroll-m.png',fullPage:true});
await m.close();
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
