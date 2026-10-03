import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createToken, setSessionCookie } from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, full_name, email, phone } = body;

    if (!username || !password || !full_name) {
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

    const usernameRegex = /^[a-zA-Z0-9._]+$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'O nome de usuário deve conter apenas letras, números, pontos ou sublinhados' },
        { status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase();

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
        full_name,
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
