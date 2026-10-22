import type { Router } from "@prisma/client";
import { TestRouterButton } from "@/components/admin/TestRouterButton";
import { Card, PageHeader, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { deleteRouter, saveRouter } from "../actions";

function RouterForm({ router }: { router?: Router }) {
  return (
    <form action={saveRouter.bind(null, router?.id ?? null)} className="grid items-end gap-3 md:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Nome
        <input name="name" required defaultValue={router?.name} placeholder="CCR1036 Matriz" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        URL da API REST
        <input name="apiUrl" required defaultValue={router?.apiUrl} placeholder="https://10.0.0.1" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Perfil de usuário hotspot
        <input name="userProfile" defaultValue={router?.userProfile ?? "default"} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Usuário
        <input name="username" required defaultValue={router?.username} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Senha
        <input name="password" type="password" required={!router} placeholder={router ? "(manter atual)" : ""} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="insecureTls" defaultChecked={router?.insecureTls ?? true} /> Aceitar certificado autoassinado
      </label>
      <button className={buttonClass}>{router ? "Salvar" : "Adicionar roteador"}</button>
    </form>
  );
}

export default async function RoutersPage() {
  const routers = await db.router.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { locations: true } } } });
  return (
    <>
      <PageHeader title="MikroTik" subtitle="Roteadores que recebem os usuários de hotspot (RouterOS v7, API REST)" />
      <div className="flex flex-col gap-4">
        {routers.map((r) => (
          <Card key={r.id} title={`${r.name} · ${r._count.locations} locais`}>
            <RouterForm router={r} />
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <TestRouterButton id={r.id} />
              <form action={deleteRouter.bind(null, r.id)}>
                <button className={`${ghostButtonClass} text-red-600`}>Remover</button>
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
