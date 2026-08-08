import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:1440,height:1400}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
await p.evaluate(()=>{db.recurring=[
  {id:"r1",name:"Rent",category:"Rent/Mortgage",amount:1450,dueDay:1,freq:"monthly"},
  {id:"r2",name:"Netflix",category:"Subscriptions",amount:23,dueDay:8,freq:"monthly"}];
  db.budgets={}; saveAll(); setView('budget');});
await p.waitForTimeout(800);
const row=async t=>{const r=await p.evaluate(()=>{const x=document.querySelector('#billsList .brow');
  return {name:x.querySelector('.bname').textContent.trim(), meta:x.querySelector('.bmeta').textContent.trim(),
    amt:x.querySelector('.bamt').textContent.trim(), pay:!!x.querySelector('[data-billpay]'),
    bar:x.parentElement.querySelector('.bprog')?Math.round(parseFloat(x.querySelector('.bprog')?.firstElementChild?.style.width||0)):null,
    paid:x.classList.contains('paid'), ticked:x.querySelector('.chk.on')?true:false};});
  console.log('  '+t.padEnd(28)+r.amt.padEnd(22)+'| '+r.meta.padEnd(52)+'| pay:'+r.pay+' ticked:'+r.ticked);};
console.log('RENT $1,450 — paying it in pieces:');
await row('untouched');
// first partial
await p.click('[data-billpay="r1"]'); await p.waitForTimeout(400);
console.log('\n  pay form prefills the remaining:', await p.$eval('#bp-amt',e=>e.value), '| hint:', await p.$eval('.bpanel .muted',e=>e.textContent.trim().slice(0,70)));
await p.fill('#bp-amt','500'); await p.click('[data-billpaysave="r1"]'); await p.waitForTimeout(700);
await row('after $500');
console.log('  progress bar:', await p.evaluate(()=>{const s=document.querySelector('#billsList .bprog span');return s?s.style.width:'none';}));
console.log('  transaction created:', await p.evaluate(()=>db.transactions.map(t=>t.date+' '+t.desc+' '+t.amount+' ref='+t.billRef.split('|').length+'parts')));
console.log('  counts as spending:', await p.evaluate(()=>fmt(monthTotals(budgetMonth).exp)));
// second partial — the form stays open after Apply, prefilled with the new remainder
console.log('\n  form stayed open, now prefills:', await p.$eval('#bp-amt',e=>e.value), '| button reads:', await p.$eval('[data-billpay="r1"]',e=>e.textContent.trim()));
await p.fill('#bp-amt','450'); await p.click('[data-billpaysave="r1"]'); await p.waitForTimeout(700);
await row('after +$450');
// history + undo
console.log('\n  payment history:', await p.$$eval('.bpanel tbody tr',e=>e.map(r=>r.children[0].textContent+' '+r.children[1].textContent)));
await p.click('.bpanel [data-billpaydel]'); await p.waitForTimeout(700);
await row('after removing one');
// final payment closes the form and ticks it
const rest=await p.$eval('#bp-amt',e=>e.value);
await p.click('[data-billpaysave="r1"]'); await p.waitForTimeout(700);
console.log('\n  paying the last '+rest+':');
await row('fully paid');
console.log('  form auto-closed:', await p.evaluate(()=>payBill===null), '| Pay button gone:', await p.evaluate(()=>!document.querySelector('[data-billpay="r1"]')));
console.log('  footer:', await p.$eval('#billsList .brow.sum',e=>e.textContent.trim().replace(/\s+/g,' ')));
console.log('  total spending logged:', await p.evaluate(()=>fmt(monthTotals(budgetMonth).exp)));
// untick removes every piece
await p.click('[data-billtog="r1"]'); await p.waitForTimeout(700);
console.log('\n  unticking clears all pieces:', await p.evaluate(()=>({txs:db.transactions.length,paidAmt:billPaidAmt(db.recurring[0],budgetMonth)})));
// tick on a partial tops it up
await p.click('[data-billpay="r1"]'); await p.waitForTimeout(400);
await p.fill('#bp-amt','200'); await p.click('[data-billpaysave="r1"]'); await p.waitForTimeout(700);
await p.click('[data-billtog="r1"]'); await p.waitForTimeout(700);
console.log('  $200 then tick -> tops up:', await p.evaluate(()=>({paid:billPaid(db.recurring[0],budgetMonth),
  amounts:db.transactions.filter(t=>t.billRef).map(t=>Math.abs(t.amount))})));
// Pay and editor are mutually exclusive
await p.click('[data-billpay="r2"]'); await p.waitForTimeout(400);
await p.click('[data-billedit="r2"]'); await p.waitForTimeout(400);
console.log('\n  opening the editor closes the pay form:', await p.evaluate(()=>({payBill,editBill})));
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
