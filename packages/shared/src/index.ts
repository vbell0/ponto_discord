// Tipos, enums e constantes compartilhados entre o bot e o dashboard web.

// ---- Enums de domínio (espelham os enums do Prisma) ----

export const PontoStatus = {
  ABERTO: "ABERTO",
  PAUSADO: "PAUSADO",
  FECHADO: "FECHADO",
} as const;
export type PontoStatus = (typeof PontoStatus)[keyof typeof PontoStatus];

export const ClosedReason = {
  MANUAL: "MANUAL",
  SAIU_DA_VOZ: "SAIU_DA_VOZ",
  ADMIN: "ADMIN",
} as const;
export type ClosedReason = (typeof ClosedReason)[keyof typeof ClosedReason];

export const PontoEventType = {
  INICIO: "INICIO",
  PAUSA: "PAUSA",
  RETOMADA: "RETOMADA",
  FIM: "FIM",
} as const;
export type PontoEventType = (typeof PontoEventType)[keyof typeof PontoEventType];

// Período do ranking do #top-10-horas (configurável no site).
export const RankingPeriod = {
  SEMANA: "SEMANA",
  MES: "MES",
} as const;
export type RankingPeriod = (typeof RankingPeriod)[keyof typeof RankingPeriod];

// ---- customIds fixos dos botões do painel de ponto ----
// Nunca mudar esses valores: o bot reidrata os botões no `ready`.

export const PONTO_BUTTONS = {
  BATER: "ponto:bater",
  PAUSAR: "ponto:pausar",
  RETOMAR: "ponto:retomar",
  FECHAR: "ponto:fechar",
} as const;
export type PontoButtonCustomId =
  (typeof PONTO_BUTTONS)[keyof typeof PONTO_BUTTONS];

// ---- Defaults whitelabel (sobrescritos por Guild no banco) ----

export const DEFAULT_ORG_NAME = "Ponto";
export const DEFAULT_EMBED_COLOR = "#5865F2";
export const DEFAULT_AUTO_CLOSE_SECONDS = 60;
export const DEFAULT_BACKUP_ENABLED = true;

// ---- Limites / constantes da plataforma ----

// Limite de anexo do Discord (25MB) — acima disso não enviamos o dump.
export const DISCORD_ATTACHMENT_LIMIT_BYTES = 25 * 1024 * 1024;

// Nome sugerido dos 4 canais (usado como referência; nada é hardcoded no bot —
// os IDs reais vêm da tabela Guild e são configurados no site).
export const CANAIS = {
  PAINEL: "ponto",
  TOP10: "top-10-horas",
  ABERTOS: "pontos-abertos",
  BACKUPS: "backups",
} as const;
