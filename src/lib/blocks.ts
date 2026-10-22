export type Block =
  | { id: string; type: "hero"; title: string; subtitle: string; imageUrl: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "banner"; imageUrl: string; linkUrl: string; caption: string }
  | { id: string; type: "video"; videoUrl: string }
  | { id: string; type: "carousel"; images: string }
  | { id: string; type: "coupon"; title: string; code: string; description: string }
  | { id: string; type: "instagram"; handle: string; text: string }
  // One plan per line: "Name | price | details"
  | { id: string; type: "plans"; title: string; items: string; footnote: string }
  | { id: string; type: "whatsapp"; phone: string; label: string; message: string };

export type BlockType = Block["type"];

export type Theme = {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  backgroundImage: string;
  logoUrl: string;
};

export const DEFAULT_THEME: Theme = {
  primaryColor: "#7c3aed",
  backgroundColor: "#0f0a1f",
  textColor: "#ffffff",
  backgroundImage: "",
  logoUrl: "",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Destaque",
  text: "Texto",
  banner: "Banner / anúncio",
  video: "Vídeo",
  carousel: "Carrossel de imagens",
  coupon: "Cupom de desconto",
  instagram: "Siga no Instagram",
  plans: "Planos / pacotes",
  whatsapp: "Botão WhatsApp",
};

export function newBlock(type: BlockType): Block {
  const id = crypto.randomUUID().slice(0, 8);
  switch (type) {
    case "hero":
      return { id, type, title: "Bem-vindo!", subtitle: "Conecte-se e aproveite", imageUrl: "" };
    case "text":
      return { id, type, text: "Escreva algo aqui" };
    case "banner":
      return { id, type, imageUrl: "", linkUrl: "", caption: "" };
    case "video":
      return { id, type, videoUrl: "" };
    case "carousel":
      return { id, type, images: "" };
    case "coupon":
      return { id, type, title: "10% OFF", code: "WIFI10", description: "Mostre este cupom no caixa" };
    case "instagram":
      return { id, type, handle: "", text: "Poste uma foto e marque a gente!" };
    case "plans":
      return { id, type, title: "Nossos planos", items: "300 Mega | R$ 99,90 | Wi-Fi 6", footnote: "" };
    case "whatsapp":
      return { id, type, phone: "", label: "Falar com a gente no WhatsApp", message: "Olá! Vim pelo Wi-Fi." };
  }
}
