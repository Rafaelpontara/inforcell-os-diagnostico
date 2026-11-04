# FIXBOT.AI — Front-end

Interface web do assistente de diagnóstico inteligente da **Inforcell** (UNIBALSAS – Sistemas de Informação).
Tecnologias definidas no Documento Técnico (Quadro 11): **HTML, CSS e TypeScript**, sem frameworks.

> Estado atual: **página inicial** e **telas internas** (cadastro de assistências, login, painel, equipe, clientes e equipamentos, Ordens de Serviço e assistente de diagnóstico) integradas à API do back-end Inforcell OS.

## Estrutura

```
frontend/
├── index.html        Página inicial (estrutura semântica e acessível)
├── app.html          Telas internas, que consomem a API
├── css/styles.css    Estilos: tokens de design, componentes, seções e responsividade
├── css/app.css       Estilos das telas internas
├── src/main.ts       Comportamentos da página inicial
├── src/app/          Telas internas: cliente HTTP (api.ts), URL da API (config.ts), roteador (main.ts) e telas/
├── dist/             JavaScript compilado (gerado pelo `npm run build`; a publicação usa esta pasta como está)
├── assets/           Ícones e imagens
├── tsconfig.json     Configuração do compilador TypeScript (modo strict)
└── package.json      Scripts de build e servidor local
```

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior (inclui o npm)

## Instalação e execução

```bash
cd frontend
npm install        # instala o TypeScript
npm run build      # compila src/ -> dist/
npm run serve      # servidor local em http://localhost:5173
```

Ou, em um passo: `npm run dev`. Durante o desenvolvimento, `npm run watch` recompila a cada alteração do `.ts`.

> Também é possível abrir o `index.html` direto no navegador, desde que o `dist/main.js` já tenha sido gerado.
> Se o projeto veio em `.zip`, **extraia antes** (botão direito → Extrair tudo); aberto de dentro do zip, a página fica sem estilo.

O histórico de alterações está em [CHANGELOG.md](CHANGELOG.md).

## Telas internas (`app.html`)

Precisam da API do back-end em execução (veja o README do back-end). Com a API e o `npm run serve` no ar, acesse **http://localhost:5173/app.html** (use `localhost`: é a origem liberada em `CORS_ORIGIN`; pelo `file://` as telas não funcionam).

| Tela | O que faz | Perfis |
|---|---|---|
| Cadastrar assistência | Cria a empresa e o administrador dela. Cada empresa só vê os próprios dados | Público |
| Login | Autenticação com JWT. O token fica no `sessionStorage` e some ao fechar a aba | Todos |
| Painel | Indicadores e OS por status da empresa | Todos |
| Equipe | Adiciona, desativa e reativa atendentes, técnicos e administradores | ADMIN |
| Clientes | Busca, cadastro e edição de clientes e de seus equipamentos | Cadastro: ADMIN e ATENDENTE |
| Ordens de Serviço | Lista com filtros, abertura de OS, técnico, orçamento, status, reparos, histórico e comprovante | Abertura: ADMIN e ATENDENTE |
| Assistente de diagnóstico | Conversa guiada com a IA, medições e conclusão do diagnóstico | ADMIN e TECNICO |

**URL da API:** o padrão é `http://localhost:3333/api`, definido na `<meta name="inforcell-api">` do `app.html`. Cada navegador pode trocá-la na tela de login, em *Configurar conexão com a API* (fica salva no `localStorage`).

> **GitHub Pages:** a página publicada é estática e só funciona com uma API publicada, com a origem do site incluída em `CORS_ORIGIN`. Sem a `ANTHROPIC_API_KEY` no servidor, o restante funciona e o assistente mostra um aviso.

## Utilização

A página inicial apresenta o produto e leva às telas internas pelo botão Entrar:

| Seção | Conteúdo |
|---|---|
| Cabeçalho | Logo, menu com destaque da seção visível, status da IA, botão Entrar |
| Hero | Proposta de valor e janela ilustrativa de uma sessão de diagnóstico |
| Indicadores | Metas do MVP (sintomas-piloto, acerto top 3, etapas, registro na OS) |
| Plataforma | Ordens de Serviço, diagnóstico guiado, histórico e base de conhecimento |
| Como funciona | Fluxo em 4 passos e sintomas-piloto |
| Recursos | Diferenciais + terminal animado simulando um diagnóstico |
| Validação | Estratégias E1–E4 com o público-alvo |
| Planos / FAQ / CTA / Rodapé | Planos em validação, dúvidas frequentes, link do repositório, equipe |

## Boas práticas aplicadas

- **Acessibilidade:** HTML semântico (`header`, `nav`, `main`, `section`, `footer`), link “Pular para o conteúdo”, `aria-label`/`aria-expanded` no menu, foco visível, FAQ com `<details>` (funciona por teclado sem JS), áreas de toque ≥ 44 px, contraste adequado e respeito a `prefers-reduced-motion`.
- **Responsividade:** mobile-first com breakpoints em 1024, 900 e 560 px; menu hambúrguer no celular; sem rolagem horizontal.
- **Organização:** CSS dividido em tokens/base/layout/componentes/seções/animações; classes no padrão BEM; TypeScript em `strict` com funções pequenas por responsabilidade.
- **Progressive enhancement:** sem JavaScript o conteúdo continua visível (animações só são ativadas com a classe `js`).
