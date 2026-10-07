# PUBG Stream Report

Site independente inspirado no conceito de PUBG Report.

## Regra principal

Um encontro só aparece publicamente quando:

1. o jogador pesquisado participou da partida;
2. a telemetria confirma uma kill/death contra outro jogador;
3. o outro jogador está cadastrado como streamer;
4. existe um VOD arquivado da Twitch cobrindo o horário do evento.

Se não houver VOD cobrindo o horário, o encontro é descartado.

## Rodar localmente

Requer Node.js 20+.

```bash
cp .env.example .env
npm start
```

Abra http://localhost:3000

## Variáveis

- PUBG_API_KEY
- PUBG_PLATFORM=steam
- TWITCH_CLIENT_ID
- TWITCH_CLIENT_SECRET
- ADMIN_TOKEN
- MAX_MATCHES
- VOD_MATCH_TOLERANCE_SECONDS

## Cadastrar streamer

Use o nickname da Twitch e, preferencialmente, o nickname exato do PUBG:

```bash
curl -X POST http://localhost:3000/api/admin/streamers \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: SEU_TOKEN" \
  -d '{"twitchLogin":"exemplo","displayName":"Exemplo","pubgNickname":"NickNoPUBG"}'
```

O campo pubgNickname é importante porque o nome da Twitch e o nickname do PUBG podem ser diferentes.

## Deploy

O projeto inclui render.yaml para Render. Configure as mesmas variáveis como Environment Variables no serviço. Não coloque chaves no Git.

## Observação

A API do PUBG fornece partidas recentes, não um histórico ilimitado. O MVP consulta as partidas retornadas para o jogador. A confirmação histórica da transmissão é feita pelos VODs arquivados da Twitch.
