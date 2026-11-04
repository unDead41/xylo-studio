const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const view=()=>html.match(/<section id="kompangView"[\s\S]*?(?=\n<\/main>)/)?.[0]||'';

test('four enabled instrument cards retain real routes, categories and Buka studio actions',()=>{
 for(const id of ['chooseXylophone','chooseRecorder','chooseTamborin','chooseKompang']){
  const button=html.match(new RegExp('<button[^>]*id="'+id+'"[\\s\\S]*?</button>'))?.[0];
  assert.ok(button,id);assert.doesNotMatch(button.slice(0,button.indexOf('>')),/\bdisabled\b/);
  assert.match(button,/Buka studio/);assert.match(button,/(?:choice-art|recorderPreview)/);
 }
 for(const id of ['chooseTamborin','chooseKompang'])assert.match(html.match(new RegExp('<button[^>]*id="'+id+'"[\\s\\S]*?</button>'))[0],/Cadangan baharu/);
 assert.match(html,/Empat instrumen/);
});

test('Kompang exposes two separate focusable SVG hit regions on one unpitched membrane',()=>{
 const s=view();assert.match(s,/Studio Kompang/);assert.match(s,/<div id="kompSurface"/);
 for(const [id,action,label]of [['kompCenter','center','tengah'],['kompEdge','edge','tepi']]){
  const tag=s.match(new RegExp('<g[^>]*id="'+id+'"[^>]*>'))?.[0]||'';
  assert.match(tag,/role="button"/);assert.match(tag,/tabindex="0"/);assert.match(tag,new RegExp('data-action="'+action+'"'));assert.match(tag,new RegExp('aria-label="Ketuk '+label));
 }
 assert.match(s,/fill-rule="evenodd"/);assert.match(s,/komp-center-feedback/);assert.match(s,/komp-edge-feedback/);
 assert.doesNotMatch(s,/tambMetal|kepingan logam|data-midi|recorder-pad|penjarian/i);
 assert.match(s,/sintesis digital/i);assert.match(s,/Perkusi tidak berpic/);
});

test('Kompang markup supplies every control required by the reused percussion controller',()=>{
 const s=view();
 for(const id of ['Back','Surface','Tap','Shake','Feedback','Example','Record','Stop','Reset','Pattern','Tempo','TempoValue','TempoHint','Metro','BeatDots','Status','Trace','TraceCount','Rows','Title','Count','Duration','Bpm','Empty','RecordBadge','Replay','ExportJson','ExportCsv','Save','ImportText','ImportBtn','ImportError'])assert.match(s,new RegExp('id="komp'+id+'"'),id);
 for(const id of ['ReplaceDialog','ConfirmRecord','CancelRecord'])assert.match(html,new RegExp('id="komp'+id+'"'),id);
 assert.match(s,/Ketuk tengah<\/span><kbd>F/);assert.match(s,/Ketuk tepi<\/span><kbd>J/);
 assert.match(s,/Belum ada ketukan/);assert.match(s,/Belum dirakam/);assert.match(s,/Reset mengekalkan rakaman dan suntingan/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'all IDs are unique');
});

test('thin Kompang configuration delegates transport to the shared Studio and supplies own actions and patterns',()=>{
 const source=html.match(/<script id="kompang-ui">([\s\S]*?)<\/script>/)?.[1];assert.ok(source);
 let config;const voice=()=>{};const box={window:{PercussionAudio:{kompang:voice},PercussionStudio:{createStudio(c){config=c;return{};}}}};
 vm.runInNewContext(source,box);assert.equal(config.instrument,'kompang');assert.equal(config.prefix,'komp');assert.equal(config.voice,voice);
 assert.equal(config.shortcuts.F,'center');assert.equal(config.shortcuts.J,'edge');assert.equal(config.labels.center,'Tengah');assert.equal(config.labels.edge,'Tepi');
 assert.deepEqual(JSON.parse(JSON.stringify(config.surfaces)),[{id:'kompCenter',action:'center'},{id:'kompEdge',action:'edge'}]);
 const unique=new Set();for(const kind of ['basic','alternate','offbeat','march']){
  const chart=config.patternEvents({bpm:80,kind});assert.ok(chart.durationMs>0);assert.ok(chart.events.length>=8);assert.ok(chart.events.every(e=>['center','edge'].includes(e.action)&&e.at_ms>=0));unique.add(JSON.stringify(chart.events));
 }assert.equal(unique.size,4,'four genuinely different examples');
 assert.match(html,/\.kompang-surface\.is-tap \.komp-center-feedback/);assert.match(html,/\.kompang-surface\.is-shake \.komp-edge-feedback/);
});
