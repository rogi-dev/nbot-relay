require("dotenv").config();
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const WIDGET_TOKEN = process.env.WIDGET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;

let widgetClients = new Set();
let botClient = null;

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

  if (url.startsWith("/widget") && token === WIDGET_TOKEN) {
    wssWidget.handleUpgrade(req, socket, head, (ws) => {
      wssWidget.emit("connection", ws, req);
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

wssWidget.on("connection", (ws) => {
  console.log("Widget connected");
  widgetClients.add(ws);

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
    widgetClients.delete(ws);
    console.log("Widget disconnected");
  });
});

wssBot.on("connection", (ws) => {
  console.log("Bot connected");
  botClient = ws;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

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
    if (botClient === ws) {
      botClient = null;
    }
    console.log("Bot disconnected");
  });
});

server.listen(PORT, () => {
  console.log("Relay Server running on port", PORT);
});
