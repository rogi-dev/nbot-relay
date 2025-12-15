const WebSocket = require("ws");
const overlay = require("./overlay")
const widget = require("./widget")
const {dataStore} = require("./data-handler")

const BOT_TOKEN = process.env.BOT_TOKEN;

const botClient = {current: null};
let wss = null;

const initWebSocketServer = () => {
  if (wss) return;
  wss = new WebSocket.Server({ noServer: true });

  // Centralized single connection handler
  wss.on("connection", (ws) => {
    console.log("Bot connected");
    botClient.current = ws;

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        console.log("Received message from bot", data);
        const topic = data.topic;
        if (topic && data.amount && dataStore.hasOwnProperty(topic)) {
          dataStore[topic] = data.amount;
          Object.values(overlay.socketClients).forEach((clients) => {
            clients.forEach((client) => {
              client.send(JSON.stringify({
                type: 'data',
                data: dataStore
              }));
            });
          });
          widget.widgetClients[topic].forEach((client) => {
            client.send(JSON.stringify({
              value: data.amount,
              formatted: widget.formatters[topic](data.amount)
            }));
          });
        }
      } catch (err) {
        console.error("Error processing bot message:", err);
      }
    });

    ws.on("close", () => {
      if (botClient.current === ws) {
        botClient.current = null;
      }
      console.log("Bot disconnected");
    });
  });
}

const handleWebSocket = (req, socket, head) => {
  if (!wss) return false;

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const params = parsedUrl.searchParams;

  if (params.get("token") !== BOT_TOKEN) return false;

  if (botClient.current && botClient.current.readyState === WebSocket.OPEN) {
    return false
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws); 
  });

  return true;
}

module.exports = {
  initWebSocketServer,
  handleWebSocket,
  botClient,
}
