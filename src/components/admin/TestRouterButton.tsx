"use client";

import { useState, useTransition } from "react";
import { testRouterConnection } from "@/app/admin/actions";
import { ghostButtonClass } from "./ui";

export function TestRouterButton({ id }: { id: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={ghostButtonClass} disabled={pending}
        onClick={() => start(async () => setResult(await testRouterConnection(id)))}>
        {pending ? "Testando..." : "Testar conexão"}
      </button>
      {result && <span className="text-sm">{result}</span>}
    </div>
  );
}
