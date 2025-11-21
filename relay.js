// relay.js
require("dotenv").config();
const http = require("http");
const WebSocket = require("ws");

// --- Config
const PORT = process.env.PORT || 3001;
const WIDGET_TOKEN = process.env.WIDGET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;

// --- Storage
let widgetClients = new Set();
let botClients = new Set();

// --- Create required HTTP server (Render needs this)
const server = http.createServer((req, res) => {
    console.log({ forwardedFor: req.headers['x-forwarded-for'], remoteAddress: req.socket.remoteAddress });

    // Normaler HTTP-Request
    if (req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("pong");
      return;
    }
  
    // Default-Endpoint
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("WebSocket Relay Server running");
  });

// --- Create WS servers without direct port binding
const wssWidget = new WebSocket.Server({ noServer: true });
const wssBot = new WebSocket.Server({ noServer: true });

// --- Handle WebSocket Upgrade
server.on("upgrade", (req, socket, head) => {
  const url = req.url || "/";
  const params = new URLSearchParams(url.replace(/^.*\?/, ""));
  const token = params.get("token");

  // Widget endpoint
  if (url.startsWith("/widget") && token === WIDGET_TOKEN) {
    wssWidget.handleUpgrade(req, socket, head, (ws) => {
      wssWidget.emit("connection", ws, req);
    });
    return;
  }

  // Bot endpoint
  if (url.startsWith("/bot") && token === BOT_TOKEN) {
    wssBot.handleUpgrade(req, socket, head, (ws) => {
      wssBot.emit("connection", ws, req);
    });
    return;
  }

  // Reject connections with bad token / endpoint
  socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
  socket.destroy();
});

// --- WIDGET CONNECTIONS
wssWidget.on("connection", (ws) => {
  console.log("Widget connected");
  widgetClients.add(ws);

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Forward to all bots
      botClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("Invalid JSON from widget", err);
    }
  });

  ws.on("close", () => {
    widgetClients.delete(ws);
    console.log("Widget disconnected");
  });
});

// --- BOT CONNECTIONS
wssBot.on("connection", (ws) => {
  console.log("Bot connected");
  botClients.add(ws);

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Forward to all widgets
      widgetClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("Invalid JSON from bot", err);
    }
  });

  ws.on("close", () => {
    botClients.delete(ws);
    console.log("Bot disconnected");
  });
});

// --- Start HTTP server
server.listen(PORT, () => {
  console.log("Relay Server running on port", PORT);
});
