# Hollow Fight — servidor inicial

## O que este projeto já faz
- Servidor Node.js + Express + Socket.IO.
- Salas com código e limite de 3 jogadores.
- Lista de jogadores da sala.
- Migração simples do anfitrião quando ele sai.
- Endpoint de versão (`/api/version`).
- Painel para avisar jogadores online (`/admin.html`).

## Importante
Este é o esqueleto do servidor, não a integração completa do jogo. O HTML atual usa PeerJS. Para migrar, será necessário substituir a camada PeerJS por Socket.IO e mover a lógica crítica de batalha para o servidor. A migração de anfitrião aqui ainda NÃO transfere a batalha em andamento.

## Testar no computador
1. Instale Node.js (versão LTS).
2. Abra o terminal nesta pasta.
3. Rode `npm install`.
4. Defina `ADMIN_TOKEN`:
   - Windows PowerShell: `$env:ADMIN_TOKEN="uma-senha-longa"`
   - macOS/Linux: `export ADMIN_TOKEN="uma-senha-longa"`
5. Rode `npm start`.
6. Abra `http://localhost:10000/health` e depois `http://localhost:10000/admin.html`.

## Publicar no Render
- Envie estes arquivos para um repositório GitHub.
- No Render: New > Web Service > conecte o repositório.
- Build Command: `npm install`
- Start Command: `npm start`
- Adicione a variável de ambiente `ADMIN_TOKEN` com uma senha longa e privada.
- Deploy.
- O Render fornece uma URL `https://seu-servico.onrender.com`.

## Atualizações (opção C)
1. Atualização automática do código: altere os arquivos e faça commit/push na branch conectada ao Render. O Render inicia um novo deploy.
2. Aviso pelo painel: abra `https://SEU-SERVICO.onrender.com/admin.html`, informe o token, versão e novidades e clique em AVISAR JOGADORES.
3. O aviso é enviado apenas a quem estiver conectado naquele momento. Para exibir aviso dentro do jogo e verificar versões automaticamente, o HTML do jogo precisa ser integrado ao Socket.IO e consultar `/api/version`.

No plano gratuito, o Render pode suspender o serviço após 15 minutos sem tráfego e pode levar cerca de um minuto para voltar. Não use esse plano como garantia de servidor 24h.
