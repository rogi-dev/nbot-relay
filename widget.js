const WebSocket = require("ws");
const { dataStore } = require("./data-handler");

const WIDGET_TOKEN = process.env.WIDGET_TOKEN;

let widgetClients = {
  "monthly-tips": new Set(),
  "session-tips": new Set(),
  "session-bits": new Set()
};
const formatters = {
  "monthly-tips": (amount) => amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
  "session-tips": (amount) => amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
  "session-bits": (amount) => amount
};

const handleWebSocket = (req, socket, head) => {
  if (!wss) return false;

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const params = parsedUrl.searchParams;
  const token = params.get("token");
  const topic = params.get("topic");

  if (token !== WIDGET_TOKEN || !topic || !widgetClients.hasOwnProperty(topic)) {
    return false;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, topic);
  });
  return true;
};

const initWebSocketServer = () => {
  if (wss) return;
  wss = new WebSocket.Server({ noServer: true });

  wss.on("connection", (ws, topic) => {
    console.log("Widget connected to topic", topic);
    widgetClients[topic].add(ws);

    setTimeout(() => {
      const value = dataStore[topic] || 0;
      ws.send(JSON.stringify({ value: value, formatted: formatters[topic](value) }));
    }, 1000);

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        console.log("Received message from widget", data);
      } catch (err) {
        console.error("Invalid JSON from widget", err);
      }
    });

    ws.on("close", () => {
      if (ws.topic && widgetClients[ws.topic]) {
        widgetClients[ws.topic].delete(ws);
      }
      console.log("Widget disconnected");
    });
  });
};

module.exports = {
  handleWebSocket,
  initWebSocketServer,
  widgetClients,
  formatters
};
