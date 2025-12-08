require("dotenv").config();
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const WIDGET_TOKEN = process.env.WIDGET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;

let botClient = null;

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
let lastValues = {};

const server = http.createServer((req, res) => {
    if (req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
  
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket Relay Server running");
  });

const wssWidget = new WebSocket.Server({ noServer: true });
const wssBot = new WebSocket.Server({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = req.url || "/";
  const params = new URLSearchParams(url.replace(/^.*\?/, ""));
  const token = params.get("token");
  const topic = params.get("topic");

  if (url.startsWith("/widget") && token === WIDGET_TOKEN && topic && widgetClients.hasOwnProperty(topic)) {
    wssWidget.handleUpgrade(req, socket, head, (ws) => {
      wssWidget.emit("connection", ws, topic);
    });
    return;
  }

  if (url.startsWith("/bot") && token === BOT_TOKEN) {
    if (botClient && botClient.readyState === WebSocket.OPEN) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      console.log("Rejected bot");
      return;
    }
    wssBot.handleUpgrade(req, socket, head, (ws) => {
      wssBot.emit("connection", ws, req);
    });
    return;
  }

  socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
  socket.destroy();
});

wssWidget.on("connection", (ws, topic) => {
  console.log("Widget connected to topic", topic, "lastValue:", lastValues[topic]);
  widgetClients[topic].add(ws);
  ws.topic = topic;

  if (lastValues[topic]) {
    ws.send(JSON.stringify({
      value: lastValues[topic],
      formatted: formatters[topic](lastValues[topic])
    }));
  }

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (botClient && botClient.readyState === WebSocket.OPEN) {
        botClient.send(JSON.stringify(data));
      }
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

wssBot.on("connection", (ws) => {
  console.log("Bot connected");
  botClient = ws;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const topic = data.topic;
      if (topic && widgetClients[topic]) {
        lastValues[topic] = data.amount;
        console.log("Updated last value for topic", topic, "to", data.amount, "formatted:", formatters[topic](data.amount));
        widgetClients[topic].forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              value: data.amount,
              formatted: formatters[topic](data.amount)
            }));
          }
        });
      }
    } catch (err) {
      console.error("Invalid JSON from bot", err);
    }
  });

  ws.on("close", () => {
    if (botClient === ws) {
      botClient = null;
    }
    console.log("Bot disconnected");
  });
});

server.listen(PORT, () => {
  console.log("Relay Server running on port", PORT);
});
