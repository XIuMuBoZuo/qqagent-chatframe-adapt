import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url)),skill=path.resolve(testDir,'..');
const fixture=fs.mkdtempSync(path.join(testDir,'fixture-host-'));fs.mkdirSync(path.join(fixture,'renderer'));
fs.copyFileSync(path.join(skill,'index.js'),path.join(fixture,'index.js'));
fs.copyFileSync(path.join(skill,'package.json'),path.join(fixture,'package.json'));
fs.copyFileSync(path.join(testDir,'fake_renderer.py'),path.join(fixture,'renderer','render_card.py'));
const mod=await import(pathToFileURL(path.join(fixture,'index.js')).href);
assert.equal(mod.available(),true);
let tool;mod.setup({registerTool(t){tool=t;}});assert.equal(tool.id,'render_chatframe');assert.deepEqual(Object.keys(tool.parameters.properties),['text']);
const sent=[],ctx={kind:'group',chatId:'555551111',chatKey:'group:555551111',session:{trigger:[{text:'请把下面的内容做成聊天框图片'}],sent:[]},sender:{sendImage:async(...args)=>{sent.push(args);return {message_id:88};}}};
const text='模拟文本 $(touch not-a-command) `test`';
let r=await tool.execute(ctx,{text});assert.equal(r.isError,undefined);assert.equal(sent.length,1);assert.equal(sent[0][0],ctx.chatKey);assert(sent[0][1].dataUrl.startsWith('base64://'));assert(!r.content.includes(text));assert.equal(ctx.session.sent.length,1);assert.equal(ctx.session.sent[0].type,'image');
const n=sent.length;
for(const [badCtx,badArgs] of [
 [{...ctx,chatKey:'group:555552222'},{text:'内容'}],
 [{...ctx,session:{trigger:'proactive',triggerText:'做聊天框图片',sent:[]}},{text:'内容'}],
 [{...ctx,session:{trigger:[],triggerText:'请做聊天框图片',sent:[]}},{text:'内容'}],
 [{...ctx,session:{trigger:[{text:'今天怎么样'}],sent:[]}},{text:'内容'}],
 [{...ctx,session:{trigger:[{text:'不要做聊天框图片'}],sent:[]}},{text:'内容'}],
 [ctx,{text:'内容',path:'C:/private'}],
 [ctx,{text:'x'.repeat(2001)}],
 [ctx,{text:'__overflow__'}],
 [ctx,{text:'__wrong_path__'}],
 [ctx,{text:'__bad_png__'}]
]){const result=await tool.execute(badCtx,badArgs);assert.equal(result.isError,true);assert.equal(sent.length,n);}
const privateCtx={...ctx,kind:'private',chatId:'123456789',chatKey:'private:123456789'};
r=await tool.execute(privateCtx,{text:'你好'});assert.equal(r.isError,undefined);assert.equal(sent.at(-1)[0],privateCtx.chatKey);
const failCtx={...ctx,sender:{sendImage:async()=>{throw new Error('do not leak error detail');}}};
r=await tool.execute(failCtx,{text:'你好'});assert.equal(r.isError,true);assert(!r.content.includes('do not leak'));
assert(!fs.existsSync(path.join(fixture,'not-a-command')));
console.log(JSON.stringify({passed:true,real_QQ_messages:0,checks:['registered_tool_only_with_text_argument','explicit_request_required','proactive_denied','real_sender_and_current_chat_only','no_shell_user_text','renderer_failures_and_traversal_rejected','PNG_header_and_dimensions_checked','send_failure_reported_without_leaking','private_and_group_routing'] }));
