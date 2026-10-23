import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { newBlock, type Block } from "../src/lib/blocks";

const db = new PrismaClient();

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// Verão Conectado packages (manual "Voltec_Pacotes_Verao_Base_IA" v1.0): total price per period, advertised in 6x.
const pacote = (months: number, cents: number) =>
  `${months} meses | R$ ${brl(cents)} o pacote | ou 6x de R$ ${brl(Math.round(cents / 6))}`;

const VERAO_BLOCKS: Block[] = [
  {
    ...newBlock("hero"),
    type: "hero",
    title: "Verão Conectado ☀️🌊",
    subtitle: "Internet de fibra na sua casa de praia em Grussaí, Atafona, Chapéu do Sol e São João da Barra, só pelo tempo que você precisar.",
    imageUrl: "",
  },
  {
    ...newBlock("text"),
    type: "text",
    text: "✅ Sem taxa de instalação\n✅ Sem fidelidade\n✅ Sem comprovante de residência\n✅ Instalação em até 72h úteis\n📶 Wi-Fi 6 + Voltec TV com mais de 90 canais",
  },
  {
    ...newBlock("plans"),
    type: "plans",
    title: "800 Mega + streaming",
    items: [pacote(2, 42990), pacote(3, 49990), pacote(4, 59990), pacote(5, 65990)].join("\n"),
    footnote: "Inclui Watch (4 telas), Universal+, Telecine e GE TV.",
  },
  {
    ...newBlock("plans"),
    type: "plans",
    title: "600 Mega",
    items: [pacote(3, 39990), pacote(4, 52990), pacote(5, 57990)].join("\n"),
    footnote: "",
  },
  {
    ...newBlock("whatsapp"),
    type: "whatsapp",
    phone: process.env.VOLTEC_WHATSAPP_NUMBER ?? "",
    label: "Quero o Verão Conectado",
    message: "Olá! Vi no Wi-Fi e quero o Verão Conectado para a minha casa de praia.",
    leadLabel: "lead-verao",
  },
  { ...newBlock("instagram"), type: "instagram", handle: "voltecbandalarga", text: "Marque a gente nas fotos do seu verão! 📸" },
  {
    ...newBlock("text"),
    type: "text",
    text:
      "O valor é o total do pacote pelo período, não é mensalidade. A forma de pagamento é combinada com a nossa equipe. " +
      "Os equipamentos ficam em comodato e são devolvidos em uma loja Voltec ao fim do período. " +
      "Válido em Grussaí, Atafona, Chapéu do Sol e São João da Barra, sujeito à viabilidade técnica.",
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL!.toLowerCase();
  await db.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10) },
  });

  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if (!(await db.funnelStep.count())) {
    await db.funnelStep.createMany({
      data: [
        { position: 0, name: "Pediu o Verão Conectado (lead)", type: "CHATWOOT_LABEL", param: "lead-verao" },
        { position: 1, name: "Venda fechada", type: "CHATWOOT_LABEL", param: "venda-fechada" },
      ],
    });
  }

  if (!(await db.portal.findFirst({ where: { name: "Verão Conectado" } }))) {
    await db.portal.updateMany({ data: { isDefault: false } });
    await db.portal.create({
      data: {
        name: "Verão Conectado",
        isDefault: true,
        welcomeTitle: "Wi-Fi grátis Voltec",
        theme: { primaryColor: "#f97316", backgroundColor: "#062c43", textColor: "#ffffff", backgroundImage: "", logoUrl: "" },
        blocks: VERAO_BLOCKS,
        instagram: "voltecbandalarga",
        termsText: "Ao conectar você concorda com os termos de uso do Wi-Fi e com o tratamento dos seus dados conforme a LGPD.",
      },
    });
  }
}

main().finally(() => db.$disconnect());
