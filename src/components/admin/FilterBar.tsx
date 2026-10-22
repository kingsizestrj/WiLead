import type { Filters } from "@/lib/filters";
import { isoDate } from "@/lib/filters";
import { buttonClass, inputClass } from "./ui";

export function FilterBar({
  filters,
  locations,
  search,
  type,
}: {
  filters: Filters;
  locations: { id: string; name: string }[];
  search?: boolean;
  type?: boolean;
}) {
  return (
    <form className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {search && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Buscar
          <input name="q" defaultValue={filters.q} placeholder="Nome, telefone ou e-mail" className={`${inputClass} w-64`} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Local
        <select name="location" defaultValue={filters.location ?? ""} className={inputClass}>
          <option value="">Todos os locais</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {type && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Tipo
          <select name="type" defaultValue={filters.type ?? ""} className={inputClass}>
            <option value="">Todos</option>
            <option value="NEW">Novos</option>
            <option value="RETURNING">Recorrentes</option>
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        De
        <input type="date" name="from" defaultValue={isoDate(filters.from)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Até
        <input type="date" name="to" defaultValue={isoDate(filters.to)} className={inputClass} />
      </label>
      <button className={buttonClass}>Filtrar</button>
    </form>
  );
}
