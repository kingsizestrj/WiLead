import type { Router } from "@prisma/client";
import { Settings2 } from "lucide-react";
import Link from "next/link";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { TestRouterButton } from "@/components/admin/TestRouterButton";
import { Card, PageHeader, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { deleteRouter, saveRouter } from "../actions";

function RouterForm({ router }: { router?: Router }) {
  return (
    <form action={saveRouter.bind(null, router?.id ?? null)} className="grid items-end gap-3 md:grid-cols-3">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
        Nome
        <input name="name" required defaultValue={router?.name} placeholder="CCR1036 Matriz" className={inputClass} />
      </label>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
          IP / host
          <input name="host" required defaultValue={router?.host} placeholder="10.0.0.1" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
          Porta
          <input name="port" type="number" required defaultValue={router?.port ?? 8728} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
        Perfil de usuário hotspot
        <input name="userProfile" defaultValue={router?.userProfile ?? "default"} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
        Usuário
        <input name="username" required defaultValue={router?.username} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-300">
        Senha
        <input name="password" type="password" required={!router} placeholder={router ? "(manter atual)" : ""} className={inputClass} />
      </label>
      <div className="flex flex-col gap-1 pb-1 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="useTls" defaultChecked={router?.useTls ?? false} /> Usar api-ssl (porta 8729)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="insecureTls" defaultChecked={router?.insecureTls ?? true} /> Aceitar certificado autoassinado
        </label>
      </div>
      <button className={buttonClass}>{router ? "Salvar" : "Adicionar roteador"}</button>
    </form>
  );
}

export default async function RoutersPage() {
  const routers = await db.router.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { locations: true } } } });
  return (
    <>
      <PageHeader title="MikroTik" subtitle="Roteadores que recebem os usuários de hotspot (RouterOS v6 ou v7, serviço api / api-ssl)" />
      <div className="flex flex-col gap-4">
        {routers.map((r) => (
          <Card key={r.id} title={`${r.name} · ${r._count.locations} locais`}>
            <RouterForm router={r} />
            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/admin/roteadores/${r.id}`} className={buttonClass}>
                  <Settings2 className="h-4 w-4" /> Gerenciar hotspot e pontos
                </Link>
                <TestRouterButton id={r.id} />
              </div>
              <form action={deleteRouter.bind(null, r.id)}>
                <ConfirmButton message={`Remover o roteador ${r.name} do WiLead? Nada é apagado no MikroTik.`} className={`${ghostButtonClass} text-rose-300`}>
                  Remover
                </ConfirmButton>
              </form>
            </div>
          </Card>
        ))}
        <Card title="Novo roteador">
          <RouterForm />
        </Card>
      </div>
    </>
  );
}
