const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// These host tests execute the actual provider service with a fake Supabase
// boundary. They never contact Supabase, start OAuth, or send a real SMS.
const inline=fs.readFileSync('index.html','utf8').match(/<script id="auth-provider-service">([\s\S]*?)<\/script>/);
assert.ok(inline,'Missing shipped inline script #auth-provider-service');
const source=inline[1];
const box={module:{exports:{}},URL};
vm.runInNewContext(source,box,{filename:'inline-auth-provider-service.js'});
const {createProviderService,normalizePhone,errorMessage}=box.module.exports;
const plain=value=>JSON.parse(JSON.stringify(value));
const redirectTo='https://studio.example/xylo-studio/';
const location={href:redirectTo,origin:'https://studio.example',pathname:'/xylo-studio/'};
const session={access_token:'fake-test-session',user:{id:'test-user'}};
const settings={external:{google:true,email:true,phone:true}};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

function fixture(options={}){
 const calls={oauth:[],send:[],verify:[],settings:[]};
 let clock=options.now??10000;
 const call=(name,payload,fallback)=>{
  calls[name].push(plain(payload));
  return options[name]?options[name](payload):Promise.resolve(fallback);
 };
 const client={auth:{
  signInWithOAuth:payload=>call('oauth',payload,{data:{provider:'google',url:'https://accounts.example/authorize'},error:null}),
  signInWithOtp:payload=>call('send',payload,{data:{user:null,session:null},error:null}),
  verifyOtp:payload=>call('verify',payload,{data:{session,user:session.user},error:null})
 }};
 const service=createProviderService({
  client,redirectTo:options.redirectTo??redirectTo,location:options.location??location,
  now:()=>clock,cooldownMs:options.cooldownMs??60000,
  fetchSettings:async()=>{calls.settings.push(true);return options.fetchSettings?options.fetchSettings():options.settings??settings;}
 });
 return{service,calls,setNow(value){clock=value;},async ready(){const result=await service.refreshProviders();assert.equal(result.error,null);return result;}};
}

test('provider readiness is closed by default and subscriptions stop after unsubscribe',async()=>{
 const f=fixture(),states=[];
 const stop=f.service.subscribe(state=>states.push(plain(state)));
 assert.equal(states.length,1);
 assert.equal(f.service.getState().providersLoaded,false);
 assert.equal(f.service.getState().busy,false);
 assert.deepEqual(plain(f.service.getState().providers),{google:false,email:false,phone:false});
 assert.equal((await f.service.startGoogle()).error.code,'provider_unavailable');
 assert.equal((await f.service.sendPhoneCode('0123456789')).error.code,'provider_unavailable');
 assert.equal(f.calls.oauth.length,0);assert.equal(f.calls.send.length,0);
 await f.ready();
 assert.equal(f.service.getState().providersLoaded,true);
 assert.deepEqual(plain(f.service.getState().providers),{google:true,email:true,phone:true});
 assert.ok(states.length>1);
 const count=states.length;stop();
 await f.ready();assert.equal(states.length,count);
});

test('disabled, malformed and failed settings cannot make a provider callable',async()=>{
 for(const external of [{google:false,email:false,phone:false},{google:'true',email:1,phone:{}}]){
  const f=fixture({settings:{external}});await f.ready();
  assert.deepEqual(plain(f.service.getState().providers),{google:false,email:false,phone:false});
  assert.equal((await f.service.startGoogle()).error.code,'provider_unavailable');
  assert.equal((await f.service.sendPhoneCode('0123456789')).error.code,'provider_unavailable');
  assert.equal(f.calls.oauth.length+f.calls.send.length,0);
 }
 const f=fixture({fetchSettings:async()=>{throw new Error('remote secret detail');}});
 assert.equal((await f.service.refreshProviders()).error.code,'providers_unavailable');
 assert.deepEqual(plain(f.service.getState().providers),{google:false,email:false,phone:false});
 assert.equal((await f.service.startGoogle()).error.code,'provider_unavailable');
 assert.equal(f.calls.oauth.length,0);
});

test('refresh deduplicates settings requests and suspends previously ready providers until it completes',async()=>{
 const wait=deferred();let response=settings;
 const f=fixture({fetchSettings:()=>response});await f.ready();
 response=wait.promise;
 const refresh=f.service.refreshProviders(),duplicate=f.service.refreshProviders();
 assert.equal(refresh,duplicate);
 assert.equal(f.service.getState().providersLoaded,false);
 assert.equal((await f.service.startGoogle()).error.code,'provider_unavailable');
 assert.equal((await f.service.sendPhoneCode('0123456789')).error.code,'provider_unavailable');
 assert.equal(f.calls.settings.length,2);
 assert.equal(f.calls.oauth.length+f.calls.send.length,0);
 wait.resolve({external:{google:false,email:true,phone:true}});await refresh;
 assert.deepEqual(plain(f.service.getState().providers),{google:false,email:true,phone:true});
 assert.equal((await f.service.startGoogle()).error.code,'provider_unavailable');
});

test('Google requests account choice with only the validated same-origin return URL',async()=>{
 const f=fixture();await f.ready();
 const result=await f.service.startGoogle();
 assert.equal(result.error,null);
 assert.deepEqual(f.calls.oauth,[{provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}}]);
 assert.equal(f.service.getState().phase,'redirecting');
});

test('Google rejects an external, script or credential-bearing return URL before OAuth',async()=>{
 for(const invalid of ['https://attacker.example/return','javascript:alert(1)','https://user:password@studio.example/xylo-studio/']){
  const f=fixture({redirectTo:invalid});await f.ready();
  assert.equal((await f.service.startGoogle()).error.code,'invalid_redirect',invalid);
  assert.equal(f.calls.oauth.length,0,invalid);
  assert.equal(f.service.getState().phase,'idle');
 }
});

test('a pending Google request blocks duplicate provider attempts and recovers from a remote failure',async()=>{
 const wait=deferred(),f=fixture({oauth:()=>wait.promise});await f.ready();
 const first=f.service.startGoogle();
 assert.equal(f.service.getState().phase,'redirecting');
 assert.equal((await f.service.startGoogle()).error.code,'busy');
 assert.equal((await f.service.sendPhoneCode('0123456789')).error.code,'busy');
 assert.equal(f.calls.oauth.length,1);assert.equal(f.calls.send.length,0);
 wait.resolve({data:null,error:{message:'raw upstream credential detail',code:'unexpected'}});
 assert.equal((await first).error.code,'auth_error');
 assert.equal(f.service.getState().phase,'idle');
 assert.doesNotMatch(f.service.getState().error.message,/raw upstream|credential/);
});

test('Google cannot report a started redirect without a nonempty authorization URL',async()=>{
 for(const data of [null,{}, {provider:'google'}, {url:''}, {url:'   '}, {url:42}]){
  const f=fixture({oauth:async()=>({data,error:null})});await f.ready();
  const result=await f.service.startGoogle();
  assert.equal(result.error?.code,'auth_error',JSON.stringify(data));
  assert.equal(result.data,null);
  assert.equal(f.service.getState().phase,'idle');
 }
});

test('browser Back recovery releases the Google redirect lock without changing a phone challenge',async()=>{
 const f=fixture();await f.ready();await f.service.startGoogle();
 assert.equal(f.service.getState().phase,'redirecting');
 assert.deepEqual(plain(f.service.resetRedirect()),{data:null,error:null});
 assert.equal(f.service.getState().phase,'idle');
 assert.equal(f.service.getState().error,null);
 assert.equal((await f.service.startGoogle()).error,null);
 assert.equal(f.calls.oauth.length,2);
 f.service.resetRedirect();
 await f.service.sendPhoneCode('0123456789');
 const before=plain(f.service.getState());
 f.service.resetRedirect();
 assert.deepEqual(plain(f.service.getState()),before);
});

test('Malaysian local numbers and explicit international numbers normalize to E.164',()=>{
 for(const [input,expected] of [
  ['0123456789','+60123456789'],['011-1234 5678','+601112345678'],
  [' (012) 345-6789 ','+60123456789'],['+60 12-345 6789','+60123456789'],
  ['+1 (415) 555-2671','+14155552671'],['+44 7700 900123','+447700900123']
 ])assert.equal(normalizePhone(input),expected,input);
 for(const input of ['',null,12,'123','60123456789','01234567','0001234567','+0123456789','+1234567','+1234567890123456','0123456789 ext 1','+60/12/3456789']){
  assert.equal(normalizePhone(input),null,String(input));
 }
});

test('SMS send uses only the normalized phone and explicit SMS options',async()=>{
 const f=fixture();await f.ready();
 assert.equal((await f.service.sendPhoneCode('not a phone')).error.code,'invalid_phone');
 assert.equal(f.calls.send.length,0);
 const result=await f.service.sendPhoneCode('012-345 6789',{captchaToken:'captcha-test',channel:'whatsapp',shouldCreateUser:false});
 assert.equal(result.error,null);
 assert.deepEqual(f.calls.send,[{phone:'+60123456789',options:{channel:'sms',shouldCreateUser:true,captchaToken:'captcha-test'}}]);
 assert.equal(f.service.getState().phase,'code');
 assert.equal(f.service.getState().phone,'+60123456789');
 assert.equal(f.service.getState().resendAt,70000);
});

test('SMS resend enforces the complete cooldown and permits resend at its boundary',async()=>{
 const f=fixture();await f.ready();await f.service.sendPhoneCode('0123456789');
 assert.equal((await f.service.sendPhoneCode('0123456789')).error.code,'resend_cooldown');
 f.setNow(69999);
 assert.equal((await f.service.sendPhoneCode('0123456789')).error.code,'resend_cooldown');
 assert.equal(f.calls.send.length,1);
 f.setNow(70000);
 assert.equal((await f.service.sendPhoneCode('0123456789')).error,null);
 assert.equal(f.calls.send.length,2);
 assert.equal(f.service.getState().resendAt,130000);
});

test('cancelling a delivered SMS preserves cooldown across arbitrary phone edits',async()=>{
 const f=fixture();await f.ready();await f.service.sendPhoneCode('0123456789');
 f.service.cancelPhone();
 assert.equal(f.service.getState().phase,'idle');
 assert.equal(f.service.getState().phone,'');
 assert.equal(f.service.getState().resendAt,70000);
 assert.equal((await f.service.sendPhoneCode('0198765432')).error?.code,'resend_cooldown');
 assert.equal(f.calls.send.length,1);
 f.service.cancelPhone();f.setNow(69999);
 assert.equal((await f.service.sendPhoneCode('+14155552671')).error?.code,'resend_cooldown');
 assert.equal(f.calls.send.length,1);
 f.setNow(70000);
 assert.equal((await f.service.sendPhoneCode('0198765432')).error,null);
 assert.equal(f.calls.send.length,2);
 assert.equal(f.calls.send[1].phone,'+60198765432');
});

test('Google start and browser Back recovery cannot bypass a delivered SMS cooldown',async()=>{
 const f=fixture();await f.ready();await f.service.sendPhoneCode('0123456789');
 await f.service.startGoogle();
 assert.equal(f.service.getState().phone,'');
 assert.equal(f.service.getState().resendAt,70000);
 f.service.resetRedirect();
 assert.equal((await f.service.sendPhoneCode('0198765432')).error?.code,'resend_cooldown');
 assert.equal(f.calls.send.length,1);
 f.setNow(70000);
 assert.equal((await f.service.sendPhoneCode('0198765432')).error,null);
 assert.equal(f.calls.send.length,2);
});

test('OTP verification requires a sent challenge, six digits and the original phone',async()=>{
 const f=fixture();await f.ready();
 assert.equal((await f.service.verifyPhoneCode('123456')).error.code,'phone_challenge_missing');
 assert.equal(f.calls.verify.length,0);
 await f.service.sendPhoneCode('0123456789');
 for(const invalid of ['12345','1234567','12ab56','']){
  assert.equal((await f.service.verifyPhoneCode(invalid)).error.code,'invalid_otp');
 }
 assert.equal(f.calls.verify.length,0);
 const result=await f.service.verifyPhoneCode(' 123456 ');
 assert.equal(result.error,null);assert.ok(result.data.session);
 assert.deepEqual(f.calls.verify,[{phone:'+60123456789',token:'123456',type:'sms'}]);
 assert.equal(f.service.getState().phase,'idle');
 assert.equal(f.service.getState().phone,'');
 assert.equal((await f.service.sendPhoneCode('0198765432')).error?.code,'resend_cooldown');
 assert.equal(f.calls.send.length,1);
});

test('a pending phone send or verify blocks duplicate network requests',async()=>{
 const sendWait=deferred(),f=fixture({send:()=>sendWait.promise});await f.ready();
 const pendingSend=f.service.sendPhoneCode('0123456789');
 assert.equal(f.service.getState().phase,'sending');
 assert.equal((await f.service.sendPhoneCode('0198765432')).error.code,'busy');
 assert.equal((await f.service.startGoogle()).error.code,'busy');
 assert.equal(f.calls.send.length,1);
 sendWait.resolve({data:{session:null,user:null},error:null});await pendingSend;
 const verifyWait=deferred(),g=fixture({verify:()=>verifyWait.promise});await g.ready();await g.service.sendPhoneCode('0123456789');
 const pendingVerify=g.service.verifyPhoneCode('123456');
 assert.equal(g.service.getState().phase,'verifying');
 assert.equal((await g.service.verifyPhoneCode('123456')).error.code,'busy');
 assert.equal(g.calls.verify.length,1);
 verifyWait.resolve({data:{session,user:session.user},error:null});await pendingVerify;
});

test('cancelling a pending SMS retains its network lock and records delivered-message cooldown without restoring a challenge',async()=>{
 const wait=deferred(),f=fixture({send:()=>wait.promise});await f.ready();
 const pending=f.service.sendPhoneCode('0123456789');
 assert.deepEqual(plain(f.service.cancelPhone()),{data:null,error:null});
 assert.equal(f.service.getState().phase,'idle');assert.equal(f.service.getState().busy,true);
 assert.equal(f.service.getState().phone,'');
 assert.equal((await f.service.startGoogle()).error?.code,'busy');
 assert.equal((await f.service.sendPhoneCode('0198765432')).error?.code,'busy');
 assert.equal((await f.service.verifyPhoneCode('123456')).error?.code,'busy');
 assert.equal(f.calls.send.length,1);assert.equal(f.calls.oauth.length,0);assert.equal(f.calls.verify.length,0);
 wait.resolve({data:{session:null,user:null},error:null});
 assert.equal((await pending).error.code,'cancelled');
 assert.equal(f.service.getState().phase,'idle');assert.equal(f.service.getState().busy,false);
 assert.equal(f.service.getState().phone,'');assert.equal(f.service.getState().resendAt,70000);
 assert.equal((await f.service.verifyPhoneCode('123456')).error.code,'phone_challenge_missing');
 assert.equal(f.calls.verify.length,0);
 assert.equal((await f.service.sendPhoneCode('0198765432')).error?.code,'resend_cooldown');
 assert.equal(f.calls.send.length,1);
});

test('cancelling a pending verify retains its network lock and never returns the stale session',async()=>{
 const wait=deferred(),f=fixture({verify:()=>wait.promise});await f.ready();await f.service.sendPhoneCode('0123456789');
 const pending=f.service.verifyPhoneCode('123456');f.service.cancelPhone();
 assert.equal(f.service.getState().phase,'idle');assert.equal(f.service.getState().busy,true);
 assert.equal((await f.service.startGoogle()).error?.code,'busy');
 assert.equal((await f.service.sendPhoneCode('0198765432')).error?.code,'busy');
 assert.equal((await f.service.verifyPhoneCode('123456')).error?.code,'busy');
 assert.equal(f.calls.send.length,1);assert.equal(f.calls.oauth.length,0);assert.equal(f.calls.verify.length,1);
 wait.resolve({data:{session,user:session.user},error:null});
 const result=await pending;
 assert.equal(result.error.code,'cancelled');assert.equal(result.data,null);
 assert.equal(f.service.getState().phase,'idle');assert.equal(f.service.getState().busy,false);
 assert.equal(f.service.getState().phone,'');
});

test('a missing or incomplete verification session cannot report a successful sign-in',async()=>{
 for(const invalid of [null,undefined,[],{},
  {access_token:'fake-test-session'}, {user:{id:'test-user'}},
  {access_token:'',user:{id:'test-user'}}, {access_token:'   ',user:{id:'test-user'}},
  {access_token:'fake-test-session',user:{}}, {access_token:'fake-test-session',user:{id:''}},
  {access_token:'fake-test-session',user:{id:'   '}}, {access_token:'fake-test-session',user:{id:42}}
 ]){
  const f=fixture({verify:async()=>({data:{session:invalid,user:{id:'test-user'}},error:null})});
  await f.ready();await f.service.sendPhoneCode('0123456789');
  const result=await f.service.verifyPhoneCode('123456');
  assert.equal(result.error?.code,'session_missing',JSON.stringify(invalid));
  assert.equal(result.data,null);
  assert.equal(f.service.getState().phase,'code');
 }
});

test('an expired OTP keeps the original challenge available for retry without another SMS',async()=>{
 let attempt=0;
 const f=fixture({verify:async()=>++attempt===1
  ?{data:null,error:{code:'otp_expired',message:'raw remote token detail'}}
  :{data:{session,user:session.user},error:null}});
 await f.ready();await f.service.sendPhoneCode('0123456789');
 const expiresAt=f.service.getState().resendAt;
 const failed=await f.service.verifyPhoneCode('111111');
 assert.equal(failed.error.code,'invalid_otp');
 assert.doesNotMatch(failed.error.message,/raw remote|token detail/);
 assert.equal(f.service.getState().phase,'code');
 assert.equal(f.service.getState().phone,'+60123456789');
 assert.equal(f.service.getState().resendAt,expiresAt);
 assert.equal((await f.service.verifyPhoneCode('123456')).error,null);
 assert.equal(f.calls.send.length,1);
 assert.deepEqual(f.calls.verify.map(call=>call.phone),['+60123456789','+60123456789']);
 assert.equal(f.service.getState().error,null);
});

test('rate limits, delivery failures and network exceptions produce safe retryable errors',async()=>{
 for(const [remote,code] of [
  [{status:429,message:'raw remote rate limit'},'rate_limited'],
  [{code:'sms_send_failed',message:'raw remote provider key'},'sms_delivery_unavailable']
 ]){
  const f=fixture({send:async()=>({data:null,error:remote})});await f.ready();
  const result=await f.service.sendPhoneCode('0123456789');
  assert.equal(result.error.code,code);
  assert.equal(f.service.getState().phase,'idle');
  assert.equal(f.service.getState().phone,'');assert.equal(f.service.getState().resendAt,0);
  assert.doesNotMatch(result.error.message,/raw remote|provider key/);
 }
 const f=fixture({send:async()=>{throw new TypeError('Failed to fetch raw remote secret');}});await f.ready();
 const result=await f.service.sendPhoneCode('0123456789');
 assert.equal(result.error.code,'network_error');
 assert.equal(f.service.getState().phase,'idle');
 assert.equal(typeof errorMessage(new Error('raw remote secret')),'string');
 assert.doesNotMatch(errorMessage(new Error('raw remote secret')),/raw remote secret/);
});
