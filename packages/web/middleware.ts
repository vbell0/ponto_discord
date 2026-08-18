import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const secret = process.env.NEXTAUTH_SECRET;

// Primeira barreira de autenticação: páginas e rotas /api (exceto /api/auth)
// exigem um token de sessão válido. A checagem de ESCOPO (admin do servidor
// específico) é feita dentro de cada route handler / server component.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Nunca bloquear as rotas próprias do NextAuth (login/callback), senão o
  // fluxo OAuth de Discord quebra. O escopo é validado nas outras rotas.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret });

  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/servidores/:path*", "/guild/:path*", "/api/:path*"],
};
