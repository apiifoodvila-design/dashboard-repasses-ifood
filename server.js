// Dashboard de repasses iFood — Vila Árabe
// Busca os dados no Supabase e serve o painel com login.
// Variáveis de ambiente:
//   DADOS_URL     URL da função ifood-repasses no Supabase
//   DADOS_TOKEN   token de acesso da função
//   DASH_USUARIO  usuário para entrar no painel
//   DASH_SENHA    senha para entrar no painel
const express = require("express");
const path = require("path");
// Os dados vêm de uma função no Supabase (ifood-repasses), que lê o schema "ifood".
const DADOS_URL = process.env.DADOS_URL;     // URL da função no Supabase
const DADOS_TOKEN = process.env.DADOS_TOKEN; // token que a função exige

const app = express();

// Login simples (o navegador pede usuário e senha)
app.use((req, res, next) => {
  const user = process.env.DASH_USUARIO, pass = process.env.DASH_SENHA;
  if (!user || !pass) return res.status(500).send("Configure DASH_USUARIO e DASH_SENHA no Render.");
  const [tipo, cred] = (req.headers.authorization || "").split(" ");
  if (tipo === "Basic" && cred) {
    const [u, ...p] = Buffer.from(cred, "base64").toString().split(":");
    if (u === user && p.join(":") === pass) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Repasses iFood", charset="UTF-8"');
  res.status(401).send("Acesso restrito.");
});

app.get("/api/dados", async (req, res) => {
  try {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || "") ? "?mes=" + req.query.mes : "";
    const r = await fetch(DADOS_URL + mes, { headers: { "x-dash-token": DADOS_TOKEN } });
    res.status(r.status).type("application/json").send(await r.text());
  } catch (e) {
    console.error(e);
    res.status(502).json({ erro: "Falha ao buscar os dados" });
  }
});


// Homologação iFood: consulta ao vivo o ambiente de teste (app de teste + header x-request-homologation)
const HOMOLOG_URL = process.env.HOMOLOG_URL || (DADOS_URL || "").replace("ifood-repasses", "ifood-homolog");
const LOJA_TESTE = "b4451ef7-13ab-4ec3-9b98-51c99ec6a5ee";
const CHAMADAS = {
  merchants: { paths: ["/merchant/v1.0/merchants"] },
  sales: { paths: [`/financial/v3.0/merchants/${LOJA_TESTE}/sales?beginSalesDate=2025-08-01&endSalesDate=2025-08-31`] },
  events: { paths: [`/financial/v3.0/merchants/${LOJA_TESTE}/financial-events?beginDate=2025-08-01&endDate=2025-08-31`] },
  reconciliation: { paths: [`/financial/v3.0/merchants/${LOJA_TESTE}/reconciliation?competence=2025-08`], baixar_csv: true },
  settlements: { paths: [`/financial/v3.0/merchants/${LOJA_TESTE}/settlements?beginPaymentDate=2025-08-01&endPaymentDate=2025-08-31`,
                         `/financial/v3.0/merchants/${LOJA_TESTE}/financial-events?beginDate=2025-08-01&endDate=2025-08-31`] },
};
app.post("/api/homolog/:api", async (req, res) => {
  const c = CHAMADAS[req.params.api];
  if (!c) return res.status(404).json({ erro: "API desconhecida" });
  try {
    const r = await fetch(HOMOLOG_URL, {
      method: "POST",
      headers: { "x-dash-token": DADOS_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ tag: "video:" + req.params.api, retornar: true, ...c }),
    });
    res.status(r.status).type("application/json").send(await r.text());
  } catch (e) {
    console.error(e);
    res.status(502).json({ erro: "Falha ao consultar o iFood" });
  }
});

app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Dashboard no ar na porta " + port));
