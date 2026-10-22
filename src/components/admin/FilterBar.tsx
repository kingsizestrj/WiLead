import { Filter } from "lucide-react";
import type { Filters } from "@/lib/filters";
import { isoDate } from "@/lib/filters";
import { buttonClass, fieldClass, inputClass } from "./ui";

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
    <form className="glass mb-6 flex animate-fade-up flex-wrap items-end gap-3 rounded-2xl p-4">
      {search && (
        <label className={`${fieldClass} min-w-56 flex-1`}>
          Buscar
          <input name="q" defaultValue={filters.q} placeholder="Nome, telefone ou e-mail" className={inputClass} />
        </label>
      )}
      <label className={fieldClass}>
        Local
        <select name="location" defaultValue={filters.location ?? ""} className={inputClass}>
          <option value="">Todos os locais</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {type && (
        <label className={fieldClass}>
          Tipo
          <select name="type" defaultValue={filters.type ?? ""} className={inputClass}>
            <option value="">Todos</option>
            <option value="NEW">Novos</option>
            <option value="RETURNING">Recorrentes</option>
          </select>
        </label>
      )}
      <label className={fieldClass}>
        De
        <input type="date" name="from" defaultValue={isoDate(filters.from)} className={inputClass} />
      </label>
      <label className={fieldClass}>
        Até
        <input type="date" name="to" defaultValue={isoDate(filters.to)} className={inputClass} />
      </label>
      <button className={buttonClass}>
        <Filter className="h-4 w-4" /> Filtrar
      </button>
    </form>
  );
}
