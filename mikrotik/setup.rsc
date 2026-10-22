# Ajuste os valores antes de colar no terminal do MikroTik (RouterOS v7).
# PORTAL_HOST = domínio do sistema (ex.: wifi.voltec.com.br)

# 1) API REST usada pelo sistema para criar os usuários do hotspot
/ip service set www-ssl disabled=no certificate=<seu-certificado>
/user group add name=hotspot-api policy=read,write,api,rest-api,!ftp,!ssh,!telnet,!winbox,!web,!sniff,!sensitive,!policy,!password,!reboot,!test
/user add name=hotspot-api group=hotspot-api password=<senha-forte> address=<ip-do-servidor>/32

# 2) Hotspot: login por HTTP PAP (o portal envia usuário/senha) + cookie de MAC
/ip hotspot profile set [find] login-by=http-pap,cookie http-cookie-lifetime=1d

# 3) Walled garden: o cliente acessa o portal antes de logar
/ip hotspot walled-garden add dst-host=PORTAL_HOST action=allow comment="Portal Voltec"
/ip hotspot walled-garden ip add dst-host=PORTAL_HOST action=accept comment="Portal Voltec"

# 4) Envie mikrotik/login.html para a pasta "hotspot/" de cada servidor (Files) substituindo o original.
