import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p=await b.newPage({viewport:{width:402,height:874}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(800);
const VIEWS=['accounts','income','expenses','budget','goals','credit','invest','data'];
for(const v of VIEWS){
  await p.evaluate(x=>{setView(x);window.scrollTo(0,0);},v); await p.waitForTimeout(300);
  const r=await p.evaluate(x=>{const sec=document.getElementById('view-'+x);
    const btn=sec.querySelector('.infobtn'), lead=sec.querySelector('p.lead'), h=sec.querySelector('h1.page');
    return {title:h?h.textContent:'—', hasBtn:!!btn, leadHidden:lead?lead.hidden:null,
      sameLine:btn&&h?Math.abs(btn.getBoundingClientRect().top-h.getBoundingClientRect().top)<28:null,
      topOfFirstCard:Math.round((sec.querySelector('.card,.grid,#onHandHero')||{getBoundingClientRect:()=>({top:0})}).getBoundingClientRect().top)};},v);
  console.log(`${v.padEnd(9)} "${r.title}" info=${r.hasBtn} leadHidden=${r.leadHidden} sameLine=${r.sameLine} contentStartsAt=${r.topOfFirstCard}px`);
}
// toggle behaviour
await p.evaluate(()=>setView('accounts')); await p.waitForTimeout(300);
const before=await p.evaluate(()=>Math.round(document.querySelector('#onHandHero').getBoundingClientRect().top));
await p.click('#view-accounts .infobtn'); await p.waitForTimeout(300);
const after=await p.evaluate(()=>({lead:!document.querySelector('#view-accounts p.lead').hidden,
  on:document.querySelector('#view-accounts .infobtn').classList.contains('on'),
  heroTop:Math.round(document.querySelector('#onHandHero').getBoundingClientRect().top)}));
console.log(`\ntap (i): lead shows=${after.lead} highlighted=${after.on} · hero moved ${before}px -> ${after.heroTop}px`);
await p.click('#view-accounts .infobtn'); await p.waitForTimeout(300);
console.log('tap again:', await p.evaluate(()=>document.querySelector('#view-accounts p.lead').hidden?'hidden again ✓':'✗'));
// settings pane leads still work
await p.evaluate(()=>{setView('data');openSetting('bank');}); await p.waitForTimeout(400);
console.log('\nsettings pane title:', await p.$eval('#setTitle',e=>e.textContent),
  '| lead hidden:', await p.evaluate(()=>document.getElementById('setLead').hidden));
await p.click('#view-data .infobtn'); await p.waitForTimeout(300);
console.log('settings (i) reveals:', await p.$eval('#setLead',e=>e.textContent));
await p.evaluate(()=>closeSetting()); await p.waitForTimeout(300);
console.log('after back, lead text:', await p.$eval('#setLead',e=>e.textContent.slice(0,40)+'…'));
await p.evaluate(()=>{setView('accounts');}); await p.waitForTimeout(400);
await p.screenshot({path:'/home/claude/info-m.png'});
console.log('\noverflow:',await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth));
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
