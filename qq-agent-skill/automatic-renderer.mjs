// Host-only bridge. The operator chooses the executable and script; neither is
// accepted from QQ/model input. stdout/error details are not shown to QQ.
import path from 'node:path';
import {spawn} from 'node:child_process';

export function createRenderer({python, script, timeoutMs=45000}) {
  if (!path.isAbsolute(python||'') || !path.isAbsolute(script||'')) throw Error('Host must set absolute Python and renderer paths');
  return (text, directory) => new Promise((resolve, reject) => {
    const env={};
    for(const key of ['PATH','Path','SYSTEMROOT','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA']) if(process.env[key])env[key]=process.env[key];
    env.PYTHONIOENCODING='utf-8';env.PYTHONUTF8='1';
    let child, output='', done=false, timer;
    const finish=(err,result)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(result);};
    try {child=spawn(python,[script,'--output-dir',directory],{shell:false,windowsHide:true,env,stdio:['pipe','pipe','ignore']});}
    catch {return finish(Error('RENDER_START_FAILED'));}
    timer=setTimeout(()=>{child.kill();finish(Error('RENDER_TIMEOUT'));},timeoutMs);
    child.on('error',()=>finish(Error('RENDER_START_FAILED')));
    child.stdin.on('error',()=>{});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output,'utf8')>65536){child.kill();finish(Error('RENDER_OUTPUT_LIMIT'));}});
    child.on('close',code=>{
      if(done)return;
      let result;try{result=JSON.parse(output.trim());}catch{return finish(Error('RENDER_INVALID_RESPONSE'));}
      if(code!==0 || result?.ok!==true)return finish(Error('RENDER_FAILED'));
      finish(null,result);
    });
    child.stdin.end(JSON.stringify({text})+'\n');
  });
}
