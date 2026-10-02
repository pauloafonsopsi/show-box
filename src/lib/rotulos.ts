import type { TomStatus } from "@/design/palco";

export const STATUS_EVENTO: Record<string, { texto: string; tom: TomStatus }> = {
  rascunho: { texto: "Rascunho", tom: "neutro" },
  em_venda: { texto: "Em venda", tom: "sucesso" },
  encerrado: { texto: "Encerrado", tom: "aviso" },
};

export const TIPO_JANELA: Record<string, string> = {
  quebra_nozes: "Quebra-Nozes",
  presencial: "Recepção",
  online_familias: "Link das famílias",
  publico: "Público",
  retirada: "Retirada de ingressos",
};

export const TIPO_PRECO: Record<string, string> = {
  unico: "Valor único",
  inteira: "Inteira",
  meia: "Meia",
};

export const PAPEL: Record<string, string> = {
  admin: "Administrador",
  bilheteria: "Bilheteria",
  porta: "Porta",
};

export const TABELA: Record<string, string> = {
  user_roles: "Papéis da equipe",
  configuracoes: "Configurações",
  locais: "Locais",
  mapas: "Mapas",
  setores: "Setores",
  eventos: "Eventos",
  sessoes: "Sessões",
  periodos_preco: "Períodos de preço",
  precos: "Preços",
  janelas: "Calendário",
  familias: "Famílias",
  bailarinas: "Bailarinas",
  produtos: "Adicionais",
  lotes: "Lotes",
  produto_datas: "Dias de ensaio",
  conteudos: "Textos",
};

export const ACAO: Record<string, string> = { insert: "Criou", update: "Alterou", delete: "Apagou" };
