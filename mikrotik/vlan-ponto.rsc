# WiLead: novo ponto de hotspot numa VLAN própria (RouterOS v6 ou v7).
# Rode uma vez por ponto, ajustando os 5 valores abaixo. Cole o bloco inteiro no terminal
# (o bloco entre chaves faz as variáveis valerem para todos os comandos).
#
# Cada ponto ganha VLAN, rede /24, DHCP e servidor hotspot próprios. O WiLead identifica o
# ponto pelo servidor hotspot/VLAN e cria o local sozinho no primeiro acesso.
# Pontos ainda não migrados continuam funcionando na VLAN atual.
{
  # Porta do CCR por onde chegam os pontos (tronco)
  :local porta "ether2"
  # VLAN do ponto (a mesma configurada no AP/switch do ponto)
  :local vid 101
  # Nome curto do ponto, sem espaços nem acentos
  :local nome "praca-central"
  # Rede /24 do ponto: só os 3 primeiros números
  :local rede "10.101.0"
  # Perfil de hotspot que já tem o login.html do WiLead
  :local perfil "wilead"

  :local vlan ("vlan" . $vid . "-" . $nome)
  /interface vlan add name=$vlan vlan-id=$vid interface=$porta
  /ip address add address=($rede . ".1/24") interface=$vlan
  /ip pool add name=("pool-" . $nome) ranges=($rede . ".10-" . $rede . ".254")
  /ip dhcp-server add name=("dhcp-" . $nome) interface=$vlan address-pool=("pool-" . $nome) lease-time=30m disabled=no
  /ip dhcp-server network add address=($rede . ".0/24") gateway=($rede . ".1") dns-server=($rede . ".1")
  /ip hotspot add name=("hs-" . $nome) interface=$vlan address-pool=("pool-" . $nome) profile=$perfil disabled=no
  /ip firewall address-list add list=redes-hotspot address=($rede . ".0/24") comment=("WiLead: " . $nome)
  :put ("Ponto " . $nome . " criado: " . $vlan . ", rede " . $rede . ".0/24, hotspot hs-" . $nome)
}

# Uma vez só (se a saída para a internet ainda não cobrir as redes novas):
# /ip firewall nat add chain=srcnat src-address-list=redes-hotspot action=masquerade comment="WiLead: saída dos pontos"
# /ip dns set allow-remote-requests=yes
