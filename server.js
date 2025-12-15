const http = require("http");
const overlay = require("./overlay");
const botRelay = require("./bot-relay");
const widget = require("./widget");

const PORT = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {

  if (req.url === "/ping") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.url.startsWith("/overlay?")) {
    const data = await overlay.handleHttp(req);
    if (data) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/overlay?")) {
    const ok = overlay.handleWebSocket(req, socket, head);
    if (ok) return;
  }

  if (req.url.startsWith("/widget?")) {
    const ok = widget.handleWebSocket(req, socket, head);
    if (ok) return;
  }

  if (req.url.startsWith("/bot?")) {
    const ok = botRelay.handleWebSocket(req, socket, head);
    if (ok) return;
  }

  socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
  socket.destroy();
});

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
