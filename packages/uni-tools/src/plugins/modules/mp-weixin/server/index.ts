import { Plugin, ViteDevServer } from "vite";
import WebSocket, { WebSocketServer } from "ws";
import { createHttpServer } from "./http-server";
import { E_WS_TYPE, WS_PATH, WS_PORT } from "@/config/config";
export class WsServer {
  private wss: WebSocketServer;
  httpServer: import("http").Server<
    typeof import("http").IncomingMessage,
    typeof import("http").ServerResponse
  >;
  clientMap: Map<string, WebSocket>;
  constructor(public serverPlugin: any) {
    this.serverPlugin = serverPlugin;
    this.httpServer = createHttpServer();
    this.clientMap = new Map();
  }
  createServer() {
    this.wss = new WebSocketServer({
      server: this.httpServer, // 绑定到 Vite 的 HTTP 服务器
      path: WS_PATH, // WS 连接路径，前端连接时用 ws://localhost:5173/__mfe__ws__
    });
    this.onMessage();
    this.onConnection();
    this.start();
  }
  start() {
    this.httpServer.listen(WS_PORT, () => {
      console.log(
        `[uni-WS] 独立服务已启动：ws://localhost:${WS_PORT}${WS_PATH}`
      );
    });
  }
  onMessage() {
    this.wss.on("message", (ws, message) => {
      console.log("收到消息", message);
    });
  }

  sendMessageToApp(appCode: string, message: any) {
    const ws = this.clientMap.get(appCode);
    if (ws) {
      ws.send(typeof message === "string" ? message : JSON.stringify(message));
    }
  }

  onConnection() {
    this.wss.on("connection", (ws, request) => {
      console.log("客户端已连接 WS 服务", ws);
      // 拿到客户端传递的 appCode
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const appCode = url.searchParams.get("appCode");
      if (!appCode) return;
      this.clientMap.set(appCode!, ws);
      this.sendMessageToApp(appCode!, {
        type: E_WS_TYPE.INIT,
        data: {
          pwd: process.env.UNI_OUTPUT_DIR,
        },
      });
    });
  }
}

export class WsClientServer {
  ws: WebSocket;
  isConnected: boolean;
  constructor(public serverPlugin: any) {
    this.serverPlugin = serverPlugin;
    this.ws = null;
    this.isConnected = false;
  }
  connect(appCode: string) {
    this.ws = new WebSocket(
      `ws://localhost:${WS_PORT}${WS_PATH}?appCode=${appCode}`
    );
    this.ws.on("open", () => {
      console.log("客户端已连接 WS 服务");
      this.isConnected = true;
    });
    this.ws.on("close", () => {
      console.log("客户端已关闭 WS 服务");
      this.isConnected = false;
      this.retryConnect(appCode);
    });
    // 重试连接
    this.ws.on("error", () => {
      console.log("连接失败，重试连接...");
      this.isConnected = false;
      this.retryConnect(appCode);
    });
    this.onMessage(this.handleMessage);
  }
  handleMessage = (message: any) => {
    const { type, data } = message;
    if (type === E_WS_TYPE.INIT) {
      // console.log("收到初始化消息", data);
      this.serverPlugin.copyAppDistModule(data);
    }
    // console.log("收到消息", message);
  };
  onMessage(callback: (message: any) => void) {
    this.ws.on("message", (message) => {
      callback(JSON.parse(message.toString()));
    });
  }
  retryConnect(appCode: string) {
    if (this.isConnected) return;
    this.isConnected = true;
    setTimeout(() => {
      this.connect(appCode);
    }, 3000);
  }
}
// export const createWsServer = (server: ViteDevServer) => {
//   const wss = new WebSocketServer({
//     server: server.httpServer, // 绑定到 Vite 的 HTTP 服务器
//     path: "/__mfe__ws__", // WS 连接路径，前端连接时用 ws://localhost:5173/__mfe__ws__
//   });
//   wss.on("connection", (ws: WebSocket) => {
//     console.log("客户端已连接 WS 服务");
//   });
// };

// export const con
// export const mfeServer = new WsServer();

// export const mfeClientServer = new WsClientServer();
