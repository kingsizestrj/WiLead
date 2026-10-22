# WiLead: remove um ponto criado (inteiro ou pela metade) pelo vlan-ponto.rsc.
# Use os mesmos valores de VLAN, nome e rede usados na criação.
{
  :local vid 101
  :local nome "praca-central"
  :local rede "10.101.0"

  :local vlan ("vlan" . $vid . "-" . $nome)
  /ip hotspot remove [find name=("hs-" . $nome)]
  /ip dhcp-server remove [find name=("dhcp-" . $nome)]
  /ip dhcp-server network remove [find address=($rede . ".0/24")]
  /ip pool remove [find name=("pool-" . $nome)]
  /ip address remove [find interface=$vlan]
  /ip firewall address-list remove [find list=redes-hotspot address=($rede . ".0/24")]
  /interface vlan remove [find name=$vlan]
  :put ("OK: ponto " . $nome . " removido")
}
