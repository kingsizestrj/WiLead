"use client";

import { Loader2, Plus, Wand2 } from "lucide-react";
import { useActionState } from "react";
import { buttonClass, fieldClass, inputClass } from "@/components/admin/ui";
import type { RouterInterface } from "@/lib/mikrotik-setup";
import { createPointAction, prepareRouterAction } from "../../actions";

type Result = { log?: string[]; ok?: string; error?: string } | null;

function Feedback({ state }: { state: Result }) {
  if (!state) return null;
  if (state.error) return <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">❌ {state.error}</p>;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
      {state.ok && <p>✅ {state.ok}</p>}
      {state.log?.map((line) => <p key={line}>✅ {line}</p>)}
    </div>
  );
}

export function PrepareForm({ routerId, dnsOn, natOn }: { routerId: string; dnsOn: boolean; natOn: boolean }) {
  const [state, action, pending] = useActionState<Result, FormData>(prepareRouterAction.bind(null, routerId), null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="enableDns" defaultChecked={!dnsOn} className="mt-1 accent-fuchsia-500" />
        <span>
          Ligar o DNS do roteador para os clientes (<code>allow-remote-requests</code>)
          <span className="block text-xs text-ink-400">Necessário para o hotspot. Se o roteador tem IP público, bloqueie a porta 53 vinda da internet no firewall.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="masquerade" defaultChecked={natOn} className="mt-1 accent-fuchsia-500" />
        <span>
          Criar NAT (masquerade) para as redes dos pontos
          <span className="block text-xs text-ink-400">Marque só se as redes dos pontos não saem para a internet por NAT em outro roteador.</span>
        </span>
      </label>
      <button className={`${buttonClass} self-start`} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Preparar roteador
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function NewPointForm({ routerId, interfaces }: { routerId: string; interfaces: RouterInterface[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(createPointAction.bind(null, routerId), null);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <label className={fieldClass}>
        Nome do ponto
        <input name="name" required placeholder="Polo Grussaí" className={inputClass} />
      </label>
      <label className={fieldClass}>
        Cidade / bairro
        <input name="city" placeholder="Grussaí" className={inputClass} />
      </label>
      <label className={fieldClass}>
        Porta tronco (por onde chegam as VLANs)
        <select name="trunk" required className={inputClass}>
          {interfaces.map((i) => (
            <option key={i.name} value={i.name}>
              {i.name}
              {i.comment ? ` — ${i.comment}` : ""}
              {i.running ? "" : " (sem link)"}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldClass}>
        VLAN do ponto
        <input name="vlanId" type="number" min={2} max={4094} required placeholder="3701" className={inputClass} />
      </label>
      <label className={fieldClass}>
        Rede do ponto (/24)
        <input name="network" required placeholder="10.5.1.0/24" className={inputClass} />
      </label>
      <label className={fieldClass}>
        Tempo do DHCP (minutos)
        <input name="leaseMinutes" type="number" min={5} defaultValue={30} className={inputClass} />
      </label>
      <div className="flex flex-col gap-3 md:col-span-3">
        <p className="text-xs text-ink-400">
          Cria no MikroTik: VLAN na porta tronco, IP .1 da rede, pool, servidor hotspot com o perfil do WiLead, DHCP e a rede na lista
          redes-hotspot. Se algo falhar no meio, tudo o que foi criado é desfeito. O AP do ponto precisa entregar o Wi-Fi nessa VLAN.
        </p>
        <button className={`${buttonClass} self-start`} disabled={pending || !interfaces.length}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar ponto no MikroTik
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
