import express from "express";
import http from "http";
import cors from "cors";
import { E_WS_TYPE, HTTP_PATH, WS_PORT } from "@/config/config";

let app: express | null = null;
/**
 * 创建开发态 HTTP 服务
 * - 单例复用：避免重复创建与重复监听
 * - 路由：
 *   - GET `${HTTP_PATH}/root-path`：返回当前进程的环境变量（主应用输出位置等）
 * - 与 WS 服务配合：WSServer 绑定同一个 HTTP server 进行升级
 */
export const createHttpServer = () => {
  if (app) return { server: app, start: () => {} };
  app = express();
  const server = http.createServer(app);
  app.get(`${HTTP_PATH}/root-path`, (req, res) => {
    res.send(process.env);
  });
  app.use(cors({ origin: "*" }));
  /**
   * 返回：
   * - server：HTTP Server 实例（供 WS 复用）
   * - start(type)：启动监听并输出日志，type 用于日志区分（'http' | 'ws'）
   */
  return {
    server,
    start: (type?: string) => {
      const originKey = type || "http";
      server.listen(WS_PORT, () => {
        console.log(
          `[uni-${originKey}] ${originKey}://localhost:${WS_PORT}${HTTP_PATH}`
        );
      });
    },
  };
};
