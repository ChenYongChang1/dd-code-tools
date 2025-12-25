import { Plugin, ViteDevServer } from "vite";
import WebSocket, { WebSocketServer } from "ws";
import { createHttpServer } from "./http-server";
import { E_WS_TYPE, WS_PATH, WS_PORT } from "@/config/config";
import { IMainAppFilePlugin } from "@/config/types";
export class WsServer {
  private static instance: WsServer;
  private wss: WebSocketServer;
  clientMap: Map<string, WebSocket>;
  httpServer: { server: import("http").Server; start: (type?: string) => void; } | null;
  constructor(
    public handleMessage?: (opt: { type: E_WS_TYPE; data: any }) => void
  ) {
    this.httpServer = createHttpServer()!;
    this.clientMap = new Map();
  }

  /**
   * 单例获取 WS 服务实例
   * - 若已创建则复用并更新消息回调
   */
  static getInstance(
    handleMessage?: (opt: { type: E_WS_TYPE; data: any }) => void
  ) {
    if (!WsServer.instance) {
      WsServer.instance = new WsServer(handleMessage);
    } else if (handleMessage) {
      WsServer.instance.handleMessage = handleMessage;
    }
    return WsServer.instance;
  }

  createServer() {
    if (this.wss) return; // 避免重复创建
    this.wss = new WebSocketServer({
      server: this.httpServer!.server, // 绑定到 Vite 的 HTTP 服务器
      path: WS_PATH, // WS 连接路径，前端连接时用 ws://localhost:5173/__mfe__ws__
    });
    this.onMessage(this.handleMessage);
    this.onConnection();
    this.httpServer!.start('ws');
  }
  onMessage(callback?: (opt: { type: E_WS_TYPE; data: any }) => void) {
    // WebSocketServer 不支持直接监听 message，必须在 connection 后的 socket 上监听
    // 这里仅更新回调引用
    if (callback) {
      this.handleMessage = callback;
    }
  }

  /**
   * 向指定 appCode 的客户端发送消息
   */
  sendMessageToApp(appCode: string, message: any) {
    const ws = this.clientMap.get(appCode);
    if (ws) {
      ws.send(typeof message === "string" ? message : JSON.stringify(message));
    }
  }

  /**
   * 连接事件：建立客户端映射并下发初始化信息（主应用输出目录）
   */
  onConnection() {
    this.wss.on("connection", (ws, request) => {
      // console.log("客户端已连接 WS 服务");

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage?.(data);
        } catch (e) {
          console.error("WS消息解析失败:", e);
        }
      });

      // 拿到客户端传递的 appCode
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const appCode = url.searchParams.get("appCode");
      console.log(`[uni-WS] 客户端连接 WS 服务，appCode: ${appCode}`);

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
  private static instance: WsClientServer;
  ws: WebSocket;
  isConnected: boolean;
  constructor(
    public handleMessage?: (opt: { type: E_WS_TYPE; data: any }) => void
  ) {
    this.handleMessage = handleMessage;
    this.ws = null;
    this.isConnected = false;
  }

  /**
   * 获取客户端单例
   */
  static getInstance(
    handleMessage?: (opt: { type: E_WS_TYPE; data: any }) => void
  ) {
    if (!WsClientServer.instance) {
      WsClientServer.instance = new WsClientServer(handleMessage);
    } else if (handleMessage) {
      WsClientServer.instance.handleMessage = handleMessage;
    }
    return WsClientServer.instance;
  }

  connect(appCode: string) {
    if (this.isConnected && this.ws) return;
    this.ws = new WebSocket(
      `ws://localhost:${WS_PORT}${WS_PATH}?appCode=${appCode}`
    );
    this.ws.on("open", () => {
      // console.log("客户端已连接 WS 服务");
      this.isConnected = true;
    });
    this.ws.on("close", () => {
      // console.log("客户端已关闭 WS 服务");
      this.isConnected = false;
      this.retryConnect(appCode);
    });
    // 重试连接
    this.ws.on("error", () => {
      // console.log("连接失败，重试连接...");
      this.isConnected = false;
      this.retryConnect(appCode);
    });
    // 监听消息并使用当前的 handleMessage
    this.ws.on("message", (message) => {
      this.handleMessage?.(JSON.parse(message.toString()));
    });
  }
  sendMessage(type: E_WS_TYPE, data: any) {
    if (this.isConnected) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }
  // handleMessage = (message: any) => {
  //   const { type, data } = message;
  //   if (type === E_WS_TYPE.INIT) {
  //     // console.log("收到初始化消息", data);
  //     this.serverPlugin.copyAppDistModule(data);
  //   }
  //   // console.log("收到消息", message);
  // };
  onMessage(callback?: (message: any) => void) {
    if (callback) {
      this.handleMessage = callback;
    }
  }
  /**
   * 简单重试策略：一定时间后重新连接
   */
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
