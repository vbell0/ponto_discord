import {
  Client,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  MessageActionRowComponentBuilder,
} from "discord.js";

export function parseColor(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

// Publica um embed num canal. Se já houver messageId, **edita** a mensagem
// existente (não reposta); se a mensagem sumiu do canal, reposta e avisa via onNew.
// `components` só é enviado na postagem inicial (na edição os componentes
// existentes — ex.: os botões do painel — são preservados).
// Usado pelos 3 embeds automáticos (painel, top10, abertos).
export async function sendOrEditEmbed(
  client: Client,
  channelId: string,
  messageId: string | null,
  embed: EmbedBuilder,
  onNew: (messageId: string) => Promise<unknown>,
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[],
): Promise<void> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) return;

  const textChannel = channel as TextChannel;
  if (messageId) {
    try {
      const msg = await textChannel.messages.fetch(messageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      // Mensagem não encontrada (canal mudou ou apagada) → repostar.
    }
  }

  const msg = await textChannel.send({
    embeds: [embed],
    components: components ?? [],
  });
  await onNew(msg.id);
}
