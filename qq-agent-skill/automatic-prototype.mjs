// Offline-only design exercise. A QQ Agent hook does not currently provide
// availableToolIds: never fabricate it from session.excludedTools.
export function rewriteNativeCalls(response, {enabled, availableToolIds} = {}) {
  const target = 'chatframe-auto__send';
  if (enabled !== true || !(availableToolIds instanceof Set) ||
      !availableToolIds.has('send_message') || !availableToolIds.has(target)) return 0;
  const calls = response?.message?.tool_calls;
  if (!Array.isArray(calls)) return 0;
  let count = 0;
  for (const call of calls) {
    if (call?.type === 'function' && call.function?.name === 'send_message') {
      call.function.name = target;
      count++;
    }
  }
  return count;
}
