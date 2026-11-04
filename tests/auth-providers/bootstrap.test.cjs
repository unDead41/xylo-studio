const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {fakeClient,environment,user,session,deferred,settle}=require('../auth/helpers.cjs');

// Exercise the scripts shipped together in index.html. Only the views,
// Supabase transport and public settings response are test doubles.
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
function inline(id){
 const match=html.match(new RegExp('<script\\b[^>]*\\bid="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'));
 assert.ok(match,'Missing shipped inline script #'+id);
 return match[1];
}

function bootstrap({restoredSession=null,responses={},href}={}){
 const fake=fakeClient({restoredSession,responses});
 const env=environment(href);
 const client=fake.client,receivers=[],settingsRequests=[],uiStates=[],disabled=[],listeners=new Map();
 const providerRoot={id:'test-provider-root'};
 let service,providers,uiOptions,providerOptions,baseClient,createClientCount=0,resets=0;
 client.from=()=>{
  const query={select:()=>query,eq:()=>query,
   maybeSingle:async()=>({data:{id:user().id},error:null}),insert:async()=>({error:null})};
  return query;
 };
 client.auth.signInWithOAuth=async function(...args){
  fake.calls.push({method:'signInWithOAuth',args});
  const response=responses.signInWithOAuth??{data:{provider:'google',url:'https://accounts.example/authorize'},error:null};
  return typeof response==='function'?response(...args):response;
 };
 for(const method of ['signInWithOAuth','signInWithOtp','verifyOtp']){
  const original=client.auth[method];
  client.auth[method]=function(...args){receivers.push({method,receiver:this});return original.apply(this,args);};
 }
 const box={
  console,URL,URLSearchParams,setTimeout,clearTimeout,queueMicrotask,AbortSignal,
  location:env.location,history:env.history,sessionStorage:env.storage,
  InstruAuthConfig:{projectRef:'ahvyieyojqciohdogsqc',url:'https://ahvyieyojqciohdogsqc.supabase.co',
   publishableKey:'sb_publishable_integration_test',redirectTo:'https://example.invalid/xylo-studio/',storageKey:'test-auth-storage'},
  supabase:{createClient(){createClientCount++;return client;}},
  fetch:async(url,options)=>{
   settingsRequests.push({url,options});
   return{ok:true,json:async()=>({external:{google:true,email:true,phone:true}})};
  },
  addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},
  InstruAuthUI:{createAuthUI(options){
   uiOptions=options;
   return{mount(){},getProviderRoot:()=>providerRoot,setState:state=>uiStates.push(state)};
  }},
  InstruAuthProviderUI:{mount(options){
   providerOptions=options;
   return{reset(){resets++;},setDisabled:value=>disabled.push(value),refresh:()=>options.service.refreshProviders()};
  }}
 };
 box.window=box;vm.createContext(box);
 vm.runInContext(inline('auth-service'),box,{filename:'shipped-auth-service.js'});
 vm.runInContext(inline('auth-provider-service'),box,{filename:'shipped-auth-provider-service.js'});
 const baseFactory=box.InstruAuth.createAuthService,providerFactory=box.InstruAuthProviders.createProviderService;
 box.InstruAuth.createAuthService=options=>{baseClient=options.client;service=baseFactory(options);return service;};
 box.InstruAuthProviders.createProviderService=options=>{providers=providerFactory(options);return providers;};
 vm.runInContext(inline('auth-bootstrap'),box,{filename:'shipped-auth-bootstrap.js'});
 return{
  fake,env,client,baseClient,receivers,settingsRequests,uiStates,disabled,service,providers,uiOptions,providerOptions,providerRoot,
  get createClientCount(){return createClientCount;},get resets(){return resets;},
  async ready(){await service.init();assert.equal((await providers.refreshProviders()).error,null);await settle();},
  async dispatch(type,event){for(const listener of listeners.get(type)||[])await listener(event);await settle();}
 };
}

test('provider integration shares one Supabase client and leaves callback exchange with the base service',async t=>{
 const app=bootstrap({href:'https://example.invalid/xylo-studio/?code=test-oauth-code&keep=yes#workspace',
  responses:{exchangeCodeForSession:{data:{session:session(),user:user(),redirectType:null},error:null}}});
 t.after(()=>app.service.destroy());await app.ready();await app.service.init();
 assert.equal(app.createClientCount,1);assert.equal(app.baseClient,app.client);
 assert.equal(app.providerOptions.service,app.providers);assert.equal(app.providerOptions.root,app.providerRoot);
 assert.equal(app.fake.count('exchangeCodeForSession'),1);assert.equal(app.fake.listenerCount(),1);
 assert.equal(app.fake.count('getSession'),1);
 assert.equal(app.service.getState().callback.status,'success');
 assert.equal(app.service.getState().user.id,user().id);
 assert.equal(app.env.location.searchParams.has('code'),false);
 const request=app.settingsRequests[0];
 assert.equal(request.url,'https://ahvyieyojqciohdogsqc.supabase.co/auth/v1/settings');
 assert.equal(request.options.method,'GET');assert.equal(request.options.credentials,'omit');
 assert.equal(request.options.redirect,'error');
 assert.equal(request.options.headers.apikey,'sb_publishable_integration_test');
});

test('a pending SMS request locks email submission until the provider request finishes',async t=>{
 const pending=deferred(),app=bootstrap({responses:{signInWithOtp:pending.promise}});
 t.after(()=>app.service.destroy());await app.ready();
 const send=app.providers.sendPhoneCode('0123456789');
 assert.equal(app.providers.getState().phase,'sending');
 assert.equal(app.uiStates.at(-1).providerBusy,true);
 const blocked=await app.uiOptions.onSubmit('signIn',{email:'musician@example.invalid',password:'password1'});
 assert.equal(blocked.ok,false);assert.equal(app.fake.count('signInWithPassword'),0);
 pending.resolve({data:{user:null,session:null},error:null});
 assert.equal((await send).error,null);
 assert.equal(app.uiStates.at(-1).providerBusy,false);
 assert.equal((await app.uiOptions.onSubmit('signIn',{email:'musician@example.invalid',password:'password1'})).ok,true);
 assert.equal(app.fake.count('signInWithPassword'),1);assert.equal(app.fake.count('signInWithOtp'),1);
 assert.equal(app.receivers.find(call=>call.method==='signInWithOtp').receiver,app.client.auth);
});

test('pending email authentication disables and rejects provider methods before they reach Supabase',async t=>{
 const pending=deferred(),app=bootstrap({responses:{signInWithPassword:pending.promise}});
 t.after(()=>app.service.destroy());await app.ready();
 const email=app.uiOptions.onSubmit('signIn',{email:'musician@example.invalid',password:'password1'});
 await settle();assert.equal(app.service.getState().busy,true);assert.equal(app.disabled.at(-1),true);
 assert.equal((await app.providers.startGoogle()).error?.code,'busy');
 assert.equal((await app.providers.sendPhoneCode('0123456789')).error?.code,'busy');
 assert.equal(app.fake.count('signInWithOAuth'),0);assert.equal(app.fake.count('signInWithOtp'),0);
 pending.resolve({data:{session:null,user:null},error:{code:'invalid_credentials'}});
 assert.equal((await email).ok,false);assert.equal(app.disabled.at(-1),false);
 assert.equal((await app.providers.startGoogle()).error,null);
 assert.equal(app.fake.count('signInWithOAuth'),1);
 assert.equal(app.receivers.find(call=>call.method==='signInWithOAuth').receiver,app.client.auth);
});

test('an authenticated base session cannot be replaced by another provider sign-in',async t=>{
 const existing=session(),app=bootstrap({restoredSession:existing});
 t.after(()=>app.service.destroy());await app.ready();
 assert.equal(app.disabled.at(-1),true);
 assert.equal((await app.providers.startGoogle()).error?.code,'provider_unavailable');
 assert.equal((await app.providers.sendPhoneCode('0123456789')).error?.code,'provider_unavailable');
 assert.equal(app.fake.count('signInWithOAuth'),0);assert.equal(app.fake.count('signInWithOtp'),0);
 assert.equal(app.service.getState().session,existing);
 assert.equal(app.service.getState().user.id,existing.user.id);
});

test('dismissing during OTP verification clears the challenge while retaining the shared email lock until settlement',async t=>{
 const pending=deferred(),app=bootstrap({responses:{verifyOtp:pending.promise}});
 t.after(()=>app.service.destroy());await app.ready();
 await app.providers.sendPhoneCode('0123456789');
 const resendAt=app.providers.getState().resendAt;
 const verify=app.providers.verifyPhoneCode('123456');
 assert.equal(app.providers.getState().phase,'verifying');
 app.uiOptions.onDismiss();
 assert.equal(app.resets,1);assert.equal(app.providers.getState().phase,'idle');
 assert.equal(app.providers.getState().phone,'');assert.equal(app.providers.getState().resendAt,resendAt);
 assert.equal(app.uiStates.at(-1).providerBusy,true);
 const blocked=await app.uiOptions.onSubmit('signIn',{email:'musician@example.invalid',password:'password1'});
 assert.equal(blocked.ok,false);assert.equal(app.fake.count('signInWithPassword'),0);
 assert.equal((await app.providers.sendPhoneCode('0198765432')).error?.code,'busy');
 assert.equal(app.fake.count('signInWithOtp'),1);
 pending.resolve({data:{session:session(),user:user()},error:null});
 assert.equal((await verify).error?.code,'cancelled');
 assert.equal(app.uiStates.at(-1).providerBusy,false);
 assert.equal((await app.providers.verifyPhoneCode('123456')).error?.code,'phone_challenge_missing');
 assert.equal(app.fake.count('verifyOtp'),1);
});

test('persisted pageshow recovers a Google redirect lock and refreshes provider readiness',async t=>{
 const app=bootstrap();t.after(()=>app.service.destroy());await app.ready();
 await app.providers.startGoogle();
 assert.equal(app.providers.getState().phase,'redirecting');assert.equal(app.uiStates.at(-1).providerBusy,true);
 const requests=app.settingsRequests.length;
 await app.dispatch('pageshow',{persisted:false});
 assert.equal(app.providers.getState().phase,'redirecting');assert.equal(app.settingsRequests.length,requests);
 await app.dispatch('pageshow',{persisted:true});
 assert.equal(app.providers.getState().phase,'idle');assert.equal(app.providers.getState().providersLoaded,true);
 assert.equal(app.settingsRequests.length,requests+1);assert.equal(app.uiStates.at(-1).providerBusy,false);
 assert.equal((await app.providers.startGoogle()).error,null);
 assert.equal(app.fake.count('signInWithOAuth'),2);
 assert.equal(app.fake.count('exchangeCodeForSession'),0);assert.equal(app.fake.count('getSession'),1);
});
