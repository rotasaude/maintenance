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
// quando a requisição chega ao proxy SEM Origin, o hook injeta uma CONSTANTE
// (ver DEV_FRONTEND_ORIGIN abaixo — não o Host que a requisição trouxe: um
// Host é dado do request, não algo em que confiar para decidir o Origin). Um
// Origin que o navegador já mandou — inclusive de outro site — NUNCA é
// sobrescrito: é exatamente ele que a API compara com
// MAINTENANCE_FRONTEND_ORIGIN, e é assim que um POST cross-site continua
// sendo recusado.
//
// `headers: { host }` sozinho é estático e não dá para condicionar o Origin
// à presença ou não do header recebido, então as duas trocas (Host e Origin)
// passam pelo hook `configure`/`proxyReq` do http-proxy.
//
// /invitations NÃO é repassado como prefixo: o link do convite abre
// /invitations#<token> NO FRONTEND. Só os dois POSTs vão ao api.
const TARGET = process.env.VITE_API_PROXY_TARGET || "http://localhost:3030";
const API_HOST = "maintenance-api.localhost";

// O Origin injetado é uma CONSTANTE — o frontend de dev só serve de
// http://maintenance.localhost:5177 (server.host/port acima), então "de
// onde a requisição chegou" nunca é uma pergunta em aberto aqui. Derivar o
// Origin do Host QUE O NAVEGADOR MANDOU (como antes) inverte a checagem que
// este hook existe para fazer: um proxy reverso, um túnel, ou qualquer
// front-end nesse caminho poderia escrever um Host arbitrário, e o api
// acabaria comparando o Origin contra um valor que o PRÓPRIO REQUEST trouxe
// — nunca recusaria nada. `MAINTENANCE_FRONTEND_ORIGIN` deixa a env
// sobrescrever para outra porta/host de dev sem editar código.
//
// ATENÇÃO — ESTE HOOK É SÓ DE DEV: existe porque o servidor de dev do Vite
// é o único lugar onde "o navegador não manda Origin num GET same-origin"
// (ruling P2) precisa de um paliativo local. Um proxy reverso de STAGING
// (nginx, etc.) NUNCA deve copiar este truque — lá o Origin ausente deve
// continuar sendo recusado pelo api normalmente; inventar um Origin ali
// reabriria exatamente o buraco que a checagem existe para fechar.
const DEV_FRONTEND_ORIGIN = process.env.MAINTENANCE_FRONTEND_ORIGIN || "http://maintenance.localhost:5177";

const proxy: ProxyOptions = {
  target: TARGET,
  changeOrigin: false,
  configure(proxyServer) {
    proxyServer.on("proxyReq", (proxyReq, req) => {
      proxyReq.setHeader("host", API_HOST);
      // Um Origin que o navegador já mandou — inclusive de outro site —
      // NUNCA é sobrescrito: é exatamente ele que o api compara com
      // MAINTENANCE_FRONTEND_ORIGIN, e é assim que um POST cross-site
      // continua sendo recusado.
      if (!req.headers.origin) proxyReq.setHeader("origin", DEV_FRONTEND_ORIGIN);
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
