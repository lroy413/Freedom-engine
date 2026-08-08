/* Guards the rot class that took out v47, v61 and v62: fixtures pinned to a
   calendar month go red once real time moves past them, which reads as an app
   bug and isn't. Runs the shared date logic under a fake clock at every month
   end, a leap day and a year boundary. Has real assertions and exits non-zero,
   so it belongs in a regression run alongside smoke.mjs. */
import pkg from 'playwright';
const {chromium}=pkg;
const b=await chromium.launch();
let pass=0,fail=0;
const chk=(n,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  if(!ok)console.log(`    FAIL ${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  ok?pass++:fail++;};

const DATES=['2026-01-31','2026-02-28','2026-03-31','2026-05-31','2026-08-31',
             '2026-10-31','2026-12-31','2027-02-28','2028-02-29','2026-07-01'];

for(const iso of DATES){
  const p=await b.newPage({viewport:{width:1440,height:1000}});
  await p.addInitScript(({y,m,d})=>{
    const R=Date, fixed=new R(y,m,d,12,0,0).getTime();
    class F extends R{constructor(...a){ a.length? super(...a) : super(fixed); }
      static now(){ return fixed; }}
    window.Date=F;
  },{y:+iso.slice(0,4),m:+iso.slice(5,7)-1,d:+iso.slice(8,10)});
  await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(500);

  const r=await p.evaluate(()=>{
    const relMonth=n=>{const d=dayOf(todayISO()); d.setDate(1); d.setMonth(d.getMonth()+n); return monthOf(d);};
    const rel=n=>{const d=dayOf(todayISO()); d.setDate(d.getDate()+n); return isoOf(d);};
    const today=dayOf(todayISO()).getDate();
    const months=[0,1,2,3,4,5,6,9].map(relMonth);

    // v47: ten bills, one per upcoming day — how many fall inside 14 days?
    const bills=Array.from({length:10},(_,i)=>({id:"r"+i,name:"B"+i,category:"Household",
      amount:50,dueDay:((today-1+i)%28)+1}));
    const horizon=dayOf(rel(14));
    const within=bills.filter(x=>dayOf(nextBillDate(x))<=horizon).length;

    // v61/v62: anchors relative to the current month
    const q={id:"q",name:"Water",amount:180,dueDay:20,freq:"quarterly",anchor:months[0]};
    const s={id:"s",name:"Ins",amount:1020,dueDay:15,freq:"semiannual",anchor:months[0]};
    const a3={id:"a",name:"Domain",amount:96,dueDay:9,freq:"annual",anchor:months[3]};
    return {today:todayISO(), months,
      dayOffsets:[rel(-1),rel(0),rel(1)],
      within,
      qDueNow:billDueIn(q,months[0]), qDueM3:billDueIn(q,months[3]), qDueM1:billDueIn(q,months[1]),
      sDueNow:billDueIn(s,months[0]), sDueM6:billDueIn(s,months[6]),
      aDueNow:billDueIn(a3,months[0]), aDueM3:billDueIn(a3,months[3])};
  });

  // months must be strictly sequential — the classic setMonth month-skip
  const step=(x,y)=>{const [ay,am]=x.split('-').map(Number),[by,bm]=y.split('-').map(Number);
    return (by*12+bm)-(ay*12+am);};
  const offs=[0,1,2,3,4,5,6,9];
  let seqOk=true;
  for(let i=1;i<r.months.length;i++) if(step(r.months[0],r.months[i])!==offs[i]) seqOk=false;

  console.log(`  ${iso}  today=${r.today}  months=${r.months[0]}..${r.months[7]}  upcoming≤14d=${r.within}`);
  chk(`${iso} month sequence`,seqOk,true);
  chk(`${iso} today matches fake clock`,r.today,iso);
  chk(`${iso} ≥6 bills inside the 14-day window`,r.within>=6,true);
  chk(`${iso} quarterly anchored to now is due now`,r.qDueNow,true);
  chk(`${iso} quarterly due again 3 months on`,r.qDueM3,true);
  chk(`${iso} quarterly NOT due next month`,r.qDueM1,false);
  chk(`${iso} semiannual anchored to now is due now`,r.sDueNow,true);
  chk(`${iso} semiannual due again 6 months on`,r.sDueM6,true);
  chk(`${iso} annual anchored +3 is NOT due now`,r.aDueNow,false);
  chk(`${iso} annual anchored +3 is due at +3`,r.aDueM3,true);
  await p.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
if(fail) process.exitCode=1;
