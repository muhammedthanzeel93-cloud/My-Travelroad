/**
 * Helper to polyfill cjson in ioredis-mock Fengari Lua runtime.
 * Native Redis (used in real-redis.integration.test.ts and production) has native cjson preloaded.
 * In unit tests using ioredis-mock, this polyfills cjson without altering production lua scripts.
 */
export function setupRedisMock(redis: any): void {
  const originalEval = redis.eval.bind(redis);
  redis.eval = (script: string, numKeys: number, ...args: any[]) => {
    if (typeof script === "string" && script.includes("cjson.decode") && !script.includes("-- CJSON_POLYFILL_INJECTED")) {
      const polyfill = `
        -- CJSON_POLYFILL_INJECTED
        if not cjson then
          cjson = {}
          function cjson.decode(str)
            if type(str) ~= 'string' or string.sub(str, 1, 1) ~= '{' then
              error('Invalid JSON')
            end
            local t = {}
            for k, v in string.gmatch(str, '"([%w_]+)":"?([^",}]+)"?') do
              t[k] = v
            end
            return t
          end
        end
      `;
      return originalEval(polyfill + "\n" + script, numKeys, ...args);
    }
    return originalEval(script, numKeys, ...args);
  };
}
