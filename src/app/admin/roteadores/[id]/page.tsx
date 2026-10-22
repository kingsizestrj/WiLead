import { AlertTriangle, ArrowLeft, CheckCircle2, Info, ListChecks, MapPinPlus, Radio } from "lucide-react";
import Link from "next/link";
import { Badge, Card, PageHeader, Table, Td, tr } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { hotspotStatus, routerChecklist, srcNatAddresses, trunkCandidates, wileadUrls, type CheckItem, type HotspotStatus, type RouterInterface } from "@/lib/mikrotik-setup";
import { NewPointForm, PrepareForm } from "./forms";

export default async function RouterPage({ params }: { params: Promise<{ id: string }> }) {
  const router = await db.router.findUniqueOrThrow({ where: { id: (await params).id } });
  const sources = await db.locationSource.findMany({ include: { location: true } });

  let configError: string | null = null;
  try {
    wileadUrls();
  } catch (e) {
    configError = (e as Error).message;
  }

  let checklist: CheckItem[] = [];
  let hotspots: HotspotStatus[] = [];
  let interfaces: RouterInterface[] = [];
  let publicAddresses: string[] = [];
  let error: string | null = null;
  if (!configError) {
    try {
      [checklist, hotspots, interfaces, publicAddresses] = await Promise.all([
        routerChecklist(router),
        hotspotStatus(router),
        trunkCandidates(router),
        srcNatAddresses(router),
      ]);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const item = (label: string) => checklist.find((c) => c.label.startsWith(label));

  return (
    <>
      <Link href="/admin/roteadores" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-300 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> MikroTik
      </Link>
      <PageHeader title={router.name} subtitle={`${router.host}:${router.port} · usuário ${router.username}`} />

      {configError ? (
        <Card>
          <p className="text-sm text-amber-300">Falta configurar o servidor do WiLead: {configError}</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900/70 p-3 text-xs text-ink-300">
            {`cd ~/wilead\necho 'PUBLIC_URL="https://wilead.voltecautomacao.com.br"' >> .env\ndocker compose up -d`}
          </pre>
        </Card>
      ) : error ? (
        <Card>
          <p className="text-sm text-rose-300">Não foi possível falar com o roteador: {error}</p>
          <p className="mt-2 text-sm text-ink-400">Confira IP, porta e usuário da API na lista de roteadores e se o serviço api aceita o IP do WiLead.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Preparação do roteador" icon={<ListChecks className="h-4 w-4" />}>
              <ul className="mb-5 flex flex-col gap-2.5">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-start gap-3 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    ) : c.optional ? (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    )}
                    <span>
                      {c.label}
                      <span className="block text-xs text-ink-400">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <PrepareForm routerId={router.id} dnsOn={!!item("DNS")?.ok} publicAddresses={publicAddresses} />
            </Card>

            <Card title="Novo ponto" icon={<MapPinPlus className="h-4 w-4" />}>
              <NewPointForm routerId={router.id} interfaces={interfaces} />
            </Card>
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Radio className="h-4 w-4 text-fuchsia-300" /> Hotspots neste roteador
            </h2>
            <Table head={["Servidor", "Interface", "Perfil", "Status", "Aparelhos", "Conectados", "IPs do DHCP", "Local no WiLead"]}>
              {hotspots.map((h) => {
                const location = sources.find((s) => s.hotspotServer === h.name)?.location;
                return (
                  <tr key={h.name} className={tr}>
                    <Td className="font-semibold max-md:text-base">{h.name}</Td>
                    <Td label="Interface" className="font-mono text-xs">{h.interface}</Td>
                    <Td label="Perfil">{h.profile}</Td>
                    <Td label="Status">
                      {h.disabled ? <Badge tone="zinc">Desativado</Badge> : h.invalid ? <Badge tone="rose">Inválido</Badge> : <Badge tone="green">Ativo</Badge>}
                    </Td>
                    <Td label="Aparelhos">{h.hosts}</Td>
                    <Td label="Conectados">{h.active}</Td>
                    <Td label="IPs do DHCP">
                      {h.leases === null ? <span className="text-ink-400">sem DHCP</span> : h.leases === 0 ? <Badge tone="amber">0 · VLAN não chega?</Badge> : h.leases}
                    </Td>
                    <Td label="Local no WiLead">{location ? location.name : <span className="text-ink-400">aparece no 1º acesso</span>}</Td>
                  </tr>
                );
              })}
              {!hotspots.length && (
                <tr className={tr}>
                  <Td colSpan={8} className="text-ink-400">Nenhum hotspot neste roteador. Crie o primeiro ponto acima.</Td>
                </tr>
              )}
            </Table>
            <p className="mt-2 text-xs text-ink-400">
              &quot;IPs do DHCP&quot; zerado com o Wi-Fi em uso indica que a VLAN do ponto não está chegando no roteador (AP/switch/rádio sem a VLAN).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
