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

app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Dashboard no ar na porta " + port));
