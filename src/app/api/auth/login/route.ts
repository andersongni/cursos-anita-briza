import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createToken, setSessionCookie } from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Usuário ou senha incorretos' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, profile.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Usuário ou senha incorretos' },
        { status: 401 }
      );
    }

    if (profile.status === 'BLOCKED') {
      return NextResponse.json(
        { error: 'Conta bloqueada. Entre em contato com o administrador.' },
        { status: 403 }
      );
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { last_login_at: new Date() },
    });

    const token = await createToken({
      userId: profile.id,
      username: profile.username,
      role: profile.role,
      status: profile.status,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      role: profile.role,
      status: profile.status,
      username: profile.username,
      full_name: profile.full_name,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Ocorreu um erro ao fazer login' },
      { status: 500 }
    );
  }
}
