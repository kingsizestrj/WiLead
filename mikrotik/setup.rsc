# WiLead: acesso do painel ao MikroTik (RouterOS v6 ou v7). Rode uma vez por roteador.
# O resto (perfil de hotspot, login.html, walled garden, WhatsApp temporário, DNS, NAT e os
# pontos com VLAN/DHCP/hotspot) é feito pelo painel: MikroTik → Gerenciar → Preparar roteador.
#
# Troque <ip-do-wilead> pelo IP com que o servidor do WiLead chega no roteador e <senha-forte>.

# Serviço da API: api = 8728 (rede interna/VPN) ou api-ssl = 8729 (precisa de certificado)
/ip service set api disabled=no address=<ip-do-wilead>/32

# Usuário só para o WiLead
/user group add name=wilead-api policy=read,write,api,test,!ftp,!ssh,!telnet,!winbox,!web,!sniff,!sensitive,!policy,!password,!reboot
/user add name=wilead-api group=wilead-api password=<senha-forte> address=<ip-do-wilead>/32
