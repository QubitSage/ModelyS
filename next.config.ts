import type { NextConfig } from "next";

// F-14: headers de segurança em todas as rotas. Sem CSP estrita por enquanto
// (o Excalidraw + estilos inline + data:/blob: exigiriam calibração iterativa).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // microphone=(self): o portal de entrega grava recado em áudio do cliente.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // Com middleware.ts casando /api/*, o Next limita o body a 10MB por padrão e
  // trunca uploads (o formData() falha → "carrega e some"). Entregas sobem vídeo
  // 4K, então elevamos o teto. (Next 16 unificou middleware→proxy; a key nova
  // proxyClientMaxBodySize vale pro middleware.ts. Não pode coexistir c/ a antiga.)
  experimental: {
    proxyClientMaxBodySize: '1gb',
  },
  images: {
    // Reel (home): placeholders do portfólio. Adicionar aqui o host real dos
    // assets quando trocar os vídeos/imagens (ex: *.supabase.co).
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
