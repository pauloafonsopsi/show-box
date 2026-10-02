export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assentos: {
        Row: {
          acessivel: boolean
          bloqueio_motivo: string | null
          coluna: number
          id: string
          linha: number
          numero: number
          reserva_id: string | null
          reservado_ate: string | null
          rotulo_fila: string | null
          sessao_id: string
          setor_id: string
          status: string
        }
        Insert: {
          acessivel?: boolean
          bloqueio_motivo?: string | null
          coluna: number
          id?: string
          linha: number
          numero: number
          reserva_id?: string | null
          reservado_ate?: string | null
          rotulo_fila?: string | null
          sessao_id: string
          setor_id: string
          status?: string
        }
        Update: {
          acessivel?: boolean
          bloqueio_motivo?: string | null
          coluna?: number
          id?: string
          linha?: number
          numero?: number
          reserva_id?: string | null
          reservado_ate?: string | null
          rotulo_fila?: string | null
          sessao_id?: string
          setor_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assentos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assentos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          antes: Json | null
          depois: Json | null
          em: string
          id: number
          quem: string | null
          registro_id: string | null
          tabela: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          depois?: Json | null
          em?: string
          id?: number
          quem?: string | null
          registro_id?: string | null
          tabela: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          depois?: Json | null
          em?: string
          id?: number
          quem?: string | null
          registro_id?: string | null
          tabela?: string
        }
        Relationships: []
      }
      bailarinas: {
        Row: {
          ativa: boolean
          conferir: boolean
          criado_em: string
          evento_id: string
          familia_id: string
          id: string
          nome: string
          nome_busca: string
          origem: string
          pacote: string | null
          turma: string | null
        }
        Insert: {
          ativa?: boolean
          conferir?: boolean
          criado_em?: string
          evento_id: string
          familia_id: string
          id?: string
          nome: string
          nome_busca: string
          origem?: string
          pacote?: string | null
          turma?: string | null
        }
        Update: {
          ativa?: boolean
          conferir?: boolean
          criado_em?: string
          evento_id?: string
          familia_id?: string
          id?: string
          nome?: string
          nome_busca?: string
          origem?: string
          pacote?: string | null
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bailarinas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bailarinas_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          chave: string
          explicacao: string | null
          ordem: number
          rotulo: string
          tipo: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          explicacao?: string | null
          ordem?: number
          rotulo: string
          tipo: string
          valor: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          explicacao?: string | null
          ordem?: number
          rotulo?: string
          tipo?: string
          valor?: Json
        }
        Relationships: []
      }
      conteudos: {
        Row: {
          atualizado_em: string
          chave: string
          evento_id: string | null
          id: string
          rotulo: string
          texto: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          evento_id?: string | null
          id?: string
          rotulo: string
          texto: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          evento_id?: string | null
          id?: string
          rotulo?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      desistencias: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          estornada_em: string | null
          id: string
          motivo: string | null
          pedido_id: string
          solicitada_em: string
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          estornada_em?: string | null
          id?: string
          motivo?: string | null
          pedido_id: string
          solicitada_em?: string
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          estornada_em?: string | null
          id?: string
          motivo?: string | null
          pedido_id?: string
          solicitada_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "desistencias_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      escalacao: {
        Row: {
          bailarina_id: string
          sessao_id: string
        }
        Insert: {
          bailarina_id: string
          sessao_id: string
        }
        Update: {
          bailarina_id?: string
          sessao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalacao_bailarina_id_fkey"
            columns: ["bailarina_id"]
            isOneToOne: false
            referencedRelation: "bailarinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalacao_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      estoques: {
        Row: {
          evento_id: string
          id: string
          nome: string
        }
        Insert: {
          evento_id: string
          id?: string
          nome: string
        }
        Update: {
          evento_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoques_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          atualizado_em: string
          cota_por_participante: number | null
          criado_em: string
          id: string
          imagem_capa: string | null
          limite_por_pedido: number
          meia_categorias: Json
          meia_percentual: number
          nome: string
          parcelamento_min_ingressos: number
          parcelas_max: number
          slug: string
          status: string
          tema: string
          tempo_reserva_min: number
        }
        Insert: {
          atualizado_em?: string
          cota_por_participante?: number | null
          criado_em?: string
          id?: string
          imagem_capa?: string | null
          limite_por_pedido?: number
          meia_categorias?: Json
          meia_percentual?: number
          nome: string
          parcelamento_min_ingressos?: number
          parcelas_max?: number
          slug: string
          status?: string
          tema?: string
          tempo_reserva_min?: number
        }
        Update: {
          atualizado_em?: string
          cota_por_participante?: number | null
          criado_em?: string
          id?: string
          imagem_capa?: string | null
          limite_por_pedido?: number
          meia_categorias?: Json
          meia_percentual?: number
          nome?: string
          parcelamento_min_ingressos?: number
          parcelas_max?: number
          slug?: string
          status?: string
          tema?: string
          tempo_reserva_min?: number
        }
        Relationships: []
      }
      eventos_pagamento: {
        Row: {
          evento_gateway_id: string
          id: number
          payload: Json
          recebido_em: string
          resultado: string | null
          tipo: string | null
        }
        Insert: {
          evento_gateway_id: string
          id?: number
          payload: Json
          recebido_em?: string
          resultado?: string | null
          tipo?: string | null
        }
        Update: {
          evento_gateway_id?: string
          id?: number
          payload?: Json
          recebido_em?: string
          resultado?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      familia_links: {
        Row: {
          enviado_em: string | null
          enviado_por: string | null
          familia_id: string
          gerado_em: string
          gerado_por: string | null
          token: string
        }
        Insert: {
          enviado_em?: string | null
          enviado_por?: string | null
          familia_id: string
          gerado_em?: string
          gerado_por?: string | null
          token: string
        }
        Update: {
          enviado_em?: string | null
          enviado_por?: string | null
          familia_id?: string
          gerado_em?: string
          gerado_por?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_links_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: true
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      familias: {
        Row: {
          ativa: boolean
          criado_em: string
          evento_id: string
          id: string
          responsavel_nome: string
          whatsapp: string
        }
        Insert: {
          ativa?: boolean
          criado_em?: string
          evento_id: string
          id?: string
          responsavel_nome: string
          whatsapp: string
        }
        Update: {
          ativa?: boolean
          criado_em?: string
          evento_id?: string
          id?: string
          responsavel_nome?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "familias_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_caixa: {
        Row: {
          atendente_id: string
          criado_em: string
          data: string
          diferenca_centavos: number
          evento_id: string
          id: string
          observacao: string | null
          totais_conferidos: Json
          totais_sistema: Json
        }
        Insert: {
          atendente_id: string
          criado_em?: string
          data: string
          diferenca_centavos: number
          evento_id: string
          id?: string
          observacao?: string | null
          totais_conferidos: Json
          totais_sistema: Json
        }
        Update: {
          atendente_id?: string
          criado_em?: string
          data?: string
          diferenca_centavos?: number
          evento_id?: string
          id?: string
          observacao?: string | null
          totais_conferidos?: Json
          totais_sistema?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_caixa_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          arquivo: string | null
          em: string
          evento_id: string
          id: string
          por: string | null
          resumo: Json
          status: string
        }
        Insert: {
          arquivo?: string | null
          em?: string
          evento_id: string
          id?: string
          por?: string | null
          resumo: Json
          status: string
        }
        Update: {
          arquivo?: string | null
          em?: string
          evento_id?: string
          id?: string
          por?: string | null
          resumo?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      ingressos: {
        Row: {
          assento_id: string
          categoria_meia: string | null
          criado_em: string
          entregue_em: string | null
          entregue_por: string | null
          id: string
          pedido_id: string
          qr_token: string
          sessao_id: string
          status: string
          tipo: string
          usado_em: string | null
          valor_centavos: number
        }
        Insert: {
          assento_id: string
          categoria_meia?: string | null
          criado_em?: string
          entregue_em?: string | null
          entregue_por?: string | null
          id?: string
          pedido_id: string
          qr_token?: string
          sessao_id: string
          status?: string
          tipo: string
          usado_em?: string | null
          valor_centavos: number
        }
        Update: {
          assento_id?: string
          categoria_meia?: string | null
          criado_em?: string
          entregue_em?: string | null
          entregue_por?: string | null
          id?: string
          pedido_id?: string
          qr_token?: string
          sessao_id?: string
          status?: string
          tipo?: string
          usado_em?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingressos_assento_id_fkey"
            columns: ["assento_id"]
            isOneToOne: false
            referencedRelation: "assentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingressos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingressos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      janelas: {
        Row: {
          evento_id: string
          fim: string | null
          id: string
          inicio: string
          observacao: string | null
          tipo: string
        }
        Insert: {
          evento_id: string
          fim?: string | null
          id?: string
          inicio: string
          observacao?: string | null
          tipo: string
        }
        Update: {
          evento_id?: string
          fim?: string | null
          id?: string
          inicio?: string
          observacao?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "janelas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      locais: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          endereco: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      lotes: {
        Row: {
          aberto: boolean
          estoque_id: string
          id: string
          numero: number
          quantidade: number
        }
        Insert: {
          aberto?: boolean
          estoque_id: string
          id?: string
          numero: number
          quantidade: number
        }
        Update: {
          aberto?: boolean
          estoque_id?: string
          id?: string
          numero?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "lotes_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_celulas: {
        Row: {
          acessivel: boolean
          bloqueado_padrao: boolean
          coluna: number
          id: string
          linha: number
          mapa_id: string
          numero: number | null
          rotulo_fila: string | null
          setor_id: string | null
          tipo: string
        }
        Insert: {
          acessivel?: boolean
          bloqueado_padrao?: boolean
          coluna: number
          id?: string
          linha: number
          mapa_id: string
          numero?: number | null
          rotulo_fila?: string | null
          setor_id?: string | null
          tipo: string
        }
        Update: {
          acessivel?: boolean
          bloqueado_padrao?: boolean
          coluna?: number
          id?: string
          linha?: number
          mapa_id?: string
          numero?: number | null
          rotulo_fila?: string | null
          setor_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapa_celulas_mapa_id_fkey"
            columns: ["mapa_id"]
            isOneToOne: false
            referencedRelation: "mapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_celulas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      mapas: {
        Row: {
          atualizado_em: string
          colunas: number
          criado_em: string
          filas: number
          id: string
          local_id: string
          nome: string
          regra_numeracao: string
          status: string
        }
        Insert: {
          atualizado_em?: string
          colunas: number
          criado_em?: string
          filas: number
          id?: string
          local_id: string
          nome: string
          regra_numeracao?: string
          status?: string
        }
        Update: {
          atualizado_em?: string
          colunas?: number
          criado_em?: string
          filas?: number
          id?: string
          local_id?: string
          nome?: string
          regra_numeracao?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapas_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          bailarina_id: string | null
          id: string
          lote_id: string | null
          pedido_id: string
          produto_data_id: string | null
          produto_id: string
          quantidade: number
          sessao_entrega_id: string | null
          valor_unitario_centavos: number
        }
        Insert: {
          bailarina_id?: string | null
          id?: string
          lote_id?: string | null
          pedido_id: string
          produto_data_id?: string | null
          produto_id: string
          quantidade: number
          sessao_entrega_id?: string | null
          valor_unitario_centavos: number
        }
        Update: {
          bailarina_id?: string | null
          id?: string
          lote_id?: string | null
          pedido_id?: string
          produto_data_id?: string | null
          produto_id?: string
          quantidade?: number
          sessao_entrega_id?: string | null
          valor_unitario_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_bailarina_id_fkey"
            columns: ["bailarina_id"]
            isOneToOne: false
            referencedRelation: "bailarinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_data_id_fkey"
            columns: ["produto_data_id"]
            isOneToOne: false
            referencedRelation: "produto_datas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_sessao_entrega_id_fkey"
            columns: ["sessao_entrega_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          aceite_em: string | null
          aceite_ip: unknown
          acesso_token: string
          atendente_id: string | null
          canal: string
          codigo: string
          criado_em: string
          evento_id: string
          expira_em: string | null
          familia_id: string | null
          forma_pagamento: string | null
          id: string
          ingressos_previstos: Json
          motivo: string | null
          pagador_celular: string | null
          pagador_cpf: string | null
          pagador_email: string | null
          pagador_nome: string | null
          pagarme_charge_id: string | null
          pagarme_order_id: string | null
          pagarme_pedidos: Json
          pago_em: string | null
          parcelas: number
          status: string
          termos_versao_id: string | null
          valor_recebido_centavos: number | null
          valor_total_centavos: number
        }
        Insert: {
          aceite_em?: string | null
          aceite_ip?: unknown
          acesso_token?: string
          atendente_id?: string | null
          canal: string
          codigo?: string
          criado_em?: string
          evento_id: string
          expira_em?: string | null
          familia_id?: string | null
          forma_pagamento?: string | null
          id?: string
          ingressos_previstos?: Json
          motivo?: string | null
          pagador_celular?: string | null
          pagador_cpf?: string | null
          pagador_email?: string | null
          pagador_nome?: string | null
          pagarme_charge_id?: string | null
          pagarme_order_id?: string | null
          pagarme_pedidos?: Json
          pago_em?: string | null
          parcelas?: number
          status?: string
          termos_versao_id?: string | null
          valor_recebido_centavos?: number | null
          valor_total_centavos?: number
        }
        Update: {
          aceite_em?: string | null
          aceite_ip?: unknown
          acesso_token?: string
          atendente_id?: string | null
          canal?: string
          codigo?: string
          criado_em?: string
          evento_id?: string
          expira_em?: string | null
          familia_id?: string | null
          forma_pagamento?: string | null
          id?: string
          ingressos_previstos?: Json
          motivo?: string | null
          pagador_celular?: string | null
          pagador_cpf?: string | null
          pagador_email?: string | null
          pagador_nome?: string | null
          pagarme_charge_id?: string | null
          pagarme_order_id?: string | null
          pagarme_pedidos?: Json
          pago_em?: string | null
          parcelas?: number
          status?: string
          termos_versao_id?: string | null
          valor_recebido_centavos?: number | null
          valor_total_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_termos_versao_id_fkey"
            columns: ["termos_versao_id"]
            isOneToOne: false
            referencedRelation: "termos_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos_preco: {
        Row: {
          evento_id: string
          fim: string
          id: string
          inicio: string
          modo: string
          nome: string
          rotulo_unico: string
        }
        Insert: {
          evento_id: string
          fim: string
          id?: string
          inicio: string
          modo: string
          nome: string
          rotulo_unico?: string
        }
        Update: {
          evento_id?: string
          fim?: string
          id?: string
          inicio?: string
          modo?: string
          nome?: string
          rotulo_unico?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodos_preco_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      precos: {
        Row: {
          id: string
          periodo_id: string
          setor_id: string
          tipo: string
          valor_centavos: number
        }
        Insert: {
          id?: string
          periodo_id: string
          setor_id: string
          tipo: string
          valor_centavos: number
        }
        Update: {
          id?: string
          periodo_id?: string
          setor_id?: string
          tipo?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "precos_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos_preco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_datas: {
        Row: {
          ativa: boolean
          data: string | null
          id: string
          produto_id: string
          reservas_internas: number
          vagas: number
        }
        Insert: {
          ativa?: boolean
          data?: string | null
          id?: string
          produto_id: string
          reservas_internas?: number
          vagas: number
        }
        Update: {
          ativa?: boolean
          data?: string | null
          id?: string
          produto_id?: string
          reservas_internas?: number
          vagas?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_datas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_estoque: {
        Row: {
          estoque_id: string
          produto_id: string
          quantidade: number
        }
        Insert: {
          estoque_id: string
          produto_id: string
          quantidade?: number
        }
        Update: {
          estoque_id?: string
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_estoque_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          descricao: string | null
          entrega: string
          evento_id: string
          foto_url: string | null
          id: string
          nome: string
          ordem: number
          preco_antecipado_centavos: number | null
          preco_cheio_centavos: number | null
          venda_online_ate: string | null
        }
        Insert: {
          ativo?: boolean
          descricao?: string | null
          entrega?: string
          evento_id: string
          foto_url?: string | null
          id?: string
          nome: string
          ordem?: number
          preco_antecipado_centavos?: number | null
          preco_cheio_centavos?: number | null
          venda_online_ate?: string | null
        }
        Update: {
          ativo?: boolean
          descricao?: string | null
          entrega?: string
          evento_id?: string
          foto_url?: string | null
          id?: string
          nome?: string
          ordem?: number
          preco_antecipado_centavos?: number | null
          preco_cheio_centavos?: number | null
          venda_online_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          abertura_portas: string | null
          ativa: boolean
          atualizado_em: string
          data_hora: string | null
          evento_id: string
          id: string
          mapa_congelado_em: string | null
          mapa_id: string | null
          nome: string
          ordem: number
        }
        Insert: {
          abertura_portas?: string | null
          ativa?: boolean
          atualizado_em?: string
          data_hora?: string | null
          evento_id: string
          id?: string
          mapa_congelado_em?: string | null
          mapa_id?: string | null
          nome: string
          ordem?: number
        }
        Update: {
          abertura_portas?: string | null
          ativa?: boolean
          atualizado_em?: string
          data_hora?: string | null
          evento_id?: string
          id?: string
          mapa_congelado_em?: string | null
          mapa_id?: string | null
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_mapa_id_fkey"
            columns: ["mapa_id"]
            isOneToOne: false
            referencedRelation: "mapas"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          cor: string
          id: string
          mapa_id: string
          nome: string
          ordem: number
        }
        Insert: {
          cor: string
          id?: string
          mapa_id: string
          nome: string
          ordem?: number
        }
        Update: {
          cor?: string
          id?: string
          mapa_id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "setores_mapa_id_fkey"
            columns: ["mapa_id"]
            isOneToOne: false
            referencedRelation: "mapas"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_versoes: {
        Row: {
          evento_id: string | null
          hash: string
          id: string
          publicada_em: string
          publicada_por: string | null
          texto: string
          tipo: string
          versao: number
        }
        Insert: {
          evento_id?: string | null
          hash: string
          id?: string
          publicada_em?: string
          publicada_por?: string | null
          texto: string
          tipo: string
          versao: number
        }
        Update: {
          evento_id?: string | null
          hash?: string
          id?: string
          publicada_em?: string
          publicada_por?: string | null
          texto?: string
          tipo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "termos_versoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _compor: {
        Args: {
          p_adicionais: Json
          p_ingressos: Json
          p_pedido: string
          p_presencial: boolean
        }
        Returns: Json
      }
      _congelar_mapa: { Args: { p_sessao: string }; Returns: number }
      _eh_servidor: { Args: never; Returns: boolean }
      _exigir_equipe: { Args: never; Returns: undefined }
      _exigir_servidor: { Args: never; Returns: undefined }
      _finalizar: { Args: { p_pedido: string }; Returns: Json }
      _janela_aberta: {
        Args: { p_evento: string; p_tipo: string }
        Returns: boolean
      }
      _liberar: {
        Args: { p_pedido: string; p_status: string }
        Returns: undefined
      }
      _liberar_lugares_da_sessao: {
        Args: { p_pedido: string; p_sessao: string }
        Returns: undefined
      }
      _lugares_do_pedido: {
        Args: { p_pedido: string }
        Returns: {
          assento_id: string
          numero: number
          sessao_id: string
          setor_id: string
        }[]
      }
      _modo_preco: {
        Args: { p_evento: string; p_quando?: string }
        Returns: string
      }
      _pedido_por_acesso: { Args: { p_acesso: string }; Returns: string }
      _preco: {
        Args: {
          p_evento: string
          p_quando?: string
          p_setor: string
          p_tipo: string
        }
        Returns: number
      }
      _reservar: {
        Args: {
          p_atendente: string
          p_canal: string
          p_familia: string
          p_numeros: number[]
          p_pedido: string
          p_sessao: string
        }
        Returns: Json
      }
      _validar_parcelas: {
        Args: { p_forma: string; p_parcelas: number; p_pedido: string }
        Returns: undefined
      }
      abrir_proximo_lote: { Args: { p_estoque: string }; Returns: number }
      apagar_contatos: { Args: never; Returns: number }
      aprovar_desistencia: { Args: { p_pedido: string }; Returns: Json }
      bloquear_lugares: {
        Args: {
          p_bloquear: boolean
          p_motivo?: string
          p_numeros: number[]
          p_sessao: string
        }
        Returns: number
      }
      buscar_para_retirada: { Args: { p_codigo: string }; Returns: Json }
      caixa_do_dia: {
        Args: { p_atendente?: string; p_data: string; p_evento: string }
        Returns: Json
      }
      cancelar_venda: {
        Args: { p_motivo: string; p_pedido: string }
        Returns: undefined
      }
      concluir_estorno: { Args: { p_pedido: string }; Returns: undefined }
      congelar_mapa_da_sessao: { Args: { p_sessao: string }; Returns: number }
      definir_escalacao: {
        Args: { p_bailarina: string; p_sessoes: string[] }
        Returns: number
      }
      emitir_cortesia: {
        Args: {
          p_familia?: string
          p_motivo: string
          p_numeros: number[]
          p_sessao: string
        }
        Returns: Json
      }
      estoque_disponivel: { Args: { p_estoque: string }; Returns: number }
      existe_admin: { Args: never; Returns: boolean }
      expirar_reservas: { Args: never; Returns: number }
      familia_painel: { Args: { p_token: string }; Returns: Json }
      fechar_pedido_online: {
        Args: {
          p_acesso: string
          p_adicionais: Json
          p_forma: string
          p_ingressos: Json
          p_ip?: string
          p_pagador: Json
          p_parcelas: number
          p_termos_versao: string
        }
        Returns: Json
      }
      finalizar_pedido_pago: {
        Args: { p_pagarme_order_id: string }
        Returns: Json
      }
      gerar_link_familia: { Args: { p_familia: string }; Returns: string }
      gerar_links_do_evento: { Args: { p_evento: string }; Returns: number }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      importar_planilha: {
        Args: {
          p_arquivo?: string
          p_evento: string
          p_gravar: boolean
          p_linhas: Json
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_equipe: { Args: never; Returns: boolean }
      liberar_reserva: { Args: { p_pedido: string }; Returns: undefined }
      liberar_reserva_online: { Args: { p_acesso: string }; Returns: undefined }
      mapa_da_sessao: { Args: { p_sessao: string }; Returns: Json }
      marcar_entregues: {
        Args: { p_entregue?: boolean; p_ingressos: string[] }
        Returns: number
      }
      marcar_link_enviado: {
        Args: { p_enviado?: boolean; p_familia: string }
        Returns: undefined
      }
      marcar_pagamento_falhou: {
        Args: { p_pagarme_order_id: string }
        Returns: undefined
      }
      meias_disponiveis: { Args: { p_sessao: string }; Returns: number }
      normalizar_texto: { Args: { p: string }; Returns: string }
      normalizar_whatsapp: { Args: { p: string }; Returns: string }
      novo_codigo: { Args: { p_bytes?: number }; Returns: string }
      pedido_publico: { Args: { p_acesso: string }; Returns: Json }
      previa_pedido: {
        Args: { p_adicionais: Json; p_ingressos: Json; p_pedido: string }
        Returns: Json
      }
      primeiro_nome: { Args: { p: string }; Returns: string }
      registrar_evento_pagamento: {
        Args: { p_evento_id: string; p_payload: Json; p_tipo: string }
        Returns: boolean
      }
      registrar_pagarme: {
        Args: { p_acesso: string; p_charge_id: string; p_order_id: string }
        Returns: undefined
      }
      registrar_venda_presencial: {
        Args: {
          p_adicionais: Json
          p_forma: string
          p_ingressos: Json
          p_parcelas?: number
          p_pedido: string
          p_valor_recebido_centavos?: number
        }
        Returns: Json
      }
      reivindicar_admin: { Args: never; Returns: undefined }
      reservar_online: {
        Args: {
          p_acesso_pedido?: string
          p_numeros: number[]
          p_sessao: string
          p_token_familia?: string
        }
        Returns: Json
      }
      reservar_presencial: {
        Args: {
          p_familia?: string
          p_numeros: number[]
          p_pedido?: string
          p_sessao: string
        }
        Returns: Json
      }
      resultado_evento_pagamento: {
        Args: { p_evento_id: string; p_resultado: string }
        Returns: undefined
      }
      saldo_familia: {
        Args: { p_familia: string; p_sessao: string }
        Returns: number
      }
      saldos_do_evento: {
        Args: { p_evento: string }
        Returns: {
          cota: number
          escaladas: number
          familia_id: string
          saldo: number
          sessao_id: string
          usados: number
        }[]
      }
      salvar_mapa: {
        Args: {
          p_celulas: Json
          p_colunas: number
          p_filas: number
          p_mapa: string
        }
        Returns: Json
      }
      solicitar_desistencia: {
        Args: { p_acesso: string; p_motivo?: string }
        Returns: undefined
      }
      trocar_lugar: {
        Args: { p_ingresso: string; p_motivo?: string; p_novo_numero: number }
        Returns: Json
      }
      vagas_disponiveis: { Args: { p_produto_data: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
