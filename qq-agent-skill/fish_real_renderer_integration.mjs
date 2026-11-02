import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adaptReply} from './automatic-adapter.mjs';
import {createRenderer} from './automatic-renderer.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),stage=path.resolve(here,'..');
const python='C:/Users/UU189/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const script=path.join(stage,'renderer','render_card.py');
const evidence=fs.mkdtempSync(path.join(stage,'集成证据_'));
const render=createRenderer({python,script});
let images=[],texts=[],throws=false;
const ctx={kind:'group',chatId:'555551111',chatKey:'group:555551111',session:{id:'test',sent:[]},emit(){},sender:{
 async sendImage(chatKey,image,opts){
  assert.equal(chatKey,ctx.chatKey);assert(image.file&&!image.dataUrl);
  if(throws)throw new Error('mock uncertain send');
  const bytes=fs.readFileSync(image.file);assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  fs.writeFileSync(path.join(evidence,'模拟发送的聊天框.png'),bytes,{flag:'wx'});images.push({opts,bytes:bytes.length});
 },
 async sendTextBatch(chatKey,messages,opts){texts.push({chatKey,messages,opts});return {sent:messages.map(text=>({text,at:'00:00'})),failed:[]};}
}};
const normalizeMessages=x=>typeof x==='string'?[x]:Array.isArray(x)?x:[];
const args={messages:'吾辈的这段话，也能住进聊天框里。',replyToMessageId:42,atUserId:123456789};
const disabled=await adaptReply({enabled:false,ctx,args,normalizeMessages,render});
assert.equal(disabled.status,'passthrough');assert.equal(images.length+texts.length,0);
const enabled=await adaptReply({enabled:true,ctx,args,normalizeMessages,render});
assert.equal(enabled.status,'completed');assert.equal(images.length,1);assert.equal(texts.length,0);
assert.equal(images[0].opts.replyToMessageId,42);assert.equal(images[0].opts.atUserId,123456789);
assert.equal(ctx.session.sent.at(-1).type,'image');
const overlong='字'.repeat(241);
const fallback=await adaptReply({enabled:true,ctx,args:{messages:overlong},normalizeMessages,render});
assert.equal(fallback.status,'completed');assert.equal(texts.length,1);assert.equal(texts[0].messages[0],overlong);
throws=true;
const uncertain=await adaptReply({enabled:true,ctx,args:{messages:'发送状态不确定的模拟'},normalizeMessages,render});
assert.equal(uncertain.status,'uncertain');assert.equal(uncertain.reason,'image_send_unknown');assert.equal(texts.length,1);
const result={passed:true,real_renderer:true,real_QQ_messages:0,model_calls:0,QQ_Agent_real_host_tested:false,
 checks:['real_renderer_to_simulated_QQ_Agent_sender','disabled_mode_does_not_send','reference_and_at_options_preserved','overlong_text_falls_back_once','uncertain_image_send_does_not_retry_or_fallback'],sample:path.join(evidence,'模拟发送的聊天框.png')};
fs.writeFileSync(path.join(evidence,'闭环验收.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
