# Inforcell OS — Back-end

API REST da **Plataforma Inteligente para Gestão de Ordens de Serviço e Diagnóstico de Equipamentos Eletrônicos**, desenvolvida para a Inforcell (Balsas/MA) — projeto da disciplina de Programação Web, UNIBALSAS.

**Stack:** Node.js 20+ · Express 5 · TypeScript · Prisma ORM · MySQL 8 · JWT + bcrypt · API da Anthropic (Claude)

---

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar o ambiente
cp .env.example .env        # edite DATABASE_URL, JWT_SECRET e ANTHROPIC_API_KEY

# 3. Criar as tabelas e os dados de exemplo
npx prisma migrate deploy   # ou: npm run db:migrate (em desenvolvimento)
npm run db:seed

# 4. Subir a API
npm run dev                 # http://localhost:3333/api
```

Usuários criados pelo seed (senha `inforcell123`): `admin@inforcell.local`, `atendente@inforcell.local`, `tecnico@inforcell.local`.

> Sem `ANTHROPIC_API_KEY` a API funciona normalmente; só as rotas de diagnóstico com IA respondem 503.

### Testes

```bash
npm test          # testes unitários + rotas que não usam banco
npm run test:api  # fluxo completo de uma OS contra o banco (exige migrate + seed); a IA é simulada
```

---

## Estrutura

```
prisma/
  schema.prisma          modelo de dados (MySQL)
  migrations/            migrações versionadas
  seed.ts                dados de exemplo
src/
  app.ts                 montagem do Express e das rotas
  server.ts              inicialização
  config/env.ts          variáveis de ambiente validadas
  middlewares/           autenticação JWT, controle de perfil, tratamento de erros
  modules/               rotas por recurso (auth, usuarios, clientes, equipamentos, ordens, diagnosticos, conhecimento, dashboard)
  services/
    statusOS.ts          fluxo de status da OS (Seção 14 do Documento Técnico)
    ia.service.ts        integração com a API da Anthropic, prompt e sanitização de dados pessoais
    conhecimento.service.ts  busca de artigos relevantes na base de conhecimento
    comprovante.ts       comprovante HTML imprimível da OS
tests/                   testes com Vitest + Supertest
```

---

## Perfis de acesso (RF02 / RNF03)

| Perfil | Pode |
|---|---|
| **ADMIN** | tudo, incluindo gerenciar usuários e excluir artigos da base |
| **ATENDENTE** | cadastrar clientes e equipamentos, abrir OS, atribuir técnico, registrar aprovação do cliente e entrega, gerar comprovante |
| **TECNICO** | ver as OS atribuídas a ele e a fila sem técnico, usar o assistente de IA, registrar medições e reparos, mover a OS nas etapas técnicas |

Todas as rotas, exceto `/api/health` e `/api/auth/login`, exigem o cabeçalho `Authorization: Bearer <token>`.

---

## Endpoints

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{ email, senha }` → `{ token, usuario }` |
| GET | `/api/auth/me` | usuário logado |
| PATCH | `/api/auth/me/senha` | `{ senhaAtual, novaSenha }` |

### Usuários (ADMIN)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/usuarios` | lista de usuários |
| POST | `/api/usuarios` | `{ nome, email, senha, perfil }` |
| PATCH | `/api/usuarios/:id` | alterar dados, perfil, senha ou `ativo` |
| GET | `/api/usuarios/tecnicos` | técnicos ativos (ADMIN e ATENDENTE) |

### Clientes e equipamentos
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/clientes?busca=` | busca por nome, CPF ou telefone (paginado) |
| GET | `/api/clientes/:id` | cliente com equipamentos e OS |
| POST / PATCH | `/api/clientes[/:id]` | `{ nome, telefone, cpf?, email?, endereco? }` |
| GET | `/api/equipamentos?clienteId=` | lista |
| POST / PATCH | `/api/equipamentos[/:id]` | `{ clienteId, tipo, marca, modelo, imei?, numeroSerie?, cor?, observacoes? }` |
| GET | `/api/equipamentos/:id/historico` | todas as OS, diagnósticos, medições e reparos do aparelho (RF19) |

`tipo`: `CELULAR`, `TABLET`, `NOTEBOOK`, `DESKTOP`, `OUTRO`.

### Ordens de Serviço
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/ordens?status=&tecnicoId=&busca=&de=&ate=&pagina=` | `busca` aceita nº da OS (`OS-0012`), nome/telefone do cliente, IMEI, nº de série ou modelo (RF21) |
| GET | `/api/ordens/:id` | detalhes completos + `proximosStatus` permitidos ao usuário |
| POST | `/api/ordens` | `{ clienteId, equipamentoId, defeitoRelatado, acessorios?, tecnicoId?, previsaoEntrega? }` |
| PATCH | `/api/ordens/:id` | `{ valorOrcamento?, previsaoEntrega?, observacoes?, ... }` |
| PATCH | `/api/ordens/:id/atribuir` | `{ tecnicoId }` (RF07) |
| PATCH | `/api/ordens/:id/status` | `{ status, observacao? }` (RF06) |
| POST | `/api/ordens/:id/medicoes` | medição avulsa (RF14) |
| POST | `/api/ordens/:id/reparos` | `{ descricao, pecasUtilizadas?, valorFinal? }` (RF18) |
| GET | `/api/ordens/:id/comprovante` | comprovante HTML para imprimir (RF20) |

**Fluxo de status:**
`RECEBIDO → EM_DIAGNOSTICO → AGUARDANDO_APROVACAO → EM_REPARO → EM_TESTES → FINALIZADO → ENTREGUE`
- `EM_TESTES → EM_REPARO` se o teste falhar;
- `CANCELADO` a partir de RECEBIDO, EM_DIAGNOSTICO ou AGUARDANDO_APROVACAO (orçamento recusado), seguido de `ENTREGUE` na devolução.

Regras: precisa de técnico para iniciar o diagnóstico, de orçamento para pedir aprovação e de reparo registrado para ir a testes. Cada mudança fica no histórico da OS.

### Diagnóstico com IA (RF10–RF17)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/ordens/:osId/diagnosticos` | `{ sintoma }` → inicia a sessão; retorna causas possíveis e o primeiro teste |
| GET | `/api/diagnosticos/:id` | sessão com toda a conversa e as medições |
| POST | `/api/diagnosticos/:id/mensagens` | `{ texto, medicao? }` → registra o resultado e retorna a interpretação e o próximo teste |
| POST | `/api/diagnosticos/:id/continuar` | pede nova orientação (após falha temporária da IA) |
| POST | `/api/diagnosticos/:id/concluir` | `{ diagnosticoFinal, salvarNaBase? }` → encerra e, opcionalmente, salva o caso na base |

`medicao`: `{ pontoMedicao, grandeza, valor, unidade, resultadoEsperado? }` — a IA preenche a `avaliacao` (`DENTRO_DO_ESPERADO`, `ABAIXO_DO_ESPERADO`, `ACIMA_DO_ESPERADO`).

Exemplo de `orientacao` retornada:

```json
{
  "mensagem": "Vamos começar pelo consumo na fonte de bancada.",
  "causasPossiveis": [
    { "causa": "Bateria defeituosa", "probabilidade": "alta", "justificativa": "..." },
    { "causa": "Curto na linha principal", "probabilidade": "media", "justificativa": "..." }
  ],
  "proximaEtapa": {
    "titulo": "Consumo na fonte",
    "procedimento": "Alimente a placa a 4,0 V e observe a corrente ao pressionar Power.",
    "instrumento": "Fonte de bancada",
    "pontoMedicao": "Conector da bateria",
    "resultadoEsperado": "Pico de 50–300 mA"
  },
  "interpretacaoUltimoResultado": null,
  "avaliacaoUltimaMedicao": null,
  "diagnosticoConcluido": false,
  "diagnosticoSugerido": null,
  "alertasSeguranca": []
}
```

Como a IA é usada:
- a chave fica só no servidor; o front-end nunca chama a Anthropic diretamente;
- só vão para a IA dados técnicos (tipo, marca, modelo, sintoma, medições). Nome do cliente nunca é enviado, e CPF, telefone e e-mail digitados no texto são removidos antes do envio (RNF04);
- o contexto inclui diagnósticos anteriores do mesmo aparelho e os artigos mais relevantes da base de conhecimento;
- a resposta vem em formato estruturado (tool use), validada com Zod antes de ser salva.

### Base de conhecimento
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conhecimento?busca=&tipo=` | busca de artigos |
| GET | `/api/conhecimento/:id` | artigo |
| POST / PATCH | `/api/conhecimento[/:id]` | `{ titulo, sintoma, conteudo, tipoEquipamento?, marca?, modelo?, tags? }` (ADMIN, TECNICO) |
| DELETE | `/api/conhecimento/:id` | excluir (ADMIN) |

### Painel
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard` | OS por status, em aberto, atrasadas, últimos 30 dias e OS abertas por técnico (HU08) |

---

## Rastreabilidade com o Documento Técnico

| Requisito / HU | Onde |
|---|---|
| RF01–RF02, HU01 | `modules/auth.routes.ts`, `modules/usuarios.routes.ts`, `middlewares/auth.ts` |
| RF03–RF04, HU02 | `modules/clientes.routes.ts`, `modules/equipamentos.routes.ts` |
| RF05–RF08, RF20–RF21, HU03–HU04 | `modules/ordens.routes.ts`, `services/comprovante.ts` |
| RF06 / Seção 14 | `services/statusOS.ts` |
| RF09–RF17, HU05–HU06 | `modules/diagnosticos.routes.ts`, `services/ia.service.ts` |
| RF18, HU07 | `POST /api/ordens/:id/reparos` |
| RF19 | `GET /api/equipamentos/:id/historico` |
| HU08 | `modules/dashboard.routes.ts` |
| Seção 17 | `modules/conhecimento.routes.ts`, `services/conhecimento.service.ts` |
| RNF02, RNF03 | JWT com expiração (`JWT_EXPIRES_IN`), bcrypt, `autorizar(...)` |
| RNF04 | `sanitizarTexto()` e contexto sem dados pessoais em `ia.service.ts` |
| RNF09 | organização em camadas: rotas → serviços → Prisma |
