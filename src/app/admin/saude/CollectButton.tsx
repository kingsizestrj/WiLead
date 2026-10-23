"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { ghostButtonClass } from "@/components/admin/ui";
import { collectHealthNow } from "../actions";

export function CollectButton() {
  const [pending, start] = useTransition();
  return (
    <button className={ghostButtonClass} disabled={pending} onClick={() => start(() => collectHealthNow())}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {pending ? "Verificando..." : "Verificar agora"}
    </button>
  );
}
