import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

// NextAuth com Discord OAuth2. Scopes necessários (seção 7 do plano):
//  - identify: nome/avatar do usuário
//  - guilds: lista de servidores onde o usuário está (p/ cruzar com o bot)
// O token de acesso é mantido no JWT para que o site possa chamar a API do
// Discord e descobrir em quais servidores o usuário é admin.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
