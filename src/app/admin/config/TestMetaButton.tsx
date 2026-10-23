"use client";

import { useState, useTransition } from "react";
import { ghostButtonClass } from "@/components/admin/ui";
import { testMetaAction } from "../actions";

export function TestMetaButton() {
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => start(async () => setResult(await testMetaAction()))}>
        {pending ? "Testando..." : "Testar"}
      </button>
      {result && <span className="basis-full text-sm">{result}</span>}
    </>
  );
}
