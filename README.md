# Front Cofrinho

Aplicacao React/Vite que consome a API REST do Cofrinho:

- **Invasão**: equipe atacante escolhe um cofre, envia senhas e acompanha os
  indicadores de bons, otimos e etapas concluídas.
- **Gestor**: tela autenticada para configurar equipes e cofres e enviar
  comandos aos dispositivos conectados.

## Executar

```bash
npm install
npm run dev
```

Por padrao, o front usa `http://localhost:3000`. Para outro endereco de API,
crie um arquivo `.env`:

```bash
VITE_API_URL=http://localhost:3000
```

## Rotas

- `/`: painel publico do jogador. Envia tentativas para `POST /api/game/attempt`.
- `/gestor`: login e painel protegido do gestor. O JWT e mantido somente em
  `sessionStorage` e validado em `GET /api/auth/me`.
