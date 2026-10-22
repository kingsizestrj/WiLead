# Voltec Hotspot

Gestão de hotspot Wi-Fi com MikroTik, landing page personalizada e verificação por código no WhatsApp (API oficial da Meta).

## Como funciona

```
Cliente conecta no Wi-Fi
 └─ MikroTik (login.html) redireciona → https://SEU_PORTAL/p?mac=…&server=…
     ├─ Aparelho novo: nome + WhatsApp → código de 6 dígitos no WhatsApp → confirma
     └─ Aparelho conhecido: "Você é Maria? WhatsApp (11) •••••-4321"  [Sim, sou eu] / [Não sou eu]
 └─ Sistema cria/atualiza o usuário do hotspot no MikroTik (API REST):
     name = MAC · mac-address = MAC (travado no aparelho) · limit-uptime = tempo liberado
 └─ (opcional) vídeo do patrocinador por N segundos
 └─ Navegador faz login no hotspot → página "Você está conectado" (Instagram, cupons…)
```

Quando o tempo acaba ou a conexão cai, o cliente volta ao portal e só confirma "sou eu", sem precisar de código novo.
Cada "Sim" zera o contador do usuário no MikroTik e libera mais um período.

**De onde vêm os clientes:** cada servidor hotspot do MikroTik (`$(server-name)`) vira um **Local** automaticamente no primeiro acesso.
No painel você dá um nome ao local (ex.: "Praça Central"), escolhe a landing page, o roteador e o tempo de acesso.
Dashboard, clientes e acessos têm filtro por local e por período.

## Painel (`/admin`)

- **Dashboard:** acessos, novos clientes, taxa de retorno, acessos por dia e por local, ranking de locais, horários de pico e métricas de anúncios (visualizações, vídeos assistidos, cliques e conversão).
- **Clientes:** busca e filtro por local/período, link direto para o WhatsApp e exportação em CSV (abre no Excel).
- **Acessos:** histórico de liberações (novo/recorrente, MAC, IP e tempo).
- **Landing pages:** editor com pré-visualização no celular. Tem cores, logo, fundo, destaque, texto, banner/anúncio com link, vídeo, carrossel, cupom de desconto, "Siga no Instagram" e vídeo obrigatório de patrocinador. Imagens e vídeos são enviados para o próprio servidor (funciona antes do login). Cada local pode ter sua própria página.
- **MikroTik:** cadastro dos roteadores e botão "Testar conexão".
- **Configurações:** tempo padrão de internet, validade do código e limite de códigos por hora.

## Rodando

```bash
cp .env.example .env        # preencha as variáveis
docker compose up -d --build
# painel: http://localhost:3000/admin  (login = ADMIN_EMAIL / ADMIN_PASSWORD)
```

Desenvolvimento local:

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Com `WHATSAPP_DRY_RUN=true` e `HOTSPOT_DRY_RUN=true`, o código aparece no log e o MikroTik não é chamado. Para testar o portal no navegador:
`http://localhost:3000/p?mac=AA:BB:CC:DD:EE:01&ip=10.5.50.2&server=hs-teste&login=http%3A%2F%2F10.5.50.1%2Flogin`

> Em produção o portal precisa de **domínio próprio com HTTPS** (ex.: `wifi.voltec.com.br`) atrás de um proxy (Caddy, Nginx ou Traefik).

## Configurando o MikroTik (CCR1036, RouterOS v7)

1. Siga `mikrotik/setup.rsc`: ativar a API REST (`www-ssl`), criar um usuário só para a API, usar `login-by=http-pap` e liberar o domínio do portal no walled garden.
2. Em `mikrotik/login.html`, troque `PORTAL_URL` pelo domínio do portal e envie o arquivo para a pasta `hotspot/` de cada servidor hotspot.
3. No painel, vá em **MikroTik → Novo roteador** (URL `https://IP-do-roteador`, usuário da API e perfil de usuário do hotspot) e clique em **Testar conexão**.
4. Depois do primeiro acesso de cada hotspot, vá em **Locais**, dê um nome e vincule o roteador.

Dica: no perfil de usuário do hotspot dá para limitar a banda (`rate-limit=5M/10M`) e os aparelhos por usuário (`shared-users=1`).

## Configurando o WhatsApp (Meta Cloud API)

1. No Meta Business, crie o app, adicione o produto WhatsApp e registre o número.
2. Crie um template da categoria **Autenticação** (ex.: `codigo_wifi`, idioma `pt_BR`) com o botão **Copiar código**.
3. Gere um token permanente (usuário do sistema) e preencha `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_OTP_TEMPLATE`.

Atenção: para ler o código, o celular do cliente precisa de internet no WhatsApp. Quem estiver sem 4G só recebe o código se os domínios do WhatsApp estiverem no walled garden (`*.whatsapp.net`, `*.whatsapp.com`, `*.fbcdn.net`).
A contrapartida é que o WhatsApp passa a funcionar sem login no hotspot. Avalie isso por local.

## Ideias para as próximas versões

**Instagramável**
- Moldura/filtro de foto ("Eu estive na Praça Central") com botão para compartilhar no Stories.
- "Poste e ganhe": quem marcar o @ ganha mais tempo de internet ou um cupom.
- Programa de fidelidade: a cada X visitas o cliente ganha um brinde, com ranking dos mais frequentes.

**Anúncios e receita**
- Cadastro de **anunciantes e campanhas** com período, locais e horários, e rodízio automático de banners e vídeos.
- **Relatório em PDF para o anunciante** (impressões, cliques e vídeos completos por local) para vender mídia.
- Pesquisa de satisfação/NPS de 1 clique antes de liberar e enquetes patrocinadas.
- Tempo extra de internet para quem assistir ao vídeo inteiro.

**Relacionamento**
- Integração com o Chatwoot: o contato entra no CRM com etiqueta do local e você dispara campanhas no WhatsApp para quem aceitou receber promoções.
- Mensagem automática de aniversário e de "sentimos sua falta" (quem não volta há 30 dias).
- Público personalizado no Meta Ads com os telefones que deram opt-in.

**Produto vendável (SaaS)**
- Multiempresa: cada cliente com seus locais, páginas e marca (white-label).
- Planos por número de locais e acessos, com cobrança recorrente.
- Templates prontos de landing page por segmento (bar, restaurante, academia, praça, evento).
- Teste A/B de landing pages e painel do lojista no celular (PWA).
