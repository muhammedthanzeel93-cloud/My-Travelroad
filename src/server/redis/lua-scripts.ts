/**
 * My Travelroad — Deterministic Same-Slot Redis Lua Scripts
 * Implements atomic token rotation, replay revocation, and single-device logout.
 * All keys passed explicitly via KEYS array; all keys utilize same-slot {familyId} tagging.
 * References: docs/architecture/api-architecture.md Section 6.3
 */

/**
 * Deterministic Atomic Rotation Script (6 KEYS, 10 ARGV)
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
 * ARGV[6]: timestamp (createdAt ISO 8601 string)
 * ARGV[7]: ttl (seconds, e.g. 2592000)
 * ARGV[8]: tombstoneTtl (seconds, e.g. 86400)
 * ARGV[9]: expiresAt (ISO 8601 string, e.g. now + 30 days)
 * ARGV[10]: expectedOldSessionId
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

-- 3. Verify family fields: familyId, activeTokenHash, activeSessionId
local famFamilyId = redis.call('HGET', KEYS[1], 'familyId')
if not famFamilyId or famFamilyId == '' then
    return {'ERROR', 'MALFORMED_FAMILY_RECORD'}
end

local activeTokenHash = redis.call('HGET', KEYS[1], 'activeTokenHash')
if not activeTokenHash or activeTokenHash ~= ARGV[1] then
    return {'ERROR', 'RACE_OR_REPLAY_DETECTED'}
end

local activeSessionId = redis.call('HGET', KEYS[1], 'activeSessionId')
if not activeSessionId or activeSessionId == '' then
    return {'ERROR', 'MALFORMED_FAMILY_RECORD'}
end
if ARGV[10] ~= '' and activeSessionId ~= ARGV[10] then
    return {'ERROR', 'SESSION_MISMATCH'}
end

-- 4. Verify rotation sequence: must be a strict positive integer within safe range [1, 9007199254740991]
local currentSeqStr = redis.call('HGET', KEYS[1], 'rotationSeq')
if not currentSeqStr or currentSeqStr == '' then
    return {'ERROR', 'INVALID_ROTATION_SEQUENCE'}
end
if not string.match(currentSeqStr, '^%d+$') then
    return {'ERROR', 'INVALID_ROTATION_SEQUENCE'}
end
local currentSeq = tonumber(currentSeqStr)
if not currentSeq or currentSeq < 1 or currentSeq > 9007199254740991 then
    return {'ERROR', 'INVALID_ROTATION_SEQUENCE'}
end

-- 5. Verify token lookup key exists and strictly parse with cjson.decode
if redis.call('EXISTS', KEYS[2]) == 0 then
    return {'ERROR', 'TOKEN_LOOKUP_NOT_FOUND'}
end

local lookupRaw = redis.call('GET', KEYS[2])
if not lookupRaw or lookupRaw == '' then
    return {'ERROR', 'TOKEN_LOOKUP_CORRUPTED'}
end

local ok, lookup = pcall(cjson.decode, lookupRaw)
if not ok or type(lookup) ~= 'table' then
    return {'ERROR', 'TOKEN_LOOKUP_CORRUPTED'}
end

local lookupFamilyId = lookup['familyId']
local lookupSessionId = lookup['sessionId']
local lookupAccountId = lookup['accountId']

if not lookupFamilyId or type(lookupFamilyId) ~= 'string' or lookupFamilyId ~= famFamilyId then
    return {'ERROR', 'LOOKUP_FAMILY_MISMATCH'}
end
if not lookupSessionId or type(lookupSessionId) ~= 'string' or lookupSessionId == '' or lookupSessionId ~= activeSessionId then
    return {'ERROR', 'LOOKUP_SESSION_MISMATCH'}
end
if not lookupAccountId or type(lookupAccountId) ~= 'string' or lookupAccountId == '' then
    return {'ERROR', 'LOOKUP_ACCOUNT_MISSING'}
end

-- 6. Verify old session record exists and matches identity & presented token hash
if redis.call('EXISTS', KEYS[3]) == 0 then
    return {'ERROR', 'OLD_SESSION_NOT_FOUND'}
end

local oldSessId = redis.call('HGET', KEYS[3], 'sessionId')
if not oldSessId or oldSessId ~= activeSessionId then
    return {'ERROR', 'OLD_SESSION_ID_MISMATCH'}
end

local oldSessFamId = redis.call('HGET', KEYS[3], 'familyId')
if not oldSessFamId or oldSessFamId ~= famFamilyId then
    return {'ERROR', 'OLD_SESSION_FAMILY_MISMATCH'}
end

local oldSessAccountId = redis.call('HGET', KEYS[3], 'accountId')
if not oldSessAccountId or oldSessAccountId ~= lookupAccountId then
    return {'ERROR', 'OLD_SESSION_ACCOUNT_MISMATCH'}
end

local oldSessionHash = redis.call('HGET', KEYS[3], 'tokenHash')
if not oldSessionHash or oldSessionHash == '' then
    return {'ERROR', 'OLD_SESSION_TOKEN_HASH_MISSING'}
end
if oldSessionHash ~= ARGV[1] then
    return {'ERROR', 'OLD_SESSION_HASH_MISMATCH'}
end

-- 7. Verify collision avoidance on replacement keys
if redis.call('EXISTS', KEYS[5]) == 1 or redis.call('EXISTS', KEYS[6]) == 1 then
    return {'ERROR', 'REPLACEMENT_KEY_COLLISION'}
end

-- 8. All validations passed! Safe to proceed with atomic mutations.
local newSeq = currentSeq + 1

-- Delete old credentials
redis.call('DEL', KEYS[2])
redis.call('DEL', KEYS[3])

-- Write revoked token tombstone with rotation timestamp ISO string
redis.call('SET', KEYS[4], ARGV[6], 'EX', tonumber(ARGV[8]))

-- Write replacement token lookup
local newLookupJson = '{"familyId":"' .. famFamilyId .. '","sessionId":"' .. ARGV[3] .. '","accountId":"' .. lookupAccountId .. '"}'
redis.call('SET', KEYS[5], newLookupJson, 'EX', tonumber(ARGV[7]))

-- Write replacement session hash with genuine 30-day expiresAt
redis.call('HSET', KEYS[6],
    'sessionId', ARGV[3],
    'familyId', famFamilyId,
    'accountId', lookupAccountId,
    'tokenHash', ARGV[2],
    'rotationSeq', tostring(newSeq),
    'createdAt', ARGV[6],
    'expiresAt', ARGV[9],
    'ipAddress', ARGV[4],
    'userAgent', ARGV[5]
)
redis.call('EXPIRE', KEYS[6], tonumber(ARGV[7]))

-- Update family record
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

-- 3. Verify session and token lookup exist before deletion
if redis.call('EXISTS', KEYS[2]) == 0 or redis.call('EXISTS', KEYS[3]) == 0 then
    return 'SESSION_CORRUPTED'
end

-- 4. Atomically delete family, session, and token lookup keys
redis.call('DEL', KEYS[1])
redis.call('DEL', KEYS[2])
redis.call('DEL', KEYS[3])

return 'LOGOUT_SUCCESS'
`;
