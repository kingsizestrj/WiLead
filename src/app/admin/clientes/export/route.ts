import { clientsInclude, clientsWhere } from "@/lib/clients-query";
import { db } from "@/lib/db";
import { parseFilters } from "@/lib/filters";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const filters = parseFilters(Object.fromEntries(new URL(req.url).searchParams));
  const clients = await db.client.findMany({ where: clientsWhere(filters), include: clientsInclude, orderBy: { createdAt: "desc" } });

  const rows = [
    ["Nome", "WhatsApp", "E-mail", "Aceita promoções", "Primeiro local", "Cadastro", "Último local", "Último acesso", "Acessos"],
    ...clients.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.marketingOptIn ? "sim" : "não",
      c.firstLocation?.name,
      c.createdAt.toISOString(),
      c.accesses[0]?.location.name,
      c.accesses[0]?.createdAt.toISOString(),
      c._count.accesses,
    ]),
  ];

  return new Response("﻿" + rows.map((r) => r.map(csv).join(";")).join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes.csv"`,
    },
  });
}
