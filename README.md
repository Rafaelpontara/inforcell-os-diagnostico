# Inforcell OS & Diagnóstico

Plataforma inteligente para gestão de Ordens de Serviço e diagnóstico assistido por IA de equipamentos eletrônicos (celulares e computadores), desenvolvida para a **Inforcell** (Balsas – MA), como projeto da disciplina de Programação para Web — UNIBALSAS.

## Equipe

- Matheus de Brito Araujo
- Pedro Paulo T. Araujo
- Rafael Pontara

## Sobre o projeto

A plataforma reúne dois grandes grupos de funcionalidades:

- **Gestão da assistência técnica**: clientes, equipamentos, Ordens de Serviço, técnicos, status dos serviços e histórico.
- **Assistência inteligente ao técnico**: análise de sintomas, identificação de possíveis causas, diagnóstico orientado passo a passo, orientação sobre medições e registro das etapas do diagnóstico.

## Tecnologias previstas

- Front-end: HTML, CSS, JavaScript, TypeScript
- Banco de dados: MySQL
- Back-end: Node.js, Express 5, TypeScript e Prisma ORM (API REST, autenticação JWT + bcrypt)
- API de IA: Anthropic (modelos Claude), acessada somente pelo servidor
- Prototipação: Figma
- Versionamento: GitHub

## Protótipo

Protótipo de alta fidelidade no Figma: <https://www.figma.com/design/n6lJH8wOyIVzayCsOiWnGk/Projeto-de-I.A-de-Assistencia-para-equipamentos-eletronicos>

## Estrutura do repositório

- [`frontend/`](frontend/) — página inicial e interface web
- [`backend/`](backend/) — API REST, regras de negócio, banco de dados e integração com a IA

Para instalar e executar a API, os scripts do banco e a documentação dos endpoints, consulte o [README do back-end](backend/README.md).

## Status

Back-end implementado (API REST, persistência em MySQL, autenticação e diagnóstico guiado por IA). Consulte a documentação técnica completa (PDF) entregue junto com este repositório.
