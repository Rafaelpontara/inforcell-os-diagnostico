# FIXBOT.AI — Front-end

Interface web do assistente de diagnóstico inteligente da **Inforcell** (UNIBALSAS – Sistemas de Informação).
Tecnologias definidas no Documento Técnico (Quadro 11): **HTML, CSS e TypeScript**, sem frameworks.

> Estado atual: **página inicial (landing page)** concluída. Integração com a IA (API da Anthropic) prevista para a Sprint 3.

## Estrutura

```
frontend/
├── index.html        Página inicial (estrutura semântica e acessível)
├── css/styles.css    Estilos: tokens de design, componentes, seções e responsividade
├── src/main.ts       Comportamentos da interface em TypeScript
├── dist/main.js      JavaScript compilado (gerado pelo `npm run build`)
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
npm run build      # compila src/main.ts -> dist/main.js
npm run serve      # servidor local em http://localhost:5173
```

Ou, em um passo: `npm run dev`. Durante o desenvolvimento, `npm run watch` recompila a cada alteração do `.ts`.

> Também é possível abrir o `index.html` direto no navegador, desde que o `dist/main.js` já tenha sido gerado.
> Se o projeto veio em `.zip`, **extraia antes** (botão direito → Extrair tudo); aberto de dentro do zip, a página fica sem estilo.

O histórico de alterações está em [CHANGELOG.md](CHANGELOG.md).

## Utilização

A página inicial apresenta o produto e leva às próximas telas (login e painel, Sprint 1):

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
