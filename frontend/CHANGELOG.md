# Histórico de versões — Front-end FIXBOT.AI

## [0.1.1] — 05/10/2026
Correções feitas após os testes da página inicial (desktop, tablet e celular).

### Corrigido
- Texto da nota do hero ("Em desenvolvimento para a Inforcell...") quebrava em colunas; agrupado em um único bloco.
- Menu marcava "FAQ" como ativo ao voltar ao topo; o scroll spy agora limpa o destaque na área inicial.
- Botão "Acompanhar o projeto" quebrava em duas linhas na faixa de chamada; largura fixada.
- Conteúdo ficava invisível com JavaScript desativado; as animações de entrada agora só são aplicadas quando o JS carrega (classe `js`).

### Adicionado
- Publicação automática no GitHub Pages (`.github/workflows/pages.yml`), que publica a pasta `frontend/` a cada envio para a branch `main`.
- Arquivo `.gitignore` do front-end (ignora `node_modules/` e mapas de código).

### Observado nos testes
- Ao abrir o `index.html` sem extrair o zip, a página aparece sem estilo, porque as pastas `css/` e `dist/` não são encontradas. Instrução de extração adicionada ao README.

## [0.1.0] — 05/10/2026
### Adicionado
- Estrutura do front-end (HTML, CSS e TypeScript), `package.json` e `tsconfig.json`.
- Página inicial: cabeçalho com menu responsivo, hero, indicadores do MVP, plataforma, como funciona, recursos, terminal de demonstração, validação, planos, FAQ, chamada e rodapé.
- Comportamentos em TypeScript: menu mobile, scroll spy, animação de entrada, contadores e terminal animado.
- README com instalação, execução e utilização.
