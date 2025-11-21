// relay.js
require("dotenv").config();
const WebSocket = require("ws");

// --- Config
const PORT = process.env.PORT || 3001;
const WIDGET_TOKEN = process.env.WIDGET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;

// --- Storage
let widgetClients = new Set();
let botClients = new Set();

// --- Create WebSocket Server
const wss = new WebSocket.Server({ port: PORT });

console.log("Secure Relay Server running on port", PORT);

wss.on("connection", (ws, req) => {
    const url = req.url || "/";
    const params = new URLSearchParams(url.replace(/^.*\?/, ""));

    const token = params.get("token");
    let role = null;

    // --- Authentication Logic
    if (url.startsWith("/widget") && token === WIDGET_TOKEN) {
        role = "widget";
        widgetClients.add(ws);
        console.log("Widget connected");
    } else if (url.startsWith("/bot") && token === BOT_TOKEN) {
        role = "bot";
        botClients.add(ws);
        console.log("Bot connected");
    } else {
        console.log("Connection rejected (invalid token/role)");
        ws.close();
        return;
    }

    // --- Incoming message handler
    ws.on("message", (msg) => {
        try {
            const data = JSON.parse(msg);

            if (role === "bot") {
                // Forward bot message to all widgets
                widgetClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }

            if (role === "widget") {
                // Forward widget message to all bots
                botClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }

        } catch (err) {
            console.error("Invalid JSON from", role, err);
        }
    });

    // --- Cleanup on disconnect
    ws.on("close", () => {
        widgetClients.delete(ws);
        botClients.delete(ws);
        console.log(`${role} disconnected`);
    });
});
