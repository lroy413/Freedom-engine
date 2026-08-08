import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1200}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);

console.log('WRITTEN AMOUNTS (the case that failed):');
console.log(await p.evaluate(()=>[
 "TWO THOUSAND THIRTY-NINE & 80/100 DOLLARS",
 "Two Thousand Thirty Nine and 80/100",
 "ONE THOUSAND FOUR HUNDRED FIFTY & 00/100 DOLLARS",
 "THREE THOUSAND FIVE HUNDRED & 25/100",
 "NINE HUNDRED SEVENTY-FIVE AND 50 CENTS",
 "TWELVE THOUSAND & 05/100",
 "SEVENTEEN & 99/100 DOLLARS",
 "no numbers here at all"
].map(x=>'  '+x.slice(0,50).padEnd(52)+'-> '+wordsToAmount(x)).join('\n')));

console.log('\nHIS CHECK (pdf.js flattens it to one line):');
const stub=`RECORDS Lucky 5 IV 225 OF MAIN STREET, FLOOR 2 DELHI, NY 13753 (212)-206-1099 (212)-206-1070 Phone : Fax : Pay Date 07/24/2026 Pay: TWO THOUSAND THIRTY-NINE & 80/100 DOLLARS Pay to the Order of: LAWRENCE ROY JR 925 Curry Cir CITY NATIONAL BANK 400 Park Avenue New York, NY 10002 01989414`;
console.log(await p.evaluate(t=>{const r=parseStub(t);
  return '  date='+r.date+'  net='+r.net+'  gross='+r.gross+'  spelled='+r.spelled+'  how='+JSON.stringify(r.how);},stub));

console.log('\nORDINARY STUBS:');
const cases=[
 ["labelled, one line","Employee LAWRENCE ROY Pay Date 07/24/2026 Gross Pay 2,625.00 Federal Tax 315.00 FICA 200.81 Net Pay 2,039.80"],
 ["multi-line","Pay Date: 07/24/2026\nGross Pay        $2,625.00\nDeductions       $585.20\nNet Pay          $2,039.80"],
 ["with YTD columns","Description Current YTD Gross Pay 2,625.00 18,375.00 Net Pay 2,039.80 14,278.60 Check Date 7/24/2026"],
 ["YTD label first","YTD Gross 18,375.00 Gross Pay 2,625.00 YTD Net 14,278.60 Net Pay 2,039.80 Pay date 07/24/26"],
 ["net before label","Pay Date 07/24/2026 2,039.80 Net Pay 2,625.00 Gross Pay"],
 ["direct deposit wording","Payment Date 07/24/2026 Total Earnings 2,625.00 Direct Deposit 2,039.80"],
 ["takehome + no gross","Check date 07/24/2026 Take Home 2,039.80"],
 ["nothing findable","Employer copy. Retain for your records. Employee ID 01989414"],
].map(c=>c);
for(const [name,txt] of cases){
  const r=await p.evaluate(t=>{const x=parseStub(t);return {d:x.date,n:x.net,g:x.gross,c:x.candidates.slice(0,4)};},txt);
  console.log('  '+name.padEnd(24)+'date='+String(r.d).padEnd(12)+'net='+String(r.n).padEnd(10)+'gross='+String(r.g).padEnd(10)+'candidates='+JSON.stringify(r.c));
}
console.log('\n  (correct answers: date 2026-07-24, net 2039.80, gross 2625.00)');

// end-to-end through the UI
await p.evaluate(()=>{db.income=[{id:"i1",name:"Gig",type:"Production",model:"daily",rate:350,units:5,payFreq:"biweekly",extras:[]}];saveAll();setView('income');});
await p.waitForTimeout(600);
await p.evaluate(()=>{const b=document.getElementById('stubToggle')||[...document.querySelectorAll('button')].find(x=>/stub/i.test(x.textContent)); if(b)b.click();});
await p.waitForTimeout(500);
await p.evaluate(t=>{const el=document.getElementById('stubText'); if(el)el.value=t;},stub);
await p.click('#stubRead'); await p.waitForTimeout(600);
console.log('\nUI after reading his check:');
console.log('  banner:', await p.$eval('#stubResult',e=>e.textContent.trim().replace(/\s+/g,' ')));
console.log('  form filled:', await p.evaluate(()=>({date:document.getElementById('pc-date').value,
  gross:document.getElementById('pc-gross').value, net:document.getElementById('pc-net').value})));
console.log('  candidate chips:', await p.$$eval('[data-stubpick]',e=>e.map(x=>x.textContent)));
// tapping a chip fills net then gross
const chips=await p.$$('[data-stubpick]');
if(chips.length){ await chips[0].click(); await p.waitForTimeout(200);
  console.log('  1st tap -> net:', await p.$eval('#pc-net',e=>e.value));
  await chips[0].click(); await p.waitForTimeout(200);
  console.log('  2nd tap -> gross:', await p.$eval('#pc-gross',e=>e.value)); }
// a clean stub should need no chips
await p.evaluate(()=>{document.getElementById('stubText').value="Pay Date 07/24/2026 Gross Pay 2,625.00 Net Pay 2,039.80";});
await p.click('#stubRead'); await p.waitForTimeout(500);
console.log('\nclean stub banner:', await p.$eval('#stubResult',e=>e.textContent.trim().replace(/\s+/g,' ')));
console.log('  no chips needed:', await p.$$eval('[data-stubpick]',e=>e.length));
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
