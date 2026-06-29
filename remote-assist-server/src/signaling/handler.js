const { createCode, consumeCode } = require('../rooms/pairingCode')
const { createRoom, getRoom, deleteRoom } = require('../rooms/roomManager')

// ws -> { roomId, role }
const clientMeta = new Map()

function send(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data))
  }
}

function onMessage(ws, raw) {
  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }

  const { type, payload } = msg

  switch (type) {

    // 求助端：请求配对码
    case 'REQUEST_CODE': {
      const room = createRoom()
      const { code, expiresAt } = createCode(room.id)
      room.helpClient = ws
      clientMeta.set(ws, { roomId: room.id, role: 'help' })
      send(ws, { type: 'CODE_ISSUED', payload: { code, expiresAt, roomId: room.id } })
      break
    }

    // 协助端：输入配对码加入房间
    case 'JOIN_ROOM': {
      const { code } = payload || {}
      if (!code) return send(ws, { type: 'ERROR', payload: { message: '请输入配对码' } })

      const entry = consumeCode(code)
      if (!entry) return send(ws, { type: 'ERROR', payload: { message: '配对码无效或已过期' } })

      const room = getRoom(entry.roomId)
      if (!room || !room.helpClient) {
        return send(ws, { type: 'ERROR', payload: { message: '求助端已下线' } })
      }

      room.assistClient = ws
      clientMeta.set(ws, { roomId: room.id, role: 'assist' })

      // 通知双端房间就绪，开始 WebRTC
      send(room.helpClient,  { type: 'ROOM_READY', payload: { roomId: room.id, role: 'help' } })
      send(room.assistClient, { type: 'ROOM_READY', payload: { roomId: room.id, role: 'assist' } })
      break
    }

    // 求助端媒体准备完毕，通知协助端可以发 Offer 了
    case 'HELP_READY': {
      const meta = clientMeta.get(ws)
      if (!meta || meta.role !== 'help') return
      const room = getRoom(meta.roomId)
      if (!room) return
      send(room.assistClient, { type: 'HELP_READY' })
      break
    }

    // WebRTC 信令透传：OFFER / ANSWER / ICE_CANDIDATE
    case 'OFFER':
    case 'ANSWER':
    case 'ICE_CANDIDATE': {
      const meta = clientMeta.get(ws)
      if (!meta) return
      const room = getRoom(meta.roomId)
      if (!room) return
      const other = room.getOther(ws)
      send(other, { type, payload })
      break
    }

    // 协助端：请求控制
    case 'REQUEST_CONTROL': {
      const meta = clientMeta.get(ws)
      if (!meta || meta.role !== 'assist') return
      const room = getRoom(meta.roomId)
      if (!room) return
      send(room.helpClient, { type: 'REQUEST_CONTROL' })
      break
    }

    // 求助端：回应控制请求
    case 'CONTROL_RESPONSE': {
      const meta = clientMeta.get(ws)
      if (!meta || meta.role !== 'help') return
      const room = getRoom(meta.roomId)
      if (!room) return
      const { allowed } = payload || {}
      if (allowed) room.mode = 'CONTROL'
      send(room.assistClient, { type: 'CONTROL_RESPONSE', payload: { allowed } })
      break
    }

    // 控制/高亮指令透传（协助端 → 求助端）
    case 'CONTROL_ACTION': {
      const meta = clientMeta.get(ws)
      if (!meta || meta.role !== 'assist') return
      const room = getRoom(meta.roomId)
      if (!room) return
      send(room.helpClient, { type: 'CONTROL_ACTION', payload })
      break
    }

    // 求助端收回控制
    case 'CONTROL_REVOKED': {
      const meta = clientMeta.get(ws)
      if (!meta || meta.role !== 'help') return
      const room = getRoom(meta.roomId)
      if (!room) return
      room.mode = 'GUIDE'
      send(room.assistClient, { type: 'CONTROL_REVOKED' })
      break
    }

    // 任意端结束会话
    case 'END_SESSION': {
      handleDisconnect(ws)
      break
    }
  }
}

function onClose(ws) {
  handleDisconnect(ws)
}

function handleDisconnect(ws) {
  const meta = clientMeta.get(ws)
  if (!meta) return

  const room = getRoom(meta.roomId)
  if (room) {
    const other = room.getOther(ws)
    send(other, { type: 'PEER_DISCONNECTED' })
    room.remove(ws)
    if (room.isEmpty()) deleteRoom(meta.roomId)
  }

  clientMeta.delete(ws)
}

module.exports = { onMessage, onClose }
