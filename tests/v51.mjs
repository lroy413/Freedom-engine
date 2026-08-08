import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1200}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
await p.evaluate(()=>{
  db.income=[
    {id:"i1",name:"Ozark Law - AC",type:"Production",model:"daily",rate:350,units:5,payFreq:"biweekly",firstPay:"2026-06-05",start:"2026-05-20",end:"2026-10-01",extras:[]},
    {id:"i2",name:"Roommate",type:"Other",model:"monthly",amount:1517,payFreq:"monthly",firstPay:"2026-07-01",start:"2026-01-01",extras:[]}];
  db.settings.taxEnabled=false; db.settings.taxRate=22;
  saveAll(); setView('income');});
await p.waitForTimeout(600);
const snap=async t=>{const r=await p.evaluate(()=>({
  kpis:[...document.querySelectorAll('#incomeKpis .kpi')].map(x=>x.querySelector('.label').textContent+': '+x.querySelector('.val').textContent+' ('+x.querySelector('.sub').textContent+')'),
  proj:document.querySelector('#projBox .big').textContent,
  parts:[...document.querySelectorAll('#projBox tbody tr')].map(r=>r.textContent.trim().replace(/\s+/g,' ')),
  note:(document.getElementById('taxExemptNote')||{}).textContent,
  badges:[...document.querySelectorAll('#incomeList .tag')].map(x=>x.textContent),
  monthly:monthlyIncomeNet(), gross:monthlyIncomeEstimate()}));
  console.log('\n'+t); console.log(' ',r.kpis.join('\n  ')); console.log('  projected',r.proj,'|',r.parts.join(' / '));
  console.log('  toggle note:',JSON.stringify(r.note),'| badges:',r.badges.join(','));
  console.log('  monthly net',Math.round(r.monthly),'of gross',Math.round(r.gross));};
await snap('TAX OFF, nothing marked:');

// turn tax on
await p.click('#taxToggle'); await p.waitForTimeout(500);
await snap('TAX ON 22%, nothing marked (both taxed):');

// mark the roommate non-taxable
await p.click('[data-iedit="i2"]'); await p.waitForTimeout(400);
console.log('\ncheckbox present:', await p.evaluate(()=>!!document.getElementById('e-notax')));
await p.check('#e-notax'); await p.click('#e-save'); await p.waitForTimeout(600);
await snap('TAX ON, Roommate marked non-taxable:');
console.log('  stored flag:', await p.evaluate(()=>db.income.map(x=>x.name+'='+!!x.notax)));

// stream editor notes
for(const id of ['i2','i1']){
  await p.evaluate(x=>{if(document.getElementById('iedit-'+x).dataset.open!=='1')openIncomeEditor(x);},id);
  await p.waitForTimeout(400);
  const n=await p.evaluate(x=>{const e=document.querySelector('#iedit-'+x+' .note');return e?e.textContent.trim().replace(/\s+/g,' ').slice(0,130):'(none)';},id);
  console.log('  '+id+' editor note:', n);
  await p.evaluate(x=>openIncomeEditor(x),id); await p.waitForTimeout(250);
}

// downstream: dashboard + budget + coming up + forecast
await p.evaluate(()=>setView('dash')); await p.waitForTimeout(500);
console.log('\ndash income KPI:', await p.evaluate(()=>{const k=[...document.querySelectorAll('#kpiRow .kpi')].find(x=>/Income this month/.test(x.textContent));return k.querySelector('.val').textContent;}));
console.log('coming up:', await p.$$eval('#comingUp .upitem',e=>e.slice(0,4).map(x=>x.querySelector('.upname').textContent+' '+x.querySelector('.upamt').textContent)));
await p.evaluate(()=>setView('goals')); await p.waitForTimeout(500);
console.log('forecast note:', await p.evaluate(()=>{const n=document.querySelector('#forecastBox .note');return n?n.textContent.trim().replace(/\s+/g,' ').slice(0,150):'n/a';}));
await p.screenshot({path:'/home/claude/notax.png',fullPage:true});
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
