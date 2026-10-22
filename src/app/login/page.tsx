import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";

async function login(formData: FormData) {
  "use server";
  const user = await db.adminUser.findUnique({ where: { email: String(formData.get("email")).toLowerCase() } });
  if (!user || !(await bcrypt.compare(String(formData.get("password")), user.passwordHash))) {
    redirect("/login?error=1");
  }
  await createSession(user.id);
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-full place-items-center bg-gradient-to-br from-violet-950 via-slate-950 to-fuchsia-950 p-4">
      <form action={login} className="flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-2 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-violet-600 text-2xl">📶</div>
          <h1 className="text-xl font-bold">Voltec Hotspot</h1>
          <p className="text-sm text-slate-500">Acesse o painel de gestão</p>
        </div>
        <input name="email" type="email" required placeholder="E-mail" className="rounded-xl border border-slate-200 px-4 py-3" />
        <input name="password" type="password" required placeholder="Senha" className="rounded-xl border border-slate-200 px-4 py-3" />
        {error && <p className="text-sm text-red-600">E-mail ou senha inválidos.</p>}
        <button className="rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700">Entrar</button>
      </form>
    </main>
  );
}
