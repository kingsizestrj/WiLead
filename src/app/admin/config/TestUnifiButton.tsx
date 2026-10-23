"use client";

import { useState, useTransition } from "react";
import { ghostButtonClass } from "@/components/admin/ui";
import { testUnifiAction } from "../actions";

export function TestUnifiButton() {
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => start(async () => setResult(await testUnifiAction()))}>
        {pending ? "Testando..." : "Testar controladora"}
      </button>
      {result && <span className="text-sm">{result}</span>}
    </>
  );
}
