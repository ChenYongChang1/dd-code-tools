import express from "express";
import http from "http";
import cors from "cors";

export const createHttpServer = () => {
  const app = express();
  const server = http.createServer(app);
  app.use(cors({ origin: "*" }));
  return server;
};
