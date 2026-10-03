import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        last_login_at: true,
        created_at: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: 'Ocorreu um erro ao buscar os dados do usuário' },
      { status: 500 }
    );
  }
}
