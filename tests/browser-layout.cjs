// Real-browser checks for the common studio layout and percussion navigation.
// Run with Playwright and BROWSER_EXECUTABLE; output is test evidence only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const source=fs.readFileSync('index.html'),output=path.resolve(process.env.BROWSER_OUTPUT||'docs/handoffs/ui-layout/screenshots');
const routes=[['xylophone','chooseXylophone','studioView','changeInstrumentBtn'],['recorder','chooseRecorder','studioView','changeInstrumentBtn'],['tamborin','chooseTamborin','tamborinView','percBack'],['kompang','chooseKompang','kompangView','kompBack'],['snare','chooseSnare','snareView','snareBack'],['bass_drum','chooseBassDrum','bass_drumView','bassBack'],['cymbals','chooseCymbals','cymbalsView','cymBack'],['triangle','chooseTriangle','triangleView','triBack']];
const prefixes={tamborin:'perc',kompang:'komp',snare:'snare',bass_drum:'bass',cymbals:'cym',triangle:'tri'};
const checks=[],errors=[],measurements=[];
const check=name=>{checks.push(name);console.log('PASS '+name);};
async function metrics(page,view){return page.locator('#'+view).evaluate(el=>{
 const get=s=>el.querySelector(s),box=node=>{const b=node.getBoundingClientRect();return{x:b.x,y:b.y+scrollY,width:b.width,height:b.height};};
 const panel=get('.instrument-panel'),inspector=get('.inspector'),transport=get('.transport'),settings=get('.settings-row');
 return{heading:box(get('.studio-heading')),font:getComputedStyle(get('h1')).fontSize,grid:getComputedStyle(get('.workspace')).gridTemplateColumns,panel:box(panel),inspector:box(inspector),radius:getComputedStyle(panel).borderRadius,transport:box(transport),settings:box(settings),overflow:document.documentElement.scrollWidth>innerWidth};
});}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(source);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port);
  for(const link of await page.locator('#instrumentChooser .chooser-family-nav a').all()){
   const target=await link.getAttribute('href');assert.match(target,/^#[\w-]+$/);await link.focus();await page.keyboard.press('Enter');assert.equal(await page.locator(target).evaluate(el=>el.matches(':focus')),true,'family navigation moves focus to its heading');
  }
  await page.locator('#instrumentChooser .chooser-foot a[href="#chooseHeading"]').click();assert.equal(await page.locator('#chooseHeading').evaluate(el=>el.matches(':focus')),true);
  for(const width of [1440,1050,850,540,390,320]){
   await page.setViewportSize({width,height:width<600?844:1080});let canonical;
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'chooser page overflow at '+width);
   for(const [name,choose,view,back]of routes){
    await page.locator('#'+choose).click();await page.evaluate(()=>scrollTo(0,0));const m=await metrics(page,view);measurements.push({width,instrument:name,...m});
    assert.equal(await page.locator('#'+view+' .studio-heading h1').evaluate(el=>el.matches(':focus')),true,name+' entry focuses its heading');
    assert.equal(m.overflow,false,name+' page overflow at '+width);
    if(!canonical)canonical=m;
    assert.ok(Number.parseFloat(m.font)>0,name+' heading has measurable text');assert.equal(m.font,canonical.font,name+' shared heading typography');
    assert.equal(m.grid,canonical.grid,name+' workspace columns');assert.equal(m.panel.x,canonical.panel.x);assert.equal(m.panel.width,canonical.panel.width);assert.equal(m.radius,canonical.radius);
    assert.equal(m.inspector.width,canonical.inspector.width);assert.equal(m.inspector.x,canonical.inspector.x);
    if(width>850){assert.equal(m.inspector.y,m.panel.y);assert.equal(m.panel.y,canonical.panel.y);}
    else assert.ok(m.inspector.y>m.panel.y+m.panel.height,name+' inspector stacks after work area');
    assert.ok(m.transport.y>m.panel.y);assert.ok(m.settings.y>m.transport.y+m.transport.height-1);
    if(prefixes[name]){
     const prefix=prefixes[name];
     assert.deepEqual(await page.locator('#'+view+' .transport button').evaluateAll(nodes=>nodes.map(n=>n.id)),[prefix+'Record',prefix+'Replay',prefix+'Stop']);
     assert.equal(await page.locator('#'+view+' .perc-data table').isVisible(),true);
     assert.equal(await page.locator('#'+view+' .perc-data h2').innerText(),'Data ketukan');
     assert.match((await page.locator('#'+prefix+'Back').innerText()).replace(/\s+/g,' '),/Tukar instrumen/);
     if(width===1440||width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,name+(width===1440?'-desktop.png':'-phone.png'))});await page.screenshot({path:path.join(output,name+(width===1440?'-desktop-full.png':'-phone-full.png')),fullPage:true});}
    }
    await page.locator('#'+back).click();assert.equal(await page.locator('#chooseHeading').isVisible(),true);assert.equal(await page.locator('#chooseHeading').evaluate(el=>el.matches(':focus')),true,name+' return focuses chooser heading');
   }
   check(width+'px: all eight studios share header type, columns, panel/inspector geometry and responsive flow; percussion transport/data are in place');
  }
  await page.setViewportSize({width:390,height:844});
  for(const [name,choose,view,back]of routes.slice(2)){
   const prefix=prefixes[name];await page.locator('#'+choose).click();
   const button=page.locator('#'+prefix+'Tap');await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await button.evaluate(el=>el.matches(':focus-visible')),true);
   await page.keyboard.press('Enter');await page.waitForTimeout(60);assert.match(await page.locator('#'+prefix+'Surface').getAttribute('class'),/is-tap/);
   await page.locator('#'+view+' .percussion-guide summary').tap();assert.equal(await page.locator('#'+view+' .percussion-guide').getAttribute('open'),'');assert.match(await page.locator('#'+view+' .percussion-guide').innerText(),/sintesis digital/);
   await page.emulateMedia({reducedMotion:'reduce'});await button.hover();assert.equal(await button.evaluate(el=>getComputedStyle(el).transform),'none');await page.emulateMedia({reducedMotion:'no-preference'});
   await page.locator('#'+back).click();
  }
  check('phone: action focus, Enter feedback, touch guide disclosure and reduced motion remain usable');
  assert.deepEqual(errors,[]);check('no uncaught browser errors across eight studios and six widths');
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({source_sha256:crypto.createHash('sha256').update(source).digest('hex'),browser:await browser.version(),passed:checks.length,checks,measurements,pageErrors:errors,limits:'Headless Chromium geometry and emulated touch; no physical-device, Safari/Firefox or screen-reader evaluation.'},null,2)+'\n');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),1000).unref();});
