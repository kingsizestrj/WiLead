# Ajuste os valores <...> antes de colar no terminal do MikroTik (RouterOS v6 ou v7).
# PORTAL_HOST = domínio do sistema (ex.: wifi.voltec.com.br)

# 1) API do RouterOS usada pelo sistema para criar os usuários do hotspot
#    api = porta 8728 (sem criptografia, use só em rede interna/VPN)
#    api-ssl = porta 8729 (precisa de certificado no roteador)
/ip service set api disabled=no address=<ip-do-servidor>/32
/ip service set api-ssl disabled=no address=<ip-do-servidor>/32 certificate=<seu-certificado>
/user group add name=hotspot-api policy=read,write,api,!ftp,!ssh,!telnet,!winbox,!web,!sniff,!sensitive,!policy,!password,!reboot,!test
/user add name=hotspot-api group=hotspot-api password=<senha-forte> address=<ip-do-servidor>/32

# 2) Hotspot: login por HTTP PAP (o portal envia usuário/senha) + cookie
/ip hotspot profile set [find] login-by=http-pap,cookie http-cookie-lifetime=1d

# 3) Walled garden: portal acessível antes do login
/ip hotspot walled-garden add dst-host=PORTAL_HOST action=allow comment="Portal Voltec"
/ip hotspot walled-garden ip add dst-host=PORTAL_HOST action=accept comment="Portal Voltec"

# 4) Walled garden: WhatsApp liberado antes do login (para o cliente receber o código).
#    O WhatsApp usa os blocos de IP da Meta (AS32934), os mesmos de Instagram e Facebook,
#    então esses apps também funcionam antes do login. Confira a lista em https://bgp.he.net/AS32934
:foreach net in={ \
  "31.13.24.0/21"; "31.13.64.0/18"; "45.64.40.0/22"; "57.144.0.0/14"; "66.220.144.0/20"; \
  "69.63.176.0/20"; "69.171.224.0/19"; "74.119.76.0/22"; "102.132.96.0/20"; "103.4.96.0/22"; \
  "129.134.0.0/16"; "157.240.0.0/16"; "163.70.128.0/17"; "173.252.64.0/18"; "179.60.192.0/22"; \
  "185.60.216.0/22"; "185.89.216.0/22"; "204.15.20.0/22" \
} do={ /ip hotspot walled-garden ip add action=accept dst-address=$net comment="WhatsApp (Meta)" }

# 5) Envie mikrotik/login.html para a pasta "hotspot/" de cada servidor (Files), substituindo o original.
