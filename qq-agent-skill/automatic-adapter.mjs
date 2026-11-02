// Explicitly invoked host adapter prototype. Not a QQ Agent extension entrypoint.
// `render` is trusted host code; it receives text and a private output directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const signature = Buffer.from([137,80,78,71,13,10,26,10]);
const targetTool = 'chatframe-auto__send';

// Only a host-supplied snapshot for this very run is sufficient evidence.
export function canRedirect({enabled, availableToolIds} = {}) {
  return enabled === true && availableToolIds instanceof Set &&
    availableToolIds.has('send_message') && availableToolIds.has(targetTool);
}

function validateContext(ctx) {
  return ctx && ['private','group'].includes(ctx.kind) && /^\d{5,14}$/.test(String(ctx.chatId ?? '')) &&
    ctx.chatKey === `${ctx.kind}:${ctx.chatId}` && typeof ctx.sender?.sendImage === 'function' &&
    typeof ctx.sender?.sendTextBatch === 'function' && Array.isArray(ctx.session?.sent);
}

function readPng(result, directory) {
  const p = result?.image_path;
  if (typeof p !== 'string' || !path.isAbsolute(p) || path.extname(p).toLowerCase() !== '.png') throw Error('BAD_OUTPUT');
  const dir = fs.realpathSync(directory), real = fs.realpathSync(p);
  if (path.dirname(real) !== dir || fs.lstatSync(p).isSymbolicLink()) throw Error('BAD_OUTPUT');
  const st = fs.statSync(real);
  if (!st.isFile() || st.size < 24 || st.size > 12*1024*1024) throw Error('BAD_OUTPUT');
  const bytes = fs.readFileSync(real);
  if (!bytes.subarray(0,8).equals(signature) || bytes.toString('ascii',12,16) !== 'IHDR') throw Error('BAD_OUTPUT');
  const width=bytes.readUInt32BE(16), height=bytes.readUInt32BE(20);
  if (!width || !height || width>4096 || height>4096 || width*height>8_000_000 || width!==result.width || height!==result.height) throw Error('BAD_OUTPUT');
  // Supply only one representation: this fork retries a failed file send
  // automatically when dataUrl is also present, including ambiguous timeouts.
  return {file:real};
}

/**
 * Only enabled invocations are handled. Disabled/unsupported calls return
 * passthrough before any send; the caller then invokes the original tool.
 * The host MUST normalize messages exactly as its original send_message does.
 */
export async function adaptReply({enabled, ctx, args, normalizeMessages, render}) {
  if (enabled !== true) return {status:'passthrough', reason:'disabled'};
  if (!validateContext(ctx)) return {status:'rejected', reason:'invalid_current_chat'};
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k => !['messages','atUserId','replyToMessageId'].includes(k)))
    return {status:'rejected', reason:'invalid_arguments'};
  if (typeof normalizeMessages !== 'function' || typeof render !== 'function') return {status:'passthrough',reason:'host_dependencies_missing'};
  let messages;
  try { messages=normalizeMessages(args.messages); } catch { return {status:'passthrough',reason:'normalization_failed'}; }
  if (!Array.isArray(messages) || !messages.length || messages.some(x=>typeof x!=='string'||!x.trim()))
    return {status:'passthrough',reason:'unsupported_messages'};
  const records=[];
  const notify=()=>{try{ctx.emit?.('session-update',ctx.session.id);}catch{}};
  for (let i=0;i<messages.length;i++) {
    const text=messages[i], options={replyToMessageId:i===0?(args.replyToMessageId??null):null,atUserId:i===0?(args.atUserId??null):null};
    let directory=null, picture=null;
    try {
      if (Array.from(text).length>240) throw Error('TEXT_TOO_LONG');
      directory=fs.mkdtempSync(path.join(os.tmpdir(),'chatframe-auto-'));
      const generated=await render(text,directory);
      picture=readPng(generated,directory);
    } catch {
      // No image send has been attempted: a single text fallback is safe.
      try {
        const out=await ctx.sender.sendTextBatch(ctx.chatKey,[text],options);
        if (Array.isArray(out?.sent) && out.sent.length) {
          ctx.session.sent.push(...out.sent.map(s=>({type:'text',text:s.text,at:s.at})));
          notify();
        }
        if (!Array.isArray(out?.sent) || out.failed?.length || !out.sent.length) return {status:'uncertain',records,stoppedAt:i,reason:'text_send_incomplete'};
        records.push({index:i,mode:'text'});
      } catch { return {status:'uncertain',records,stoppedAt:i,reason:'text_send_failed'}; }
      finally { if(directory)try{fs.rmdirSync(directory);}catch{} }
      continue;
    }
    try {
      await ctx.sender.sendImage(ctx.chatKey,picture,{...options,note:'聊天框图片'});
      ctx.session.sent.push({type:'image',text:'[图片:聊天框图片]',at:new Date().toLocaleTimeString('zh-CN',{hour12:false})});
      notify(); records.push({index:i,mode:'image'});
    } catch {
      // A timeout may occur after QQ accepted the image. Never send the text
      // fallback, and stop rather than delivering later messages out of order.
      return {status:'uncertain',records,stoppedAt:i,reason:'image_send_unknown'};
    } finally {
      if(picture?.file)try{fs.unlinkSync(picture.file);}catch{}
      if(directory)try{fs.rmdirSync(directory);}catch{}
    }
  }
  return {status:'completed',records};
}
