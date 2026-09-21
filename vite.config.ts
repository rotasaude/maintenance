import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Frontend da API de manutenção (spec 2026-09-18-maintenance-frontend-design §4).
//
// Em dev, o navegador fala só com http://maintenance.localhost:5177, e o Vite
// repassa ao api TROCANDO O HOST para maintenance-api.localhost: a rota do api
// só casa com o rótulo `maintenance-api`, e este é o ÚNICO lugar onde o host
// muda.
//
// Ruling P2 (global-constraints.md): a API exige Origin == MAINTENANCE_FRONTEND_ORIGIN
// em TODA requisição, GET incluído — mas o navegador NÃO manda Origin num GET
// same-origin, que é exatamente esta topologia (o browser só fala com
// maintenance.localhost:5177). Sem isto, GET /session chegaria ao api sem
// Origin, levaria 403, e cada reload derrubaria a sessão. Por isso, e SÓ
// quando a requisição chega ao proxy SEM Origin, o hook injeta o Origin do
// próprio frontend (http://<Host recebido pelo Vite>, na prática
// http://maintenance.localhost:5177). Um Origin que o navegador já mandou —
// inclusive de outro site — NUNCA é sobrescrito: é exatamente ele que a API
// compara com MAINTENANCE_FRONTEND_ORIGIN, e é assim que um POST cross-site
// continua sendo recusado.
//
// `headers: { host }` sozinho é estático e não dá para condicionar o Origin
// à presença ou não do header recebido, então as duas trocas (Host e Origin)
// passam pelo hook `configure`/`proxyReq` do http-proxy.
//
// /invitations NÃO é repassado como prefixo: o link do convite abre
// /invitations#<token> NO FRONTEND. Só os dois POSTs vão ao api.
const TARGET = process.env.VITE_API_PROXY_TARGET || "http://localhost:3030";
const API_HOST = "maintenance-api.localhost";

const proxy: ProxyOptions = {
  target: TARGET,
  changeOrigin: false,
  configure(proxyServer) {
    proxyServer.on("proxyReq", (proxyReq, req) => {
      proxyReq.setHeader("host", API_HOST);
      if (!req.headers.origin) {
        const incomingHost = req.headers.host ?? "maintenance.localhost:5177";
        proxyReq.setHeader("origin", `http://${incomingHost}`);
      }
    });
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    allowedHosts: [".localhost"],
    proxy: {
      "/graphql": proxy,
      "/session": proxy,
      "/invitations/enroll": proxy,
      "/invitations/accept": proxy
    }
  }
});
