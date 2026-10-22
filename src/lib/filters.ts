export type Filters = { location?: string; from: Date; to: Date; q?: string; type?: "NEW" | "RETURNING" };

const DAY = 24 * 60 * 60 * 1000;

// Parses the shared admin filters (?location=&from=YYYY-MM-DD&to=YYYY-MM-DD&q=&type=). Default: last 30 days.
export function parseFilters(params: Record<string, string | undefined>): Filters {
  const to = params.to ? new Date(`${params.to}T23:59:59`) : new Date();
  const from = params.from ? new Date(`${params.from}T00:00:00`) : new Date(to.getTime() - 29 * DAY);
  return {
    location: params.location || undefined,
    from,
    to,
    q: params.q || undefined,
    type: params.type === "NEW" || params.type === "RETURNING" ? params.type : undefined,
  };
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
