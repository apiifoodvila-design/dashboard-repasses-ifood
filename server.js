// Dashboard de repasses iFood — Vila Árabe
// Lê os dados do schema "ifood" no Supabase (Postgres) e serve o painel.
// Variáveis de ambiente:
//   DATABASE_URL  string de conexão do Postgres (Supabase > Connect > Session pooler)
//   DASH_USUARIO  usuário para entrar no painel
//   DASH_SENHA    senha para entrar no painel
const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

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
    const mesParam = /^\d{4}-\d{2}$/.test(req.query.mes || "") ? req.query.mes + "-01" : null;
    const { rows: [m] } = await pool.query(
      "select coalesce($1::date, max(mes)) as mes from ifood.faturamento_mensal", [mesParam]);
    const mes = m.mes;

    const { rows } = await pool.query(`
      select l.id_loja, l.nome, l.apelido,
             f.valor_vendas, f.taxas_comissoes, f.servicos_promocoes, f.ajustes, f.total_faturamento,
             greatest(f.atualizado_em, (select max(atualizado_em) from ifood.repasses r where r.id_loja = l.id_loja)) as atualizado_em,
             coalesce((
               select json_agg(json_build_object(
                 'previsao_pagamento', to_char(r.previsao_pagamento,'YYYY-MM-DD'),
                 'periodo_inicio', to_char(r.periodo_inicio,'YYYY-MM-DD'),
                 'periodo_fim', to_char(r.periodo_fim,'YYYY-MM-DD'),
                 'situacao', r.situacao,
                 'valor', r.valor::float) order by r.previsao_pagamento)
               from ifood.repasses r
               where r.id_loja = l.id_loja
                 and date_trunc('month', r.periodo_inicio) = f.mes
             ), '[]') as repasses
      from ifood.faturamento_mensal f
      join ifood.lojas l using (id_loja)
      where f.mes = $1
      order by l.nome`, [mes]);

    res.json({
      mes: mes ? mes.toISOString().slice(0, 7) : null,
      atualizado_em: rows.reduce((a, r) => (r.atualizado_em > a ? r.atualizado_em : a), null),
      lojas: rows.map(r => ({
        id_loja: Number(r.id_loja),
        nome: r.nome,
        apelido_exibir: r.apelido || "",
        faturamento: {
          valor_vendas: +r.valor_vendas,
          taxas_comissoes: +r.taxas_comissoes,
          servicos_promocoes: +r.servicos_promocoes,
          ajustes: +r.ajustes,
          total_faturamento: +r.total_faturamento,
        },
        repasses: r.repasses,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Falha ao ler o banco" });
  }
});

app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Dashboard no ar na porta " + port));
