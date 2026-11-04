const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {studio}=require('./helpers/studio.cjs');
const html=fs.readFileSync('index.html','utf8');
const LANGUAGE_KEY='e-instru-language';

// Execute the shipped inline translator against a small DOM boundary, not a
// duplicate translation implementation. Mutations are queued and drained with a
// bound so an observer which reacts forever to its own writes fails this suite.
// These host tests do not measure browser rendering, sound or assistive software.
function translatedDOM({storage={},readError=false,writeError=false,storageGetterError=false,before=()=>{}}={}){
 const tasks=[],observers=new Set(),saved=new Map(Object.entries(storage)),writes=[];
 const stats={domWrites:0,observerDeliveries:0};let timer=0;
 const enqueue=fn=>tasks.push(fn),listeners=new WeakMap();
 function eventTarget(target){
  target.addEventListener=(type,fn)=>{let events=listeners.get(target);if(!events)listeners.set(target,events=new Map());if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
  target.removeEventListener=(type,fn)=>{const fns=listeners.get(target)?.get(type);if(fns)listeners.get(target).set(type,fns.filter(f=>f!==fn));};
  target.dispatchEvent=event=>{if(!event.target)event.target=target;for(const fn of listeners.get(target)?.get(event.type)||[])fn.call(target,event);return !event.defaultPrevented;};
 }
 function mutation(record){
  stats.domWrites++;
  for(const observer of observers){
   const interested=observer.targets.some(({target,options})=>{
    if(target!==record.target&&!(options.subtree&&target.contains(record.target)))return false;
    if(!options[record.type])return false;
    return record.type!=='attributes'||!options.attributeFilter||options.attributeFilter.includes(record.attributeName);
   });
   if(!interested)continue;
   observer.records.push(record);
   if(observer.queued)continue;
   observer.queued=true;enqueue(()=>{observer.queued=false;const records=observer.takeRecords();if(records.length){stats.observerDeliveries++;observer.callback(records,observer);}});
  }
 }
 class DOMNode{
  static ELEMENT_NODE=1;static TEXT_NODE=3;static DOCUMENT_NODE=9;
  constructor(type,name){this.nodeType=type;this.nodeName=name;this.parentNode=null;this.childNodes=[];eventTarget(this);}
  get ownerDocument(){return document;}
  get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get firstChild(){return this.childNodes[0]||null;}
  get lastChild(){return this.childNodes.at(-1)||null;}
  get nextSibling(){return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this)+1]||null;}
  get previousSibling(){return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this)-1]||null;}
  get isConnected(){return this===document||document.contains(this);}
  contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
  appendChild(node){if(node.parentNode)node.parentNode.removeChild(node);this.childNodes.push(node);node.parentNode=this;mutation({type:'childList',target:this,addedNodes:[node],removedNodes:[]});return node;}
  append(...nodes){for(const node of nodes)this.appendChild(typeof node==='string'?new DOMText(node):node);}
  removeChild(node){const i=this.childNodes.indexOf(node);assert.notEqual(i,-1);this.childNodes.splice(i,1);node.parentNode=null;mutation({type:'childList',target:this,addedNodes:[],removedNodes:[node]});return node;}
  replaceChildren(...nodes){const removedNodes=this.childNodes;for(const node of removedNodes)node.parentNode=null;this.childNodes=[];for(const node of nodes){const n=typeof node==='string'?new DOMText(node):node;n.parentNode=this;this.childNodes.push(n);}mutation({type:'childList',target:this,addedNodes:this.childNodes,removedNodes});}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set textContent(value){this.replaceChildren(...(String(value)?[new DOMText(String(value))]:[]));}
 }
 class DOMText extends DOMNode{
  constructor(value){super(3,'#text');this._data=String(value);}
  get data(){return this._data;}
  set data(value){const oldValue=this._data;this._data=String(value);mutation({type:'characterData',target:this,oldValue});}
  get nodeValue(){return this.data;}set nodeValue(value){this.data=value;}
  get textContent(){return this.data;}set textContent(value){this.data=value;}
 }
 function matches(element,selector){
  return selector.split(',').some(part=>{
   part=part.trim();if(part==='*')return true;
   const pattern=part.match(/^(?:([\w-]+)|\*)?(?:#([\w-]+))?(?:\.([\w-]+))?(?:\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\])?$/);
   if(!pattern)throw Error('Unsupported test selector: '+part);
   const [,tag,id,cls,attr,value]=pattern;
   return(!tag||element.tagName===tag.toUpperCase())&&(!id||element.id===id)&&(!cls||element.className.split(/\s+/).includes(cls))&&(!attr||element.hasAttribute(attr)&&(value===undefined||element.getAttribute(attr)===value));
  });
 }
 class DOMElement extends DOMNode{
  constructor(tag){super(1,tag.toUpperCase());this.tagName=this.nodeName;this._attrs=new Map();this.value='';this.disabled=false;this.hidden=false;this.checked=false;this.scrollTop=0;this.scrollLeft=0;this.style={};}
  get attributes(){return[...this._attrs].map(([name,value])=>({name,value}));}
  getAttributeNames(){return[...this._attrs.keys()];}
  getAttribute(name){return this._attrs.get(name)??null;}
  hasAttribute(name){return this._attrs.has(name);}
  setAttribute(name,value){const oldValue=this.getAttribute(name);this._attrs.set(name,String(value));mutation({type:'attributes',target:this,attributeName:name,oldValue});}
  removeAttribute(name){if(this._attrs.has(name)){const oldValue=this.getAttribute(name);this._attrs.delete(name);mutation({type:'attributes',target:this,attributeName:name,oldValue});}}
  get id(){return this.getAttribute('id')||'';}set id(value){this.setAttribute('id',value);}
  get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
  get lang(){return this.getAttribute('lang')||'';}set lang(value){this.setAttribute('lang',value);}
  get title(){return this.getAttribute('title')||'';}set title(value){this.setAttribute('title',value);}
  get dataset(){return Object.fromEntries([...this._attrs].filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));}
  matches(selector){return matches(this,selector);}
  closest(selector){for(let node=this;node?.nodeType===1;node=node.parentElement)if(matches(node,selector))return node;return null;}
  querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children){if(matches(child,selector))found.push(child);visit(child);}};visit(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){document.activeElement=this;}
 }
 class Observer{
  constructor(callback){this.callback=callback;this.targets=[];this.records=[];this.queued=false;observers.add(this);}
  observe(target,options){assert.ok(target,'MutationObserver needs a real target');this.targets.push({target,options});}
  takeRecords(){const records=this.records;this.records=[];return records;}
  disconnect(){this.targets=[];this.records=[];}
 }
 const document=new DOMNode(9,'#document');document.readyState='complete';document.hidden=false;
 document.documentElement=new DOMElement('html');document.documentElement.lang='ms';document.appendChild(document.documentElement);
 document.head=new DOMElement('head');document.body=new DOMElement('body');document.documentElement.append(document.head,document.body);
 document.createElement=tag=>new DOMElement(tag);document.createElementNS=(_,tag)=>new DOMElement(tag);document.createTextNode=value=>new DOMText(value);
 document.getElementById=id=>document.documentElement.querySelectorAll('*').find(el=>el.id===id)||null;
 document.querySelectorAll=selector=>[...(matches(document.documentElement,selector)?[document.documentElement]:[]),...document.documentElement.querySelectorAll(selector)];
 document.querySelector=selector=>document.querySelectorAll(selector)[0]||null;
 const NodeFilter={SHOW_ALL:0xFFFFFFFF,SHOW_ELEMENT:1,SHOW_TEXT:4,FILTER_ACCEPT:1,FILTER_REJECT:2,FILTER_SKIP:3};
 document.createTreeWalker=(root,whatToShow=NodeFilter.SHOW_ALL,filter)=>{
  const nodes=[];const visit=node=>{for(const child of node.childNodes){const shown=whatToShow&(1<<(child.nodeType-1)),decision=shown?(typeof filter==='function'?filter(child):filter?.acceptNode?.(child)??1):3;if(shown&&decision===1)nodes.push(child);if(decision!==2)visit(child);}};visit(root);let index=-1;
  return{currentNode:root,nextNode(){return nodes[++index]||null;}};
 };
 document.createNodeIterator=document.createTreeWalker;
 const create=(tag,attrs={},text)=>{const el=document.createElement(tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;return el;};
 const title=create('title',{},'e-Instru Studio — Pilih instrumen anda');document.head.append(title);
 Object.defineProperty(document,'title',{get:()=>title.textContent,set:value=>{title.textContent=value;}});
 const select=create('select',{id:'languageSelect','aria-label':'Bahasa / Language'});
 for(const [value,label]of [['ms','Bahasa Melayu'],['en','English']]){const option=create('option',{value},label);option.value=value;select.append(option);}select.value='ms';document.body.append(select);
 const localStorage={getItem(key){if(readError)throw Error('Storage read unavailable');return saved.get(key)??null;},setItem(key,value){if(writeError)throw Error('Storage write unavailable');writes.push([key,String(value)]);saved.set(key,String(value));}};
 const window={document,Node:DOMNode,NodeFilter,MutationObserver:Observer};eventTarget(window);window.window=window;document.defaultView=window;
 const timers=new Map();const setTimeout=fn=>{const id=++timer;timers.set(id,fn);enqueue(()=>{if(timers.delete(id))fn();});return id;};
 class Event{constructor(type,options={}){this.type=type;Object.assign(this,options);this.defaultPrevented=false;}preventDefault(){this.defaultPrevented=true;}}
 const box={window,document,Node:DOMNode,NodeFilter,MutationObserver:Observer,Event,CustomEvent:Event,queueMicrotask:enqueue,setTimeout,clearTimeout:id=>timers.delete(id),console,navigator:{language:'ms-MY'}};
 for(const target of [window,box])Object.defineProperty(target,'localStorage',{get(){if(storageGetterError)throw Error('Storage access unavailable');return localStorage;}});
 Object.assign(window,{Event,CustomEvent:Event,queueMicrotask:enqueue,setTimeout,clearTimeout:box.clearTimeout});
 before({document,create,select,window});
 const source=html.match(/<script\s+id="studio-i18n"[^>]*>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(source,'The distributed HTML must contain the real studio-i18n script');
 vm.runInNewContext(source,box,{filename:'index.html:studio-i18n'});
 assert.ok(window.StudioI18n,'The shipped translator must publish StudioI18n');
 const flush=async()=>{let count=0;for(;;){while(tasks.length){assert.ok(++count<=250,'Translation observer did not settle after 250 queued deliveries');tasks.shift()();}await Promise.resolve();if(!tasks.length)break;}return count;};
 return{document,create,select,window,api:window.StudioI18n,saved,writes,stats,flush,Event};
}

function english(api,source){const value=api.t(source,'en');assert.equal(typeof value,'string');assert.ok(value.trim(),'Empty English translation for '+source);assert.notEqual(value,source,'Missing English translation for '+source);return value;}

test('the standalone document initializes translation before any instrument controller and exposes a native language selector',()=>{
 assert.equal((html.match(/<script\s+id="studio-i18n"/g)||[]).length,1);
 assert.ok(html.indexOf('<script id="studio-i18n"')<html.indexOf('<script id="xylo-core"'));
 assert.match(html,/<select\b[^>]*id="languageSelect"/);
 const selector=html.match(/<select\b[^>]*id="languageSelect"[^>]*>([\s\S]*?)<\/select>/)?.[1]||'';
 for(const value of ['ms','en'])assert.match(selector,new RegExp('<option\\b[^>]*value="'+value+'"'));
 assert.doesNotMatch(html,/<script\b[^>]*\bsrc=/);
});

test('dictionary covers distinct chooser, studio, percussion, game, dialog and error surfaces with safe source fallback',()=>{
 const {api}=translatedDOM();
 const sources=['Pilih instrumen anda','Tukar instrumen','Permainan','Buka studio','Dram Sisi','Dram Bes','Simbal','Segi Tiga','Corak rentak','Data ketukan','Rakam','Main rakaman','Henti','Tengah','Tepi','Goncang','Rakaman sendiri','Kata laluan eksport','Kata laluan salah. Cuba lagi.','Batal','Mula permainan','Empat lorong. Satu melodi.'];
 for(const source of sources){assert.ok(html.includes(source),'Stale coverage probe: '+source);english(api,source);assert.equal(api.t(source,'ms'),source);}
 for(const source of ['C5','JSON','BPM','A S D F','A user title containing Rakam, 743.5 ms'])assert.equal(api.t(source,'en'),source,'Unknown or technical text must stay intact');
 assert.equal(api.language,'ms','Formatting a message for another language must not change the selected language');
});

test('every shipped exact translation is reachable and template fields are complete in both languages',()=>{
 const corpus=html.match(/const entries = (\[[\s\S]*?\]);\s*const templates = (\[[\s\S]*?\]);/);assert.ok(corpus,'Inline dictionary arrays must remain inspectable');
 const entries=JSON.parse(corpus[1]),templates=JSON.parse(corpus[2]),{api}=translatedDOM(),seen=new Set();assert.ok(entries.length);assert.ok(templates.length);
 for(const pair of entries){assert.ok(Array.isArray(pair)&&pair.length===2);const [ms,en]=pair;for(const value of pair)assert.ok(typeof value==='string'&&value.trim(),'Empty or malformed dictionary phrase');assert.ok(!seen.has(ms),'Ambiguous duplicate BM phrase: '+ms);seen.add(ms);assert.equal(api.t(ms,'en'),en,'Unreachable English dictionary entry: '+ms);}
 const fields=phrase=>[...new Set([...phrase.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(match=>match[1]))].sort();
 for(const template of templates){assert.ok(typeof template.ms==='string'&&template.ms.trim());assert.ok(typeof template.en==='string'&&template.en.trim());const names=fields(template.ms);assert.deepEqual(names,fields(template.en),'Missing template field: '+template.ms);for(const name of template.translate||[])assert.ok(names.includes(name),'Unknown translated capture '+name+': '+template.ms);}
});

test('BM is the default, saved English restores after reload and unrelated recordings remain byte-for-byte unchanged',async()=>{
 const evidence='{"take":{"title":"Rakam","raw_capture":[{"raw_ms":743.5,"midi":72}]}}';
 const original={'xylo-studio-v2':evidence,'e-instru-percussion-v1:triangle':'{"title":"Corak rentak","events":[]}'};
 const s=translatedDOM({storage:original});await s.flush();assert.equal(s.api.language,'ms');assert.equal(s.document.documentElement.lang,'ms');assert.equal(s.select.value,'ms');
 s.api.setLanguage('en');await s.flush();assert.equal(s.api.language,'en');assert.equal(s.document.documentElement.lang,'en');assert.equal(s.select.value,'en');assert.equal(s.saved.get(LANGUAGE_KEY),'en');
 for(const [key,value]of Object.entries(original))assert.equal(s.saved.get(key),value);
 assert.ok(s.writes.every(([key])=>key===LANGUAGE_KEY),'A language change must write only the language preference');
 const reloaded=translatedDOM({storage:Object.fromEntries(s.saved)});await reloaded.flush();assert.equal(reloaded.api.language,'en');assert.equal(reloaded.select.value,'en');assert.equal(reloaded.document.documentElement.lang,'en');assert.notEqual(reloaded.document.title,'e-Instru Studio — Pilih instrumen anda');
});

test('invalid saved preferences fall back to BM and denied storage still permits an in-memory language switch',async()=>{
 for(const preference of ['fr','__proto__','{"language":"en"}','null']){const s=translatedDOM({storage:{[LANGUAGE_KEY]:preference}});await s.flush();assert.equal(s.api.language,'ms',preference);assert.equal(s.select.value,'ms');}
 for(const failure of [{readError:true},{writeError:true},{storageGetterError:true}]){const s=translatedDOM(failure);await s.flush();assert.equal(s.api.language,'ms');assert.doesNotThrow(()=>s.api.setLanguage('en'));await s.flush();assert.equal(s.api.language,'en');assert.equal(s.select.value,'en');s.api.setLanguage('ms');await s.flush();assert.equal(s.document.documentElement.lang,'ms');}
});

test('native selector changes translate nested text, SVG descriptions, document title and accessible attributes without replacing controls',async()=>{
 let button,label,icon,svgTitle,svgDesc,input;
 const s=translatedDOM({before({document,create}){
  button=create('button',{id:'chooseXylophone','aria-label':'Pilih Xylophone',title:'Tukar instrumen','aria-pressed':'true','data-action':'tap'});button.disabled=true;button.scrollTop=37;
  icon=create('svg',{'aria-hidden':'true'});label=create('span',{},'Tukar instrumen');button.append(icon,label);document.body.append(button);
  svgTitle=create('title',{},'Dram Sisi interaktif');svgDesc=create('desc',{},'Sentuh kulit di tengah atau gelang rim. F = kulit · J = rim. Tab dan Enter atau Ruang juga boleh digunakan.');icon.append(svgTitle,svgDesc);
  input=create('input',{placeholder:'Kata laluan'});input.value='Kata laluan';document.body.append(input);
 }});
 let clicks=0;button.addEventListener('click',()=>clicks++);label.focus();s.select.value='en';s.select.dispatchEvent(new s.Event('change'));await s.flush();
 assert.equal(label.textContent,english(s.api,'Tukar instrumen'));assert.equal(button.getAttribute('aria-label'),english(s.api,'Pilih Xylophone'));assert.equal(button.title,english(s.api,'Tukar instrumen'));
 assert.equal(svgTitle.textContent,english(s.api,'Dram Sisi interaktif'));assert.equal(svgDesc.textContent,english(s.api,'Sentuh kulit di tengah atau gelang rim. F = kulit · J = rim. Tab dan Enter atau Ruang juga boleh digunakan.'));assert.equal(input.getAttribute('placeholder'),english(s.api,'Kata laluan'));
 assert.equal(s.document.getElementById('chooseXylophone'),button);assert.equal(button.children[0],icon);assert.equal(button.children[1],label);assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(button.getAttribute('data-action'),'tap');assert.equal(button.scrollTop,37);assert.equal(s.document.activeElement,label);assert.equal(input.value,'Kata laluan');button.dispatchEvent(new s.Event('click'));assert.equal(clicks,1);
 s.select.value='ms';s.select.dispatchEvent(new s.Event('change'));await s.flush();assert.equal(label.textContent,'Tukar instrumen');assert.equal(button.getAttribute('aria-label'),'Pilih Xylophone');assert.equal(input.getAttribute('placeholder'),'Kata laluan');assert.equal(s.document.title,'e-Instru Studio — Pilih instrumen anda');
});

test('runtime application writes and inserted controls translate once, then reverse to the newest source rather than stale text',async()=>{
 const s=translatedDOM();s.api.setLanguage('en');await s.flush();
 const status=s.create('span',{},'Rakam'),edit=s.create('button',{'aria-label':'Sunting not 12: C5'},'Tukar instrumen');s.document.body.append(status,edit);await s.flush();
 assert.equal(status.textContent,english(s.api,'Rakam'));const accessible=english(s.api,'Sunting not 12: C5');assert.equal(edit.getAttribute('aria-label'),accessible);assert.match(accessible,/12: C5/);
 status.firstChild.data='Henti';edit.setAttribute('aria-label','Sunting not 37: D5');await s.flush();assert.equal(status.textContent,english(s.api,'Henti'));assert.equal(edit.getAttribute('aria-label'),english(s.api,'Sunting not 37: D5'));
 s.api.setLanguage('ms');await s.flush();assert.equal(status.textContent,'Henti');assert.equal(edit.getAttribute('aria-label'),'Sunting not 37: D5');
});

test('anchored message templates retain numbers and translate instrument labels without replacing substrings of arbitrary text',()=>{
 const {api}=translatedDOM();
 const numbered=english(api,'Sunting not 743');assert.match(numbered,/743/);
 const source='Dengar tengah 7 pada 0.743 saat',labelled=english(api,source);assert.ok(labelled.includes(english(api,'tengah')));assert.match(labelled,/7.*0\.743/);
 for(const label of ['Dram Sisi','hentakan kulit']){const multiword=english(api,'Dengar '+label+' 7 pada 2.500 saat');assert.ok(multiword.includes(english(api,label)),'Keep the whole multiword label in its capture: '+label);assert.match(multiword,/7.*2\.500/);}
 for(const source of ['Ijamm: Sunting not 743 is my title','Sunting not 743 extra user text','Dengar tengah 7 pada 0.743 saat extra user text','{"title":"Rakam","raw_ms":743.5}','my-tap-shake-center-edge'])assert.equal(api.t(source,'en'),source,'Template must match the entire UI message');
});

test('language changes preserve editable values and imported/exported evidence even when values equal dictionary phrases',async()=>{
 const evidence='{"title":"Rakam","instrument_id":"recorder","events":[{"midi":72,"onset_tick":0}],"raw_capture":[{"raw_ms":743.5,"release_ms":1000}]}';
 let title,draft,importText,exportText,action,script,style;
 const s=translatedDOM({before({document,create}){
  title=create('input',{id:'takeTitle'});title.value='Rakam';importText=create('textarea',{id:'percImportText'},evidence);importText.value=evidence;exportText=create('textarea',{id:'exportText'},evidence);exportText.value=evidence;
  draft=create('textarea',{},'Rakam');draft.value='Rakam';
  action=create('select',{'data-action':'center'});action.value='center';const option=create('option',{value:'center'},'Tengah');option.value='center';action.append(option);
  script=create('script',{},'Rakam');style=create('style',{},'Rakam');document.body.append(title,draft,importText,exportText,action,script,style);
 }});
 for(const lang of ['en','ms','en','ms']){s.api.setLanguage(lang);await s.flush();assert.equal(title.value,'Rakam');assert.equal(draft.value,'Rakam');assert.equal(draft.textContent,'Rakam');assert.equal(importText.value,evidence);assert.equal(importText.textContent,evidence);assert.equal(exportText.value,evidence);assert.equal(exportText.textContent,evidence);assert.equal(action.value,'center');assert.equal(action.firstChild.value,'center');assert.equal(action.getAttribute('data-action'),'center');assert.equal(script.textContent,'Rakam');assert.equal(style.textContent,'Rakam');}
});

test('repeated refreshes and reverse toggles settle without self-observer feedback or duplicate control listeners',async()=>{
 const s=translatedDOM();const button=s.create('button',{'aria-label':'Sunting not 8'},'Rakam');s.document.body.append(button);await s.flush();
 let changes=0;if(s.api.onChange)s.api.onChange(()=>changes++);await s.flush();const initialChanges=changes;
 for(let i=0;i<12;i++){s.api.setLanguage('en');await s.flush();s.api.refresh(s.document.body);await s.flush();s.api.setLanguage('ms');await s.flush();}
 assert.equal(button.textContent,'Rakam');assert.equal(button.getAttribute('aria-label'),'Sunting not 8');const writes=s.stats.domWrites,deliveries=s.stats.observerDeliveries;
 await s.flush();assert.equal(s.stats.domWrites,writes,'An idle translator must not continue mutating its own output');assert.equal(s.stats.observerDeliveries,deliveries);
 if(s.api.onChange)assert.equal(changes,initialChanges+24,'Refresh must not emit a new language selection');
});

test('storage events synchronize other tabs without writing back or reacting to another key or storage area',async()=>{
 let label;const evidence='{"title":"Rakam","raw_capture":[{"raw_ms":743.5}]}';
 const s=translatedDOM({storage:{[LANGUAGE_KEY]:'ms','xylo-studio-v2':evidence},before({document,create}){label=create('span',{},'Rakam');document.body.append(label);}});await s.flush();const writes=s.writes.length;
 for(const event of [{key:'xylo-studio-v2',newValue:'en'},{key:LANGUAGE_KEY,newValue:'en',storageArea:{}}]){s.window.dispatchEvent(new s.Event('storage',event));await s.flush();assert.equal(s.api.language,'ms');assert.equal(label.textContent,'Rakam');}
 s.window.dispatchEvent(new s.Event('storage',{key:LANGUAGE_KEY,newValue:'en'}));await s.flush();assert.equal(s.api.language,'en');assert.equal(s.select.value,'en');assert.equal(label.textContent,english(s.api,'Rakam'));assert.equal(s.document.documentElement.lang,'en');
 s.window.dispatchEvent(new s.Event('storage',{key:LANGUAGE_KEY,newValue:'invalid'}));await s.flush();assert.equal(s.api.language,'ms');assert.equal(label.textContent,'Rakam');
 s.window.dispatchEvent(new s.Event('storage',{key:LANGUAGE_KEY,newValue:'en'}));await s.flush();s.window.dispatchEvent(new s.Event('storage',{key:null,newValue:null}));await s.flush();assert.equal(s.api.language,'ms','Clearing the preference in another tab restores BM');assert.equal(s.writes.length,writes,'A storage notification must not echo a new write');assert.equal(s.saved.get('xylo-studio-v2'),evidence);
});

test('fresh document titles derived from English instrument headings reverse correctly for all eight studios',async()=>{
 const s=translatedDOM({storage:{[LANGUAGE_KEY]:'en'}});await s.flush();
 for(const name of ['Xylophone','Rekoder Soprano','Tamborin','Kompang','Dram Sisi','Dram Bes','Simbal','Segi Tiga']){
  s.api.setLanguage('en');await s.flush();const title=s.api.t(name,'en')+' · e-Instru Studio';s.document.title=title;await s.flush();assert.equal(s.document.title,title);
  s.api.setLanguage('ms');await s.flush();assert.equal(s.document.title,name+' · e-Instru Studio','Fresh English-derived title: '+name);
 }
});

test('explicit custom-content guards protect literal text and ARIA labels and can be removed to resume translation',async()=>{
 let guarded,nested,editable;
 const s=translatedDOM({before({document,create}){guarded=create('section',{'data-i18n-ignore':'',title:'Tukar instrumen'});nested=create('span',{'aria-label':'Kata laluan'},'Rakam');guarded.append(nested);editable=create('div',{},'Rakam');editable.isContentEditable=true;document.body.append(guarded,editable);}});
 s.api.setLanguage('en');await s.flush();assert.equal(nested.textContent,'Rakam');assert.equal(nested.getAttribute('aria-label'),'Kata laluan');assert.equal(guarded.title,'Tukar instrumen');assert.equal(editable.textContent,'Rakam');
 nested.firstChild.data='Tengah';await s.flush();assert.equal(nested.textContent,'Tengah');guarded.removeAttribute('data-i18n-ignore');await s.flush();assert.equal(nested.textContent,english(s.api,'Tengah'));assert.equal(nested.getAttribute('aria-label'),english(s.api,'Kata laluan'));
 guarded.setAttribute('data-i18n-ignore','');nested.firstChild.data='Goncang';await s.flush();s.api.setLanguage('ms');await s.flush();assert.equal(nested.textContent,'Goncang');assert.equal(editable.textContent,'Rakam');
});

test('real Studio owners mark imported custom arrangement and section labels literal while preserving catalog localization',()=>{
 const base=studio({variant:null}),canonical=JSON.parse(JSON.stringify(base.C.preset(2,4,'long')));
 const open=take=>studio({variant:null,storage:{'xylo-studio-v2':JSON.stringify({take})}});
 const catalog=open(canonical);assert.equal(catalog.ids.get('sourceNote').getAttribute('data-i18n-ignore'),null);
 const catalogSections=catalog.ids.get('timeline').querySelectorAll('text').filter(node=>canonical.sections.some(section=>section.label===node.textContent));assert.ok(catalogSections.length);assert.ok(catalogSections.every(node=>node.getAttribute('data-i18n-ignore')===null));
 const custom=JSON.parse(JSON.stringify(canonical));custom.title='Rakam';custom.arrangement_note='Tukar instrumen';custom.sections[0].label='Rakam';
 const restored=open(custom),saved=JSON.parse(restored.saved.get('xylo-studio-v2')).take;
 assert.equal(restored.ids.get('sourceNote').textContent,'Tukar instrumen');assert.equal(restored.ids.get('sourceNote').getAttribute('data-i18n-ignore'),'');assert.equal(restored.ids.get('takeTitle').value,'Rakam');
 const section=restored.ids.get('timeline').querySelectorAll('text').find(node=>node.textContent==='Rakam');assert.ok(section);assert.equal(section.getAttribute('data-i18n-ignore'),'');
 assert.equal(saved.title,'Rakam');assert.equal(saved.arrangement_note,'Tukar instrumen');assert.equal(saved.sections[0].label,'Rakam');const timing=event=>[event.midi,event.original_midi,event.onset_tick,event.duration_tick,event.raw_ms,event.source,event.reviewed,event.estimated,event.gate_tick];assert.deepEqual(saved.events.map(timing),custom.events.map(timing));assert.deepEqual(saved.raw_capture,custom.raw_capture);
});

test('appearance labels and runtime statuses round-trip BM and English without changing select values or listeners',async()=>{
 const sourceText=id=>{
  const match=html.match(new RegExp('<([a-z][a-z0-9-]*)\\b[^>]*\\bid="'+id+'"[^>]*>([^<]*)<\\/\\1>','i'));
  assert.ok(match,'Missing actual appearance text #'+id);return match[2];
 };
 const pauseMessage='Permainan dijeda untuk tetapan paparan. Tekan Sambung selepas selesai.';
 const statuses=['Pilihan digunakan untuk sesi ini. Simpanan pelayar tidak tersedia.',
  'Pilihan disimpan dalam pelayar ini.','Pilihan dipulihkan daripada pelayar ini.',
  'Tetapan asal digunakan. Ubah pilihan untuk menyimpannya dalam pelayar ini.'];
 for(const phrase of [pauseMessage,...statuses])assert.ok(html.includes(phrase),'Stale appearance status probe: '+phrase);
 const displayPreference='{"theme":"dark","vision":"tritanopia"}',localized=[],selects=new Map();
 let status,gameStatus,done,close;
 const s=translatedDOM({storage:{'e-instru-display-v1':displayPreference},before({document,create}){
  const dialog=create('dialog',{id:'displayDialog'});document.body.append(dialog);
  for(const id of ['displaySettingsBtn','displayHeading','displayDescription','displayGameHint','displayVisionHint','displayReset','displayDone']){
   const node=create(id.endsWith('Btn')||id==='displayReset'||id==='displayDone'?'button':'span',{id},sourceText(id));
   localized.push({node,source:sourceText(id)});dialog.append(node);if(id==='displayDone')done=node;
  }
  for(const [id,value]of [['displayTheme','dark'],['displayVision','tritanopia']]){
   const labelSource=html.match(new RegExp('<label\\b[^>]*for="'+id+'"[^>]*>([^<]*)<\\/label>'))?.[1];
   assert.ok(labelSource,'Missing native appearance label '+id);
   const label=create('label',{for:id},labelSource);localized.push({node:label,source:labelSource});dialog.append(label);
   const select=create('select',{id}),markup=html.match(new RegExp('<select\\b[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/select>'))?.[1];
   assert.ok(markup,'Missing actual appearance options '+id);
   for(const [,raw,text]of markup.matchAll(/<option\b[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g)){
    const option=create('option',{value:raw},text);option.value=raw;select.append(option);localized.push({node:option,source:text});
   }
   select.value=value;selects.set(id,{node:select,value,options:select.children.slice(),values:select.children.map(option=>option.value)});dialog.append(select);
  }
  const closeName=html.match(/<button\b[^>]*id="displayClose"[^>]*aria-label="([^"]+)"/)?.[1];assert.ok(closeName);
  close=create('button',{id:'displayClose','aria-label':closeName},sourceText('displayClose'));
  localized.push({node:close,source:sourceText('displayClose')});dialog.append(close);
  status=create('p',{id:'displaySaveStatus',role:'status'},sourceText('displaySaveStatus'));
  gameStatus=create('p',{id:'gameStatus'},pauseMessage);dialog.append(status);document.body.append(gameStatus);
 }});
 const changes=[],clicks=[];
 for(const [id,{node}]of selects)node.addEventListener('change',()=>changes.push([id,node.value]));
 done.addEventListener('click',()=>clicks.push('done'));
 await s.flush();
 for(const source of statuses){
  status.textContent=source;await s.flush();
  for(const language of ['en','ms']){
   s.select.value=language;s.select.dispatchEvent(new s.Event('change'));await s.flush();
   for(const {node,source:label}of localized)assert.equal(node.textContent,language==='en'?english(s.api,label):label);
   assert.equal(status.textContent,language==='en'?english(s.api,source):source);
   assert.equal(gameStatus.textContent,language==='en'?english(s.api,pauseMessage):pauseMessage);
   assert.equal(close.getAttribute('aria-label'),language==='en'?english(s.api,'Tutup tetapan paparan'):'Tutup tetapan paparan');
   for(const [id,{node,value,options,values}]of selects){
    assert.equal(s.document.getElementById(id),node);assert.equal(node.value,value);
    node.children.forEach((option,index)=>{assert.equal(option,options[index]);assert.equal(option.value,values[index]);assert.equal(option.getAttribute('value'),values[index]);});
    node.dispatchEvent(new s.Event('change'));
   }
   assert.equal(s.document.getElementById('displayDone'),done);done.dispatchEvent(new s.Event('click'));
  }
 }
 assert.deepEqual(changes,Array.from({length:8},()=>[['displayTheme','dark'],['displayVision','tritanopia']]).flat());
 assert.equal(clicks.length,8);assert.equal(s.saved.get('e-instru-display-v1'),displayPreference);
 assert.ok(s.writes.every(([key])=>key===LANGUAGE_KEY),'Translation must not write appearance preferences');
});
