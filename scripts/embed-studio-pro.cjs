'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').trim();
const modules=['core','audio','arranger','mixer','projects','shell'];
const styles=['arranger','mixer','projects','shell','display'];
function block(name,body){return '<!-- studio-pro:'+name+':start -->\n'+body+'\n<!-- studio-pro:'+name+':end -->';}
function place(html,name,body,before){
 const start='<!-- studio-pro:'+name+':start -->',end='<!-- studio-pro:'+name+':end -->';
 const a=html.indexOf(start),b=html.indexOf(end);
 const content=block(name,body);
 if(a>=0){if(b<a||html.indexOf(start,a+1)>=0)throw Error('Invalid embedded '+name+' markers');return html.slice(0,a)+content+html.slice(b+end.length);}
 if(!html.includes(before))throw Error('Missing insertion point '+before);
 return html.replace(before,content+'\n'+before);
}
let html=read('index.html')+'\n';
// Extend the existing bilingual owner without replacing its shipped corpus.
const translationsPath=path.join(root,'studio-pro/i18n.json');
if(fs.existsSync(translationsPath)){
 const extra=JSON.parse(fs.readFileSync(translationsPath,'utf8'));
 const ownership=/\n\s*\/\* studio-pro:i18n-owned (.*?) \*\//;
 const previous=ownership.exec(html),owned=previous?JSON.parse(previous[1]):{entries:[],templates:[]};
 html=html.replace(ownership,'');
 const corpus=/const entries = (\[[\s\S]*?\]);\s*const templates = (\[[\s\S]*?\]);/;
 if(!corpus.test(html))throw Error('Missing canonical StudioI18n corpus');
 html=html.replace(corpus,(_match,entriesText,templatesText)=>{
  const priorPhrases=new Set(owned.entries),priorPatterns=new Set(owned.templates);
  const entries=JSON.parse(entriesText).filter(pair=>!priorPhrases.has(pair[0])),templates=JSON.parse(templatesText).filter(item=>!priorPatterns.has(item.ms));
  const phrases=new Set(entries.map(pair=>pair[0])),patterns=new Set(templates.map(item=>item.ms));
  const nextOwned={entries:[],templates:[]};
  for(const pair of extra.entries){if(!phrases.has(pair[0])){entries.push(pair);phrases.add(pair[0]);nextOwned.entries.push(pair[0]);}}
  for(const item of extra.templates){if(!patterns.has(item.ms)){templates.push(item);patterns.add(item.ms);nextOwned.templates.push(item.ms);}}
  return 'const entries = '+JSON.stringify(entries,null,2).replace(/<\//g,'<\\/')+';\n  const templates = '+JSON.stringify(templates,null,2).replace(/<\//g,'<\\/')+';\n  /* studio-pro:i18n-owned '+JSON.stringify(nextOwned).replace(/<\//g,'<\\/')+' */';
 });
}
html=place(html,'display-boot','<script id="studio-display">\n'+read('studio-pro/display.js').replace(/<\/script/gi,'<\\/script')+'\n</script>','<meta name="theme-color"');
html=place(html,'styles',styles.map(name=>'<style id="pro-'+name+'-style">\n'+read('studio-pro/'+name+'.css')+'\n</style>').join('\n'),'</head>');
html=place(html,'view',read('studio-pro/shell.html')+'\n'+read('studio-pro/display.html'),'</main>');
html=place(html,'scripts',modules.map(name=>'<script id="pro-'+name+'">\n'+read('studio-pro/'+name+'.js').replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n'),'</body>');
if(process.argv.includes('--check')){
 if(html!==fs.readFileSync(path.join(root,'index.html'),'utf8')){console.error('Embedded Studio Pro sources are stale. Run node scripts/embed-studio-pro.cjs.');process.exitCode=1;}
 else console.log('Embedded Studio Pro sources match all modules.');
}else{fs.writeFileSync(path.join(root,'index.html'),html);console.log('Embedded Studio Pro sources updated.');}
