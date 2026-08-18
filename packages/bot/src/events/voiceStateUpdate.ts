import { Client, Events, VoiceState } from "discord.js";
import {
  initVoiceService,
  handleVoiceStateUpdate,
} from "../services/voice.js";

export function registerVoiceStateUpdate(client: Client): void {
  initVoiceService(client);
  client.on(
    Events.VoiceStateUpdate,
    async (oldState: VoiceState, newState: VoiceState) => {
      try {
        await handleVoiceStateUpdate(oldState, newState);
      } catch (err) {
        console.error("[bot] Erro em VoiceStateUpdate:", err);
      }
    },
  );
}
