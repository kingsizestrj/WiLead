"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { buttonClass, fieldClass, ghostButtonClass, inputClass } from "@/components/admin/ui";
import { saveFunnelSteps, type FunnelStepInput } from "../actions";

const TYPES: Record<FunnelStepInput["type"], string> = {
  OPT_IN: "Aceitou receber promoções",
  RETURNED: "Voltou ao Wi-Fi",
  BLOCK_CLICK: "Clicou em botão da landing page",
  CHATWOOT_LABEL: "Tem etiqueta no Chatwoot",
};

export function FunnelEditor({
  initial,
  blocks,
  labels,
}: {
  initial: FunnelStepInput[];
  blocks: { id: string; label: string }[];
  labels: string[];
}) {
  const [steps, setSteps] = useState(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const set = (i: number, patch: Partial<FunnelStepInput>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, delta: number) => {
    const next = [...steps];
    const [s] = next.splice(i, 1);
    next.splice(i + delta, 0, s);
    setSteps(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-ink-300">
        <b className="text-white">1. Conectou no Wi-Fi</b>: base do funil, todos que fizeram login no período.
      </div>
      {steps.map((step, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <label className={fieldClass}>
            {i + 2}. Nome da etapa
            <input className={inputClass} value={step.name} onChange={(e) => set(i, { name: e.target.value })} />
          </label>
          <label className={fieldClass}>
            Condição
            <select className={inputClass} value={step.type} onChange={(e) => set(i, { type: e.target.value as FunnelStepInput["type"], param: "" })}>
              {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={fieldClass}>
            {step.type === "RETURNED" ? "Mínimo de visitas" : step.type === "BLOCK_CLICK" ? "Botão" : step.type === "CHATWOOT_LABEL" ? "Etiqueta" : " "}
            {step.type === "RETURNED" && (
              <input type="number" min={2} className={inputClass} value={step.param || "2"} onChange={(e) => set(i, { param: e.target.value })} />
            )}
            {step.type === "BLOCK_CLICK" && (
              <select className={inputClass} value={step.param} onChange={(e) => set(i, { param: e.target.value })}>
                <option value="">Qualquer botão</option>
                {blocks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            )}
            {step.type === "CHATWOOT_LABEL" && (
              <>
                <input className={inputClass} list="chatwoot-labels" placeholder="venda-fechada" value={step.param} onChange={(e) => set(i, { param: e.target.value })} />
                <datalist id="chatwoot-labels">{labels.map((l) => <option key={l} value={l} />)}</datalist>
              </>
            )}
          </label>
          <div className="flex items-end gap-1">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-2 hover:bg-white/5 disabled:opacity-30" aria-label="Subir">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-2 hover:bg-white/5 disabled:opacity-30" aria-label="Descer">
              <ArrowDown className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10" aria-label="Remover">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ghostButtonClass} onClick={() => setSteps([...steps, { name: "Nova etapa", type: "CHATWOOT_LABEL", param: "" }])}>
          <Plus className="h-4 w-4" /> Adicionar etapa
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveFunnelSteps(steps);
              setMessage(res.error ?? "Funil salvo.");
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar funil
        </button>
        {message && <span className="text-sm text-ink-300">{message}</span>}
      </div>
    </div>
  );
}
