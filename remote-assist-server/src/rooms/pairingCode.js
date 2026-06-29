// 配对码管理（内存存储，测试阶段）
// 生产环境替换为 Redis

const codes = new Map() // code -> { roomId, expiresAt }
const CODE_TTL_MS = 5 * 60 * 1000 // 5 分钟

function generateCode() {
  let code
  let attempts = 0
  do {
    code = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    attempts++
    if (attempts > 100) throw new Error('无法生成唯一配对码，当前活跃会话过多')
  } while (codes.has(code))
  return code
}

function createCode(roomId) {
  cleanExpired()
  const code = generateCode()
  const expiresAt = Date.now() + CODE_TTL_MS
  codes.set(code, { roomId, expiresAt })
  return { code, expiresAt }
}

function validateCode(code) {
  cleanExpired()
  const entry = codes.get(code)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    codes.delete(code)
    return null
  }
  return entry
}

function consumeCode(code) {
  const entry = validateCode(code)
  if (!entry) return null
  codes.delete(code) // 用后即废
  return entry
}

function cleanExpired() {
  const now = Date.now()
  for (const [code, entry] of codes.entries()) {
    if (now > entry.expiresAt) codes.delete(code)
  }
}

module.exports = { createCode, validateCode, consumeCode }
