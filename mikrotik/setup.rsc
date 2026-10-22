# Ajuste os valores <...> antes de colar no terminal do MikroTik (RouterOS v6 ou v7).
# Portal: wilead.voltecautomacao.com.br. Servidor do WiLead: 10.128.31.78

# 1) API do RouterOS usada pelo sistema para criar os usuários do hotspot
#    api = porta 8728 (sem criptografia, use só em rede interna/VPN)
#    api-ssl = porta 8729 (precisa de certificado no roteador)
/ip service set api disabled=no address=10.128.31.78/32
/ip service set api-ssl disabled=no address=10.128.31.78/32 certificate=<seu-certificado>
/user group add name=hotspot-api policy=read,write,api,!ftp,!ssh,!telnet,!winbox,!web,!sniff,!sensitive,!policy,!password,!reboot,!test
/user add name=hotspot-api group=hotspot-api password=<senha-forte> address=10.128.31.78/32

# 2) Hotspot: login por HTTP PAP (o portal envia usuário/senha) + cookie
/ip hotspot profile set [find] login-by=http-pap,cookie http-cookie-lifetime=1d

# 3) Walled garden: portal acessível antes do login
/ip hotspot walled-garden add dst-host=wilead.voltecautomacao.com.br action=allow comment="Portal Voltec"
/ip hotspot walled-garden ip add dst-host=wilead.voltecautomacao.com.br action=accept comment="Portal Voltec"

# 4) WhatsApp só para quem acabou de pedir o código (cliente sem 4G consegue ler).
#    O WiLead coloca o IP do aparelho na lista "wilead-otp" com tempo limite (Configurações do painel);
#    só essa lista alcança os IPs da Meta (lista "wilead-meta") antes do login. O resto continua bloqueado.
#    Confira os blocos da Meta em https://bgp.he.net/AS32934
:foreach net in={ \
  "31.13.24.0/21"; "31.13.64.0/18"; "45.64.40.0/22"; "57.144.0.0/14"; "66.220.144.0/20"; \
  "69.63.176.0/20"; "69.171.224.0/19"; "74.119.76.0/22"; "102.132.96.0/20"; "103.4.96.0/22"; \
  "129.134.0.0/16"; "157.240.0.0/16"; "163.70.128.0/17"; "173.252.64.0/18"; "179.60.192.0/22"; \
  "185.60.216.0/22"; "185.89.216.0/22"; "204.15.20.0/22" \
} do={ /ip firewall address-list add list=wilead-meta address=$net comment="WiLead: Meta/WhatsApp" }
/ip hotspot walled-garden ip add action=accept src-address-list=wilead-otp dst-address-list=wilead-meta comment="WiLead: WhatsApp temporario para ler o codigo"
#    Se você rodou a versão antiga (WhatsApp liberado para todos), remova:
#    /ip hotspot walled-garden ip remove [find comment="WhatsApp (Meta)"]

# 5) Envie mikrotik/login.html para a pasta "hotspot/" de cada servidor (Files), substituindo o original.
