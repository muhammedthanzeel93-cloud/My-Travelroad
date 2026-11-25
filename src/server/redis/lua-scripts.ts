/**
 * My Travelroad — Deterministic Same-Slot Redis Lua Scripts
 * Implements atomic token rotation, replay revocation, and single-device logout.
 * All keys passed explicitly via KEYS array; all keys utilize same-slot {familyId} tagging.
 * References: docs/architecture/api-architecture.md Section 6.3
 */

/**
 * Deterministic Atomic Rotation Script (6 KEYS, 8 ARGV)
 *
 * KEYS[1]: family:{familyId}
 * KEYS[2]: token_lookup:{familyId}:{presentedTokenHash}
 * KEYS[3]: session:{familyId}:{oldSessionId}
 * KEYS[4]: revoked_token:{familyId}:{presentedTokenHash}
 * KEYS[5]: token_lookup:{familyId}:{replacementTokenHash}
 * KEYS[6]: session:{familyId}:{newSessionId}
 *
 * ARGV[1]: presentedTokenHash
 * ARGV[2]: replacementTokenHash
 * ARGV[3]: newSessionId
 * ARGV[4]: ipAddress
 * ARGV[5]: userAgent
 * ARGV[6]: timestamp (ISO 8601)
 * ARGV[7]: ttl (seconds, e.g. 2592000)
 * ARGV[8]: tombstoneTtl (seconds, e.g. 86400)
 */
export const ATOMIC_ROTATION_LUA = `
-- 1. Verify family exists
if redis.call('EXISTS', KEYS[1]) == 0 then
    return {'ERROR', 'FAMILY_NOT_FOUND'}
end

-- 2. Verify family is not already compromised
local isCompromised = redis.call('HGET', KEYS[1], 'isCompromised')
if isCompromised == '1' then
    return {'ERROR', 'FAMILY_COMPROMISED'}
end

-- 3. Verify active token hash matches presented token hash
local activeTokenHash = redis.call('HGET', KEYS[1], 'activeTokenHash')
if activeTokenHash ~= ARGV[1] then
    return {'ERROR', 'RACE_OR_REPLAY_DETECTED'}
end

-- 4. Verify token lookup key exists
if redis.call('EXISTS', KEYS[2]) == 0 then
    return {'ERROR', 'TOKEN_LOOKUP_NOT_FOUND'}
end

-- 5. Extract accountId and familyId from existing state
local familyId = redis.call('HGET', KEYS[1], 'familyId') or ''
local accountId = redis.call('HGET', KEYS[3], 'accountId') or ''
if accountId == '' then
    -- Fallback: parse from lookup if session hash is missing
    local lookupVal = redis.call('GET', KEYS[2])
    if lookupVal then
        local match = string.match(lookupVal, '"accountId"%s*:%s*"([^"]+)"')
        if match then accountId = match end
    end
end

-- 6. Read and increment rotation sequence
local currentSeqStr = redis.call('HGET', KEYS[1], 'rotationSeq')
local currentSeq = tonumber(currentSeqStr) or 1
local newSeq = currentSeq + 1

-- 7. Atomically delete old credentials
redis.call('DEL', KEYS[2])
redis.call('DEL', KEYS[3])

-- 8. Write revoked token tombstone
redis.call('SET', KEYS[4], familyId, 'EX', tonumber(ARGV[8]))

-- 9. Construct new token lookup JSON
local newLookupJson = '{"familyId":"' .. familyId .. '","sessionId":"' .. ARGV[3] .. '","accountId":"' .. accountId .. '"}'
redis.call('SET', KEYS[5], newLookupJson, 'EX', tonumber(ARGV[7]))

-- 10. Write replacement session hash
redis.call('HSET', KEYS[6],
    'sessionId', ARGV[3],
    'familyId', familyId,
    'accountId', accountId,
    'tokenHash', ARGV[2],
    'rotationSeq', tostring(newSeq),
    'createdAt', ARGV[6],
    'expiresAt', ARGV[6],
    'ipAddress', ARGV[4],
    'userAgent', ARGV[5]
)
redis.call('EXPIRE', KEYS[6], tonumber(ARGV[7]))

-- 11. Update family record
redis.call('HSET', KEYS[1],
    'activeSessionId', ARGV[3],
    'activeTokenHash', ARGV[2],
    'rotationSeq', tostring(newSeq)
)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[7]))

return {'OK', tostring(newSeq)}
`;

/**
 * Atomic Replay Revocation Script (4 KEYS, 3 ARGV)
 *
 * KEYS[1]: family:{familyId}
 * KEYS[2]: revoked_token:{familyId}:{presentedTokenHash}
 * KEYS[3]: token_lookup:{familyId}:{expectedActiveTokenHash}
 * KEYS[4]: session:{familyId}:{expectedActiveSessionId}
 *
 * ARGV[1]: expectedActiveTokenHash
 * ARGV[2]: expectedActiveSessionId
 * ARGV[3]: tombstoneTtl (seconds, e.g. 86400)
 */
export const REPLAY_REVOCATION_LUA = `
-- 1. Check if KEYS[2] (revoked_token tombstone) exists
if redis.call('EXISTS', KEYS[2]) == 0 then
    return 'NOT_A_REPLAY'
end

-- 2. Check if family exists
if redis.call('EXISTS', KEYS[1]) == 0 then
    return 'ALREADY_REVOKED'
end

-- 3. Concurrent rotation check: verify activeTokenHash and activeSessionId
local activeTokenHash = redis.call('HGET', KEYS[1], 'activeTokenHash')
local activeSessionId = redis.call('HGET', KEYS[1], 'activeSessionId')

if activeTokenHash ~= ARGV[1] or activeSessionId ~= ARGV[2] then
    return 'CONCURRENT_ROTATION_DETECTED'
end

-- 4. Replay confirmed: mark family as compromised and set 24h retention TTL
redis.call('HSET', KEYS[1], 'isCompromised', '1')
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))

-- 5. Delete active lookup and active session keys
redis.call('DEL', KEYS[3])
redis.call('DEL', KEYS[4])

return 'REPLAY_CONFIRMED'
`;

/**
 * Atomic Single-Device Logout Script (3 KEYS, 2 ARGV)
 *
 * KEYS[1]: family:{familyId}
 * KEYS[2]: session:{familyId}:{activeSessionId}
 * KEYS[3]: token_lookup:{familyId}:{activeTokenHash}
 *
 * ARGV[1]: expectedActiveTokenHash
 * ARGV[2]: expectedActiveSessionId
 */
export const SINGLE_DEVICE_LOGOUT_LUA = `
-- 1. Check if family exists
if redis.call('EXISTS', KEYS[1]) == 0 then
    return 'ALREADY_LOGGED_OUT'
end

-- 2. Revalidate active token hash and session ID
local activeTokenHash = redis.call('HGET', KEYS[1], 'activeTokenHash')
local activeSessionId = redis.call('HGET', KEYS[1], 'activeSessionId')

if activeTokenHash ~= ARGV[1] or activeSessionId ~= ARGV[2] then
    return 'SESSION_MISMATCH'
end

-- 3. Atomically delete family, session, and token lookup keys
redis.call('DEL', KEYS[1])
redis.call('DEL', KEYS[2])
redis.call('DEL', KEYS[3])

return 'LOGOUT_SUCCESS'
`;
