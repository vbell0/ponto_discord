# Plano — Bot de Ponto (Discord) + Dashboard Web para servidor GTA RP

> Documento de planejamento para ser usado no **Claude Code**. Cole este arquivo na raiz do projeto (`PLANO.md`) e peça ao Claude Code para seguir as fases em ordem.

---

## 1. Visão geral

Sistema de "bate ponto" whitelabel para organizações de servidores de GTA RP — cada servidor Discord é uma organização única (Polícia, Corpo de Bombeiros, EMS, Mecânica, até uma lanchonete do RP), com nome e cor configuráveis no site, sem departamentos internos fixos. Composto por:

1. **Bot do Discord** — 100% via **Interactions**, e só as do painel de ponto: **botões** (`Bater Ponto`/`Pausar`/`Retomar`/`Fechar Ponto`). Sem slash command nenhum (nem de admin, nem de usuário), sem comando de prefixo, sem leitura de conteúdo de mensagem (não precisa do intent `MESSAGE_CONTENT`) — toda configuração é feita pelo site (seção 6).
2. **Dashboard Web** — login com Discord OAuth2, análise completa dos pontos batidos (gráficos, filtros, exportação), toda a configuração do bot/canais/mensagens (nada de comando, tudo pela web), e gerenciamento de backups (link pra mensagem no Discord + importação/restore).
3. **Banco de dados PostgreSQL** rodando em Docker, com **backup automático a cada 1h enviado só como anexo no Discord** (feature com liga/desliga no site) e possibilidade de restaurar/importar um dump pelo site.
4. Tudo hospedado numa **VM Always Free do Oracle Cloud** (seção 9).

### Decisão de stack

Você deu a opção Go ou Node.js. Recomendo **TypeScript/Node.js** para o projeto inteiro (bot + web), porque:
- Um único ecossistema (menos context-switch, mesmos tipos compartilhados entre bot e site via um pacote `shared`).
- `discord.js` é o SDK de interactions mais maduro e documentado.
- `Next.js` cobre dashboard + API routes num só serviço.
- `Prisma` dá migrations, seed e um client tipado para o Postgres — ótimo para o Claude Code gerar CRUD rápido.

Se você preferir Go no bot por performance, dá pra trocar só o serviço `bot/` por `discordgo` mantendo o resto do plano igual — mas o plano abaixo assume Node.js em tudo.

### Stack final

| Camada | Tecnologia |
|---|---|
| Bot Discord | Node.js 20 + TypeScript + discord.js v14 (interactions only) |
| Web/Dashboard | Next.js 14 (App Router) + TypeScript + Tailwind |
| Auth do site | NextAuth.js com provider Discord OAuth2 |
| ORM / DB | Prisma + PostgreSQL 16 |
| Banco em container | Docker Compose (postgres + adminer opcional) |
| Backup | `pg_dump` agendado com `node-cron`, envia **só como anexo no canal do Discord**, arquivo local é temporário (apagado após o envio) |
| Gráficos do site | Recharts |
| Exportação | Excel (`exceljs`) e CSV |
| Deploy | Docker Compose num **Droplet DigitalOcean** (2 vCPU / 4 GB RAM), Caddy como reverse proxy/TLS |

---

## 2. Estrutura de pastas (monorepo)

```
ponto-rp/
├── docker-compose.yml
├── .env.example
├── PLANO.md
├── packages/
│   ├── shared/              # tipos TS compartilhados, enums, constantes
│   ├── database/            # schema.prisma, migrations, client Prisma exportado
│   ├── bot/                 # bot Discord (discord.js) — só interactions do painel de ponto
│   │   ├── src/
│   │   │   ├── components/  # handlers dos botões: Bater/Pausar/Retomar/Fechar Ponto
│   │   │   ├── jobs/        # cron: refresh top10, refresh painel aberto, auto-close, backup, poll de config
│   │   │   ├── services/    # regras de negócio (ponto, voz, backup)
│   │   │   ├── events/      # interactionCreate, voiceStateUpdate, guildCreate, ready
│   │   │   ├── internal-api/ # servidor HTTP interno (Fastify/Express) só pra chamadas do site: /internal/refresh, /internal/backup, /internal/ponto/:id/fechar — protegido por INTERNAL_API_SECRET, sem exposição pública
│   │   │   └── index.ts
│   │   └── package.json
│   └── web/                 # Next.js dashboard
│       ├── app/
│       │   ├── (dashboard)/
│       │   │   ├── analytics/
│       │   │   ├── membros/
│       │   │   ├── configuracoes/
│       │   │   └── backups/
│       │   ├── api/
│       │   │   ├── auth/[...nextauth]/
│       │   │   ├── pontos/
│       │   │   ├── backups/
│       │   │   │   ├── route.ts        # listar / gerar backup manual
│       │   │   │   └── import/route.ts # upload + restore de dump
│       │   │   └── config/
│       │   └── login/
│       └── package.json
```

---

## 3. Modelo de dados (Prisma / Postgres)

Entidades principais:

- **Guild** — servidor Discord (id, nome, config: canal_painel_id, canal_top10_id, canal_abertos_id, canal_backup_id, canal_voz_permitido_ids[], tempo_tolerancia_saida_voz_segundos default 60) **+ textos whitelabel** (nome da organização, cor do embed, rótulo do que é "ponto" — tudo editável no site, sem entidade fixa de departamento no banco; ver `Guild.orgName`/`Guild.embedColor` abaixo).
- **Member** — usuário Discord da guild (sem vínculo a departamento — cada guild já é uma organização única, com seu próprio nome/cor definidos em `Guild`).
- **PontoSession** — sessão de ponto: `id, memberId, startedAt, endedAt, status (ABERTO, PAUSADO, FECHADO), closedReason (MANUAL, SAIU_DA_VOZ, ADMIN)`.
- **PontoEvent** — log granular de eventos dentro de uma sessão (INICIO, PAUSA, RETOMADA, FIM) com timestamp — usado para calcular tempo líquido (descontando pausas).
- **VoiceWatch** — controle temporário de quem saiu da call com ponto aberto e o timestamp limite dos 60s (pode ser em memória/Redis-like no processo do bot, mas persistir em tabela garante que sobrevive a restart do bot).
- **BackupLog** — histórico de backups automáticos/manuais (arquivo, tamanho, timestamp, sucesso/erro).
- **AuditLog** — ações administrativas (editar ponto manualmente, importar backup, mudar config).

```prisma
model Guild {
  id                    String   @id // discord guild id
  name                  String
  orgName               String   @default("Ponto") // whitelabel: "Departamento de Polícia", "Corpo de Bombeiros", "Lanchonete do Zé"...
  embedColor            String   @default("#5865F2")
  painelChannelId       String?
  top10ChannelId        String?
  abertosChannelId      String?
  backupChannelId       String?
  allowedVoiceChannelIds String[] @default([])
  autoCloseSeconds      Int      @default(60)
  backupEnabled         Boolean  @default(true) // feature toggle — liga/desliga o backup automático de 1 em 1h
  members               Member[]
  createdAt             DateTime @default(now())
}

model Member {
  id           String   @id @default(cuid())
  discordId    String
  guildId      String
  guild        Guild    @relation(fields: [guildId], references: [id])
  displayName  String
  sessions     PontoSession[]

  @@unique([discordId, guildId])
}

model PontoSession {
  id           String    @id @default(cuid())
  memberId     String
  member       Member    @relation(fields: [memberId], references: [id])
  startedAt    DateTime  @default(now())
  endedAt      DateTime?
  status       PontoStatus @default(ABERTO)
  closedReason ClosedReason?
  totalSeconds Int?       // calculado no fechamento (descontando pausas)
  events       PontoEvent[]
}

model PontoEvent {
  id        String   @id @default(cuid())
  sessionId String
  session   PontoSession @relation(fields: [sessionId], references: [id])
  type      PontoEventType
  createdAt DateTime @default(now())
}

model BackupLog {
  id                String   @id @default(cuid())
  guildId           String
  fileName          String
  sizeBytes         Int
  success           Boolean
  errorMsg          String?
  discordMessageId  String?  // mensagem no canal #backups onde o dump foi anexado
  discordChannelId  String?
  createdAt         DateTime @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  guildId    String
  actorId    String   // discord id de quem fez a ação (bot/admin)
  action     String
  metadata   Json?
  createdAt  DateTime @default(now())
}

enum PontoStatus { ABERTO PAUSADO FECHADO }
enum ClosedReason { MANUAL SAIU_DA_VOZ ADMIN }
enum PontoEventType { INICIO PAUSA RETOMADA FIM }
```

---

## 4. Os 4 canais e o que cada um faz

1. **#ponto** — canal fixo com um **embed + botões persistentes** (`Bater Ponto`, `Pausar`, `Retomar`, `Fechar Ponto`). Título, texto e cor do embed vêm de `Guild.orgName`/`Guild.embedColor` (whitelabel — ex.: "Departamento de Polícia", "Corpo de Bombeiros", "Lanchonete do Zé"), tudo editável no site. Os botões usam `customId` fixo e são reidratados no `ready` do bot (`client.on(Events.InteractionCreate...)`), então sobrevivem a restart do bot.
2. **#top-10-horas** — embed atualizado por cron (ex.: a cada 5 min) com o ranking das 10 pessoas com mais horas no período configurado (semana/mês, configurável no site).
3. **#pontos-abertos** — embed atualizado por cron (ex.: a cada 30s–1min) listando quem está com ponto ABERTO ou PAUSADO agora, com tempo decorrido.
4. **#backups** — se o feature estiver ligado (`Guild.backupEnabled`), a cada 1h o bot roda o `pg_dump`, comprime e **posta o arquivo como anexo nesse canal** — é o único destino do backup, nada de nuvem externa. O arquivo local é apagado logo depois do envio (não fica guardado no servidor). Se passar do limite de 25MB do Discord, o bot posta um aviso no canal explicando que o dump ficou grande demais pra anexar e sugerindo gerar um backup mais frequente ou revisar o volume de dados — não há destino alternativo.

---

## 5. Regras de negócio críticas

### 5.1 Só pode bater ponto estando em canal de voz
Ao clicar em "Bater Ponto", o bot verifica `interaction.member.voice.channelId`. Se for `null` ou não estiver na lista `allowedVoiceChannelIds` da guild, responde efêmero: *"Você precisa estar em um canal de voz permitido para bater ponto."*

### 5.2 Fechamento automático ao sair da call (1 minuto)
No handler de `voiceStateUpdate`:
- Se `oldState.channelId` existia, `newState.channelId` é `null` (ou não é mais um canal permitido), **e** o membro tem uma `PontoSession` ABERTA/PAUSADA:
  - Cria/atualiza um `VoiceWatch` com `deadline = now + autoCloseSeconds`.
  - Agenda um timer (setTimeout em memória **e** um cron de segurança que varre `VoiceWatch` vencidos, para cobrir restarts do bot).
- Se o membro **voltar** a um canal de voz permitido antes do deadline, remove o `VoiceWatch` (ponto continua rodando normalmente).
- Se o deadline vencer, fecha a sessão (`status = FECHADO`, `closedReason = SAIU_DA_VOZ`), grava `PontoEvent(FIM)`, calcula `totalSeconds`, e manda uma notificação no canal do ponto ou DM avisando o motivo.

### 5.3 Pausar/Retomar
Pausa não fecha a sessão, só grava `PontoEvent(PAUSA)`. O cálculo de `totalSeconds` no fechamento soma apenas os intervalos entre INICIO/RETOMADA e a próxima PAUSA/FIM (tempo líquido, sem contar pausas).

### 5.4 Um ponto por vez
Antes de iniciar, verificar se o membro já não tem uma sessão ABERTA/PAUSADA — se tiver, bloquear com mensagem efêmera.

---

## 6. Sem comandos admin no bot — tudo isso vive só no site

Removido: nenhum slash command de configuração/administração no bot. As **únicas interactions do bot são as do painel de ponto** (botões `Bater Ponto`, `Pausar`, `Retomar`, `Fechar Ponto`) — nada de comando pra staff digitar.

Tudo que antes seria `/configurar`, `/departamento`, `/membro`, `/ponto forcar-fechar`, `/backup gerar|listar` agora é **funcionalidade exclusiva do dashboard** (seção 7), e só quem é **administrador do Discord no servidor onde o bot está** consegue acessar/usar.

### Como o site aplica mudanças no bot sem comandos
Bot e site compartilham o mesmo Postgres (mesmo Prisma). Fluxo:
1. Admin altera algo no site (ex.: troca o canal do painel, ou o nome/cor da organização) → grava direto na tabela `Guild` via API route do Next.js.
2. O site chama uma **API interna do bot** (`POST /internal/refresh`, protegida por um `INTERNAL_API_SECRET` compartilhado, nunca exposta publicamente) pedindo pra republicar/editar os embeds (painel, top10, abertos) imediatamente.
3. Como rede de segurança, o bot também roda um **poll leve a cada ~60s** verificando se a config mudou (`updatedAt` da `Guild`), então mesmo se a chamada interna falhar, a mudança aparece em até 1 minuto.
4. Ações pontuais também passam pela API interna: gerar backup manual agora (`POST /internal/backup`), forçar fechamento de um ponto (`POST /internal/ponto/:id/fechar`) — o bot executa e o site só reflete o resultado (lido do banco).

Isso mantém a regra pedida à risca: **a única coisa que roda como interaction do Discord é o ponto em si** (botões no canal de voz-obrigatória); toda administração é 100% web.

---

## 7. Dashboard Web

### Login e regra de acesso (importante)
Discord OAuth2 (NextAuth), com scopes `identify` + `guilds`:

1. Usuário loga com a conta Discord.
2. O site busca em `GET /users/@me/guilds` **todas** as guilds em que esse usuário é **Administrador ou Dono** (bit `ADMINISTRATOR` no `permissions` retornado, ou `owner: true`).
3. O site cruza isso com a tabela `Guild` do banco (que só tem linhas dos servidores onde **o bot foi de fato adicionado** — populada no evento `GuildCreate` do bot).
4. **Interseção** = únicos servidores que aparecem pro usuário na tela "Selecionar servidor". Ou seja, o site mostra claramente e apenas os servidores Discord em que o bot está instalado **e** onde o próprio usuário logado é admin — nunca uma lista de servidores aleatória, nunca um servidor sem o bot.
5. Se o usuário não é admin em nenhum servidor com o bot, tela de "sem acesso" (sem dados, sem navegação).
6. Toda API route do site (`/api/**`) revalida essa mesma checagem no servidor (nunca confia só no que foi renderizado no client): recebe `guildId` no request, confirma que a sessão atual é admin daquela guild específica antes de ler/escrever qualquer dado. Isso vale também pras chamadas internas ao bot (seção 6) — o site nunca deixa um admin de um servidor mexer na config de outro.

### Páginas
- **/servidores** (tela pós-login) — lista os servidores (interseção acima); ao escolher um, o resto do dashboard fica com aquele `guildId` no contexto.
- **/analytics** — filtros por período/membro; gráficos de horas trabalhadas (linha/barra), ranking, heatmap de horários mais ativos, exportar Excel/CSV.
- **/membros** — lista de membros, horas totais, histórico de sessões, opção de editar/cancelar uma sessão manualmente (vira AuditLog).
- **/configuracoes** — tudo que antes seriam slash commands: **identidade whitelabel** (nome da organização — ex. "Departamento de Polícia", "Corpo de Bombeiros", "Lanchonete do Zé" — e cor do embed), canais (ponto/top10/abertos/backups), canais de voz permitidos, tolerância de auto-fechamento, textos customizados dos embeds/botões, e os botões de ação "Forçar fechar ponto" e "Gerar backup agora".
- **/backups** — mostra o toggle **"Backup automático (1 em 1h): Ligado/Desligado"** (grava em `Guild.backupEnabled`) e um botão "Gerar backup agora" (chama `POST /internal/backup`). Abaixo, a lista de `BackupLog` — como o arquivo **só existe no Discord** (não fica guardado no servidor), cada linha mostra data, tamanho e sucesso/erro, com um link "Ver no Discord" (jump link pra mensagem no canal #backups, usando `discordChannelId`/`discordMessageId`) em vez de um botão de download direto do site. Pra restaurar, o admin baixa o `.dump` a partir dessa mensagem no Discord e faz o **upload/importar** aqui no site, que:
  1. recebe o `.sql`/`.sql.gz`,
  2. valida (checagem básica de schema/versão),
  3. roda `pg_restore`/`psql` dentro de uma transação segura (idealmente contra um banco "staging" antes de promover, para não destruir dados em caso de arquivo inválido),
  4. registra em AuditLog.

---

## 8. Backup automático (1 em 1h) — feature com liga/desliga, destino único: Discord

Job com `node-cron` (`0 * * * *`) dentro do processo do **bot**, rodando por guild:

1. Verifica `Guild.backupEnabled`. Se estiver **desligado**, pula essa guild silenciosamente (nenhum log de erro — é uma escolha do admin, não uma falha).
2. Se ligado:
   ```
   pg_dump -Fc --no-owner $DATABASE_URL > /tmp/guild_<id>_<timestamp>.dump
   gzip /tmp/guild_<id>_<timestamp>.dump
   ```
3. Posta o arquivo comprimido como **anexo no canal `Guild.backupChannelId`** — esse é o único destino, não existe upload pra S3/Backblaze/etc.
4. Grava `BackupLog` (sucesso/erro, tamanho, `discordMessageId`/`discordChannelId` da mensagem postada).
5. **Apaga o arquivo temporário do disco imediatamente após o envio** — o dump não fica persistido no servidor, só no histórico do canal do Discord. Isso também poupa o pouco armazenamento em disco livre do Oracle Free Tier (seção 9).
6. Se `sizeBytes` > 25MB (limite de anexo do Discord), não tenta enviar — só grava `BackupLog(success: false, errorMsg: "dump excede 25MB")` e posta um aviso de texto no canal.

O botão "Gerar backup agora" do site (`/internal/backup`) roda esse mesmo fluxo sob demanda, **mesmo com o toggle desligado** — desligar só afasta o agendamento horário automático, não bloqueia um backup manual pedido explicitamente pelo admin.

---

## 9. Docker & Hospedagem — DigitalOcean Droplet

Tudo roda num único **Droplet DigitalOcean** (recomendado: Basic/Regular 2 vCPU + 4 GB RAM, US$ 24/mês — ou 1 vCPU / 2 GB se uso leve).

- **Compute**: x86_64 (Intel/AMD) — sem preocupação com multi-arch; todas as imagens Docker rodam nativamente.
- **Storage**: SSD do Droplet (50–100 GB incluídos no plano) — de sobra pro Postgres, já que os backups **não** ficam guardados em disco (são temporários e vão só pro Discord, seção 8).
- **Rede**: 1–4 TB/mês de transferência (conforme o plano) — tranquilo pra dashboard interno. Firewall **único** via **Cloud Firewall** do painel DigitalOcean (libera 22/80/443); **não** precisa mexer em `ufw`/`iptables` no SO.
- **TLS/domínio**: domínio próprio apontando pro IP público do Droplet + **Caddy** como reverse proxy — certificado Let's Encrypt automático.
- **Só 2 serviços expostos publicamente**: `web` (porta 443 via Caddy) e nada mais — `postgres`, `bot:4000` (internal-api) e `web:3000` ficam só na rede interna do Docker Compose.

`docker-compose.prod.yml` com os serviços: `postgres`, `bot`, `web`, `caddy` (+ volumes `pgdata`, `caddy_data`, `caddy_config`). Variáveis de ambiente centralizadas em `.env` — veja `.env.example`.

> Ajuste de memória do Postgres no `docker-compose.prod.yml` conforme o tamanho do Droplet:
> - 2 GB RAM: `shared_buffers=256MB`, `work_mem=2MB`, `maintenance_work_mem=32MB`.
> - 4 GB RAM: `shared_buffers=512MB`, `work_mem=4MB`, `maintenance_work_mem=64MB` (padrão).
> - 8 GB+: pode subir proporcionalmente.
> Rode o Next.js sempre em modo `build` de produção (`output: standalone`) — nunca `next dev`.

---

## 10. Fases de implementação (para o Claude Code seguir em ordem)

- [x] **Fase 0 — Setup**: monorepo, `docker-compose.yml`, Postgres subindo, `packages/database` com schema Prisma inicial + primeira migration.
- [x] **Fase 1 — Bot base**: `ready` event, `guildCreate` (upsert `Guild` no banco ao ser adicionado), estrutura de handlers de botão, servidor `internal-api` de pé (só respondendo `200 ok`, sem regra ainda).
- [x] **Fase 2 — Ponto core**: painel de botões (`Bater Ponto/Pausar/Retomar/Fechar`) publicado/editado a partir da config lida do banco (sem nenhum comando), regra do canal de voz obrigatório, criação/atualização de `PontoSession` e `PontoEvent`.
- [x] **Fase 3 — Auto-close por sair da call**: `voiceStateUpdate`, `VoiceWatch`, timer + cron de segurança, notificação de fechamento automático.
- [x] **Fase 4 — Canais automáticos**: cron do #top-10-horas e #pontos-abertos (edição do mesmo embed, não repost) + cron de poll de config (60s).
- [x] **Fase 5 — Backup**: cron horário de `pg_dump` só respeitando `Guild.backupEnabled`, envio como anexo no #backups, apagar arquivo temporário após o envio, `BackupLog`, rota interna `/internal/backup` pra disparo manual vindo do site (ignora o toggle).
- [x] **Fase 6 — Web dashboard (auth e escopo)**: NextAuth + Discord OAuth (`identify`+`guilds`), cruzamento "admin do usuário" × "guilds com o bot", telas `/servidores` + `/guild/[id]` + `/login` + `/sem-acesso`, `middleware` + guard `assertGuildAccess` revalidando escopo em toda API route (build `next build` ok; providers liberados, `/api/servidores` 401 sem sessão; bit ADMINISTRATOR validado).
- [x] **Fase 7 — Web dashboard (funcionalidades)**: `/analytics` (gráficos linha/barra/heatmap via Recharts, filtro período/membro, export CSV); `/membros` (lista com horas totais, ponto aberto, forçar-fechar via bot, cancelar + histórico); `/configuracoes` (identidade whitelabel orgName/embedColor, seletores de canais de texto/voz, tolerância autoCloseSeconds, rankingPeriod, botão "Gerar backup agora"); `/backups` (toggle backupEnabled, botão "Gerar backup agora", lista de BackupLog com link "Ver no Discord"); todos revalidam escopo admin×bot e chamam a `internal-api` do bot (`/internal/refresh`, `/internal/backup`, `/internal/ponto/:id/fechar`). Build `next build` ok.
- [x] **Fase 8 — Importação de backup pelo site**: `POST /api/guild/[id]/backups/import` (multipart .sql/.dump/.gz) → validação básica via `pg_restore --list` (checa tabelas obrigatórias) → `pg_restore --clean --if-exists` no banco atual → `AuditLog(IMPORT_BACKUP)`; UI em `/backups` com aviso de sobrescrita total, input file + botão "Importar", limpeza de arquivo temporário.
- [x] **Fase 9 — Polimento**: export **Excel** (`exceljs`, 3 abas: Sessões / Resumo por Membro / Horas por Dia) + CSV já existente; `output: standalone` no Next.js p/ Docker; **DEPLOY.md** completo (DigitalOcean Droplet, Cloud Firewall, DNS, Caddy, docker-compose.prod.yml, Dockerfile.bot/web, troubleshooting).
- [x] **Fase 10 — Deploy DigitalOcean**: **Droplet** (2 vCPU / 4 GB recomendado), **Cloud Firewall** único (22/80/443), DNS A record, `.env` de produção, `docker-compose.prod.yml` (postgres + bot + web + caddy), `Dockerfile.bot` (com `postgresql-client`), `Dockerfile.web` (standalone), `Caddyfile` (TLS automático), validação ponta a ponta (login, painel, backup, import).

---

## 11. Variáveis de ambiente (rascunho do `.env.example`)

> Uma coisa importante: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` **não são "configuração de guild/canal"** — não têm nada a ver com o que fica dinâmico no site. São as **3 credenciais da aplicação Discord em si** (criadas uma única vez no [Discord Developer Portal](https://discord.com/developers/applications), pro projeto inteiro, não por servidor):
> - `DISCORD_TOKEN` — o bot usa pra logar no gateway, ler voz, postar embeds, etc.
> - `DISCORD_CLIENT_ID` — identifica a aplicação; usado pra montar o **link de convite do bot** (`/oauth2/authorize?client_id=...&scope=bot`) e é obrigatório no fluxo OAuth2 do login.
> - `DISCORD_CLIENT_SECRET` — o NextAuth precisa dele pra completar a troca do código OAuth2 quando um admin loga no dashboard (é o que permite o site perguntar pro Discord "quem é esse usuário e em quais guilds ele é admin").
>
> Sem esses três valores o **login com Discord no site simplesmente não funciona** — é o mecanismo que te dá, dinamicamente, a lista de guilds/canais/cargos de cada admin (exatamente o comportamento whitelabel que você quer: nada de guild ou canal fica hardcoded em lugar nenhum, tudo é buscado ao vivo na API do Discord usando essas credenciais + o `DISCORD_TOKEN`). Eles ficam no `.env` da mesma forma que `DATABASE_URL` — segredo de infraestrutura, não dado de negócio.

```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

INTERNAL_API_SECRET=            # compartilhado entre web e bot; nunca exposto ao navegador
INTERNAL_API_URL=http://bot:4000

DATABASE_URL=postgresql://ponto:ponto@postgres:5432/ponto

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

BACKUP_CRON=0 * * * *
AUTO_CLOSE_SECONDS_DEFAULT=60
```

---

## 12. Observação sobre "revirada na net"

Pesquisei bots de bate-ponto usados de fato em servidores de GTA RP/FiveM (ex. PontoBot, Cop Bot, KOv Ponto, Nyox Bate-Ponto) para confirmar convenções do nicho — o padrão de mercado é exatamente: painel fixo com botões (iniciar/pausar/finalizar), obrigatoriedade de estar em call, ranking, listagem de pontos abertos em tempo real, e exportação de estatísticas — o que já está refletido nas fases acima.

---

**Próximo passo sugerido no Claude Code:** abrir este arquivo, rodar a Fase 0 (scaffolding do monorepo + docker-compose + Prisma) e ir marcando os checkboxes conforme avança.
