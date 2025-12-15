const WebSocket = require("ws");
const fs = require("fs");
const {dataStore} = require("./data-handler");

const OVERLAY_TOKEN = process.env.OVERLAY_TOKEN;

const channels = fs.readdirSync(`${__dirname}/overlays`).map(file => file.replace('.html', ''));

const wrapper = fs.readFileSync(`${__dirname}/overlays/wrapper.html`);

const validateOverlayParams = (req) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const params = parsedUrl.searchParams;
  
  const token = params.get("token");
  const channel = params.get("channel");
  
  if (token !== OVERLAY_TOKEN || !channels.includes(channel)) {
    return null;
  }
  return channel;
}

const handleHttp = (req) => {
  const channel = validateOverlayParams(req);
  if (!channel) return false;

  try {
    const content = fs.readFileSync(`${__dirname}/overlays/${channel}.html`);
    return wrapper.toString().replace('(CONTENT)', content.toString());
  } catch (err) {
    return false;
  }
}

let wss = null;
const socketClients = channels.reduce((acc, channel) => {
  acc[channel] = new Set();
  return acc;
}, {});

const handleWebSocket = (req, socket, head) => {
  const channel = validateOverlayParams(req);
  if (!channel) return false;
  if (!wss) return false;

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, channel); 
  });
  return true;
}

const initWebSocketServer = () => {
  if (wss) return;
  wss = new WebSocket.Server({ noServer: true });
  
  wss.on("connection", (ws, channel) => {
    console.log("Overlay connected for channel", channel);
    socketClients[channel].add(ws);
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'data', data: dataStore }));
    }, 1000);

    ws.on("close", () => {
      socketClients[channel].delete(ws);
    });
  });
}

module.exports = {
  initWebSocketServer,
  handleHttp,
  handleWebSocket,
  socketClients,
}
