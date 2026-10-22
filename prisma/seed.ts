import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_THEME, newBlock } from "../src/lib/blocks";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL!.toLowerCase();
  await db.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10) },
  });

  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if (!(await db.portal.count())) {
    await db.portal.create({
      data: {
        name: "Página padrão",
        isDefault: true,
        theme: DEFAULT_THEME,
        welcomeTitle: "Wi-Fi grátis",
        blocks: [
          { ...newBlock("hero"), title: "Bem-vindo!", subtitle: "Conecte-se em segundos com seu WhatsApp" },
          newBlock("coupon"),
          { ...newBlock("instagram"), handle: "voltec" },
        ],
      },
    });
  }
}

main().finally(() => db.$disconnect());
