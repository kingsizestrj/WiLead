import type { Prisma } from "@prisma/client";
import type { Filters } from "./filters";

// Clients that accessed the hotspot (optionally at a given location) within the period.
export function clientsWhere(filters: Filters): Prisma.ClientWhereInput {
  return {
    accesses: { some: { createdAt: { gte: filters.from, lte: filters.to }, locationId: filters.location } },
    ...(filters.q && {
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { phone: { contains: filters.q.replace(/\D/g, "") || filters.q } },
        { email: { contains: filters.q, mode: "insensitive" } },
      ],
    }),
  };
}

export const clientsInclude = {
  firstLocation: true,
  _count: { select: { accesses: true, devices: true } },
  accesses: { orderBy: { createdAt: "desc" }, take: 1, include: { location: true } },
} satisfies Prisma.ClientInclude;
