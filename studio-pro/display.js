(function(root){'use strict';
 const KEY='e-instru-display-v1';
 const THEMES=['system','light','dark'],VISIONS=['standard','protanopia','deuteranopia','tritanopia','contrast'];
 const PALETTES={standard:['#EB8C88','#EDA971','#E6C360','#8FC79B','#6BBEB8','#82B9DB','#A1ACE0','#C3A2D6'],protanopia:['#9BC8F0','#F3BE70','#CBC0EB','#E9D791','#91CBCD','#E9BDCE','#BACDE4','#D2CBC0'],deuteranopia:['#A3CEF0','#F0BB74','#C9BCEA','#E8D994','#9EC9D5','#E8BED2','#BDCFDF','#D9CABC'],tritanopia:['#81C8CD','#F2AEA1','#D7B3C7','#AAD8D5','#F0C3B0','#BAC4DC','#E1BBD1','#A9CBCB'],contrast:['#FFFFFF','#E6E6E6','#CDCDCD','#FFFFFF','#E6E6E6','#CDCDCD','#FFFFFF','#E6E6E6']};
 const normalize=value=>({theme:THEMES.includes(value?.theme)?value.theme:'system',vision:VISIONS.includes(value?.vision)?value.vision:'standard'});
 let preferences=normalize(null),savingError=false,media=null;
 try{preferences=normalize(JSON.parse(root.localStorage.getItem(KEY)||'null'));}catch{}
 try{media=root.matchMedia?.('(prefers-color-scheme: dark)')||null;}catch{}
 const resolvedTheme=()=>preferences.theme==='system'?(media?.matches?'dark':'light'):preferences.theme;
 function apply(){
  const el=document.documentElement;el.dataset.theme=resolvedTheme();el.dataset.vision=preferences.vision;
  PALETTES[preferences.vision].forEach((color,i)=>el.style.setProperty('--vision-note-'+i,color));
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',resolvedTheme()==='dark'?'#101B26':'#EDF3F7');
  const theme=document.getElementById('displayTheme'),vision=document.getElementById('displayVision');if(theme)theme.value=preferences.theme;if(vision)vision.value=preferences.vision;
  const status=document.getElementById('displaySaveStatus');if(status)status.textContent=savingError?'Pilihan digunakan untuk sesi ini. Simpanan peranti tidak tersedia.':'Pilihan disimpan pada peranti ini.';
  if(typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('studiodisplaychange',{detail:{...preferences,resolvedTheme:resolvedTheme(),palette:PALETTES[preferences.vision].slice()}}));
 }
 function set(patch){preferences=normalize({...preferences,...patch});savingError=false;try{root.localStorage.setItem(KEY,JSON.stringify(preferences));}catch{savingError=true;}apply();return {...preferences};}
 function ready(){
  const $=id=>document.getElementById(id),dialog=$('displayDialog'),trigger=$('displaySettingsBtn');if(!dialog||!trigger)return;
  let returnFocus=null;
  const close=()=>dialog.close();
  trigger.addEventListener('click',()=>{if(document.querySelector('dialog[open]'))return;returnFocus=document.activeElement;apply();dialog.showModal();$('displayTheme').focus();});
  $('displayTheme').addEventListener('change',()=>set({theme:$('displayTheme').value}));
  $('displayVision').addEventListener('change',()=>set({vision:$('displayVision').value}));
  $('displayClose').addEventListener('click',close);$('displayDone').addEventListener('click',close);
  $('displayReset').addEventListener('click',()=>set({theme:'system',vision:'standard'}));
  dialog.addEventListener('close',()=>{returnFocus?.focus?.();returnFocus=null;});
  apply();
 }
 root.StudioDisplay=Object.freeze({get:()=>({...preferences}),set,normalize,resolvedTheme,palette:()=>PALETTES[preferences.vision].slice(),KEY});
 media?.addEventListener?.('change',()=>{if(preferences.theme==='system')apply();});
 root.addEventListener('storage',event=>{if(event.key!==KEY)return;try{preferences=normalize(JSON.parse(event.newValue||'null'));savingError=false;apply();}catch{}});
 apply();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})(window);
