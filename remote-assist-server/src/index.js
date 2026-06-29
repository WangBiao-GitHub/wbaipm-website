const http = require('http')
const fs = require('fs')
const path = require('path')
const { WebSocketServer } = require('ws')
const { onMessage, onClose } = require('./signaling/handler')

const PORT = process.env.PORT || 3000

// APP_URL 由 Railway 自动注入（如 https://xxx.railway.app），本地测试时手动设置
const WS_URL = process.env.WS_URL || `wss://relay.wbaipm.com/ws`
const APP_URL = 'https://relay.wbaipm.com'

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // App 启动时拉取的配置接口，返回 WebSocket 地址
  if (req.url === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ wsUrl: WS_URL, version: '1' }))
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }))
    return
  }

  // 网页测试客户端
  if (req.url === '/' || req.url === '/test') {
    const htmlPath = path.join(__dirname, '../public/index.html')
    fs.readFile(htmlPath, 'utf8', (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(data)
    })
    return
  }

  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  console.log(`[连接] 新客户端 ${ip}`)

  ws.on('message', (data) => {
    onMessage(ws, data.toString())
  })

  ws.on('close', () => {
    console.log(`[断开] 客户端 ${ip}`)
    onClose(ws)
  })

  ws.on('error', (err) => {
    console.error(`[错误] ${ip}:`, err.message)
    onClose(ws)
  })
})

server.listen(PORT, () => {
  console.log(`✅ 信令服务器已启动，端口 ${PORT}`)
  console.log(`   配置接口: ${APP_URL}/config`)
  console.log(`   WebSocket: ${WS_URL}`)
  console.log(`   健康检查: ${APP_URL}/health`)
})
