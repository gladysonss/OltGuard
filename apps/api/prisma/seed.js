// Seed em JS puro (nao TS) para rodar direto com `node` na imagem de producao,
// sem precisar de ts-node instalado no runtime.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Cria o primeiro usuario ADMIN a partir de ADMIN_EMAIL/ADMIN_PASSWORD.
 * Idempotente (upsert) - seguro rodar toda vez que o container sobe.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD nao definidos - pulando criacao do admin inicial.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: 'Administrador',
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Usuario admin pronto: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
