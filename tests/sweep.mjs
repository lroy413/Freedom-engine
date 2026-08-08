import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const VIEWS=['dash','accounts','income','expenses','budget','goals','credit','invest','data'];
const fixture=()=>{
  db.accounts=[{id:"b1",name:"Chase",kind:"bank",value:0,parentId:null},
    {id:"a1",name:"Chase Checking",kind:"checking",value:4210,parentId:"b1"},
    {id:"a2",name:"Chase Savings",kind:"savings",value:5266,parentId:"b1"},
    {id:"a3",name:"Cash App",kind:"digital",value:120,parentId:null},
    {id:"c1",name:"Milestone Card",kind:"credit",value:410,limit:500,parentId:null,debtId:"d4"}];
  db.debts=[{id:"d1",name:"Credit Card",balance:600,start:730,kind:"card",limit:750,payments:[{id:"p1",date:"2026-07-10",amount:130}]},
    {id:"d2",name:"Mission Lane",balance:1400,start:1400,kind:"collection",payments:[]},
    {id:"d3",name:"Navy Federal Car",balance:3150,start:24000,kind:"auto",payments:[]},
    {id:"d4",name:"Milestone Card",balance:410,start:500,kind:"card",limit:500,payments:[]}];
  db.holdings=[{id:"h1",ticker:"VOO",shares:3,price:512,avgCost:480,divPerShare:6.2},
    {id:"h2",ticker:"SCHD",shares:12,price:28.4,avgCost:26.1,divPerShare:1.05}];
  db.recurring=[["Rent",1525,1],["Car Insurance",169,1],["Cell Phone",140,1],["Car Note",173,5],["Internet",70,8],["Electric",95,10]]
    .map((x,i)=>({id:"r"+i,name:x[0],category:"Household",amount:x[1],dueDay:x[2]}));
  db.income=[{id:"i1",name:"Ozark Law - AC",kind:"production",rate:350,daysPerWeek:5,payEvery:"biweekly",firstPay:"2026-06-05",start:"2026-05-20",end:"2026-10-01",taxRate:22}];
  db.budgets={Food:400,"Auto & Gas":150,Entertainment:100,Shopping:120,Household:80};
  db.goal={target:15000,deadline:"2026-09-21"};
  db.snapshots=[{m:"2026-04",net:2100},{m:"2026-05",net:4300},{m:"2026-06",net:5800},{m:"2026-07",net:7900}];
  db.creditLog=[{date:"2026-05-01",score:601},{date:"2026-06-01",score:618},{date:"2026-07-01",score:640}];
  db.paychecks=[{id:"pc1",date:"2026-07-15",source:"Ozark",gross:3500,net:2900}];
  const cats=["Food","Auto & Gas","Shopping","Entertainment","Household"];
  db.transactions=Array.from({length:30},(_,i)=>{const d=new Date(2026,6,29);d.setDate(d.getDate()-i*1.2);
    return {id:"t"+i,date:d.toISOString().slice(0,10),desc:"Merchant "+(i+1),amount:-(15+i*3),category:cats[i%5]};});
  saveAll();};
for(const [w,h,tag] of [[390,844,'m'],[1440,1000,'d']]){
  const p=await b.newPage({viewport:{width:w,height:h}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
  await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
  await p.evaluate(fixture); await p.waitForTimeout(700);
  for(const v of VIEWS){
    await p.evaluate(x=>{setView(x);window.scrollTo(0,0);},v); await p.waitForTimeout(450);
    const r=await p.evaluate(()=>{
      const de=document.documentElement;
      const over=[...document.querySelectorAll('.view.active *')].filter(el=>{
        const b=el.getBoundingClientRect();
        if(!(b.width>0&&b.right>de.clientWidth+2)) return false;
        /* content inside an overflow-x scroller is meant to run past the edge */
        for(let a=el.parentElement;a;a=a.parentElement){
          const o=getComputedStyle(a).overflowX; if(o==="auto"||o==="scroll") return false; }
        return true;})
        .slice(0,4).map(el=>el.tagName.toLowerCase()+'.'+(el.className&&el.className.split?el.className.split(' ')[0]:'')+' r='+Math.round(el.getBoundingClientRect().right));
      return {docW:de.scrollWidth, cliW:de.clientWidth, h:Math.round(document.querySelector('.view.active').getBoundingClientRect().height), over};});
    const flag=r.docW>r.cliW+1?` ⚠ hscroll ${r.docW}>${r.cliW}`:'';
    console.log(`${tag} ${v.padEnd(9)} viewH=${String(r.h).padStart(5)}${flag}${r.over.length?'  clipped: '+r.over.join(', '):''}`);
    await p.screenshot({path:`/home/claude/sw-${tag}-${v}.png`,fullPage:true});
  }
  if(errs.length)console.log(tag,'ERRORS',errs);
  await p.close();
}
await b.close();
