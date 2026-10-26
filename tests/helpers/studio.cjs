const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(fs.existsSync('dist/index.html')?'dist/index.html':'index.html','utf8');

// Execute the actual inline UI with a small DOM/audio test double. No real
// microphone, speaker or browser timing is measured by these host tests.
function studio({variant='short',legacy=null,game=false,storage={}}={}){
 const elements=[],ids=new Map(),downloads=[],oscillators=[],copies=[],saved=new Map(),contexts=[],intervals=new Map();const frames=new Map();let timerId=0;for(const [k,v]of Object.entries(storage))saved.set(k,v);
 if(legacy)saved.set('xylo-studio-v1',JSON.stringify({take:legacy,lastCustom:legacy,version:1}));
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.attrs={};this.dataset={};this._text='';this.value='';this.open=false;this.disabled=false;this.hidden=false;this.className='';this.scrollTop=0;this.scrollLeft=0;this.clientWidth=780;this.style={setProperty(){}};elements.push(this);const el=this;this.classList={add(c){const s=new Set(el.className.split(' ').filter(Boolean));s.add(c);el.className=[...s].join(' ');},remove(c){el.className=el.className.split(' ').filter(x=>x!==c).join(' ');},toggle(c,on){if(on===undefined)on=!el.className.split(' ').includes(c);this[on?'add':'remove'](c);}};}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
  append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;}}
  replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v);if(k==='id'){this.id=String(v);ids.set(this.id,this);}if(k.startsWith('data-'))this.dataset[k.slice(5)]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  async fire(k,extra={}){const e={target:this,preventDefault(){},button:0,detail:1,...extra};for(const fn of this.listeners[k]||[])await fn(e);}
  click(){if(this.tagName==='A'){downloads.push({filename:this.download,url:this.href});return;}return this.fire('click');}
  showModal(){this.open=true;}close(){this.open=false;for(const fn of this.listeners.close||[])fn({target:this});}
  get parentElement(){return this.parent||null;}
  getContext(){return{setTransform(){},clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},fill(){},stroke(){},fillText(){}};}
  focus(){}select(){}closest(tag){let n=this;while(n&&n.tagName!==tag.toUpperCase())n=n.parent;return n;}
  getBoundingClientRect(){if(this.id==='gameCanvas')return{left:0,top:0,width:600,height:500};if(this.id==='eventTableScroll')return{top:200,bottom:530,height:330};if(this.id==='eventHead')return{top:200,bottom:235,height:35};if(this.tagName==='TR'&&this.parent?.id==='eventRows'){const top=235+this.parent.children.indexOf(this)*36-(ids.get('eventTableScroll')?.scrollTop||0);return{top,bottom:top+36,height:36};}return{top:0,bottom:34,height:34};}
  querySelectorAll(selector){const all=[];const visit=n=>{for(const child of n.children){if(matches(child,selector))all.push(child);visit(child);}};visit(this);return all;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 function matches(el,s){if(s.startsWith('.'))return el.className.split(' ').includes(s.slice(1));const d=s.match(/^\[data-([a-z]+)="([^"]+)"\]$/);if(d)return el.dataset[d[1]]===d[2];return el.tagName===s.toUpperCase();}
 for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const el=new Element(match[1]);el.id=match[2];el.hidden=/\shidden(?:\s|>)/.test(match[0]);for(const attr of match[0].matchAll(/\b([a-z-]+)="([^"]*)"/g))el.setAttribute(attr[1],attr[2]);ids.set(el.id,el);}
 for(const format of ['json','csv','cpp']){const b=new Element('button');b.dataset.format=format;ids.get('exportTabs').append(b);}
 for(let i=0;i<4;i++)ids.get('beatDots').append(new Element('i'));
 if(game){for(const [i,key]of ['A','S','D','F'].entries()){const b=new Element('button');b.dataset.lane=String(i);ids.get('gamePads').append(b);}for(const value of ['easy','medium','hard']){const o=new Element('option');o.value=value;ids.get('gameDifficulty').append(o);}ids.get('gameVariant').value='short';ids.get('gameDifficulty').value='medium';}
 const documentListeners={};
 const document={hidden:false,getElementById:id=>ids.get(id)||null,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),createTextNode:text=>{const el=new Element('#text');el.textContent=text;return el;},querySelector:s=>s==='dialog[open]'?elements.find(e=>e.tagName==='DIALOG'&&e.open)||null:null,querySelectorAll:s=>elements.filter(e=>matches(e,s)),addEventListener(k,fn){(documentListeners[k]??=[]).push(fn);}};
 const parameter=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
 class AudioContext{
  constructor(){this.state='running';this.currentTime=1;this.destination={};contexts.push(this);}
  resume(){this.state='running';return Promise.resolve();}
  addEventListener(){}
  createGain(){return{gain:parameter(),connect(){},disconnect(){}};}
  createOscillator(){const context=this,o={frequency:parameter(),connect(){},disconnect(){},start(at){this.started=at;},stop(at){this.stopped=at;if(at===undefined&&this.started>context.currentTime+.000001)this.cancelled=true;}};oscillators.push(o);return o;}
 }
 const window={AudioContext,crypto:{randomUUID:()=> 'ui-test'},addEventListener(){}};
 const box={window,document,navigator:{clipboard:{writeText:async text=>copies.push(text)}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},performance:{now:()=>1000},Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{const id=++timerId;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),requestAnimationFrame:fn=>{const id=++timerId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),console};
 vm.createContext(box);for(const id of (game?['xylo-core','xylo-game-core','xylo-ui','xylo-game-ui']:['xylo-core','xylo-ui']))vm.runInContext(html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1],box);
 if(variant){ids.get('scoreVariant').value=variant;for(const fn of ids.get('scoreVariant').listeners.change||[])fn({target:ids.get('scoreVariant')});}
 return{ids,downloads,oscillators,copies,saved,document,contexts,C:window.XyloCore,G:window.XyloGameCore,async dispatch(k,extra={}){const e={target:new Element('div'),preventDefault(){},...extra};for(const fn of documentListeners[k]||[])await fn(e);},advance(ms){for(let elapsed=0;elapsed<ms;elapsed+=25){for(const a of contexts)a.currentTime+=.025;for(const fn of [...intervals.values()])fn();for(const [id,fn]of [...frames]){frames.delete(id);fn();}}},async settle(){for(let i=0;i<5;i++)await Promise.resolve();}};
}


module.exports={studio};
