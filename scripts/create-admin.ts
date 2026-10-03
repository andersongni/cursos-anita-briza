import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import bcrypt from 'bcryptjs'

const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

function formatName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLocaleLowerCase('pt-BR')
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
    })
    .join(' ')
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('--- Criar Usuário Administrador ---');
    
    const username = await rl.question('Username (ex: admin): ');
    if (!username || username.trim().length === 0) {
      throw new Error('Username não pode ser vazio.');
    }

    const full_name = await rl.question('Nome Completo: ');
    if (!full_name || full_name.trim().length === 0) {
      throw new Error('Nome Completo não pode ser vazio.');
    }

    const password = await rl.question('Senha (mínimo 6 caracteres): ');
    if (!password || password.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    const lowerUsername = username.toLowerCase().trim();
    if (!/^[a-z0-9.]+$/.test(lowerUsername)) {
      throw new Error('Username deve conter apenas letras minúsculas, números e pontos.');
    }

    const existingUser = await prisma.profile.findUnique({
      where: { username: lowerUsername }
    });

    if (existingUser) {
      throw new Error(`Username '${lowerUsername}' já está em uso.`);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = await prisma.profile.create({
      data: {
        username: lowerUsername,
        full_name: formatName(full_name),
        password_hash: hashedPassword,
        role: 'ADMIN',
        status: 'APPROVED'
      }
    });

    console.log(`\nSucesso! Administrador criado.`);
    console.log(`ID: ${newAdmin.id}`);
    console.log(`Username: ${newAdmin.username}`);
    
  } catch (err: any) {
    console.error(`\nErro: ${err.message}`);
  } finally {
    rl.close();
  }
}

main()
  .catch(e => {
    console.error('Erro fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
