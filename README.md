# PUBG Stream Report

Site onde qualquer jogador pesquisa o próprio nickname do PUBG e encontra somente confrontos contra streamers que estavam transmitindo no momento e possuem VOD cobrindo a jogada.

## Fluxo
1. O usuário informa seu nickname do PUBG.
2. O servidor consulta as partidas recentes.
3. A telemetria identifica kills e mortes.
4. O adversário é comparado com a base interna de streamers.
5. A Twitch é consultada para encontrar o VOD.
6. O encontro só é publicado se o VOD cobrir o horário do evento.
7. O resultado recebe um link para o VOD com o timestamp aproximado.

O usuário comum não precisa ser streamer e não precisa estar cadastrado.

## Base interna de streamers
Cada streamer possui twitchLogin, pubgNickname, displayName e enabled. A base é usada somente pelo servidor.

Se o streamer não estava transmitindo, não existe VOD ou o horário não puder ser coberto pelo VOD, o encontro não aparece.

## Configuração
Copie .env.example para .env e preencha PUBG_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET e ADMIN_TOKEN.

## Rodar
Node.js 20+:

    npm install
    npm start

Abra http://localhost:3000.

## Deploy
O projeto inclui render.yaml para Render. Configure as variáveis secretas no serviço e nunca coloque credenciais no Git.

## Limitação
A PUBG API disponibiliza partidas recentes. O MVP analisa as partidas retornadas para o jogador pesquisado. A confirmação histórica depende de VOD arquivado na Twitch.
