// 房间管理

const { v4: uuidv4 } = require('uuid')

const rooms = new Map() // roomId -> Room

class Room {
  constructor(id) {
    this.id = id
    this.helpClient = null  // 求助端 WebSocket
    this.assistClient = null // 协助端 WebSocket
    this.mode = 'GUIDE'     // GUIDE | CONTROL
    this.createdAt = Date.now()
  }

  isFull() {
    return this.helpClient !== null && this.assistClient !== null
  }

  getOther(ws) {
    if (ws === this.helpClient) return this.assistClient
    if (ws === this.assistClient) return this.helpClient
    return null
  }

  remove(ws) {
    if (ws === this.helpClient) this.helpClient = null
    if (ws === this.assistClient) this.assistClient = null
  }

  isEmpty() {
    return !this.helpClient && !this.assistClient
  }
}

function createRoom() {
  const id = uuidv4().slice(0, 8)
  const room = new Room(id)
  rooms.set(id, room)
  return room
}

function getRoom(id) {
  return rooms.get(id) || null
}

function deleteRoom(id) {
  rooms.delete(id)
}

module.exports = { createRoom, getRoom, deleteRoom }
