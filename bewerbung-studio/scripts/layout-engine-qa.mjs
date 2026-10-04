import {createServer} from 'vite';import {parseHTML} from 'linkedom';import fs from 'node:fs/promises';import path from 'node:path';
const out=path.resolve('tmp/layout-engine-qa');await fs.mkdir(out,{recursive:true});
const vite=await createServer({configFile:false,root:process.cwd(),appType:'custom',logLevel:'error',server:{middlewareMode:true}});
try{
 const {applyResumePageLayout}=await vite.ssrLoadModule('/src/shared/resumeLayoutEngine.ts');
 const {defaultDocumentDesign}=await vite.ssrLoadModule('/src/shared/documentDesign.ts');
 const {templates}=await vite.ssrLoadModule('/src/shared/templates.ts');
 const failures=[];let count=0;
 for(const {id} of templates)for(const surface of ['preview','pdf'])for(const [mode,side,percent] of [['single','left',20],['two-column','left',25],['two-column','right',40]]){
  const html=await fs.readFile(`tmp/section-inheritance-qa/${id}-visual-${surface}.html`,'utf8');
  const {document}=parseHTML(html);
  const page=document.querySelector('.cv-sheet')??document.body;
  applyResumePageLayout(page,id,surface,{...defaultDocumentDesign,resumePresentation:{layoutMode:mode,sidebarSide:side,sidebarWidthPercent:percent}});
  const host=document.querySelector('[data-resume-layout]');
  if(mode==='two-column'&&!host)failures.push(`${id}/${surface}/${mode}/${side}: missing layout host`);
  if(host){
   const style=host.getAttribute('style')??'';
   if(!style.includes(mode==='single'?'1fr':`${percent}fr`))failures.push(`${id}/${surface}/${mode}/${side}: ${style}`);
  }
  const name=`${id}-${surface}-${mode}-${side}`;await fs.writeFile(path.join(out,name+'.html'),document.toString());count++;
 }
 console.log({count,failures});if(failures.length)process.exitCode=1;
}finally{await vite.close();}
