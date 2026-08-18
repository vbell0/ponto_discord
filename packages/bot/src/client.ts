import { Client, GatewayIntentBits } from "discord.js";

// Intents mínimos: Guilds (eventos de servidor + interactions de botão)
// e GuildVoiceStates (necessário para o auto-close ao sair da call — Fase 3).
// Não usamos MESSAGE_CONTENT: o bot nunca lê conteúdo de mensagens.
export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });
}
