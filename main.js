require("dotenv").config();
const overlay = require("./overlay");
const widget = require("./widget");
const botRelay = require("./bot-relay");

require('./server');  

overlay.initWebSocketServer();
widget.initWebSocketServer();
botRelay.initWebSocketServer();
