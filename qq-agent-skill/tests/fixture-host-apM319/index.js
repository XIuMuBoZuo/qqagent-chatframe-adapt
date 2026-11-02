import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// The tool never accepts a path, executable, command, destination, or template
// from a QQ message/model. CHATFRAME_PYTHON is set by the local operator only.
const base=path.dirname(fileURLToPath(import.meta.url));
const renderer=path.join(base,'renderer','render_card.py');
const maxTextLength=2000,maxOutputBytes=12*1024*1024;
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const errorTexts={TEXT_TOO_LONG:'文字太长，请缩短后重试。',TEXT_OVERFLOW:'当前聊天框装不下这些文字，请缩短后重试。',INVALID_REQUEST:'无法识别本次文字，请重新提供。',RENDER_FAILED:'聊天框渲染未完成，请检查本机环境。'};

function intended(text){
 if(typeof text!=='string'||!text.trim())return false;
 if(/(?:不要|不用|不必|别|禁止|取消).{0,12}(?:聊天框|对话框|转图|转成|做成|生成图片)/s.test(text))return false;
 return /聊天框|对话框|文字转图|转成.{0,4}(?:图片|图)|做成.{0,4}(?:图片|图)|(?:生成|做|来|变成).{0,8}(?:图片|图像|图卡)/s.test(text);
}
function targetValid(ctx){
 return ctx&&['private','group'].includes(ctx.kind)&&/^\d{5,14}$/.test(String(ctx.chatId||''))&&ctx.chatKey===`${ctx.kind}:${ctx.chatId}`&&typeof ctx.sender?.sendImage==='function'&&ctx.session?.trigger!=='proactive';
}
function render(text,dir){
 return new Promise((resolve,reject)=>{
  const env={};for(const key of ['PATH','Path','SYSTEMROOT','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
  env.PYTHONIOENCODING='utf-8';env.PYTHONUTF8='1';
  const interpreter=process.env.CHATFRAME_PYTHON||'python';
  let child,finished=false,buffer='',timer;
  const finish=(err,result)=>{if(finished)return;finished=true;clearTimeout(timer);err?reject(err):resolve(result);};
  try{child=spawn(interpreter,[renderer,'--output-dir',dir],{shell:false,windowsHide:true,env,stdio:['pipe','pipe','ignore']});}
  catch{return finish(new Error('START_FAILED'));}
  timer=setTimeout(()=>{child.kill();finish(new Error('TIMEOUT'));},45000);
  child.on('error',()=>finish(new Error('START_FAILED')));
  child.stdin.on('error',()=>{});
  child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;if(Buffer.byteLength(buffer,'utf8')>65536){child.kill();finish(new Error('OUTPUT_LIMIT'));}});
  child.on('close',code=>{if(finished)return;let result;try{result=JSON.parse(buffer.trim());}catch{return finish(new Error('BAD_RESULT'));}
   if(code!==0||result?.ok!==true)return finish(new Error(Object.hasOwn(errorTexts,result?.error?.code)?result.error.code:'RENDER_FAILED'));
   finish(null,result);
  });
  child.stdin.end(JSON.stringify({text})+'\n');
 });
}
function readValidPng(result,outputDir){
 if(typeof result?.image_path!=='string'||!path.isAbsolute(result.image_path)||path.extname(result.image_path).toLowerCase()!=='.png')throw new Error('BAD_FILE');
 const realDir=fs.realpathSync(outputDir),realFile=fs.realpathSync(result.image_path);
 if(path.dirname(realFile)!==realDir||fs.lstatSync(result.image_path).isSymbolicLink())throw new Error('BAD_FILE');
 const stat=fs.statSync(realFile);if(!stat.isFile()||stat.size<24||stat.size>maxOutputBytes)throw new Error('BAD_FILE');
 const bytes=fs.readFileSync(realFile);if(!bytes.subarray(0,8).equals(signature)||bytes.toString('ascii',12,16)!=='IHDR')throw new Error('BAD_FILE');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>4096||height>4096||width*height>8_000_000||width!==result.width||height!==result.height)throw new Error('BAD_FILE');
 return {file:realFile,bytes};
}
export function available(){return fs.existsSync(renderer)?true:{ok:false,reason:'本机聊天框渲染组件尚未就绪。'};}
export function setup(api){
 api.registerTool({
  id:'render_chatframe',name:'制作聊天框图片',category:'media',
  description:'仅在本轮用户明确要求把文字制作成聊天框、对话框图片时调用，文字为要放进图片里的内容；只发送到当前会话。',
  parameters:{type:'object',properties:{text:{type:'string',description:'用户明确指定或本轮要求放进聊天框的纯文字，最多2000字。'}},required:['text'],additionalProperties:false},
  async execute(ctx,args){
   if(!targetValid(ctx))return {content:'当前会话不可用于发送聊天框图片。',isError:true};
   if(!intended(ctx.session?.triggerText))return {content:'本轮没有明确的聊天框图片请求，请先明确提出。',isError:true};
   if(!args||typeof args!=='object'||Object.keys(args).some(k=>k!=='text')||typeof args.text!=='string'||!args.text.trim()||args.text.length>maxTextLength)return {content:'请提供2000字以内的聊天框文字。',isError:true};
   if(!fs.existsSync(renderer))return {content:'本机聊天框渲染组件尚未就绪。',isError:true};
   let dir=null,file=null;
   try{
    dir=fs.mkdtempSync(path.join(os.tmpdir(),'chatframe-qqagent-'));
    const result=await render(args.text,dir),picture=readValidPng(result,dir);file=picture.file;
    await ctx.sender.sendImage(ctx.chatKey,{dataUrl:'data:image/png;base64,'+picture.bytes.toString('base64')},{});
    return {content:'聊天框图片已发送到当前会话，请勿重复发送。'};
   }catch(error){return {content:errorTexts[error?.message]||'聊天框图片暂未生成或发送，请检查本机渲染环境和 QQ 连接。',isError:true};}
   finally{
    // Remove only our verified temporary result and its now-empty directory.
    if(file)try{fs.unlinkSync(file);}catch{}
    if(dir)try{fs.rmdirSync(dir);}catch{}
   }
  }
 });
}
