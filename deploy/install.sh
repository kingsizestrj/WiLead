#!/usr/bin/env bash
# Instala/atualiza o WiLead num servidor Ubuntu/Debian com Docker.
# Uso: bash install.sh   (rode de novo para atualizar)
set -euo pipefail

REPO="${REPO:-https://github.com/kingsizestrj/WiLead.git}"
BRANCH="${BRANCH:-claude/laughing-dijkstra-xv9wc2}"
DIR="${DIR:-$HOME/wilead}"

if ! command -v git >/dev/null; then
  sudo apt-get update -qq && sudo apt-get install -y -qq git
fi

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" pull -q --ff-only origin "$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

# Variáveis novas de versões mais recentes entram no .env existente com o valor de exemplo
if [ -f .env ]; then
  grep -E '^[A-Z_]+=' .env.example | while IFS= read -r line; do
    key="${line%%=*}"
    grep -q "^${key}=" .env || { echo "$line" >> .env; echo "==> .env: adicionada a variável ${key}"; }
  done
fi

if [ ! -f .env ]; then
  cp .env.example .env
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16)"
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -hex 32)\"|" .env
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=\"$ADMIN_PASSWORD\"|" .env
  chmod 600 .env
  echo "==> .env criado. Senha inicial do painel: $ADMIN_PASSWORD (também está em $DIR/.env)"
fi

$DOCKER compose up -d --build

echo "==> Aguardando o sistema subir..."
for _ in $(seq 1 60); do
  if curl -fs -o /dev/null http://localhost:3000/login; then
    echo "==> WiLead no ar: http://$(hostname -I | awk '{print $1}'):3000/admin"
    grep -q '^CHATWOOT_API_TOKEN=""' .env && echo "==> Falta preencher as variáveis do Chatwoot em $DIR/.env e rodar: $DOCKER compose up -d"
    exit 0
  fi
  sleep 2
done

echo "==> O sistema não respondeu. Veja os logs com: $DOCKER compose logs app" >&2
exit 1
