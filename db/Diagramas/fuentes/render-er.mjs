import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [modulePath, inputDir, outputDir]=process.argv.slice(2);
const {instance}=await import(pathToFileURL(path.resolve(modulePath)).href);

for(const name of fs.readdirSync(inputDir).filter(x=>x.endsWith('.dot'))){
 const viz=await instance();
 const input=fs.readFileSync(path.join(inputDir,name),'utf8');
 const result=viz.renderFormats(input,['svg','json'],{engine:'dot'});
 if(result.status!=='success'||result.errors?.some(e=>e.level==='error'))throw Error(JSON.stringify(result.errors));
 const warnings=result.errors??[];
 if(warnings.length) console.log(name,JSON.stringify(warnings));
 const stem=name.slice(0,-4);
 fs.writeFileSync(path.join(outputDir,stem+'.svg'),result.output.svg.replace(/<a\b[^>]*>/g,'').replace(/<\/a>/g,''));
 fs.writeFileSync(path.join(outputDir,stem+'.layout.json'),result.output.json);
 console.log(stem);
}
