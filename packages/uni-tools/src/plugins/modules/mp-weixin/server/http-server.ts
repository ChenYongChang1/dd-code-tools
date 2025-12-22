import express from "express";
import http from "http";
import cors from "cors";
import { HTTP_PATH, WS_PORT } from "@/config/config";

let app: express | null = null;
export const createHttpServer = () => {
  if (app) return app;
  app = express();
  const server = http.createServer(app);
  app.get(`${HTTP_PATH}/root-path`, (req, res) => {
    res.send(process.env);
  });
  app.use(cors({ origin: "*" }));
  return {
    server,
    start: () => {
      server.listen(WS_PORT, () => {
        console.log(`[uni-http] http://localhost:${WS_PORT}${HTTP_PATH}`);
      });
    },
  };
};
