import express from "express";
import http from "http";
import cors from "cors";
import { E_WS_TYPE, HTTP_PATH, WS_PORT } from "@/config/config";

let app: express | null = null;
export const createHttpServer = () => {
  if (app) return { server: app, start: () => {} };
  app = express();
  const server = http.createServer(app);
  app.get(`${HTTP_PATH}/root-path`, (req, res) => {
    res.send(process.env);
  });
  app.use(cors({ origin: "*" }));
  return {
    server,
    start: (type: string) => {
      const originKey = type || "http";
      server.listen(WS_PORT, () => {
        console.log(
          `[uni-${originKey}] ${originKey}://localhost:${WS_PORT}${HTTP_PATH}`
        );
      });
    },
  };
};
