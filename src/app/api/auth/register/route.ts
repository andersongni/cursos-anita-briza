import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createToken, setSessionCookie } from '@/lib/auth/session';
import { formatFullName, isValidUsername } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, full_name, email, phone } = body;
    const normalizedFullName = typeof full_name === 'string' ? formatFullName(full_name) : '';

    if (!username || !password || !normalizedFullName) {
      return NextResponse.json(
        { error: 'Nome de usuário, senha e nome completo são obrigatórios' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';

    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json(
        { error: 'O nome de usuário deve conter apenas letras minúsculas, números e pontos' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.profile.findUnique({
      where: { username: normalizedUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Nome de usuário já está em uso' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const profile = await prisma.profile.create({
      data: {
        username: normalizedUsername,
        full_name: normalizedFullName,
        email: email || null,
        phone: phone || null,
        role: 'STUDENT',
        status: 'PENDING',
        password_hash: hashedPassword,
      },
    });

    // Sessão PENDING para acessar /aguardando-aprovacao
    const token = await createToken({
      userId: profile.id,
      username: profile.username,
      role: profile.role,
      status: profile.status,
      sessionVersion: profile.session_version ?? 0,
    });
    await setSessionCookie(token);

    return NextResponse.json({ success: true, status: profile.status });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Ocorreu um erro ao registrar o usuário' },
      { status: 500 }
    );
  }
}
