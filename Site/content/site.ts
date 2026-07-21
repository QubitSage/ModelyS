/**
 * Conteúdo do site — BILÍNGUE (en / pt). Fonte única, tipada. Sem travessões no texto.
 */

export type Locale = "en" | "pt";

export type Package = {
  name: string;
  price: string;
  description?: string;
  features: string[];
  featured?: boolean;
  badge?: string;
};

export type ProcessStep = { title: string; text: string };

export type Service = {
  id: string;
  label: string;
  tagline: string;
  videoSrc: string;
  poster: string;
  description: string;
  process: ProcessStep[];
  packages: Package[];
  packagesNote?: string;
  gallery: string[];
};

export type SocialLink = { label: string; href: string };

export type ContactField = {
  name: string;
  label: string;
  type: "text" | "email" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  half?: boolean; // ocupa meia largura (layout 2 colunas)
};

export type UIStrings = {
  deliveryModel: string;
  howItWorks: string;
  packages: string;
  selectedWork: string;
  wantThis: string;
  back: string;
  seeDetails: string;
  scrollSideways: string;
  select: string;
  contactEyebrow: string;
  seeItems: string;
  requiredField: string;
  completeAll: string;
  about: string; // rótulo do menu "Sobre / About"
};

export type ClientLogo = {
  name: string;
  logo?: string; // caminho em /public (ex: "/clients/acme.svg"). Sem logo = mostra o nome.
};

export type AboutContent = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  clientsTitle: string;
  clients: ClientLogo[];
};

export type SiteContent = {
  brand: string;
  taglineShort: string;
  taglineLong: string;
  headerCta: string;
  ui: UIStrings;
  about: AboutContent;
  services: Service[];
  contact: {
    headline: string;
    sub: string;
    email: string;
    phone: string;
    socials: SocialLink[];
    micro: string;
    form: { fields: ContactField[]; submitLabel: string; successMessage: string };
  };
  footer: string[];
};

const gallery = (id: string) => [
  `https://picsum.photos/seed/${id}-g1/1200/800`,
  `https://picsum.photos/seed/${id}-g2/1200/800`,
  `https://picsum.photos/seed/${id}-g3/1200/800`,
];

const V = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";
const VIDEO: Record<string, string> = {
  brand: `${V}/ForBiggerBlazes.mp4`,
  storytelling: `${V}/ForBiggerMeltdowns.mp4`,
  corporate: `${V}/ElephantsDream.mp4`,
  cloning: `${V}/ForBiggerJoyrides.mp4`,
  websites: `${V}/BigBuckBunny.mp4`,
};
const poster = (id: string) => `https://picsum.photos/seed/${id}-poster/1920/1080`;

const EMAIL = "contato@modely.com.br";
const PHONE = "+55 11 99522-9391";
const SOCIALS: SocialLink[] = [
  { label: "Instagram", href: "https://instagram.com/modely" },
  { label: "YouTube", href: "https://youtube.com/@modely" },
];

// Logos dos clientes (a mesma lista nos dois idiomas). Pra ativar um logo:
// coloque o arquivo em Site/public/clients/ e aponte em `logo`. Sem `logo`,
// renderiza o nome como placeholder estilizado.
const CLIENTS: ClientLogo[] = [
  { name: "Cliente 1" },
  { name: "Cliente 2" },
  { name: "Cliente 3" },
  { name: "Cliente 4" },
  { name: "Cliente 5" },
  { name: "Cliente 6" },
];

// ===========================================================================
// EN
// ===========================================================================
const en: SiteContent = {
  brand: "Modely",
  taglineShort: "Ads that perform",
  taglineLong: "The creative production arm your brand needs.",
  headerCta: "Talk to us",
  ui: {
    deliveryModel: "Delivery model", howItWorks: "How it works", packages: "Packages",
    selectedWork: "Selected work", wantThis: "I want this model", back: "Back",
    seeDetails: "See details", scrollSideways: "Scroll sideways", select: "Select",
    contactEyebrow: "Contact", seeItems: "See details",
    requiredField: "Please complete this required field.",
    completeAll: "Please complete all required fields.",
    about: "About",
  },
  about: {
    eyebrow: "About us",
    title: "The studio behind the videos.",
    paragraphs: [
      "[Placeholder] The Modely story goes here: who we are, how we work, and why we build videos the way we do. You will fill this in with the good stuff later.",
      "[Placeholder] A second paragraph for the mission, the team, and what sets the studio apart.",
    ],
    clientsTitle: "Trusted by",
    clients: CLIENTS,
  },
  services: [
    {
      id: "brand", label: "Brand Film",
      tagline: "Cinematic brand films that make your product look expensive, without the traditional production cost.",
      videoSrc: VIDEO.brand, poster: poster("brand"),
      description: "Tired of product videos that look cheap, generic or like every other brand? This is for you if you want pure visual storytelling: strong aesthetics, rhythm, product as the hero, and zero talking heads. We create Brand Films that feel premium and commercial, using AI + human direction. You get the look of a high-end production in days, not months, and at a fraction of the traditional cost.",
      process: [
        { title: "Concept & moodboard", text: "The creative concept and visual references for the film." },
        { title: "Script & storyboard", text: "Every scene planned and approved before generation." },
        { title: "AI production", text: "Shots produced to the approved art direction." },
        { title: "Color & sound", text: "Edit, color grade, and sound design." },
        { title: "Cuts & delivery", text: "High-res masters with cuts for every channel." },
      ],
      packages: [
        { name: "Essential", price: "$1,190", features: ["1 main Brand Film (30-45s)", "4 cuts for ads and social", "Vertical (9:16) + horizontal (16:9)", "Color grading + soundtrack", "2 revision rounds", "Delivery in up to 7 business days"] },
        { name: "Performance", price: "$1,790", features: ["1 main Brand Film (35-50s)", "6 ad-optimized cuts", "9:16 and 16:9", "2 hook variations", "Color grading + sound design", "2 revision rounds", "Delivery in up to 10 business days"], featured: true, badge: "Most chosen" },
        { name: "Complete", price: "$2,690", features: ["1 main Brand Film (40-60s)", "8 performance cuts", "All aspect ratios (9:16 and 16:9)", "3 hook variations", "Advanced color grading + sound design", "Version for site", "3 revision rounds", "Delivery in up to 12 business days"] },
      ],
      gallery: gallery("brand"),
    },
    {
      id: "storytelling", label: "Storytelling Commercial",
      tagline: "Commercials that tell a story and actually sell, without looking like every other ad.",
      videoSrc: VIDEO.storytelling, poster: poster("storytelling"),
      description: "Tired of ads that feel forced, generic or just 'product + text on screen'? This is for brands that want commercials with narrative, rhythm and emotion, the kind that stop the scroll and push people to action. We create Storytelling Commercials focused on conversion: strong hook, visual storytelling and clear CTA. Built with AI + human direction so you get performance-ready material fast, without the traditional production cost.",
      process: [
        { title: "Strategy & angle", text: "Core message, audience, and the hook that earns attention." },
        { title: "Narrative script", text: "The arc: problem, tension, solution, and call to action." },
        { title: "Production", text: "Scenes and voiceover in your brand tone." },
        { title: "Performance edit", text: "Cuts, captions, music, and pace built to convert." },
        { title: "Variations & delivery", text: "Channel and hook versions ready for the ads manager." },
      ],
      packages: [
        { name: "Essential", price: "$1,290", features: ["1 Storytelling Commercial (30-45s)", "4 cuts for ads", "Vertical + horizontal", "Color grading + soundtrack", "2 revision rounds", "Delivery in up to 7 business days"] },
        { name: "Performance", price: "$1,890", features: ["1 main Storytelling Commercial (35-50s)", "6 performance-optimized cuts", "9:16, 1:1 and 16:9", "2 hook variations", "Color grading + sound design", "2 revision rounds", "Delivery in up to 10 business days"], featured: true, badge: "Most chosen" },
        { name: "Complete", price: "$2,690", features: ["1 main Storytelling Commercial (40-60s)", "8 cuts for ads", "All aspect ratios (9:16, 1:1 and 16:9)", "3 hook variations", "Advanced color grading + sound design", "Version for site and ads", "3 revision rounds", "Delivery in up to 12 business days"] },
      ],
      gallery: gallery("storytelling"),
    },
    {
      id: "corporate", label: "Corporate Film",
      tagline: "Clean, professional corporate films for companies.",
      videoSrc: VIDEO.corporate, poster: poster("corporate"),
      description: "Corporate films with an authoritative tone, for your site, LinkedIn, and presentations. Your company's serious, trustworthy face, without feeling stiff.",
      process: [
        { title: "Brief & message", text: "The core message, audience, and goal of the film." },
        { title: "Corporate script", text: "A clear, credible script in your company's voice." },
        { title: "Production", text: "Scenes produced to the approved direction." },
        { title: "Color & sound", text: "Edit, color grade, and sound design." },
        { title: "Versions & delivery", text: "Cuts for site, LinkedIn, and ads." },
      ],
      packages: [
        { name: "Corporate Essential", price: "$1,090", features: ["1 corporate film (60-75s)", "3 short versions", "Version for site + LinkedIn", "Color grading + soundtrack", "2 revision rounds", "Delivery in up to 8 business days"] },
        { name: "Corporate Performance", price: "$1,690", features: ["1 main corporate film (70-90s)", "5 short versions", "16:9 + 9:16", "Specific version for LinkedIn and site", "Color grading + sound design", "2 revision rounds", "Delivery in up to 10 business days"], featured: true, badge: "Recommended" },
        { name: "Corporate Complete", price: "$2,490", features: ["1 main corporate film (80-100s)", "1 more cinematic version", "7 short versions", "All aspect ratios (16:9, 9:16 and 1:1)", "Versions for site, LinkedIn and ads", "Advanced color grading + sound design", "3 revision rounds", "Delivery in up to 12 business days"] },
      ],
      gallery: gallery("corporate"),
    },
    {
      id: "cloning", label: "Cloning",
      tagline: "We clone your face and voice in person, then turn them into unlimited videos without you ever filming again.",
      videoSrc: VIDEO.cloning, poster: poster("cloning"),
      description: "Tired of having to record every single time you need a new video? Cloning builds a digital twin of you, face and voice, with absolute fidelity. The cloning is done 100% in person, at our studio, because that is the only way to capture every detail of your expression, your tone and your delivery with the precision the final result demands. After the setup, you get an avatar that speaks any script, across as many videos as you need, with your real face and your real voice.",
      process: [
        { title: "In-person capture", text: "A dedicated studio session to record your face and voice at full fidelity." },
        { title: "Cloning & calibration", text: "We build your digital twin and fine-tune expression, tone and delivery." },
        { title: "Quality tests", text: "Side-by-side checks until the avatar is indistinguishable from you." },
        { title: "Script to video", text: "Send a script, we generate the video with your face and voice." },
        { title: "Cuts & delivery", text: "Vertical and horizontal cuts, captions and soundtrack for every channel." },
      ],
      packages: [
        { name: "Cloning Setup", price: "R$ 3,500", description: "One-time payment", features: ["High-fidelity face cloning", "Voice cloning (timbre and delivery)", "In-person capture session at the studio", "Calibration and quality testing", "Your avatar ready to produce"] },
        { name: "Videos", price: "On request", description: "On demand", features: ["Volume defined per project, from one-off to monthly", "Any script, in your own face and voice", "Vertical and horizontal cuts", "Captions and soundtrack", "Price scales with volume: the more videos, the better the rate"], featured: true, badge: "Recurring" },
      ],
      packagesNote: "Exclusive to clients in São José dos Campos, São Paulo and Jundiaí. Cloning is done in person to guarantee maximum precision and quality.",
      gallery: gallery("cloning"),
    },
    {
      id: "websites", label: "Websites",
      tagline: "High-converting websites and landing pages with real studio craft.",
      videoSrc: VIDEO.websites, poster: poster("websites"),
      description: "Tired of sites that look generic, load slowly or don't convert? This is for brands that want a clean, modern and professional online presence, designed to look premium and actually generate results. We create websites and landing pages with strong visual identity, clear structure and conversion focus. Built to match the same quality standard of our Brand Films and Commercials.",
      process: [
        { title: "Brief & architecture", text: "Goal, audience, and the journey that converts." },
        { title: "Design", text: "Your brand applied to a clear, desirable interface." },
        { title: "Build", text: "Fast, responsive, lightweight implementation." },
        { title: "Content & SEO", text: "Sales-aware copy and on-page SEO." },
        { title: "Launch", text: "Live with domain, analytics, and tracking." },
      ],
      packages: [
        { name: "Site Essential", price: "$990", features: ["Landing page or 1-page site", "Modern, responsive design", "WhatsApp / form integration", "Basic speed optimization", "2 revision rounds", "Delivery in up to 8 business days"] },
        { name: "Site Performance", price: "$1,590", features: ["Institutional site (up to 5 pages)", "Design aligned with your identity", "Video section (Brand Film / Commercial)", "Form + WhatsApp + strong CTAs", "Responsive + speed optimization", "2 revision rounds", "Delivery in up to 12 business days"], featured: true, badge: "Recommended" },
        { name: "Site Complete", price: "$2,390", features: ["Full site (up to 8 pages)", "Premium design + light animation", "Brand Film / Commercial integration", "Cases or portfolio section", "Advanced forms + WhatsApp", "Speed optimization and basic SEO", "3 revision rounds", "Delivery in up to 15 business days"] },
      ],
      gallery: gallery("websites"),
    },
  ],
  contact: {
    headline: "Let's talk video.",
    sub: "Fill out the form below and a specialist will follow up within 2 hours (business hours: Mon to Fri, 8 AM to 8 PM).",
    email: EMAIL, phone: PHONE, socials: SOCIALS, micro: "A human replies",
    form: {
      fields: [
        { name: "firstName", label: "First name", type: "text", placeholder: "First name", required: true, half: true },
        { name: "lastName", label: "Last name", type: "text", placeholder: "Last name", required: true, half: true },
        { name: "company", label: "Company name", type: "text", placeholder: "Company name", required: true, half: true },
        { name: "phone", label: "Phone number", type: "text", placeholder: "Phone number", half: true },
        { name: "email", label: "Work email address", type: "email", placeholder: "you@company.com", required: true },
        { name: "format", label: "Which format?", type: "select", required: true, options: ["Brand Film", "Storytelling Commercial", "Corporate Film", "Cloning", "Websites", "Not sure yet"] },
        { name: "size", label: "Company size", type: "select", options: ["1-9", "10-49", "50-199", "200+"] },
        { name: "overview", label: "Overview of your project", type: "textarea", placeholder: "Tell us the goal, timeline, and any references", required: true },
        { name: "source", label: "How did you hear about us?", type: "select", options: ["LinkedIn", "Instagram", "Google", "Referral", "Other"] },
      ],
      submitLabel: "Submit",
      successMessage: "Got it. A specialist will follow up shortly.",
    },
  },
  footer: [
    "Modely © 2026 · AI creative studio · Chicago",
    "AI-assisted production. Human creative direction and QC.",
  ],
};

// ===========================================================================
// PT
// ===========================================================================
const pt: SiteContent = {
  brand: "Modely",
  taglineShort: "Anúncios que performam",
  taglineLong: "Somos o braço de produção criativa que sua marca precisa.",
  headerCta: "Fale conosco",
  ui: {
    deliveryModel: "Formato de entrega", howItWorks: "Como funciona", packages: "Pacotes",
    selectedWork: "Trabalhos selecionados", wantThis: "Quero este formato", back: "Voltar",
    seeDetails: "Ver detalhes", scrollSideways: "Arraste para o lado", select: "Selecione",
    contactEyebrow: "Contato", seeItems: "Ver detalhes",
    requiredField: "Preencha este campo obrigatório.",
    completeAll: "Preencha todos os campos obrigatórios.",
    about: "Sobre",
  },
  about: {
    eyebrow: "Sobre nós",
    title: "O estúdio por trás dos vídeos.",
    paragraphs: [
      "[Placeholder] Aqui vai a história da Modely: quem somos, como trabalhamos e por que fazemos vídeo do jeito que fazemos. Você preenche com as informações legais depois.",
      "[Placeholder] Um segundo parágrafo pra missão, o time e o diferencial do estúdio.",
    ],
    clientsTitle: "Quem confia na gente",
    clients: CLIENTS,
  },
  services: [
    {
      id: "brand", label: "Brand Film",
      tagline: "Filmes de marca cinematográficos que fazem seu produto parecer caro, sem o custo de produção tradicional.",
      videoSrc: VIDEO.brand, poster: poster("brand"),
      description: "Cansado de vídeos de produto que parecem baratos, genéricos ou iguais aos de todo mundo? Este é pra você que quer storytelling visual puro: estética forte, ritmo, o produto como protagonista e zero talking head. Criamos Brand Films com cara premium e comercial, usando IA + direção humana. Você tem o acabamento de uma produção de alto nível em dias, não meses, e por uma fração do custo tradicional.",
      process: [
        { title: "Conceito & moodboard", text: "O conceito criativo e as referências visuais do filme." },
        { title: "Roteiro & storyboard", text: "Cada cena planejada e aprovada antes de gerar." },
        { title: "Produção com IA", text: "Os planos produzidos na direção de arte aprovada." },
        { title: "Color & som", text: "Montagem, color grading e sound design." },
        { title: "Cortes & entrega", text: "Masters em alta com cortes para cada canal." },
      ],
      packages: [
        { name: "Essencial", price: "R$ 2.400", features: ["1 Brand Film principal (30-45s)", "4 cortes para ads e redes", "Versões vertical (9:16) + horizontal (16:9)", "Color grading + trilha", "2 rodadas de revisão", "Entrega em até 7 dias úteis"] },
        { name: "Performance", price: "R$ 3.500", features: ["1 Brand Film principal (35-50s)", "6 cortes otimizados para ads", "Versões 9:16 e 16:9", "2 variações de hook", "Color grading + sound design", "2 rodadas de revisão", "Entrega em até 10 dias úteis"], featured: true, badge: "Mais escolhido" },
        { name: "Completo", price: "R$ 5.200", features: ["1 Brand Film principal (40-60s)", "8 cortes para performance", "Todas as proporções (9:16 e 16:9)", "3 variações de hook", "Color grading avançado + sound design", "Versão para site", "3 rodadas de revisão", "Entrega em até 12 dias úteis"] },
      ],
      gallery: gallery("brand"),
    },
    {
      id: "storytelling", label: "Storytelling Commercial",
      tagline: "Comerciais que contam uma história e de fato vendem, sem parecer mais um anúncio genérico.",
      videoSrc: VIDEO.storytelling, poster: poster("storytelling"),
      description: "Cansado de anúncios que soam forçados, genéricos ou só 'produto + texto na tela'? Este é pra marcas que querem comerciais com narrativa, ritmo e emoção, do tipo que trava o scroll e leva à ação. Criamos Storytelling Commercials focados em conversão: gancho forte, storytelling visual e CTA claro. Feito com IA + direção humana pra você ter material pronto pra performar rápido, sem o custo de produção tradicional.",
      process: [
        { title: "Estratégia & ângulo", text: "Mensagem-chave, público e o gancho que segura a atenção." },
        { title: "Roteiro narrativo", text: "O arco: problema, tensão, solução e chamada para a ação." },
        { title: "Produção", text: "Cenas e locução no tom da sua marca." },
        { title: "Edição de performance", text: "Cortes, legendas, trilha e ritmo pra converter." },
        { title: "Variações & entrega", text: "Versões por canal e por gancho, prontas pro gerenciador." },
      ],
      packages: [
        { name: "Essencial", price: "R$ 2.600", features: ["1 Storytelling Commercial (30-45s)", "4 cortes para ads", "Versões vertical + horizontal", "Color grading + trilha", "2 rodadas de revisão", "Entrega em até 7 dias úteis"] },
        { name: "Performance", price: "R$ 3.800", features: ["1 Storytelling Commercial principal (35-50s)", "6 cortes otimizados para performance", "Versões 9:16, 1:1 e 16:9", "2 variações de hook", "Color grading + sound design", "2 rodadas de revisão", "Entrega em até 10 dias úteis"], featured: true, badge: "Mais escolhido" },
        { name: "Completo", price: "R$ 5.400", features: ["1 Storytelling Commercial principal (40-60s)", "8 cortes para ads", "Todas as proporções (9:16, 1:1 e 16:9)", "3 variações de hook", "Color grading avançado + sound design", "Versão para site e anúncios", "3 rodadas de revisão", "Entrega em até 12 dias úteis"] },
      ],
      gallery: gallery("storytelling"),
    },
    {
      id: "corporate", label: "Corporate Film",
      tagline: "Vídeos institucionais limpos e profissionais para empresas.",
      videoSrc: VIDEO.corporate, poster: poster("corporate"),
      description: "Filmes institucionais com tom corporativo e autoridade, para site, LinkedIn e apresentações. A cara séria e confiável da sua empresa, sem parecer engessado.",
      process: [
        { title: "Briefing & mensagem", text: "A mensagem central, o público e o objetivo do filme." },
        { title: "Roteiro institucional", text: "Um roteiro claro e crível, na voz da sua empresa." },
        { title: "Produção", text: "As cenas produzidas na direção aprovada." },
        { title: "Color & som", text: "Montagem, color grading e sound design." },
        { title: "Versões & entrega", text: "Cortes para site, LinkedIn e anúncios." },
      ],
      packages: [
        { name: "Corporate Essencial", price: "R$ 2.200", features: ["1 filme institucional (60-75s)", "3 versões curtas", "Versão para site + LinkedIn", "Color grading + trilha", "2 rodadas de revisão", "Entrega em até 8 dias úteis"] },
        { name: "Corporate Performance", price: "R$ 3.400", features: ["1 filme institucional principal (70-90s)", "5 versões curtas", "Versões 16:9 + 9:16", "Versão específica para LinkedIn e site", "Color grading + sound design", "2 rodadas de revisão", "Entrega em até 10 dias úteis"], featured: true, badge: "Recomendado" },
        { name: "Corporate Completo", price: "R$ 4.900", features: ["1 filme institucional principal (80-100s)", "1 versão mais cinematográfica", "7 versões curtas", "Todas as proporções (16:9, 9:16 e 1:1)", "Versões para site, LinkedIn e anúncios", "Color grading avançado + sound design", "3 rodadas de revisão", "Entrega em até 12 dias úteis"] },
      ],
      gallery: gallery("corporate"),
    },
    {
      id: "cloning", label: "Cloning",
      tagline: "Clonamos seu rosto e sua voz presencialmente e transformamos em vídeos ilimitados, sem você precisar gravar de novo.",
      videoSrc: VIDEO.cloning, poster: poster("cloning"),
      description: "Cansado de depender de uma gravação toda vez que precisa de um vídeo novo? O Cloning cria um gêmeo digital seu, rosto e voz, com fidelidade absoluta. A clonagem é feita 100% presencialmente, no nosso estúdio, porque é a única forma de capturar cada detalhe da sua expressão, do seu timbre e da sua entonação com a precisão que o resultado final exige. Depois do setup, você tem um avatar que fala qualquer roteiro, em quantos vídeos você precisar, com a sua cara e a sua voz de verdade.",
      process: [
        { title: "Captura presencial", text: "Uma sessão dedicada no estúdio pra registrar seu rosto e sua voz em alta fidelidade." },
        { title: "Clonagem & calibração", text: "Construímos seu gêmeo digital e ajustamos expressão, timbre e entonação." },
        { title: "Testes de qualidade", text: "Comparações lado a lado até o avatar ficar indistinguível de você." },
        { title: "Do roteiro ao vídeo", text: "Você manda o roteiro, a gente gera o vídeo com o seu rosto e a sua voz." },
        { title: "Cortes & entrega", text: "Cortes vertical e horizontal, legendas e trilha pra cada canal." },
      ],
      packages: [
        { name: "Setup de Clonagem", price: "R$ 3.500", description: "Pagamento único", features: ["Clonagem de rosto em alta fidelidade", "Clonagem de voz (timbre e entonação)", "Sessão presencial de captura no estúdio", "Calibração e testes de qualidade", "Seu avatar pronto pra produzir"] },
        { name: "Vídeos", price: "Sob consulta", description: "Por demanda", features: ["Quantidade definida por projeto, do avulso ao mensal", "Qualquer roteiro, no seu rosto e na sua voz", "Cortes vertical e horizontal", "Legendas e trilha", "Preço por volume: quanto mais vídeos, melhor o valor"], featured: true, badge: "Recorrente" },
      ],
      packagesNote: "Exclusivo para clientes de São José dos Campos, São Paulo e Jundiaí. A clonagem é feita presencialmente para garantir máxima precisão e qualidade.",
      gallery: gallery("cloning"),
    },
    {
      id: "websites", label: "Websites",
      tagline: "Sites e landing pages de alta conversão, com capricho de estúdio de verdade.",
      videoSrc: VIDEO.websites, poster: poster("websites"),
      description: "Cansado de sites que parecem genéricos, carregam devagar ou não convertem? Este é pra marcas que querem uma presença online limpa, moderna e profissional, feita pra parecer premium e gerar resultado de verdade. Criamos sites e landing pages com identidade visual forte, estrutura clara e foco em conversão. No mesmo padrão de qualidade dos nossos Brand Films e Commercials.",
      process: [
        { title: "Briefing & arquitetura", text: "Objetivo, público e a jornada que converte." },
        { title: "Design", text: "A sua marca aplicada a uma interface clara e desejável." },
        { title: "Desenvolvimento", text: "Rápido, responsivo e leve." },
        { title: "Conteúdo & SEO", text: "Textos que vendem e otimização on-page." },
        { title: "Publicação", text: "No ar com domínio, analytics e tudo medindo." },
      ],
      packages: [
        { name: "Site Essencial", price: "R$ 1.900", features: ["Landing page ou site de 1 página", "Design moderno e responsivo", "Integração com WhatsApp / formulário", "Otimização básica de velocidade", "2 rodadas de revisão", "Entrega em até 8 dias úteis"] },
        { name: "Site Performance", price: "R$ 3.200", features: ["Site institucional (até 5 páginas)", "Design alinhado com identidade visual", "Seção de vídeo (Brand Film / Commercial)", "Formulário + WhatsApp + CTAs fortes", "Responsivo + otimização de velocidade", "2 rodadas de revisão", "Entrega em até 12 dias úteis"], featured: true, badge: "Recomendado" },
        { name: "Site Completo", price: "R$ 4.800", features: ["Site completo (até 8 páginas)", "Design premium + animações leves", "Integração de Brand Film / Commercial", "Seção de cases ou portfólio", "Formulários avançados + WhatsApp", "Otimização de velocidade e SEO básico", "3 rodadas de revisão", "Entrega em até 15 dias úteis"] },
      ],
      gallery: gallery("websites"),
    },
  ],
  contact: {
    headline: "Vamos falar sobre o seu projeto.",
    sub: "Preencha o formulário abaixo e um especialista responde em até 2 horas (horário comercial: seg a sex, 8h às 20h).",
    email: EMAIL, phone: PHONE, socials: SOCIALS, micro: "Resposta humana",
    form: {
      fields: [
        { name: "firstName", label: "Nome", type: "text", placeholder: "Nome", required: true, half: true },
        { name: "lastName", label: "Sobrenome", type: "text", placeholder: "Sobrenome", required: true, half: true },
        { name: "company", label: "Empresa", type: "text", placeholder: "Nome da empresa", required: true, half: true },
        { name: "phone", label: "Telefone", type: "text", placeholder: "Telefone / WhatsApp", half: true },
        { name: "email", label: "Email de trabalho", type: "email", placeholder: "voce@empresa.com", required: true },
        { name: "format", label: "Qual formato?", type: "select", required: true, options: ["Brand Film", "Storytelling Commercial", "Corporate Film", "Cloning", "Websites", "Ainda não sei"] },
        { name: "size", label: "Tamanho da empresa", type: "select", options: ["1-9", "10-49", "50-199", "200+"] },
        { name: "overview", label: "Sobre o seu projeto", type: "textarea", placeholder: "Conte o objetivo, o prazo e referências", required: true },
        { name: "source", label: "Como você nos conheceu?", type: "select", options: ["LinkedIn", "Instagram", "Google", "Indicação", "Outro"] },
      ],
      submitLabel: "Enviar",
      successMessage: "Recebido. Um especialista responde em breve.",
    },
  },
  footer: [
    "Modely © 2026 · Estúdio de produção de anúncios com IA · CNPJ [seu]",
    "Produção assistida por IA. Direção criativa e QC humanos.",
  ],
};

export const content: Record<Locale, SiteContent> = { en, pt };

/** Idioma default pro primeiro paint (SSR-safe). O real vem do navegador/toggle. */
export const DEFAULT_LOCALE: Locale = "en";

export const CONTACT_OVERLAY = "contact";
export const NAV_OVERLAY = "nav";
export const ABOUT_OVERLAY = "about";
