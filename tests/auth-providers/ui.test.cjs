// Provider UI regression checks against the actual shipped inline module.
// No browser, provider request, email or SMS delivery is exercised here.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync('index.html','utf8');
const source=html.match(/<script id="auth-provider-ui">([\s\S]*?)<\/script>/)[1];
const {test}=require('node:test');
const checks=[];
function check(name){checks.push(name);console.log('PASS '+name);}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
async function settle(){for(let i=0;i<8;i++)await Promise.resolve();}
function fixture(overrides={}){
 let now=100000,sequence=0;const intervals=new Map(),subscribers=new Set(),elements=[];
 const document={activeElement:null,createElement:tag=>new Element(tag)};
 function matches(el,selector){const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(attr)return Object.hasOwn(el.attrs,attr[1])&&(attr[2]===undefined||el.attrs[attr[1]]===attr[2]);return el.tagName===selector.toUpperCase();}
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.attrs={};this.children=[];this.listeners={};this.parentNode=null;this._text='';this.value='';this.hidden=false;this.disabled=false;this.open=false;elements.push(this);}
  setAttribute(key,value){this.attrs[key]=String(value);if(key==='class')this.className=String(value);if(key==='hidden')this.hidden=true;if(key==='disabled')this.disabled=true;}
  getAttribute(key){return this.attrs[key]??null;}
  appendChild(child){this.children.push(child);child.parentNode=this;return child;}
  insertBefore(child,before){const i=this.children.indexOf(before);if(i<0)return this.appendChild(child);this.children.splice(i,0,child);child.parentNode=this;return child;}
  get firstChild(){return this.children[0]||null;}
  remove(){if(this.parentNode){const i=this.parentNode.children.indexOf(this);if(i>=0)this.parentNode.children.splice(i,1);this.parentNode=null;}}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(value){this._text='';this.children=[];const stack=[this];for(const token of value.matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)){const item=token[0];if(item.startsWith('</')){stack.pop();continue;}if(!item.startsWith('<')){const node=new Element('#text');node._text=item;stack[stack.length-1].appendChild(node);continue;}const tag=item.match(/^<([a-z0-9]+)/i)[1],node=new Element(tag);for(const m of item.matchAll(/\s([a-z][a-z0-9-]*)(?:="([^"]*)")?/gi))node.setAttribute(m[1],m[2]??'');stack[stack.length-1].appendChild(node);if(!/\/>$/.test(item)&&!['input','br','hr','img','meta','link'].includes(tag))stack.push(node);}}
  querySelectorAll(selector){const result=[];function visit(node){for(const child of node.children){if(matches(child,selector))result.push(child);visit(child);}}visit(this);return result;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  removeEventListener(type,handler){this.listeners[type]=(this.listeners[type]||[]).filter(fn=>fn!==handler);}
  fire(type){const event={preventDefault(){this.prevented=true;}};for(const handler of [...(this.listeners[type]||[])])handler(event);return event;}
  focus(){document.activeElement=this;}
 }
 let state={providers:{google:true,email:true,phone:true},providersLoaded:true,phase:'idle',phone:'',resendAt:0,error:null,...overrides};
 const setState=patch=>{state={...state,...patch};for(const fn of subscribers)fn(state);};
 const calls={send:[],verify:[],google:0,cancel:0,refresh:0,authenticated:[],email:0};
 const f={document,intervals,subscribers,elements,calls,setState,get state(){return state;},setNow(value){now=value;for(const fn of [...intervals.values()])fn();}};
 f.sendImpl=async phone=>{setState({phone:phone.startsWith('+')?phone:'+60'+phone.slice(1),phase:'code',resendAt:now+60000,error:null});return{data:{},error:null};};
 f.verifyImpl=async()=>({data:{},error:{code:'otp_expired',message:'Kod tidak sah atau telah tamat tempoh.'}});
 f.googleImpl=async()=>{setState({phase:'redirecting'});return{data:{url:'https://accounts.google.com/'},error:null};};
 f.refreshImpl=async()=>({data:{},error:null});
 const service={getState:()=>state,subscribe(fn){subscribers.add(fn);fn(state);return()=>subscribers.delete(fn);},refreshProviders(){calls.refresh++;return f.refreshImpl();},startGoogle(){calls.google++;return f.googleImpl();},sendPhoneCode(phone){calls.send.push(phone);return f.sendImpl(phone);},verifyPhoneCode(token){calls.verify.push(token);return f.verifyImpl(token);},cancelPhone(){calls.cancel++;setState({phone:'',phase:'idle',error:null});}};
 const FakeDate=class extends Date{static now(){return now;}};
 const context=vm.createContext({document,Date:FakeDate,setInterval(fn){const id=++sequence;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),console});
 vm.runInContext(source,context);
 const root=new Element('section');root.appendChild(new Element('span'));
 f.service=service;f.root=root;f.api=context.InstruAuthProviderUI;
 f.mount=extra=>{f.controller=f.api.mount({root,service,onAuthenticated:session=>calls.authenticated.push(session),...extra});f.ui=root.children[root.children.length-1];f.find=s=>f.ui.querySelector(s);return f.controller;};
 return f;
}
test('provider controls preserve OTP, pending state, availability and cleanup',async()=>{
 const f=fixture();f.mount();
 assert.equal(f.find('[data-auth-email-option]').hidden,true);assert.equal(f.find('[data-auth-code-form]').hidden,true);assert.equal(f.root.children.length,2);assert.equal(f.subscribers.size,1);
 check('mount preserves host siblings; email option absent without callback; SMS stage initially hidden');
 f.controller.setDisabled(true);assert.equal(f.find('[data-auth-provider="google"]').disabled,true);assert.equal(f.find('[data-auth-send]').disabled,true);f.find('[data-auth-phone-form]').fire('submit');assert.equal(f.calls.send.length,0);f.controller.setDisabled(false);
 const phone=f.find('[name="phone"]'),code=f.find('[name="token"]');phone.value='abc';f.find('[data-auth-phone-form]').fire('submit');assert.equal(f.calls.send.length,0);assert.equal(phone.getAttribute('aria-invalid'),'true');assert.equal(f.document.activeElement,phone);
 check('base email busy disables provider actions; invalid phone stays local with focused inline error');
 const sending=deferred();f.sendImpl=phone=>{f.setState({phase:'sending',error:null});return sending.promise;};phone.value='+60 (12) 345-6789';phone.fire('input');f.find('[data-auth-phone-form]').fire('submit');f.find('[data-auth-phone-form]').fire('submit');assert.deepEqual(f.calls.send,['+60123456789']);assert.equal(f.find('[data-auth-code-form]').hidden,true);assert.equal(f.find('[data-auth-send]').disabled,true);
 f.setState({phase:'code',phone:'+60123456789',resendAt:102000});sending.resolve({data:{},error:null});await settle();assert.equal(f.find('[data-auth-code-form]').hidden,false);assert.equal(f.find('[data-auth-phone-form]').hidden,true);assert.equal(f.find('[data-auth-resend]').disabled,true);assert.equal(f.document.activeElement,code);assert.equal(code.getAttribute('autocomplete'),'one-time-code');assert.equal(code.getAttribute('inputmode'),'numeric');
 check('one send while pending; code stage and one-time-code focus appear only after successful SMS response');
 f.find('details').open=false;f.setNow(100100);assert.equal(f.find('details').open,false);f.find('details').open=true;
 check('cooldown updates preserve a manually collapsed phone disclosure');
 code.value='12a345';f.find('[data-auth-code-form]').fire('submit');assert.equal(f.calls.verify.length,0);assert.equal(code.getAttribute('aria-invalid'),'true');code.value='001234';code.fire('input');f.find('[data-auth-code-form]').fire('submit');await settle();assert.deepEqual(f.calls.verify,['001234']);assert.equal(f.calls.authenticated.length,0);assert.equal(code.value,'001234');assert.match(f.find('[role="alert"]').textContent,/Kod tidak sah/);
 check('six-digit OTP validation preserves leading zeroes; failed verification keeps challenge and does not authenticate');
 f.setState({resendAt:103000,phase:'code'});f.find('[data-auth-edit]').fire('click');assert.equal(f.calls.cancel,1);assert.equal(f.state.phone,'');assert.equal(f.find('[data-auth-code-form]').hidden,true);assert.equal(f.find('[data-auth-send]').disabled,true);assert.match(f.find('[data-auth-send]').textContent,/3s/);assert.equal(f.intervals.size,1);f.setNow(103001);assert.equal(f.find('[data-auth-send]').disabled,false);assert.equal(f.intervals.size,0);
 check('editing a phone clears challenge while preserving SMS cooldown; countdown re-enables initial send');
 f.setState({phone:'+60123456789',phase:'code',resendAt:0,error:null});code.value='654321';f.controller.setDisabled(true);assert.equal(code.value,'654321');assert.equal(f.state.phone,'+60123456789');assert.equal(code.disabled,true);f.controller.setDisabled(false);assert.equal(code.disabled,false);f.controller.reset();assert.equal(code.value,'');assert.equal(f.state.phone,'+60123456789');
 check('shared busy state preserves OTP challenge; reset clears typed code and leaves cancellation to service');
 const oldVerify=deferred();f.verifyImpl=()=>{f.setState({phase:'verifying'});return oldVerify.promise;};code.value='123456';f.find('[data-auth-code-form]').fire('submit');f.service.cancelPhone();f.controller.reset();f.setState({resendAt:0});const newSend=deferred();f.sendImpl=()=>{f.setState({phase:'sending'});return newSend.promise;};phone.value='0123456789';f.find('[data-auth-phone-form]').fire('submit');oldVerify.resolve({data:{session:{access_token:'fake',user:{id:'late'}}},error:null});await settle();assert.equal(f.calls.authenticated.length,0);assert.equal(f.find('[data-auth-send]').disabled,true);assert.match(f.find('[role="status"]').textContent,/Menghantar/);f.setState({phone:'+60123456789',phase:'code'});newSend.resolve({data:{},error:null});await settle();assert.equal(f.find('[data-auth-verify]').disabled,false);
 check('reset invalidates late verification; an older promise cannot authenticate or clear a newer pending action');
 const session={access_token:'test-session',user:{id:'test-user'}};f.verifyImpl=async()=>{f.setState({phase:'idle',phone:'',error:null});return{data:{session},error:null};};code.value='012345';f.find('[data-auth-code-form]').fire('submit');await settle();assert.equal(f.calls.authenticated.length,1);assert.equal(f.calls.authenticated[0],session);assert.equal(code.value,'');
 check('only actual successful session result invokes host authentication callback');
 f.setState({error:{code:'test',message:'<img src=x onerror="malicious()">'}});assert.equal(f.find('[role="alert"]').textContent,'<img src=x onerror="malicious()">');assert.equal(f.ui.querySelectorAll('img').length,0);
 check('service error text is rendered literally without HTML injection');
 f.setState({resendAt:110000});assert.equal(f.intervals.size,1);const oldUI=f.ui;f.controller.destroy();f.controller.destroy();assert.equal(f.subscribers.size,0);assert.equal(f.intervals.size,0);assert.equal(f.root.children.length,1);assert.equal(f.elements.reduce((sum,node)=>sum+Object.values(node.listeners).flat().length,0),0);assert.equal(oldUI.parentNode,null);
 check('destroy removes owned markup, all listeners, subscription, sensitive inputs and cooldown timer');
 f.setState({phone:'',phase:'idle',resendAt:0,error:null});f.mount({onEmail:()=>f.calls.email++});assert.equal(f.find('[data-auth-email-option]').hidden,false);f.find('[data-auth-provider="email"]').fire('click');assert.equal(f.calls.email,1);const before=f.controller;f.mount();assert.equal(f.root.children.length,2);assert.equal(f.subscribers.size,1);before.destroy();assert.equal(f.root.children.length,2);f.controller.destroy();
 check('optional email callback works; remount cleans the previous mount without removing host siblings');
 const a=fixture({providers:{},providersLoaded:false});const initial=deferred();a.refreshImpl=()=>initial.promise;a.mount();assert.equal(a.calls.refresh,1);assert.equal(a.find('[data-auth-provider="google"]').disabled,true);assert.equal(a.find('[data-auth-send]').disabled,true);a.setState({error:{code:'unavailable',message:'Pilihan belum tersedia.'}});initial.resolve({data:null,error:a.state.error});await settle();assert.equal(a.find('[data-auth-retry]').hidden,false);a.refreshImpl=async()=>{a.setState({providers:{google:false,email:true,phone:false},providersLoaded:true,error:null});return{data:{},error:null};};a.find('[data-auth-retry]').fire('click');await settle();assert.equal(a.calls.refresh,2);assert.equal(a.find('[data-auth-retry]').hidden,true);assert.equal(a.find('[data-auth-provider="google"]').disabled,true);assert.equal(a.find('[data-auth-send]').disabled,true);assert.match(a.find('[data-auth-google-unavailable]').textContent,/belum tersedia/);assert.match(a.find('[data-auth-phone-unavailable]').textContent,/belum tersedia/);a.controller.destroy();
 check('unknown providers stay disabled; failed discovery exposes retry; disabled providers get plain availability guidance');
 console.log(JSON.stringify({passed:checks.length,source_sha256:crypto.createHash('sha256').update(source).digest('hex'),limits:'Host DOM/service doubles only; no real provider requests, SMS/email delivery, browser layout or screen-reader validation.'}));
});
