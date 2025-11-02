import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from './server/user';

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('auth/sign-in', request.url));
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('auth/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|auth|trpc|_next/static|_next/image|.*\\.png$).*)'],
};
