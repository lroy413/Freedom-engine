import pkg from 'playwright';
const { chromium } = pkg;
const b = await chromium.launch();
const errs=[];
const p = await b.newPage({viewport:{width:1440,height:1000}});
p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
await p.goto('http://localhost:8899/index.html'); await p.waitForTimeout(700);
await p.evaluate(()=>{db.settings.theme='bushido';syncTheme();saveAll();}); await p.waitForTimeout(300);
await p.click('[data-go="data"]'); await p.waitForTimeout(400);
console.log('nav->settings root visible:', await p.evaluate(()=>!document.getElementById('setRoot').hidden));
// real click through each row and back
for(const id of ['appearance','bank','sync','market','cats','rules','backup','about','shortcuts']){
  await p.click(`[data-set="${id}"]`); await p.waitForTimeout(250);
  const t=await p.$eval('#setTitle',e=>e.textContent);
  await p.click('#setBack'); await p.waitForTimeout(200);
  const back=await p.evaluate(()=>!document.getElementById('setRoot').hidden && document.getElementById('setBack').hidden);
  console.log(`  click ${id.padEnd(11)} -> "${t}"  back-to-root:${back?'✓':'✗'}`);
}
// theme change from within pane updates the row value
await p.click('[data-set="appearance"]'); await p.waitForTimeout(250);
await p.click('[data-theme-btn="light"]'); await p.waitForTimeout(300);
await p.click('#setBack'); await p.waitForTimeout(250);
console.log('theme row after switching to Light:', await p.$eval('[data-set="appearance"] .setval',e=>e.textContent));
// add a category from the pane, check count updates
await p.click('[data-set="cats"]'); await p.waitForTimeout(250);
const before=await p.evaluate(()=>db.categories.length);
await p.fill('#newCat','Gear rental'); await p.click('#addCatBtn'); await p.waitForTimeout(400);
await p.click('#setBack'); await p.waitForTimeout(250);
console.log(`categories ${before} -> row shows`, await p.$eval('[data-set="cats"] .setval',e=>e.textContent));
await p.screenshot({path:'/home/claude/set-bushido.png'});
await p.evaluate(()=>{db.settings.theme='bushido';syncTheme();}); await p.waitForTimeout(200);
await p.screenshot({path:'/home/claude/set-bushido.png'});
console.log('ERRORS:',errs.length?errs:'none');
await b.close();
