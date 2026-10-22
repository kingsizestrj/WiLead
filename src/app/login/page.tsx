import bcrypt from "bcryptjs";
import { ArrowRight, MapPinned, MessageCircleHeart, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo, buttonClass, fieldClass, inputClass } from "@/components/admin/ui";
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

const FEATURES = [
  { icon: MapPinned, title: "Saiba de onde vem cada cliente", text: "Cada ponto de Wi-Fi vira um local, com acessos, horários de pico e retorno." },
  { icon: Sparkles, title: "Landing pages que vendem", text: "Banners, vídeos, cupons e Instagram no portal de conexão." },
  { icon: MessageCircleHeart, title: "Tudo no Chatwoot", text: "Código pelo WhatsApp e contatos com etiquetas prontas para campanhas." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="app-bg grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden text-snow lg:block">
        <div className="absolute inset-0 bg-brand opacity-90" />
        <div className="absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-snow/20 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <Logo />
          <div>
            <h2 className="max-w-md text-5xl font-extrabold leading-[1.05] tracking-tight">Seu Wi-Fi transformando visitas em clientes.</h2>
            <div className="mt-10 grid max-w-md gap-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-4 rounded-2xl bg-snow/10 p-4 backdrop-blur">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-bold">{title}</div>
                    <div className="text-sm text-snow/80">{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-snow/70">Hotspot com MikroTik, WhatsApp e Chatwoot</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form action={login} className="w-full max-w-sm animate-fade-up">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bem-vindo de volta 👋</h1>
          <p className="mt-2 text-sm text-ink-300">Entre para acompanhar seus pontos de Wi-Fi.</p>
          <div className="mt-8 space-y-4">
            <label className={fieldClass}>
              E-mail
              <input name="email" type="email" autoComplete="email" required className={inputClass} />
            </label>
            <label className={fieldClass}>
              Senha
              <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
            </label>
            {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">E-mail ou senha inválidos.</div>}
            <button className={`${buttonClass} w-full`}>
              Entrar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
