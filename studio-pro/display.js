(function(root){'use strict';
 const KEY='e-instru-display-v1';
 const THEMES=['system','light','dark'],VISIONS=['standard','protanopia','deuteranopia','tritanopia','contrast'];
 const PALETTES={standard:['#EB8C88','#EDA971','#E6C360','#8FC79B','#6BBEB8','#82B9DB','#A1ACE0','#C3A2D6'],protanopia:['#9BC8F0','#F3BE70','#CBC0EB','#E9D791','#91CBCD','#E9BDCE','#BACDE4','#D2CBC0'],deuteranopia:['#A3CEF0','#F0BB74','#C9BCEA','#E8D994','#9EC9D5','#E8BED2','#BDCFDF','#D9CABC'],tritanopia:['#81C8CD','#F2AEA1','#D7B3C7','#AAD8D5','#F0C3B0','#BAC4DC','#E1BBD1','#A9CBCB'],contrast:['#FFFFFF','#E6E6E6','#CDCDCD','#FFFFFF','#E6E6E6','#CDCDCD','#FFFFFF','#E6E6E6']};
 const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function normalize(value){
  const next=isRecord(value)?value:{};
  return{theme:Object.hasOwn(next,'theme')&&THEMES.includes(next.theme)?next.theme:'system',vision:Object.hasOwn(next,'vision')&&VISIONS.includes(next.vision)?next.vision:'standard'};
 }
 let preferences=normalize(null),saveState='default',media=null,saved=null;
 // Read failures and malformed preference data have different user consequences.
 // Neither recovery path rewrites unrelated music or account storage.
 try{saved=root.localStorage.getItem(KEY);}catch{saveState='session';}
 if(saved!==null)try{
  const value=JSON.parse(saved);preferences=normalize(value);
  if(isRecord(value)&&(THEMES.includes(value.theme)||VISIONS.includes(value.vision)))saveState='restored';
 }catch{}
 try{media=root.matchMedia?.('(prefers-color-scheme: dark)')||null;}catch{}
 const resolvedTheme=()=>preferences.theme==='system'?(media?.matches?'dark':'light'):preferences.theme;
 function emit(name,detail){if(typeof root.CustomEvent==='function'&&typeof root.dispatchEvent==='function')root.dispatchEvent(new root.CustomEvent(name,{detail}));}
 function apply(){
  const selectedTheme=resolvedTheme(),el=document.documentElement;el.dataset.theme=selectedTheme;el.dataset.vision=preferences.vision;el.style.colorScheme=selectedTheme;
  PALETTES[preferences.vision].forEach((color,i)=>el.style.setProperty('--vision-note-'+i,color));
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',preferences.vision==='contrast'?(selectedTheme==='dark'?'#000000':'#FFFFFF'):(selectedTheme==='dark'?'#101B26':'#EDF3F7'));
  const theme=document.getElementById('displayTheme'),vision=document.getElementById('displayVision');if(theme)theme.value=preferences.theme;if(vision)vision.value=preferences.vision;
  const status=document.getElementById('displaySaveStatus');if(status)status.textContent=saveState==='session'?'Pilihan digunakan untuk sesi ini. Simpanan pelayar tidak tersedia.':saveState==='saved'?'Pilihan disimpan dalam pelayar ini.':saveState==='restored'?'Pilihan dipulihkan daripada pelayar ini.':'Tetapan asal digunakan. Ubah pilihan untuk menyimpannya dalam pelayar ini.';
  emit('studiodisplaychange',{...preferences,resolvedTheme:selectedTheme,palette:PALETTES[preferences.vision].slice()});
 }
 function set(patch){
  preferences=normalize({...preferences,...(isRecord(patch)?patch:{})});
  try{root.localStorage.setItem(KEY,JSON.stringify(preferences));saveState='saved';}catch{saveState='session';}
  apply();return {...preferences};
 }
 function ready(){
  // The boot script can run before the meta element and dialog have been parsed.
  apply();
  const $=id=>document.getElementById(id),dialog=$('displayDialog'),trigger=$('displaySettingsBtn'),theme=$('displayTheme'),vision=$('displayVision'),closeButton=$('displayClose'),doneButton=$('displayDone'),resetButton=$('displayReset');
  if(!dialog||!trigger||!theme||!vision||!closeButton||!doneButton||!resetButton)return;
  let returnFocus=null;
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','displayDialog');trigger.setAttribute('aria-expanded','false');
  function finishClose(){
   if(dialog.open)return;
   trigger.setAttribute('aria-expanded','false');
   if(!returnFocus)return;
   const previous=returnFocus;returnFocus=null;
   const target=previous.isConnected!==false&&!previous.disabled&&!previous.closest?.('[hidden], [inert]')?previous:trigger;
   target.focus?.({preventScroll:true});
  }
  function close(){if(dialog.open)dialog.close();finishClose();}
  trigger.addEventListener('click',()=>{
   if(dialog.open||document.querySelector('dialog[open]'))return;
   returnFocus=document.activeElement&&document.activeElement!==document.body?document.activeElement:trigger;
   apply();emit('studiodisplayopen');dialog.showModal();trigger.setAttribute('aria-expanded','true');theme.focus({preventScroll:true});
  });
  theme.addEventListener('change',()=>set({theme:theme.value}));
  vision.addEventListener('change',()=>set({vision:vision.value}));
  closeButton.addEventListener('click',close);doneButton.addEventListener('click',close);
  resetButton.addEventListener('click',()=>set({theme:'system',vision:'standard'}));
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',finishClose);
 }
 root.StudioDisplay=Object.freeze({get:()=>({...preferences}),set,normalize,resolvedTheme,palette:()=>PALETTES[preferences.vision].slice(),KEY});
 const followSystem=()=>{if(preferences.theme==='system')apply();};
 if(typeof media?.addEventListener==='function')media.addEventListener('change',followSystem);
 else if(typeof media?.addListener==='function')media.addListener(followSystem);
 root.addEventListener('storage',event=>{
  if(event.key!==KEY&&event.key!==null)return;
  // sessionStorage events use the same event type but do not own these settings.
  if(event.storageArea)try{if(event.storageArea!==root.localStorage)return;}catch{return;}
  let value=null;try{value=JSON.parse(event.newValue||'null');}catch{return;}
  preferences=normalize(value);saveState=isRecord(value)&&(THEMES.includes(value.theme)||VISIONS.includes(value.vision))?'restored':'default';apply();
 });
 apply();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})(window);
