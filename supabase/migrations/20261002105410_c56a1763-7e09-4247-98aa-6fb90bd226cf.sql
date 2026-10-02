-- =====================================================================
-- Bilheteria de espetáculos: fundação (Bloco 1)
-- Escrito pelo Claude. Aplicar exatamente como está.
-- Conteúdo: extensões, tabelas multi-evento, papéis, auditoria,
-- regras de acesso (RLS) e funções do Bloco 1.
-- Funções de reserva, pagamento e agendamentos entram no Bloco 2.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------

create or replace function public.normalizar_texto(p text)
returns text language sql stable
set search_path = public, extensions
as $$
  select nullif(lower(extensions.unaccent(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'))), '')
$$;

-- Celular brasileiro em formato 55 + DDD + 9 dígitos. Devolve null se inválido.
-- Número de 8 dígitos começando com 6 a 9 ganha o nono dígito.
create or replace function public.normalizar_whatsapp(p text)
returns text language plpgsql immutable
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  d := regexp_replace(d, '^0+', '');
  if length(d) in (10, 11) then
    d := '55' || d;
  end if;
  if length(d) = 12 and substr(d, 1, 2) = '55' and substr(d, 5, 1) in ('6', '7', '8', '9') then
    d := substr(d, 1, 4) || '9' || substr(d, 5);
  end if;
  if length(d) = 13 and substr(d, 1, 2) = '55' and substr(d, 5, 1) = '9' then
    return d;
  end if;
  return null;
end;
$$;

create or replace function public.novo_codigo(p_bytes int default 24)
returns text language sql volatile
set search_path = public, extensions
as $$
  select translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/=', '-_')
$$;

create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'bilheteria', 'porta')),
  criado_em timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create or replace function public.is_equipe()
returns boolean language sql stable security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'bilheteria')
$$;

-- Primeiro acesso: quem chamar vira admin, desde que ainda não exista nenhum.
create or replace function public.reivindicar_admin()
returns void language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre com sua conta antes de ativar o administrador.';
  end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'Este sistema já tem um administrador.';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
end;
$$;

create or replace function public.existe_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;

create or replace function public.proteger_ultimo_admin()
returns trigger language plpgsql
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'Não é possível remover o último administrador.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger user_roles_ultimo_admin
before update or delete on public.user_roles
for each row execute function public.proteger_ultimo_admin();

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------

create table public.auditoria (
  id bigserial primary key,
  quem uuid,
  acao text not null,
  tabela text not null,
  registro_id text,
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);
create index auditoria_em_idx on public.auditoria (em desc);
create index auditoria_tabela_idx on public.auditoria (tabela, registro_id);

create or replace function public.auditar()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  linha jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.auditoria (quem, acao, tabela, registro_id, antes, depois)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(linha ->> 'id', linha ->> 'chave', linha ->> 'familia_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger auditar_user_roles after insert or update or delete on public.user_roles
for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Configurações globais
-- ---------------------------------------------------------------------

create table public.configuracoes (
  chave text primary key,
  valor jsonb not null,
  tipo text not null check (tipo in ('texto', 'numero', 'moeda', 'booleano', 'data', 'hora')),
  rotulo text not null,
  explicacao text,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);
create trigger configuracoes_tocar before update on public.configuracoes
for each row execute function public.tocar_atualizado_em();
create trigger auditar_configuracoes after insert or update or delete on public.configuracoes
for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Locais, mapas e setores
-- ---------------------------------------------------------------------

create table public.locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.mapas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id) on delete cascade,
  nome text not null,
  colunas int not null check (colunas between 1 and 60),
  filas int not null check (filas between 1 and 40),
  regra_numeracao text not null default 'continua' check (regra_numeracao in ('continua', 'por_fila')),
  status text not null default 'rascunho' check (status in ('rascunho', 'pronto')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index mapas_local_idx on public.mapas (local_id);

create table public.setores (
  id uuid primary key default gen_random_uuid(),
  mapa_id uuid not null references public.mapas(id) on delete cascade,
  nome text not null,
  cor text not null check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ordem int not null default 0,
  unique (mapa_id, nome)
);
create index setores_mapa_idx on public.setores (mapa_id);

create table public.mapa_celulas (
  id uuid primary key default gen_random_uuid(),
  mapa_id uuid not null references public.mapas(id) on delete cascade,
  linha int not null check (linha >= 1),
  coluna int not null check (coluna >= 1),
  tipo text not null check (tipo in ('assento', 'corredor', 'palco')),
  rotulo_fila text,
  numero int check (numero >= 1),
  setor_id uuid references public.setores(id) on delete restrict,
  acessivel boolean not null default false,
  bloqueado_padrao boolean not null default false,
  unique (mapa_id, linha, coluna),
  check (tipo <> 'assento' or (numero is not null and setor_id is not null))
);
create unique index mapa_celulas_numero_uk on public.mapa_celulas (mapa_id, numero) where tipo = 'assento';
create index mapa_celulas_mapa_idx on public.mapa_celulas (mapa_id);

create trigger locais_tocar before update on public.locais for each row execute function public.tocar_atualizado_em();
create trigger mapas_tocar before update on public.mapas for each row execute function public.tocar_atualizado_em();
create trigger auditar_locais after insert or update or delete on public.locais for each row execute function public.auditar();
create trigger auditar_mapas after insert or update or delete on public.mapas for each row execute function public.auditar();
create trigger auditar_setores after insert or update or delete on public.setores for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Eventos e sessões
-- ---------------------------------------------------------------------

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'rascunho' check (status in ('rascunho', 'em_venda', 'encerrado')),
  tema text not null default 'quebra-nozes',
  imagem_capa text,
  cota_por_participante int check (cota_por_participante >= 0),
  limite_por_pedido int not null default 10 check (limite_por_pedido > 0),
  tempo_reserva_min int not null default 15 check (tempo_reserva_min between 5 and 60),
  parcelamento_min_ingressos int not null default 3 check (parcelamento_min_ingressos >= 1),
  parcelas_max int not null default 3 check (parcelas_max between 1 and 12),
  meia_percentual int not null default 40 check (meia_percentual between 0 and 100),
  meia_categorias jsonb not null default '["Estudante", "Pessoa com deficiência", "Acompanhante de pessoa com deficiência", "Jovem de 15 a 29 anos de baixa renda (ID Jovem)", "Pessoa com 60 anos ou mais"]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.sessoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  nome text not null,
  data_hora timestamptz,
  abertura_portas timestamptz,
  mapa_id uuid references public.mapas(id) on delete restrict,
  mapa_congelado_em timestamptz,
  ativa boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);
create index sessoes_evento_idx on public.sessoes (evento_id);

create table public.assentos (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.sessoes(id) on delete cascade,
  setor_id uuid not null references public.setores(id) on delete restrict,
  linha int not null,
  coluna int not null,
  rotulo_fila text,
  numero int not null,
  acessivel boolean not null default false,
  status text not null default 'livre' check (status in ('livre', 'reservado', 'vendido', 'bloqueado')),
  bloqueio_motivo text,
  reservado_ate timestamptz,
  reserva_id uuid,
  unique (sessao_id, numero),
  unique (sessao_id, linha, coluna)
);
create index assentos_sessao_status_idx on public.assentos (sessao_id, status);
create index assentos_reserva_idx on public.assentos (reserva_id) where reserva_id is not null;

create trigger eventos_tocar before update on public.eventos for each row execute function public.tocar_atualizado_em();
create trigger sessoes_tocar before update on public.sessoes for each row execute function public.tocar_atualizado_em();
create trigger auditar_eventos after insert or update or delete on public.eventos for each row execute function public.auditar();
create trigger auditar_sessoes after insert or update or delete on public.sessoes for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Preços e calendário
-- ---------------------------------------------------------------------

create table public.periodos_preco (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  nome text not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  modo text not null check (modo in ('unico', 'inteira_meia')),
  rotulo_unico text not null default 'Meia-entrada para todos',
  check (fim > inicio)
);
create index periodos_evento_idx on public.periodos_preco (evento_id, inicio);

create table public.precos (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.periodos_preco(id) on delete cascade,
  setor_id uuid not null references public.setores(id) on delete cascade,
  tipo text not null check (tipo in ('unico', 'inteira', 'meia')),
  valor_centavos int not null check (valor_centavos >= 0),
  unique (periodo_id, setor_id, tipo)
);

create table public.janelas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  tipo text not null check (tipo in ('quebra_nozes', 'presencial', 'online_familias', 'publico', 'retirada')),
  inicio timestamptz not null,
  fim timestamptz,
  observacao text,
  check (fim is null or fim > inicio)
);
create index janelas_evento_idx on public.janelas (evento_id, tipo);

create trigger auditar_periodos after insert or update or delete on public.periodos_preco for each row execute function public.auditar();
create trigger auditar_precos after insert or update or delete on public.precos for each row execute function public.auditar();
create trigger auditar_janelas after insert or update or delete on public.janelas for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Elenco e famílias
-- ---------------------------------------------------------------------

create table public.familias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  responsavel_nome text not null,
  whatsapp text not null check (whatsapp ~ '^55[0-9]{2}9[0-9]{8}$'),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (evento_id, whatsapp)
);

-- O código do link fica separado: só o admin enxerga.
create table public.familia_links (
  familia_id uuid primary key references public.familias(id) on delete cascade,
  token text not null unique,
  gerado_em timestamptz not null default now(),
  gerado_por uuid,
  enviado_em timestamptz,
  enviado_por uuid
);

create table public.bailarinas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  familia_id uuid not null references public.familias(id) on delete cascade,
  nome text not null,
  nome_busca text not null,
  turma text,
  pacote text,
  origem text not null default 'planilha' check (origem in ('planilha', 'recepcao')),
  conferir boolean not null default false,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (evento_id, nome_busca)
);
create index bailarinas_familia_idx on public.bailarinas (familia_id);
create index bailarinas_busca_trgm on public.bailarinas using gin (nome_busca extensions.gin_trgm_ops);

create or replace function public.bailarinas_nome_busca()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  new.nome_busca := public.normalizar_texto(new.nome);
  return new;
end;
$$;
create trigger bailarinas_busca before insert or update of nome on public.bailarinas
for each row execute function public.bailarinas_nome_busca();

create table public.escalacao (
  bailarina_id uuid not null references public.bailarinas(id) on delete cascade,
  sessao_id uuid not null references public.sessoes(id) on delete cascade,
  primary key (bailarina_id, sessao_id)
);
create index escalacao_sessao_idx on public.escalacao (sessao_id);

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  arquivo text,
  por uuid,
  em timestamptz not null default now(),
  resumo jsonb not null,
  status text not null check (status in ('previa', 'gravada'))
);

create trigger auditar_familias after insert or update or delete on public.familias for each row execute function public.auditar();
create trigger auditar_bailarinas after insert or update or delete on public.bailarinas for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Adicionais, estoques, lotes e dias de ensaio
-- ---------------------------------------------------------------------

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  nome text not null,
  descricao text,
  foto_url text,
  preco_antecipado_centavos int check (preco_antecipado_centavos >= 0),
  preco_cheio_centavos int check (preco_cheio_centavos >= 0),
  venda_online_ate timestamptz,
  entrega text not null default 'na_sessao' check (entrega in ('na_sessao', 'agendada')),
  ativo boolean not null default true,
  ordem int not null default 0,
  check (not ativo or (preco_antecipado_centavos is not null and preco_cheio_centavos is not null))
);
create index produtos_evento_idx on public.produtos (evento_id, ordem);

create table public.estoques (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  nome text not null
);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references public.estoques(id) on delete cascade,
  numero int not null check (numero >= 1),
  quantidade int not null check (quantidade > 0),
  aberto boolean not null default false,
  unique (estoque_id, numero)
);

create table public.produto_estoque (
  produto_id uuid not null references public.produtos(id) on delete cascade,
  estoque_id uuid not null references public.estoques(id) on delete cascade,
  quantidade int not null default 1 check (quantidade > 0),
  primary key (produto_id, estoque_id)
);

create table public.produto_datas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  data date,
  vagas int not null check (vagas >= 0),
  reservas_internas int not null default 0 check (reservas_internas >= 0),
  ativa boolean not null default true,
  check (reservas_internas <= vagas)
);

create trigger auditar_produtos after insert or update or delete on public.produtos for each row execute function public.auditar();
create trigger auditar_lotes after insert or update or delete on public.lotes for each row execute function public.auditar();
create trigger auditar_produto_datas after insert or update or delete on public.produto_datas for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Pedidos e ingressos (usados a partir do Bloco 2)
-- ---------------------------------------------------------------------

create table public.termos_versoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.eventos(id) on delete cascade,
  tipo text not null check (tipo in ('termos', 'privacidade')),
  versao int not null,
  texto text not null,
  hash text not null,
  publicada_em timestamptz not null default now(),
  publicada_por uuid,
  unique nulls not distinct (evento_id, tipo, versao),
  check ((tipo = 'privacidade') = (evento_id is null))
);

create or replace function public.termos_versionar()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  select coalesce(max(versao), 0) + 1 into new.versao
  from public.termos_versoes
  where tipo = new.tipo and evento_id is not distinct from new.evento_id;
  new.hash := encode(extensions.digest(new.texto, 'sha256'), 'hex');
  new.publicada_em := now();
  new.publicada_por := auth.uid();
  return new;
end;
$$;
create trigger termos_versionar before insert on public.termos_versoes
for each row execute function public.termos_versionar();

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  evento_id uuid not null references public.eventos(id) on delete restrict,
  familia_id uuid references public.familias(id) on delete set null,
  canal text not null check (canal in ('presencial', 'online', 'publico', 'cortesia')),
  status text not null default 'reservado' check (status in ('reservado', 'aguardando_pagamento', 'pago', 'pago_sem_lugar', 'cancelado', 'expirado', 'estornado')),
  valor_total_centavos int not null default 0 check (valor_total_centavos >= 0),
  forma_pagamento text check (forma_pagamento in ('pix', 'cartao', 'credito', 'debito', 'dinheiro', 'cortesia')),
  parcelas int not null default 1 check (parcelas between 1 and 12),
  pagarme_order_id text unique,
  pagarme_charge_id text,
  pagador_nome text,
  pagador_cpf text,
  pagador_email text,
  pagador_celular text,
  termos_versao_id uuid references public.termos_versoes(id),
  aceite_em timestamptz,
  aceite_ip inet,
  atendente_id uuid,
  motivo text,
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);
create index pedidos_familia_idx on public.pedidos (familia_id, status);
create index pedidos_evento_idx on public.pedidos (evento_id, criado_em desc);

create table public.ingressos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  sessao_id uuid not null references public.sessoes(id) on delete restrict,
  assento_id uuid not null references public.assentos(id) on delete restrict,
  tipo text not null check (tipo in ('meia_todos', 'inteira', 'meia', 'cortesia')),
  categoria_meia text,
  valor_centavos int not null check (valor_centavos >= 0),
  qr_token text not null unique default public.novo_codigo(18),
  status text not null default 'ativo' check (status in ('ativo', 'cancelado')),
  entregue_em timestamptz,
  entregue_por uuid,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index ingressos_assento_ativo_uk on public.ingressos (assento_id) where status = 'ativo';
create index ingressos_pedido_idx on public.ingressos (pedido_id);
create index ingressos_sessao_idx on public.ingressos (sessao_id, status);

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade int not null check (quantidade > 0),
  valor_unitario_centavos int not null check (valor_unitario_centavos >= 0),
  sessao_entrega_id uuid references public.sessoes(id),
  produto_data_id uuid references public.produto_datas(id),
  lote_id uuid references public.lotes(id),
  bailarina_id uuid references public.bailarinas(id) on delete set null
);
create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id);

create table public.eventos_pagamento (
  id bigserial primary key,
  evento_gateway_id text not null unique,
  tipo text,
  payload jsonb not null,
  recebido_em timestamptz not null default now(),
  resultado text
);

create table public.desistencias (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id) on delete cascade,
  solicitada_em timestamptz not null default now(),
  motivo text,
  aprovada_por uuid,
  aprovada_em timestamptz,
  estornada_em timestamptz
);

create table public.fechamentos_caixa (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  atendente_id uuid not null,
  data date not null,
  totais_sistema jsonb not null,
  totais_conferidos jsonb not null,
  diferenca_centavos int not null,
  observacao text,
  criado_em timestamptz not null default now(),
  unique (evento_id, atendente_id, data)
);

-- ---------------------------------------------------------------------
-- Conteúdos (mensagens e textos das telas)
-- ---------------------------------------------------------------------

create table public.conteudos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.eventos(id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9_]+$'),
  rotulo text not null,
  texto text not null,
  atualizado_em timestamptz not null default now(),
  unique nulls not distinct (evento_id, chave)
);
create trigger conteudos_tocar before update on public.conteudos for each row execute function public.tocar_atualizado_em();
create trigger auditar_conteudos after insert or update or delete on public.conteudos for each row execute function public.auditar();

-- =====================================================================
-- Regras de acesso (RLS): tudo nasce fechado e é liberado por papel.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'user_roles', 'auditoria', 'configuracoes', 'locais', 'mapas', 'setores', 'mapa_celulas',
    'eventos', 'sessoes', 'assentos', 'periodos_preco', 'precos', 'janelas',
    'familias', 'familia_links', 'bailarinas', 'escalacao', 'importacoes',
    'produtos', 'estoques', 'lotes', 'produto_estoque', 'produto_datas',
    'termos_versoes', 'pedidos', 'ingressos', 'pedido_itens', 'eventos_pagamento',
    'desistencias', 'fechamentos_caixa', 'conteudos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Admin: acesso completo às tabelas operacionais.
do $$
declare t text;
begin
  foreach t in array array[
    'user_roles', 'configuracoes', 'locais', 'mapas', 'setores', 'mapa_celulas',
    'eventos', 'sessoes', 'assentos', 'periodos_preco', 'precos', 'janelas',
    'familias', 'familia_links', 'bailarinas', 'escalacao', 'importacoes',
    'produtos', 'estoques', 'lotes', 'produto_estoque', 'produto_datas',
    'pedidos', 'ingressos', 'pedido_itens', 'desistencias', 'fechamentos_caixa', 'conteudos'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      'admin_' || t, t
    );
  end loop;
end $$;

-- Equipe da bilheteria: leitura do que a venda presencial precisa.
do $$
declare t text;
begin
  foreach t in array array[
    'configuracoes', 'locais', 'mapas', 'setores', 'eventos', 'sessoes',
    'periodos_preco', 'precos', 'janelas', 'familias', 'bailarinas', 'escalacao',
    'produtos', 'estoques', 'lotes', 'produto_estoque', 'produto_datas',
    'pedidos', 'ingressos', 'pedido_itens', 'conteudos', 'termos_versoes'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_equipe())',
      'equipe_le_' || t, t
    );
  end loop;
end $$;

-- Cada pessoa da equipe enxerga os próprios papéis (para o menu).
create policy proprio_papel on public.user_roles for select to authenticated
using (user_id = auth.uid());

-- Atendente registra e enxerga o próprio fechamento de caixa.
create policy equipe_proprio_caixa on public.fechamentos_caixa for all to authenticated
using (atendente_id = auth.uid() and public.is_equipe())
with check (atendente_id = auth.uid() and public.is_equipe());

-- Termos: só leitura e inserção de novas versões (nunca editar a publicada).
create policy admin_le_termos on public.termos_versoes for select to authenticated using (public.is_admin());
create policy admin_publica_termos on public.termos_versoes for insert to authenticated with check (public.is_admin());

-- Auditoria e log do gateway: só leitura pelo admin. Escrita só por gatilhos e funções.
create policy admin_le_auditoria on public.auditoria for select to authenticated using (public.is_admin());
create policy admin_le_eventos_pagamento on public.eventos_pagamento for select to authenticated using (public.is_admin());

-- Única leitura pública direta: status dos lugares, sem dado pessoal, para o mapa em tempo real.
create policy publico_le_assentos on public.assentos for select to anon, authenticated using (true);
revoke select on public.assentos from anon;
grant select (id, sessao_id, setor_id, linha, coluna, rotulo_fila, numero, acessivel, status) on public.assentos to anon;

-- =====================================================================
-- Funções do Bloco 1
-- =====================================================================

-- Saldo da família numa sessão. null = evento sem cota.
create or replace function public.saldo_familia(p_familia uuid, p_sessao uuid)
returns int language plpgsql stable security definer
set search_path = public
as $$
declare
  v_cota int;
  v_escaladas int;
  v_usados int;
begin
  if not (public.is_equipe() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Sem permissão.';
  end if;

  select e.cota_por_participante into v_cota
  from public.familias f join public.eventos e on e.id = f.evento_id
  where f.id = p_familia;

  if v_cota is null then
    return null;
  end if;

  select count(*) into v_escaladas
  from public.escalacao es join public.bailarinas b on b.id = es.bailarina_id
  where b.familia_id = p_familia and b.ativa and es.sessao_id = p_sessao;

  select
    (select count(*) from public.ingressos i join public.pedidos p on p.id = i.pedido_id
      where p.familia_id = p_familia and i.sessao_id = p_sessao
        and i.status = 'ativo' and i.tipo <> 'cortesia')
    +
    (select count(*) from public.assentos a join public.pedidos p on p.id = a.reserva_id
      where p.familia_id = p_familia and a.sessao_id = p_sessao
        and a.status = 'reservado' and a.reservado_ate > now()
        and p.status in ('reservado', 'aguardando_pagamento') and p.canal <> 'cortesia')
  into v_usados;

  return greatest(0, v_cota * v_escaladas - v_usados);
end;
$$;

-- Saldo de todas as famílias de um evento, por sessão (para o painel e a Bilheteria).
create or replace function public.saldos_do_evento(p_evento uuid)
returns table (familia_id uuid, sessao_id uuid, cota int, escaladas int, usados int, saldo int)
language sql stable security definer
set search_path = public
as $$
  with base as (
    select f.id as familia_id, s.id as sessao_id, e.cota_por_participante as cota
    from public.familias f
    join public.eventos e on e.id = f.evento_id
    join public.sessoes s on s.evento_id = e.id
    where f.evento_id = p_evento and f.ativa and public.is_equipe()
  ),
  esc as (
    select b.familia_id, es.sessao_id, count(*)::int as n
    from public.escalacao es join public.bailarinas b on b.id = es.bailarina_id
    where b.evento_id = p_evento and b.ativa
    group by 1, 2
  ),
  uso as (
    select p.familia_id, i.sessao_id, count(*)::int as n
    from public.ingressos i join public.pedidos p on p.id = i.pedido_id
    where p.evento_id = p_evento and i.status = 'ativo' and i.tipo <> 'cortesia' and p.familia_id is not null
    group by 1, 2
  )
  select base.familia_id, base.sessao_id, base.cota,
         coalesce(esc.n, 0), coalesce(uso.n, 0),
         case when base.cota is null then null
              else greatest(0, base.cota * coalesce(esc.n, 0) - coalesce(uso.n, 0)) end
  from base
  left join esc on esc.familia_id = base.familia_id and esc.sessao_id = base.sessao_id
  left join uso on uso.familia_id = base.familia_id and uso.sessao_id = base.sessao_id
  where coalesce(esc.n, 0) > 0;
$$;

-- Grava o desenho de um mapa (editor de grade). Recusa número repetido e assento sem setor.
create or replace function public.salvar_mapa(p_mapa uuid, p_colunas int, p_filas int, p_celulas jsonb)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_problemas text[] := '{}';
  v_total int;
  v_por_setor jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_colunas not between 1 and 60 or p_filas not between 1 and 40 then
    raise exception 'A grade aceita até 60 colunas e 40 filas.';
  end if;
  if jsonb_typeof(p_celulas) <> 'array' then
    raise exception 'Formato de células inválido.';
  end if;

  drop table if exists _c;
  create temp table _c on commit drop as
  select
    (c ->> 'linha')::int as linha,
    (c ->> 'coluna')::int as coluna,
    c ->> 'tipo' as tipo,
    nullif(c ->> 'rotulo_fila', '') as rotulo_fila,
    (c ->> 'numero')::int as numero,
    nullif(c ->> 'setor_id', '')::uuid as setor_id,
    coalesce((c ->> 'acessivel')::boolean, false) as acessivel,
    coalesce((c ->> 'bloqueado_padrao')::boolean, false) as bloqueado_padrao
  from jsonb_array_elements(p_celulas) c;

  select v_problemas || coalesce(array_agg(format('Quadrado fora da grade na fila %s, coluna %s', linha, coluna)), '{}')
  into v_problemas from (select linha, coluna from _c where linha not between 1 and p_filas or coluna not between 1 and p_colunas limit 10) x;

  select v_problemas || coalesce(array_agg(format('Tipo desconhecido na fila %s, coluna %s', linha, coluna)), '{}')
  into v_problemas from (select linha, coluna from _c where tipo is null or tipo not in ('assento', 'corredor', 'palco') limit 10) x;

  select v_problemas || coalesce(array_agg(format('Dois quadrados na mesma posição: fila %s, coluna %s', linha, coluna)), '{}')
  into v_problemas from (select linha, coluna from _c group by 1, 2 having count(*) > 1 limit 10) x;

  select v_problemas || coalesce(array_agg(format('Número %s repetido', numero)), '{}')
  into v_problemas from (select numero from _c where tipo = 'assento' group by 1 having count(*) > 1 limit 10) x;

  select v_problemas || coalesce(array_agg(format('Assento sem número na fila %s, coluna %s', linha, coluna)), '{}')
  into v_problemas from (select linha, coluna from _c where tipo = 'assento' and (numero is null or numero < 1) limit 10) x;

  select v_problemas || coalesce(array_agg(format('Assento %s sem setor', coalesce(numero::text, '?'))), '{}')
  into v_problemas from (
    select c.numero from _c c
    where c.tipo = 'assento'
      and (c.setor_id is null or not exists (select 1 from public.setores s where s.id = c.setor_id and s.mapa_id = p_mapa))
    limit 10
  ) x;

  if array_length(v_problemas, 1) > 0 then
    raise exception using message = 'O mapa não foi salvo: ' || array_to_string(v_problemas, '; ');
  end if;

  delete from public.mapa_celulas where mapa_id = p_mapa;
  insert into public.mapa_celulas (mapa_id, linha, coluna, tipo, rotulo_fila, numero, setor_id, acessivel, bloqueado_padrao)
  select p_mapa, linha, coluna, tipo, rotulo_fila,
         case when tipo = 'assento' then numero end,
         case when tipo = 'assento' then setor_id end,
         tipo = 'assento' and acessivel,
         tipo = 'assento' and bloqueado_padrao
  from _c;

  update public.mapas set colunas = p_colunas, filas = p_filas where id = p_mapa;

  select count(*) into v_total from _c where tipo = 'assento';
  select coalesce(jsonb_object_agg(s.nome, x.n), '{}'::jsonb) into v_por_setor
  from (select setor_id, count(*) as n from _c where tipo = 'assento' group by 1) x
  join public.setores s on s.id = x.setor_id;

  return jsonb_build_object('assentos', v_total, 'por_setor', v_por_setor);
end;
$$;

-- Cria os lugares de uma sessão a partir do mapa (cópia congelada).
create or replace function public._congelar_mapa(p_sessao uuid)
returns int language plpgsql security definer
set search_path = public
as $$
declare
  v_mapa uuid;
  v_status text;
  v_n int;
begin
  select s.mapa_id, m.status into v_mapa, v_status
  from public.sessoes s left join public.mapas m on m.id = s.mapa_id
  where s.id = p_sessao;

  if v_mapa is null then
    raise exception 'Escolha o mapa da sessão antes de congelar.';
  end if;
  if v_status <> 'pronto' then
    raise exception 'O mapa ainda está em rascunho. Marque como pronto antes de usar numa sessão.';
  end if;
  if exists (select 1 from public.ingressos where sessao_id = p_sessao)
     or exists (select 1 from public.assentos where sessao_id = p_sessao and status in ('reservado', 'vendido')) then
    raise exception 'Esta sessão já tem vendas. O mapa dela não pode ser trocado.';
  end if;

  delete from public.assentos where sessao_id = p_sessao;
  insert into public.assentos (sessao_id, setor_id, linha, coluna, rotulo_fila, numero, acessivel, status, bloqueio_motivo)
  select p_sessao, c.setor_id, c.linha, c.coluna, c.rotulo_fila, c.numero, c.acessivel,
         case when c.bloqueado_padrao then 'bloqueado' else 'livre' end,
         case when c.bloqueado_padrao then 'Bloqueado no mapa' end
  from public.mapa_celulas c
  where c.mapa_id = v_mapa and c.tipo = 'assento';
  get diagnostics v_n = row_count;

  update public.sessoes set mapa_congelado_em = now() where id = p_sessao;
  return v_n;
end;
$$;

create or replace function public.congelar_mapa_da_sessao(p_sessao uuid)
returns int language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  return public._congelar_mapa(p_sessao);
end;
$$;

-- Bloqueia ou libera lugares livres de uma sessão já congelada.
create or replace function public.bloquear_lugares(p_sessao uuid, p_numeros int[], p_bloquear boolean, p_motivo text default null)
returns int language plpgsql security definer
set search_path = public
as $$
declare v_n int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_bloquear and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do bloqueio.';
  end if;
  update public.assentos
     set status = case when p_bloquear then 'bloqueado' else 'livre' end,
         bloqueio_motivo = case when p_bloquear then trim(p_motivo) end
   where sessao_id = p_sessao
     and numero = any (p_numeros)
     and status = case when p_bloquear then 'livre' else 'bloqueado' end;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Importação da planilha. p_gravar = false devolve só a prévia.
-- p_linhas: [{ "linha": 2, "nome": "...", "turma": "...", "pacote": "...",
--              "responsavel": "...", "whatsapp": "...", "sessoes": ["uuid", ...] }]
create or replace function public.importar_planilha(p_evento uuid, p_linhas jsonb, p_gravar boolean, p_arquivo text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_vermelhos jsonb;
  v_amarelos jsonb;
  v_resumo jsonb;
  v_familias int;
  v_total int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'Formato de linhas inválido.';
  end if;

  drop table if exists _l;
  create temp table _l on commit drop as
  select
    coalesce((r ->> 'linha')::int, ord::int + 1) as linha,
    regexp_replace(trim(coalesce(r ->> 'nome', '')), '\s+', ' ', 'g') as nome,
    public.normalizar_texto(r ->> 'nome') as nome_busca,
    nullif(trim(coalesce(r ->> 'turma', '')), '') as turma,
    nullif(trim(coalesce(r ->> 'pacote', '')), '') as pacote,
    regexp_replace(trim(coalesce(r ->> 'responsavel', '')), '\s+', ' ', 'g') as responsavel,
    r ->> 'whatsapp' as whatsapp_original,
    public.normalizar_whatsapp(r ->> 'whatsapp') as whatsapp,
    coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'sessoes', '[]'::jsonb)))::uuid[], '{}') as sessoes
  from jsonb_array_elements(p_linhas) with ordinality as t(r, ord);

  delete from _l where nome = '' and responsavel = '' and coalesce(whatsapp_original, '') = '';

  -- Vermelho: impede gravar.
  select coalesce(jsonb_agg(jsonb_build_object('linha', linha, 'motivo', motivo) order by linha), '[]'::jsonb)
  into v_vermelhos from (
    select linha, 'Falta o nome da bailarina' as motivo from _l where nome_busca is null
    union all
    select l.linha, 'Bailarina repetida na planilha' from _l l
      where l.nome_busca is not null and (select count(*) from _l x where x.nome_busca = l.nome_busca) > 1
    union all
    select linha, 'Nenhum dia marcado' from _l where cardinality(sessoes) = 0
    union all
    select l.linha, 'Dia que não pertence a este evento' from _l l
      where exists (select 1 from unnest(l.sessoes) s(id)
                    where not exists (select 1 from public.sessoes ss where ss.id = s.id and ss.evento_id = p_evento))
    union all
    select linha, 'WhatsApp inválido: ' || coalesce(whatsapp_original, 'vazio') from _l where whatsapp is null
    union all
    select linha, 'Falta o responsável' from _l where responsavel = ''
  ) v;

  -- Amarelo: grava, mas vale conferir.
  select coalesce(jsonb_agg(jsonb_build_object('linha', linha, 'motivo', motivo) order by linha), '[]'::jsonb)
  into v_amarelos from (
    select l.linha, 'Mesmo WhatsApp com outro nome de responsável' as motivo from _l l
      where l.whatsapp is not null and exists (
        select 1 from _l x where x.whatsapp = l.whatsapp
          and public.normalizar_texto(x.responsavel) is distinct from public.normalizar_texto(l.responsavel))
    union all
    select l.linha, 'Nome parecido com ' || (
        select x.nome from _l x
        where x.nome_busca <> l.nome_busca and extensions.similarity(x.nome_busca, l.nome_busca) >= 0.8
        order by extensions.similarity(x.nome_busca, l.nome_busca) desc limit 1)
      from _l l
      where l.nome_busca is not null and exists (
        select 1 from _l x where x.nome_busca <> l.nome_busca and extensions.similarity(x.nome_busca, l.nome_busca) >= 0.8)
    union all
    select l.linha, 'Sem turma' from _l l where l.turma is null and l.nome_busca is not null
    union all
    select null::int, 'Cadastrada antes e fora desta planilha: ' || b.nome from public.bailarinas b
      where b.evento_id = p_evento and b.ativa
        and not exists (select 1 from _l l where l.nome_busca = b.nome_busca)
  ) a;

  select count(distinct whatsapp), count(*) into v_familias, v_total from _l where whatsapp is not null;

  v_resumo := jsonb_build_object(
    'bailarinas', v_total,
    'familias', v_familias,
    'quebra_nozes', (select count(*) from _l where public.normalizar_texto(pacote) = 'quebra-nozes'),
    'por_sessao', coalesce((
      select jsonb_object_agg(s.nome, x.n)
      from (select unnest(sessoes) as sid, count(*) as n from _l group by 1) x
      join public.sessoes s on s.id = x.sid), '{}'::jsonb),
    'vermelhos', v_vermelhos,
    'amarelos', v_amarelos,
    'pode_gravar', jsonb_array_length(v_vermelhos) = 0
  );

  if p_gravar then
    if jsonb_array_length(v_vermelhos) > 0 then
      raise exception 'A planilha ainda tem linhas em vermelho. Corrija e envie de novo.';
    end if;

    insert into public.familias (evento_id, responsavel_nome, whatsapp)
    select distinct on (whatsapp) p_evento, responsavel, whatsapp
    from _l order by whatsapp, linha
    on conflict (evento_id, whatsapp) do update
      set responsavel_nome = excluded.responsavel_nome, ativa = true;

    insert into public.bailarinas (evento_id, familia_id, nome, nome_busca, turma, pacote, origem)
    select p_evento, f.id, l.nome, l.nome_busca, l.turma, l.pacote, 'planilha'
    from _l l join public.familias f on f.evento_id = p_evento and f.whatsapp = l.whatsapp
    on conflict (evento_id, nome_busca) do update
      set familia_id = excluded.familia_id, nome = excluded.nome, turma = excluded.turma,
          pacote = excluded.pacote, ativa = true;

    delete from public.escalacao es
    using public.bailarinas b
    where es.bailarina_id = b.id and b.evento_id = p_evento
      and b.nome_busca in (select nome_busca from _l);

    insert into public.escalacao (bailarina_id, sessao_id)
    select distinct b.id, s.id
    from _l l
    join public.bailarinas b on b.evento_id = p_evento and b.nome_busca = l.nome_busca
    cross join lateral unnest(l.sessoes) s(id);
  end if;

  insert into public.importacoes (evento_id, arquivo, por, resumo, status)
  values (p_evento, p_arquivo, auth.uid(), v_resumo, case when p_gravar then 'gravada' else 'previa' end);

  return v_resumo;
end;
$$;

-- Gera ou troca o código do link da família. O antigo para de funcionar na hora.
create or replace function public.gerar_link_familia(p_familia uuid)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare v_token text := public.novo_codigo(24);
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  insert into public.familia_links (familia_id, token, gerado_por)
  values (p_familia, v_token, auth.uid())
  on conflict (familia_id) do update
    set token = excluded.token, gerado_em = now(), gerado_por = excluded.gerado_por,
        enviado_em = null, enviado_por = null;
  return v_token;
end;
$$;

-- Gera o link de todas as famílias do evento que ainda não têm.
create or replace function public.gerar_links_do_evento(p_evento uuid)
returns int language plpgsql security definer
set search_path = public, extensions
as $$
declare v_n int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  insert into public.familia_links (familia_id, token, gerado_por)
  select f.id, public.novo_codigo(24), auth.uid()
  from public.familias f
  where f.evento_id = p_evento and f.ativa
    and not exists (select 1 from public.familia_links l where l.familia_id = f.id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.marcar_link_enviado(p_familia uuid, p_enviado boolean default true)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  update public.familia_links
     set enviado_em = case when p_enviado then now() end,
         enviado_por = case when p_enviado then auth.uid() end
   where familia_id = p_familia;
end;
$$;

-- Estoque disponível (soma dos lotes abertos menos o que já saiu).
create or replace function public.estoque_disponivel(p_estoque uuid)
returns int language sql stable security definer
set search_path = public
as $$
  select greatest(0,
    coalesce((select sum(quantidade) from public.lotes where estoque_id = p_estoque and aberto), 0)
    - coalesce((
        select sum(pi.quantidade * pe.quantidade)
        from public.pedido_itens pi
        join public.pedidos p on p.id = pi.pedido_id
        join public.produto_estoque pe on pe.produto_id = pi.produto_id and pe.estoque_id = p_estoque
        where p.status in ('reservado', 'aguardando_pagamento', 'pago')
      ), 0))::int
$$;

-- Abre o próximo lote fechado de um estoque.
create or replace function public.abrir_proximo_lote(p_estoque uuid)
returns int language plpgsql security definer
set search_path = public
as $$
declare v_numero int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  select numero into v_numero from public.lotes
  where estoque_id = p_estoque and not aberto order by numero limit 1;
  if v_numero is null then
    raise exception 'Não há lote fechado para abrir.';
  end if;
  update public.lotes set aberto = true where estoque_id = p_estoque and numero = v_numero;
  return v_numero;
end;
$$;

-- Vagas livres de um dia de ensaio.
create or replace function public.vagas_disponiveis(p_produto_data uuid)
returns int language sql stable security definer
set search_path = public
as $$
  select greatest(0, d.vagas - d.reservas_internas - coalesce((
    select sum(pi.quantidade) from public.pedido_itens pi
    join public.pedidos p on p.id = pi.pedido_id
    where pi.produto_data_id = d.id and p.status in ('reservado', 'aguardando_pagamento', 'pago')), 0))::int
  from public.produto_datas d where d.id = p_produto_data
$$;

-- =====================================================================
-- Permissões de execução
-- =====================================================================

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.has_role(uuid, text), public.is_admin(), public.is_equipe(), public.existe_admin(),
  public.reivindicar_admin(), public.saldo_familia(uuid, uuid), public.saldos_do_evento(uuid),
  public.salvar_mapa(uuid, int, int, jsonb), public.congelar_mapa_da_sessao(uuid),
  public.bloquear_lugares(uuid, int[], boolean, text),
  public.importar_planilha(uuid, jsonb, boolean, text),
  public.gerar_link_familia(uuid), public.gerar_links_do_evento(uuid), public.marcar_link_enviado(uuid, boolean),
  public.estoque_disponivel(uuid), public.abrir_proximo_lote(uuid), public.vagas_disponiveis(uuid),
  public.normalizar_whatsapp(text), public.normalizar_texto(text)
to authenticated;
grant execute on function public.existe_admin() to anon;
revoke execute on function public._congelar_mapa(uuid) from authenticated;
