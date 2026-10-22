# WiLead

Wi-Fi que vira lead: gestão de hotspot com MikroTik, landing page personalizada e verificação por código no WhatsApp. Todas as mensagens saem pelo Chatwoot (caixa WhatsApp Cloud da Meta).

## Como funciona

```
Cliente conecta no Wi-Fi
 └─ MikroTik (login.html) redireciona → https://SEU_PORTAL/p?mac=…&server=…
     ├─ Aparelho novo: nome + WhatsApp → código de 6 dígitos no WhatsApp → confirma
     └─ Aparelho conhecido: "Você é Maria? WhatsApp (11) •••••-4321"  [Sim, sou eu] / [Não sou eu]
 └─ Sistema cria/atualiza o usuário do hotspot no MikroTik (API do RouterOS, api/api-ssl):
     name = MAC · mac-address = MAC (travado no aparelho) · limit-uptime = tempo liberado
 └─ Contato atualizado no Chatwoot (etiquetas por local e opt-in) → público das campanhas
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

## Instalação no servidor

No servidor (Ubuntu/Debian), com um usuário que tenha `sudo`:

```bash
curl -fsSL https://raw.githubusercontent.com/kingsizestrj/hotspot/claude/laughing-dijkstra-xv9wc2/deploy/install.sh -o install.sh
bash install.sh
```

O script instala o Docker e o git se faltarem, baixa o código em `~/wilead`, cria o `.env` com segredo e senha do admin gerados e sobe o banco e o app na porta 3000.
Rode o mesmo comando de novo para atualizar.

Depois:
1. Preencha as variáveis do Chatwoot em `~/wilead/.env` e rode `docker compose up -d` dentro de `~/wilead`.
2. No **Nginx Proxy Manager**, crie um Proxy Host:
   - **Domain:** `wilead.voltecautomacao.com.br`;
   - **Forward:** `http://IP-DO-SERVIDOR:3000`;
   - **SSL:** novo certificado Let's Encrypt com Force SSL.
3. O domínio precisa apontar para um IP que os clientes do hotspot alcancem. Não use o proxy da Cloudflare (nuvem laranja), porque o walled garden do MikroTik libera o portal pelo IP.

Desenvolvimento local:

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Com `CHATWOOT_DRY_RUN=true` e `HOTSPOT_DRY_RUN=true`, o código aparece no log e nem o Chatwoot nem o MikroTik são chamados. Para testar o portal no navegador:
`http://localhost:3000/p?mac=AA:BB:CC:DD:EE:01&ip=10.5.50.2&server=hs-teste&login=http%3A%2F%2F10.5.50.1%2Flogin`


## Configurando o MikroTik (RouterOS v6 ou v7)

O sistema usa a API do RouterOS (serviço `api`, porta 8728, ou `api-ssl`, porta 8729), que funciona tanto no v6 quanto no v7.

1. Siga `mikrotik/setup.rsc`: liberar o serviço `api`/`api-ssl` só para o IP do servidor, criar um usuário só para a API, usar `login-by=http-pap` e configurar o walled garden (portal + WhatsApp).
2. Envie `mikrotik/login.html` (já aponta para `https://wilead.voltecautomacao.com.br`) para a pasta `hotspot/` de cada servidor hotspot.
3. No painel, vá em **MikroTik → Novo roteador** (IP, porta, usuário da API e perfil de usuário do hotspot) e clique em **Testar conexão**.
4. Depois do primeiro acesso de cada hotspot, vá em **Locais**, dê um nome e vincule o roteador.

Dicas:
- Prefira `api-ssl` (8729) com certificado. Se usar `api` (8728), mantenha o acesso restrito ao IP do servidor ou a uma VPN.
- No perfil de usuário do hotspot dá para limitar a banda (`rate-limit=5M/10M`) e os aparelhos por usuário (`shared-users=1`).

### Um ponto por VLAN (saber de onde o cliente vem)

O WiLead identifica o ponto pelo **servidor hotspot** e pela **interface** por onde o cliente chegou (`$(interface-name)`).
Com todos os pontos na mesma VLAN, não dá para diferenciar. A solução é dar uma VLAN para cada ponto, mesmo que todos continuem chegando ao CCR pela mesma porta (tronco):

1. No AP do ponto, marque o SSID do hotspot com a VLAN do ponto (UniFi e Intelbras corporativo fazem isso). Para APs sem VLAN, como Greatek, use uma porta *access* de um switch gerenciável ou de um rádio no ponto.
2. No CCR, rode `mikrotik/vlan-ponto.rsc` uma vez por ponto, ajustando porta do tronco, VLAN, nome, rede /24 e perfil. Ele cria VLAN, IP, DHCP, servidor hotspot e entrada na lista `redes-hotspot`.
3. No primeiro acesso, o ponto aparece em **Locais** com o nome do servidor (ex.: `hs-praca-central`). Renomeie como quiser.

Os pontos ainda não migrados continuam na VLAN atual e aparecem juntos como um único local até serem migrados.
Não usamos uma bridge única com as VLANs porque, para o MikroTik informar a porta, seria preciso ativar `use-ip-firewall`, que vale para **todas** as bridges do roteador.

### WhatsApp no walled garden (só para quem pediu o código)

O WhatsApp **não** fica liberado para todo mundo antes do login. Quando alguém pede o código, o WiLead coloca o IP do aparelho na lista `wilead-otp` do MikroTik por alguns minutos (padrão 3; ajuste ou desligue em **Configurações**).
Só essa lista alcança os IPs da Meta (`wilead-meta`) antes do login, então o cliente sem 4G consegue ler o código. Quando o tempo acaba, o próprio MikroTik remove o IP da lista.
A regra fica no bloco 4 do `mikrotik/setup.rsc`. Enquanto o IP está na lista, Instagram e Facebook também abrem, porque usam os mesmos IPs.

## Chatwoot: código no WhatsApp e campanhas

Todas as mensagens saem pelo Chatwoot, pela caixa de entrada WhatsApp Cloud:

- **Código de acesso:** o sistema acha (ou cria) o contato pelo telefone e abre uma conversa já **resolvida** com o template de autenticação.
  A conversa fica no histórico do cliente e não entra na fila da equipe. Se o cliente responder, ela reabre normalmente.
- **Segmentação para campanhas:** a cada acesso o contato recebe as etiquetas:
  - `wifi`: todo mundo que usou o Wi-Fi;
  - `wifi-<servidor hotspot>` (ex.: `wifi-hs-praca`): de onde o cliente veio;
  - `wifi-promocoes`: só quem aceitou receber promoções (LGPD). É removida se ele desmarcar.

  Também recebe os atributos `wifi_ultimo_local`, `wifi_ultima_visita`, `wifi_visitas` e `wifi_aceita_promocoes`.
- **Campanhas:** no Chatwoot, em **Campanhas → WhatsApp**, escolha um template de marketing e use como público a etiqueta `wifi-promocoes` (todos) ou `wifi-promocoes` + a etiqueta do local.

Configuração:

1. No Chatwoot, crie um token de acesso (Perfil → Token de acesso) de um agente administrador e preencha `CHATWOOT_URL`, `CHATWOOT_API_TOKEN`, `CHATWOOT_ACCOUNT_ID` e `CHATWOOT_INBOX_ID`.
2. Na Meta, crie um template da categoria **Autenticação** (ex.: `codigo_wifi`, `pt_BR`) com o botão **Copiar código** e preencha `WHATSAPP_OTP_TEMPLATE`.
3. No Chatwoot, sincronize os templates da caixa (Configurações da caixa → Templates) para o novo template aparecer.

### Templates WhatsApp direto no WiLead

O menu **Templates WhatsApp** cria, lista e exclui templates direto na Meta (Graph API), com pré-visualização no formato do WhatsApp:
- **Código do Wi-Fi (autenticação):** um clique cria o template do código, com aviso de segurança, validade e botão "Copiar código".
- **Mensagem / campanha:** templates de Marketing ou Utilidade, com título, variáveis (`{{1}}`, `{{2}}`…) e exemplos, rodapé e botões (resposta rápida, site ou ligação).

As credenciais da Meta (token e conta do WhatsApp Business) vêm da caixa de WhatsApp do Chatwoot, então não precisa configurar nada a mais. Basta que o `CHATWOOT_API_TOKEN` seja de um **administrador**.
Depois de criar ou excluir, o WiLead pede ao Chatwoot para sincronizar os templates. A lista mostra o status da Meta (em análise, aprovado ou rejeitado com o motivo).

## Landing page "Verão Conectado"

O seed cria a página **Verão Conectado** como padrão: pacotes de temporada de 600 Mega e de 800 Mega com streaming, de 2 a 5 meses (valor total do pacote, anunciado em 6x).
Ela também destaca "sem taxa de instalação, sem fidelidade e sem comprovante de residência" e traz um botão "Quero o Verão Conectado", que abre o WhatsApp da Voltec com a mensagem já escrita.
A IA de vendas do Chatwoot reconhece "Verão Conectado" e já entra no fluxo de temporada.

Os preços vieram do manual do Verão (`cw-claude-bridge`, migration `024_verao_conectado.sql`). Se mudarem no painel do bridge, atualize a página em **Landing pages**.
Preencha `VOLTEC_WHATSAPP_NUMBER` antes do seed, ou o número no bloco "Botão WhatsApp" do editor. Sem número, o botão não aparece.

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
- Mensagem automática de aniversário e de "sentimos sua falta" (quem não volta há 30 dias).
- Público personalizado no Meta Ads com os telefones que deram opt-in.

**Produto vendável (SaaS)**
- Multiempresa: cada cliente com seus locais, páginas e marca (white-label).
- Planos por número de locais e acessos, com cobrança recorrente.
- Templates prontos de landing page por segmento (bar, restaurante, academia, praça, evento).
- Teste A/B de landing pages e painel do lojista no celular (PWA).
