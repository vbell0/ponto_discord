# Guia de Deploy — DigitalOcean (Droplet)

Este documento cobre o provisionamento do Droplet, configuração de firewall, build das imagens, e subida do stack com Docker Compose + Caddy.

---

## 1. Pré-requisitos

- Conta DigitalOcean.
- Domínio próprio (ou subdomínio) apontando para o IP público do Droplet.
- Chave SSH (ed25519 recomendada).
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` criados no [Discord Developer Portal](https://discord.com/developers/applications).

---

## 2. Criar o Droplet

1. No painel DigitalOcean → **Create → Droplets**.
2. **Image**: Ubuntu 22.04 (LTS) x64 ou 24.04.
3. **Size**: recomendo **Basic / Regular Intel/AMD** ou **Premium AMD** com 2 vCPU + 4 GB RAM (US$ 24/mês) — cabe confortavelmente Postgres + bot + web + Caddy.
   - Para uso leve, o **Basic 1 vCPU / 2 GB** (US$ 12/mês) também funciona (ajuste `shared_buffers` no compose).
4. **Authentication**: SSH Key (cole sua chave pública).
5. **Region**: escolha a mais próxima dos seus usuários (ex.: `nyc3`, `sfo3`, `ams3`).
6. **Hostname**: `ponto-rp` (ou o que preferir).
7. Clique em **Create Droplet** e aguarde ficar ativo (IPv4 público atribuído).

---

## 3. Firewall (Cloud Firewall do DigitalOcean — **um só lugar**)

Diferente da Oracle, o DigitalOcean tem **Cloud Firewall** gerenciado no painel (não precisa mexer em `ufw`/`iptables` no SO, embora possa).

1. No painel → **Networking → Firewalls → Create Firewall**.
2. **Name**: `ponto-rp-fw`.
3. **Inbound Rules**:
   | Type | Protocol | Port Range | Sources |
   |---|---|---|---|
   | SSH | TCP | 22 | `0.0.0.0/0` (ou seu IP fixo) |
   | HTTP | TCP | 80 | `0.0.0.0/0` |
   | HTTPS | TCP | 443 | `0.0.0.0/0` |
   | Custom | TCP | 5432 | **NÃO adicione** (Postgres só interno) |
   | Custom | TCP | 3000 | **NÃO adicione** (web só interno) |
   | Custom | TCP | 4000 | **NÃO adicione** (bot internal-api só interno) |
4. **Outbound Rules**: deixe o padrão (tudo permitido).
5. **Apply to Droplets**: digite o nome do seu Droplet (`ponto-rp`) e selecione.
6. **Create Firewall**.

> **Pronto.** Não há `ufw`/`iptables` duplicado — o Cloud Firewall é a única barreira de rede.

---

## 4. DNS

No seu provedor de DNS (Cloudflare, Route53, GoDaddy, DigitalOcean DNS, etc.), crie um **A record**:
```
seu.dominio.com  →  IP_PUBLICO_DO_DROPLET
```
Se usar **DigitalOcean DNS**: no painel → **Networking → Domains → Add Domain**, aponte para o Droplet (ele cria o A record automaticamente).

---

## 5. Preparar o Droplet

```bash
# SSH no Droplet
ssh root@SEU_IP_PUBLICO

# 1. Atualiza e instala Docker + Compose plugin
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 2. Cria usuário não-root (opcional, mas recomendado)
adduser deploy --gecos "" --disabled-password
usermod -aG docker deploy
# copia sua chave SSH pro usuário deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# 3. Cria diretório do projeto
mkdir -p /opt/ponto-rp && chown deploy:deploy /opt/ponto-rp
```

> **Dica:** saia do `root` e entre como `deploy` (`ssh deploy@SEU_IP`) para o resto.

---

## 6. Clonar / Copiar o projeto

Se você fez push para um repo privado:
```bash
cd /opt/ponto-rp
git clone https://github.com/seu-user/ponto-rp.git .
```

Ou, se está local, use `scp`/`rsync` para copiar a pasta (exceto `node_modules`, `.next`, `dist`, `.env`) para `/opt/ponto-rp` no Droplet.

---

## 7. Configurar `.env` de produção

```bash
cd /opt/ponto-rp
cp .env.example .env
nano .env
```

```env
# Credenciais do Discord (uma vez no Developer Portal)
DISCORD_TOKEN=SEU_BOT_TOKEN
DISCORD_CLIENT_ID=SEU_CLIENT_ID
DISCORD_CLIENT_SECRET=SEU_CLIENT_SECRET

# API interna bot↔web (gere um segredo forte: openssl rand -hex 32)
INTERNAL_API_SECRET=SEGREDO_LONGO_ALEATORIO
INTERNAL_API_URL=http://bot:4000

# Postgres (usuário/senha/banco definidos aqui mesmo)
POSTGRES_USER=ponto
POSTGRES_PASSWORD=SENHA_FORTE_POSTGRES
POSTGRES_DB=ponto
DATABASE_URL=postgresql://ponto:SENHA_FORTE_POSTGRES@postgres:5432/ponto

# NextAuth
NEXTAUTH_URL=https://seu.dominio.com
NEXTAUTH_SECRET=OUTRO_SEGREDO_FORTE  # openssl rand -hex 32

# Agendamentos
BACKUP_CRON=0 * * * *
AUTO_CLOSE_SECONDS_DEFAULT=60

# Domínio p/ Caddy (usado no docker-compose.prod.yml)
DOMAIN=seu.dominio.com
```

> **Importante:** o `NEXTAUTH_URL` deve ser **HTTPS** com o domínio real. O `DOMAIN` no final é lido pelo `docker-compose.prod.yml` para injetar no Caddyfile via env substitution.

---

## 8. Ajustar o Caddyfile

Edite `Caddyfile` e substitua:
```
seu.dominio.com {
```
pelo seu domínio real. O email também:
```
email seu-email@exemplo.com
```

---

## 9. Ajuste de memória no Postgres (opcional, conforme tamanho do Droplet)

No `docker-compose.prod.yml`, o serviço `postgres` tem:
```yaml
command: >
  postgres
  -c shared_buffers=512MB
  -c work_mem=4MB
  -c maintenance_work_mem=64MB
  -c max_connections=100
```
- **2 GB RAM**: `shared_buffers=256MB`, `work_mem=2MB`, `maintenance_work_mem=32MB`.
- **4 GB RAM**: `shared_buffers=512MB` (padrão acima) — OK.
- **8 GB+ RAM**: pode subir para `1GB` / `8MB` / `128MB`.

---

## 10. Build e Subida

```bash
cd /opt/ponto-rp

# Build das imagens (multi-arch não necessário — Droplet é x86_64)
docker compose -f docker-compose.prod.yml build --no-cache

# Sobe o stack
docker compose -f docker-compose.prod.yml up -d
```

Acompanhe logs:
```bash
docker compose -f docker-compose.prod.yml logs -f
```

Esperado:
- `postgres` → `healthy`
- `bot` → `internal-api ouvindo em :4000` + (se token válido) `Pronto! Logado como ...`
- `web` → `Ready in XXXms` (Next.js standalone)
- `caddy` → obtém certificado Let's Encrypt (30–60s na primeira vez)

---

## 11. Validar

| Teste | Comando / Ação | Esperado |
|---|---|---|
| Health do Caddy | `curl -I https://seu.dominio.com` | `200` ou `307` redirect |
| Login Discord | Abra `https://seu.dominio.com` no browser | Página de login → autoriza → `/servidores` |
| Bot no servidor | Adicione o bot no servidor (OAuth2 `bot` scope) | `guildCreate` loga no bot; Guild aparece no site |
| Painel de ponto | Configure `painelChannelId` no site → `/configuracoes` | Embed + 4 botões aparecem no canal |
| Backup manual | `/backups` → "Gerar backup agora" | Anexo `.dump.gz` no canal `#backups` |
| Import backup | Baixe o `.dump.gz` do Discord → upload em `/backups` | `AuditLog: IMPORT_BACKUP`; dados restaurados |

---

## 12. Manutenção

### Ver logs
```bash
docker compose -f docker-compose.prod.yml logs -f bot
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Atualizar código
```bash
cd /opt/ponto-rp
git pull
docker compose -f docker-compose.prod.yml build --no-cache bot web
docker compose -f docker-compose.prod.yml up -d --no-deps bot web
```

### Backup do Postgres (manual, fora do app)
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U ponto -Fc ponto > backup_manual_$(date +%F).dump
```

### Renovação de certificado (Caddy faz sozinho)
O Caddy renova automaticamente 30 dias antes do vencimento. Logs:
```bash
docker compose -f docker-compose.prod.yml logs caddy | grep -i cert
```

---

## 13. Troubleshooting rápido

| Sintoma | Causa provável | Solução |
|---|---|---|
| `curl https://...` timeout | Porta 443 bloqueada | Cheque **Cloud Firewall** no painel (HTTP/HTTPS liberados?) |
| Caddy: `acme: error presenting token` | DNS não propagado / IP errado | Verifique `dig seu.dominio.com` |
| Bot não conecta | `DISCORD_TOKEN` errado | Confira no `.env` e no Developer Portal |
| Backup falha "pg_dump not found" | Imagem do bot sem `postgresql-client` | O `Dockerfile.bot` já instala; rebuild com `--no-cache` |
| NextAuth "redirect_uri_mismatch" | Redirect não cadastrado no Discord | Adicione `https://seu.dominio.com/api/auth/callback/discord` no Dev Portal |
| `internal-api` 401 | `INTERNAL_API_SECRET` divergente | Mesmo valor no `.env` do bot e do web (compose injeta igual) |

---

## 14. Checklist de produção

- [ ] Droplet criado (2 vCPU / 4 GB recomendado).
- [ ] **Cloud Firewall** liberando 22/80/443 (aplicado ao Droplet).
- [ ] DNS A record aponta pro IP público.
- [ ] `.env` preenchido com segredos reais (NUNCA commitar).
- [ ] `Caddyfile` com domínio/email corretos.
- [ ] `docker compose -f docker-compose.prod.yml up -d` sobe tudo healthy.
- [ ] Login Discord funciona → `/servidores` lista o servidor.
- [ ] Painel de ponto aparece no canal configurado.
- [ ] Backup manual gera anexo no `#backups`.
- [ ] Import de backup restaura dados + `AuditLog`.

---

## 15. Notas de arquitetura (para referência)

- **Rede interna do compose**: `bot`, `web`, `postgres`, `caddy` se veem por nome de serviço.
- **Apenas Caddy expõe portas** (80/443). `bot:4000`, `web:3000`, `postgres:5432` **não** são publicados no host.
- **Secrets**: `INTERNAL_API_SECRET`, `NEXTAUTH_SECRET`, `DISCORD_*`, `POSTGRES_PASSWORD` só existem no `.env` do Droplet (nunca no repo).
- **Backups**: o bot roda `pg_dump` dentro do container (tem `postgresql-client`), gzipa, posta no Discord, apaga o temp. **Nada fica em disco**.
- **Volumes persistentes**: só `pgdata` (Postgres) + `caddy_data`/`caddy_config` (certificados). Sem volume de backups.
- **Vantagem DigitalOcean vs Oracle**: um só firewall (Cloud Firewall), DNS integrado opcional, UI mais simples, sem "Security List + iptables" duplicado.

---

> **Pronto.** Seu stack está no ar na DigitalOcean, com TLS automático, backup só via Discord, e dashboard whitelabel gerenciável 100% pela web.