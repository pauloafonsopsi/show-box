-- lovable-cron-fallback-reviewed: a especificacao exige expirar_reservas a cada minuto; e um backstop, a compra ja trata reserva vencida como livre
-- =====================================================================
-- Bilheteria de espetáculos: motor de vendas (Bloco 2)
-- Escrito pelo Claude. Aplicar exatamente como está.
-- Reserva atômica, preço calculado no banco, finalização idempotente,
-- recepção, cortesias, troca de lugar, retirada, desistência e expiração.
-- Quem chama:
--   * funções "equipe": cliente do Cloud com o login da atendente ou do admin;
--   * funções "servidor": só o servidor do app, com a chave de serviço
--     (página da família, compra pública, Pagar.me, webhook e agendamentos).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------

alter table public.pedidos
  add column if not exists ingressos_previstos jsonb not null default '[]'::jsonb,
  add column if not exists acesso_token text unique default public.novo_codigo(18),
  add column if not exists valor_recebido_centavos int check (valor_recebido_centavos >= 0),
  add column if not exists pagarme_pedidos jsonb not null default '[]'::jsonb;

update public.pedidos set acesso_token = public.novo_codigo(18) where acesso_token is null;
alter table public.pedidos alter column acesso_token set not null;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------

create or replace function public._eh_servidor()
returns boolean language sql stable
as $$
  select coalesce(auth.role(), '') = 'service_role'
$$;

create or replace function public._exigir_equipe()
returns void language plpgsql stable security definer
set search_path = public
as $$
begin
  if not (public.is_equipe() or public._eh_servidor()) then
    raise exception 'Sem permissão.';
  end if;
end;
$$;

create or replace function public._exigir_servidor()
returns void language plpgsql stable
set search_path = public
as $$
begin
  if not public._eh_servidor() then
    raise exception 'Sem permissão.';
  end if;
end;
$$;

create or replace function public.primeiro_nome(p text)
returns text language sql immutable
as $$
  select split_part(trim(coalesce(p, '')), ' ', 1)
$$;

create or replace function public._janela_aberta(p_evento uuid, p_tipo text)
returns boolean language sql stable
set search_path = public
as $$
  select exists (
    select 1 from public.janelas
    where evento_id = p_evento and tipo = p_tipo
      and inicio <= now() and (fim is null or fim > now())
  )
$$;

-- Preço vigente de um setor. p_tipo: 'meia_todos', 'inteira' ou 'meia'. null = sem preço.
create or replace function public._preco(p_evento uuid, p_setor uuid, p_tipo text, p_quando timestamptz default now())
returns int language sql stable
set search_path = public
as $$
  select pr.valor_centavos
  from public.periodos_preco pe
  join public.precos pr on pr.periodo_id = pe.id and pr.setor_id = p_setor
  where pe.evento_id = p_evento and pe.inicio <= p_quando and pe.fim > p_quando
    and pr.tipo = case when p_tipo = 'meia_todos' then 'unico' else p_tipo end
    and ((pe.modo = 'unico' and p_tipo = 'meia_todos') or (pe.modo = 'inteira_meia' and p_tipo in ('inteira', 'meia')))
  order by pe.inicio desc
  limit 1
$$;

create or replace function public._modo_preco(p_evento uuid, p_quando timestamptz default now())
returns text language sql stable
set search_path = public
as $$
  select modo from public.periodos_preco
  where evento_id = p_evento and inicio <= p_quando and fim > p_quando
  order by inicio desc limit 1
$$;

-- Meias ainda disponíveis numa sessão (percentual do evento sobre os lugares da sessão).
create or replace function public.meias_disponiveis(p_sessao uuid)
returns int language sql stable security definer
set search_path = public
as $$
  select greatest(0,
    floor((select count(*) from public.assentos where sessao_id = p_sessao) * e.meia_percentual / 100.0)::int
    - (select count(*) from public.ingressos i where i.sessao_id = p_sessao and i.status = 'ativo' and i.tipo = 'meia')::int
    - coalesce((
        select count(*) from public.pedidos p, jsonb_array_elements(p.ingressos_previstos) x
        where p.status in ('reservado', 'aguardando_pagamento') and p.expira_em > now()
          and x ->> 'sessao_id' = p_sessao::text and x ->> 'tipo' = 'meia'), 0)::int)
  from public.sessoes s join public.eventos e on e.id = s.evento_id
  where s.id = p_sessao
$$;

-- ---------------------------------------------------------------------
-- Mapa da sessão (leitura pública, sem dado pessoal)
-- ---------------------------------------------------------------------

create or replace function public.mapa_da_sessao(p_sessao uuid)
returns jsonb language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'sessao_id', s.id,
    'evento_id', s.evento_id,
    'colunas', m.colunas,
    'filas', m.filas,
    'palco', coalesce((select jsonb_agg(jsonb_build_array(c.linha, c.coluna)) from public.mapa_celulas c where c.mapa_id = m.id and c.tipo = 'palco'), '[]'::jsonb),
    'corredor', coalesce((select jsonb_agg(jsonb_build_array(c.linha, c.coluna)) from public.mapa_celulas c where c.mapa_id = m.id and c.tipo = 'corredor'), '[]'::jsonb),
    'modo_preco', public._modo_preco(s.evento_id),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id, 'nome', st.nome, 'cor', st.cor,
        'meia_todos', public._preco(s.evento_id, st.id, 'meia_todos'),
        'inteira', public._preco(s.evento_id, st.id, 'inteira'),
        'meia', public._preco(s.evento_id, st.id, 'meia')) order by st.ordem)
      from public.setores st where st.mapa_id = m.id), '[]'::jsonb),
    'assentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'numero', a.numero, 'linha', a.linha, 'coluna', a.coluna, 'fila', a.rotulo_fila,
        'setor_id', a.setor_id, 'acessivel', a.acessivel,
        'estado', case
          when a.status = 'vendido' then 'ocupado'
          when a.status = 'bloqueado' then 'bloqueado'
          when a.status = 'reservado' and a.reservado_ate > now() then 'reservado'
          else 'livre' end) order by a.numero)
      from public.assentos a where a.sessao_id = s.id), '[]'::jsonb),
    'meias_disponiveis', public.meias_disponiveis(s.id)
  )
  from public.sessoes s join public.mapas m on m.id = s.mapa_id
  where s.id = p_sessao and s.ativa
$$;

-- ---------------------------------------------------------------------
-- Reserva atômica (núcleo)
-- ---------------------------------------------------------------------

-- Reserva tudo ou nada. Se algum lugar não estiver livre, nada é reservado e
-- a resposta traz os números perdidos. Reserva vencida de outra pessoa conta como livre.
create or replace function public._reservar(
  p_sessao uuid, p_numeros int[], p_canal text, p_familia uuid, p_pedido uuid, p_atendente uuid
) returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_evento uuid;
  v_reserva_min int;
  v_pedido public.pedidos%rowtype;
  v_perdidos int[];
  v_expira timestamptz;
  v_qtd int;
begin
  if coalesce(cardinality(p_numeros), 0) = 0 then
    raise exception 'Escolha pelo menos um lugar.';
  end if;

  select s.evento_id, e.tempo_reserva_min into v_evento, v_reserva_min
  from public.sessoes s join public.eventos e on e.id = s.evento_id
  where s.id = p_sessao and s.ativa and s.mapa_congelado_em is not null;
  if v_evento is null then
    raise exception 'Sessão indisponível.';
  end if;

  -- Trava os lugares pedidos (ordem fixa evita impasse entre duas reservas).
  perform 1 from public.assentos
  where sessao_id = p_sessao and numero = any (p_numeros)
  order by numero for update;

  select coalesce(array_agg(n order by n), '{}') into v_perdidos
  from unnest(p_numeros) n
  where not exists (
    select 1 from public.assentos a
    where a.sessao_id = p_sessao and a.numero = n
      and (a.status = 'livre'
           or (a.status = 'reservado' and (a.reservado_ate <= now() or a.reserva_id = p_pedido)))
  );

  if cardinality(v_perdidos) > 0 then
    return jsonb_build_object('ok', false, 'perdidos', to_jsonb(v_perdidos));
  end if;

  v_expira := now() + make_interval(mins => v_reserva_min);

  if p_pedido is null then
    insert into public.pedidos (evento_id, familia_id, canal, status, atendente_id, expira_em)
    values (v_evento, p_familia, p_canal, 'reservado', p_atendente, v_expira)
    returning * into v_pedido;
  else
    select * into v_pedido from public.pedidos where id = p_pedido for update;
    if v_pedido.id is null or v_pedido.status not in ('reservado', 'aguardando_pagamento') or v_pedido.evento_id <> v_evento then
      raise exception 'Este pedido não aceita mais lugares. Comece uma nova escolha.';
    end if;
    update public.pedidos set status = 'reservado', expira_em = v_expira where id = v_pedido.id;
  end if;

  update public.assentos
     set status = 'reservado', reserva_id = v_pedido.id, reservado_ate = v_expira
   where sessao_id = p_sessao and numero = any (p_numeros);
  get diagnostics v_qtd = row_count;

  return jsonb_build_object(
    'ok', true,
    'pedido_id', v_pedido.id,
    'codigo', v_pedido.codigo,
    'acesso_token', v_pedido.acesso_token,
    'expira_em', v_expira,
    'reservados', v_qtd,
    'perdidos', '[]'::jsonb
  );
end;
$$;

-- Lugares que um pedido segura agora.
create or replace function public._lugares_do_pedido(p_pedido uuid)
returns table (assento_id uuid, sessao_id uuid, numero int, setor_id uuid)
language sql stable
set search_path = public
as $$
  select a.id, a.sessao_id, a.numero, a.setor_id
  from public.assentos a
  where a.reserva_id = p_pedido and a.status = 'reservado'
$$;

create or replace function public._liberar(p_pedido uuid, p_status text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null
   where reserva_id = p_pedido and status = 'reservado';
  update public.pedidos set status = p_status
   where id = p_pedido and status in ('reservado', 'aguardando_pagamento');
end;
$$;

-- ---------------------------------------------------------------------
-- Composição do pedido: tipos de ingresso, adicionais e total.
-- Tudo calculado no banco. O navegador nunca envia valor.
-- p_ingressos: [{ "numero": 12, "sessao_id": "...", "tipo": "meia_todos|inteira|meia", "categoria_meia": "Estudante" }]
--   (lugar sem item cai no tipo padrão do período: meia_todos ou inteira)
-- p_adicionais: [{ "produto_id": "...", "quantidade": 2, "sessao_entrega_id": "...", "produto_data_id": "..." }]
-- ---------------------------------------------------------------------

create or replace function public._compor(p_pedido uuid, p_ingressos jsonb, p_adicionais jsonb, p_presencial boolean)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_p public.pedidos%rowtype;
  v_e public.eventos%rowtype;
  v_modo text;
  v_previstos jsonb := '[]'::jsonb;
  v_lugar record;
  v_item jsonb;
  v_tipo text;
  v_cat text;
  v_valor int;
  v_total int := 0;
  v_adic record;
  v_preco int;
  v_estoque record;
  v_qtd_ingressos int := 0;
begin
  select * into v_p from public.pedidos where id = p_pedido for update;
  if v_p.id is null or v_p.status not in ('reservado', 'aguardando_pagamento') then
    raise exception 'Este pedido não está mais aberto. Escolha os lugares de novo.';
  end if;
  if v_p.expira_em <= now() then
    raise exception 'O tempo da reserva acabou. Escolha os lugares de novo.';
  end if;
  select * into v_e from public.eventos where id = v_p.evento_id;
  v_modo := public._modo_preco(v_p.evento_id);
  if v_modo is null then
    raise exception 'Não há preço vigente para este evento hoje.';
  end if;

  for v_lugar in select * from public._lugares_do_pedido(p_pedido) order by numero loop
    select x into v_item from jsonb_array_elements(coalesce(p_ingressos, '[]'::jsonb)) x
    where (x ->> 'numero')::int = v_lugar.numero and (x ->> 'sessao_id')::uuid = v_lugar.sessao_id
    limit 1;

    v_tipo := coalesce(v_item ->> 'tipo', case when v_modo = 'unico' then 'meia_todos' else 'inteira' end);
    v_cat := nullif(trim(coalesce(v_item ->> 'categoria_meia', '')), '');

    if v_modo = 'unico' and v_tipo <> 'meia_todos' then
      v_tipo := 'meia_todos';
    end if;
    if v_modo = 'inteira_meia' and v_tipo not in ('inteira', 'meia') then
      raise exception 'Tipo de ingresso inválido para o lugar %.', v_lugar.numero;
    end if;
    if v_tipo = 'meia' then
      if v_cat is null or not (v_e.meia_categorias ? v_cat) then
        raise exception 'Escolha a categoria da meia-entrada do lugar %.', v_lugar.numero;
      end if;
    else
      v_cat := null;
    end if;

    v_valor := public._preco(v_p.evento_id, v_lugar.setor_id, v_tipo);
    if v_valor is null then
      raise exception 'O lugar % não tem preço definido.', v_lugar.numero;
    end if;

    v_previstos := v_previstos || jsonb_build_object(
      'assento_id', v_lugar.assento_id, 'sessao_id', v_lugar.sessao_id, 'numero', v_lugar.numero,
      'tipo', v_tipo, 'categoria_meia', v_cat, 'valor', v_valor);
    v_total := v_total + v_valor;
    v_qtd_ingressos := v_qtd_ingressos + 1;
  end loop;

  if v_qtd_ingressos = 0 then
    raise exception 'O pedido não tem lugares reservados. Escolha os lugares de novo.';
  end if;

  -- Cota de meias por sessão (só em novembro).
  if exists (
    select 1 from (
      select x ->> 'sessao_id' as sid, count(*) as n
      from jsonb_array_elements(v_previstos) x where x ->> 'tipo' = 'meia' group by 1
    ) q
    where q.n > public.meias_disponiveis(q.sid::uuid)
      + coalesce((select count(*) from jsonb_array_elements(v_p.ingressos_previstos) y
                  where y ->> 'tipo' = 'meia' and y ->> 'sessao_id' = q.sid), 0)
  ) then
    raise exception 'As meias-entradas desta sessão esgotaram.';
  end if;

  -- Adicionais: refaz os itens do pedido.
  delete from public.pedido_itens where pedido_id = p_pedido;

  for v_adic in
    select (x ->> 'produto_id')::uuid as produto_id,
           greatest(1, coalesce((x ->> 'quantidade')::int, 1)) as quantidade,
           nullif(x ->> 'sessao_entrega_id', '')::uuid as sessao_entrega_id,
           nullif(x ->> 'produto_data_id', '')::uuid as produto_data_id
    from jsonb_array_elements(coalesce(p_adicionais, '[]'::jsonb)) x
  loop
    select case when pr.venda_online_ate is null or now() < pr.venda_online_ate
                then pr.preco_antecipado_centavos else pr.preco_cheio_centavos end
    into v_preco
    from public.produtos pr
    where pr.id = v_adic.produto_id and pr.evento_id = v_p.evento_id and pr.ativo
      and (p_presencial or pr.venda_online_ate is null or now() < pr.venda_online_ate);
    if v_preco is null then
      raise exception 'Um dos adicionais não está disponível agora.';
    end if;

    if exists (select 1 from public.produto_datas d where d.produto_id = v_adic.produto_id and d.ativa) then
      if v_adic.produto_data_id is null
         or not exists (select 1 from public.produto_datas d where d.id = v_adic.produto_data_id and d.produto_id = v_adic.produto_id and d.ativa) then
        raise exception 'Escolha o dia do adicional.';
      end if;
      if public.vagas_disponiveis(v_adic.produto_data_id) < v_adic.quantidade then
        raise exception 'Não há mais vagas nesse dia.';
      end if;
    end if;

    if v_adic.sessao_entrega_id is not null
       and not exists (select 1 from public.sessoes s where s.id = v_adic.sessao_entrega_id and s.evento_id = v_p.evento_id) then
      raise exception 'Sessão de entrega inválida.';
    end if;

    for v_estoque in
      select pe.estoque_id, pe.quantidade from public.produto_estoque pe where pe.produto_id = v_adic.produto_id
    loop
      if public.estoque_disponivel(v_estoque.estoque_id) < v_estoque.quantidade * v_adic.quantidade then
        raise exception 'Um dos adicionais esgotou.';
      end if;
    end loop;

    insert into public.pedido_itens (pedido_id, produto_id, quantidade, valor_unitario_centavos, sessao_entrega_id, produto_data_id)
    values (p_pedido, v_adic.produto_id, v_adic.quantidade, v_preco, v_adic.sessao_entrega_id, v_adic.produto_data_id);
    v_total := v_total + v_preco * v_adic.quantidade;
  end loop;

  update public.pedidos set ingressos_previstos = v_previstos, valor_total_centavos = v_total where id = p_pedido;

  return jsonb_build_object(
    'pedido_id', p_pedido,
    'ingressos', v_previstos,
    'quantidade_ingressos', v_qtd_ingressos,
    'valor_total_centavos', v_total,
    'parcelamento_min_ingressos', v_e.parcelamento_min_ingressos,
    'parcelas_max', v_e.parcelas_max
  );
end;
$$;

create or replace function public._validar_parcelas(p_pedido uuid, p_forma text, p_parcelas int)
returns void language plpgsql stable
set search_path = public
as $$
declare
  v_e public.eventos%rowtype;
  v_qtd int;
begin
  select e.* into v_e from public.eventos e join public.pedidos p on p.evento_id = e.id where p.id = p_pedido;
  select jsonb_array_length(ingressos_previstos) into v_qtd from public.pedidos where id = p_pedido;
  if coalesce(p_parcelas, 1) < 1 then
    raise exception 'Número de parcelas inválido.';
  end if;
  if coalesce(p_parcelas, 1) > 1 then
    if p_forma not in ('cartao', 'credito') then
      raise exception 'Parcelamento só no cartão de crédito.';
    end if;
    if p_parcelas > v_e.parcelas_max or v_qtd < v_e.parcelamento_min_ingressos then
      raise exception 'Parcelamento em até % vezes a partir de % ingressos.', v_e.parcelas_max, v_e.parcelamento_min_ingressos;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Finalização idempotente: lugares vendidos, ingressos com QR.
-- Pode ser chamada várias vezes; só a primeira faz efeito.
-- Se os lugares foram perdidos, o pedido vira "pago_sem_lugar".
-- ---------------------------------------------------------------------

create or replace function public._finalizar(p_pedido uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_p public.pedidos%rowtype;
  v_conflitos int;
begin
  select * into v_p from public.pedidos where id = p_pedido for update;
  if v_p.id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_p.status = 'pago' or v_p.status = 'pago_sem_lugar' then
    return jsonb_build_object('status', v_p.status, 'codigo', v_p.codigo);
  end if;
  if v_p.status in ('cancelado', 'estornado') then
    update public.pedidos set status = 'pago_sem_lugar', pago_em = now() where id = p_pedido;
    return jsonb_build_object('status', 'pago_sem_lugar', 'codigo', v_p.codigo);
  end if;

  perform 1 from public.assentos a
  where a.id in (select (x ->> 'assento_id')::uuid from jsonb_array_elements(v_p.ingressos_previstos) x)
  order by a.numero for update;

  select count(*) into v_conflitos
  from jsonb_array_elements(v_p.ingressos_previstos) x
  join public.assentos a on a.id = (x ->> 'assento_id')::uuid
  where not (a.status = 'livre'
             or (a.status = 'reservado' and (a.reserva_id = p_pedido or a.reservado_ate <= now())));

  if v_conflitos > 0 or jsonb_array_length(v_p.ingressos_previstos) = 0 then
    update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null
     where reserva_id = p_pedido and status = 'reservado';
    update public.pedidos set status = 'pago_sem_lugar', pago_em = now() where id = p_pedido;
    return jsonb_build_object('status', 'pago_sem_lugar', 'codigo', v_p.codigo);
  end if;

  update public.assentos a
     set status = 'vendido', reserva_id = p_pedido, reservado_ate = null
   where a.id in (select (x ->> 'assento_id')::uuid from jsonb_array_elements(v_p.ingressos_previstos) x);

  insert into public.ingressos (pedido_id, sessao_id, assento_id, tipo, categoria_meia, valor_centavos)
  select p_pedido, (x ->> 'sessao_id')::uuid, (x ->> 'assento_id')::uuid, x ->> 'tipo',
         nullif(x ->> 'categoria_meia', ''), (x ->> 'valor')::int
  from jsonb_array_elements(v_p.ingressos_previstos) x;

  update public.pedidos set status = 'pago', pago_em = now(), expira_em = null where id = p_pedido;
  return jsonb_build_object('status', 'pago', 'codigo', v_p.codigo);
end;
$$;

-- =====================================================================
-- RECEPÇÃO (funções "equipe")
-- =====================================================================

create or replace function public.reservar_presencial(p_sessao uuid, p_numeros int[], p_familia uuid default null, p_pedido uuid default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
begin
  perform public._exigir_equipe();
  return public._reservar(p_sessao, p_numeros, 'presencial', p_familia, p_pedido, auth.uid());
end;
$$;

-- Fecha a venda da recepção: compõe, confere parcelas e finaliza na hora.
create or replace function public.registrar_venda_presencial(
  p_pedido uuid, p_ingressos jsonb, p_adicionais jsonb, p_forma text, p_parcelas int default 1, p_valor_recebido_centavos int default null
) returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_comp jsonb;
  v_fim jsonb;
begin
  perform public._exigir_equipe();
  if p_forma not in ('credito', 'debito', 'pix', 'dinheiro') then
    raise exception 'Escolha a forma de pagamento.';
  end if;
  if not exists (select 1 from public.pedidos where id = p_pedido and canal = 'presencial') then
    raise exception 'Pedido da recepção não encontrado.';
  end if;
  v_comp := public._compor(p_pedido, p_ingressos, p_adicionais, true);
  perform public._validar_parcelas(p_pedido, p_forma, p_parcelas);
  if p_forma = 'dinheiro' and p_valor_recebido_centavos is not null
     and p_valor_recebido_centavos < (v_comp ->> 'valor_total_centavos')::int then
    raise exception 'O valor recebido é menor que o total.';
  end if;
  update public.pedidos
     set forma_pagamento = p_forma, parcelas = coalesce(p_parcelas, 1),
         valor_recebido_centavos = p_valor_recebido_centavos, atendente_id = coalesce(atendente_id, auth.uid())
   where id = p_pedido;
  v_fim := public._finalizar(p_pedido);
  return v_comp || v_fim || jsonb_build_object(
    'troco_centavos', case when p_forma = 'dinheiro' and p_valor_recebido_centavos is not null
                           then p_valor_recebido_centavos - (v_comp ->> 'valor_total_centavos')::int end);
end;
$$;

-- Prévia do total sem fechar (para a tela da atendente e do checkout).
create or replace function public.previa_pedido(p_pedido uuid, p_ingressos jsonb, p_adicionais jsonb)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public._exigir_equipe();
  v := public._compor(p_pedido, p_ingressos, p_adicionais, true);
  return v;
end;
$$;

create or replace function public.liberar_reserva(p_pedido uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._exigir_equipe();
  perform public._liberar(p_pedido, 'cancelado');
end;
$$;

-- Cancela uma venda da recepção ou uma cortesia. Venda online usa desistência e estorno.
create or replace function public.cancelar_venda(p_pedido uuid, p_motivo text)
returns void language plpgsql security definer
set search_path = public
as $$
declare v_p public.pedidos%rowtype;
begin
  perform public._exigir_equipe();
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if v_p.id is null or v_p.canal not in ('presencial', 'cortesia') then
    raise exception 'Só vendas da recepção e cortesias podem ser canceladas aqui. Compras online usam a desistência.';
  end if;
  if v_p.status <> 'pago' then
    raise exception 'Esta venda não está paga.';
  end if;
  update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null
   where id in (select assento_id from public.ingressos where pedido_id = p_pedido and status = 'ativo');
  update public.ingressos set status = 'cancelado' where pedido_id = p_pedido and status = 'ativo';
  update public.pedidos set status = 'cancelado', motivo = trim(p_motivo) where id = p_pedido;
end;
$$;

-- Troca o lugar de um ingresso por outro livre da mesma sessão.
create or replace function public.trocar_lugar(p_ingresso uuid, p_novo_numero int, p_motivo text default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_i public.ingressos%rowtype;
  v_novo public.assentos%rowtype;
  v_antigo int;
  v_preco_novo int;
begin
  perform public._exigir_equipe();
  select * into v_i from public.ingressos where id = p_ingresso and status = 'ativo' for update;
  if v_i.id is null then
    raise exception 'Ingresso não encontrado.';
  end if;
  select * into v_novo from public.assentos where sessao_id = v_i.sessao_id and numero = p_novo_numero for update;
  if v_novo.id is null then
    raise exception 'Lugar não encontrado nesta sessão.';
  end if;
  if not (v_novo.status = 'livre' or (v_novo.status = 'reservado' and v_novo.reservado_ate <= now())) then
    raise exception 'O lugar % não está livre.', p_novo_numero;
  end if;
  select numero into v_antigo from public.assentos where id = v_i.assento_id;

  update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null where id = v_i.assento_id;
  update public.assentos set status = 'vendido', reserva_id = v_i.pedido_id, reservado_ate = null where id = v_novo.id;
  update public.ingressos set assento_id = v_novo.id where id = v_i.id;
  update public.pedidos set motivo = concat_ws(' | ', motivo, format('Troca %s para %s%s', v_antigo, p_novo_numero,
                                    case when coalesce(trim(p_motivo), '') <> '' then ': ' || trim(p_motivo) else '' end))
   where id = v_i.pedido_id;

  select public._preco(e.id, v_novo.setor_id, v_i.tipo) into v_preco_novo
  from public.eventos e join public.sessoes s on s.evento_id = e.id where s.id = v_i.sessao_id;

  return jsonb_build_object('de', v_antigo, 'para', p_novo_numero,
                            'diferenca_centavos', coalesce(v_preco_novo, v_i.valor_centavos) - v_i.valor_centavos);
end;
$$;

-- Cortesia: ingresso de R$ 0, fora da cota, com motivo.
create or replace function public.emitir_cortesia(p_sessao uuid, p_numeros int[], p_motivo text, p_familia uuid default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_res jsonb;
  v_pedido uuid;
begin
  perform public._exigir_equipe();
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe para quem é a cortesia.';
  end if;
  v_res := public._reservar(p_sessao, p_numeros, 'cortesia', p_familia, null, auth.uid());
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  v_pedido := (v_res ->> 'pedido_id')::uuid;
  update public.pedidos
     set ingressos_previstos = (
           select jsonb_agg(jsonb_build_object('assento_id', l.assento_id, 'sessao_id', l.sessao_id, 'numero', l.numero,
                                               'tipo', 'cortesia', 'categoria_meia', null, 'valor', 0))
           from public._lugares_do_pedido(v_pedido) l),
         valor_total_centavos = 0, forma_pagamento = 'cortesia', motivo = trim(p_motivo)
   where id = v_pedido;
  return v_res || public._finalizar(v_pedido);
end;
$$;

-- Retirada de ingressos físicos: encontra pelo QR do link (família ou pedido) ou de um ingresso.
create or replace function public.buscar_para_retirada(p_codigo text)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_familia uuid;
  v_pedido uuid;
begin
  perform public._exigir_equipe();
  select familia_id into v_familia from public.familia_links where token = p_codigo;
  if v_familia is null then
    select id into v_pedido from public.pedidos where acesso_token = p_codigo;
  end if;
  if v_familia is null and v_pedido is null then
    select pedido_id into v_pedido from public.ingressos where qr_token = p_codigo;
  end if;
  if v_familia is null and v_pedido is null then
    return null;
  end if;

  return jsonb_build_object(
    'familia_id', v_familia,
    'responsavel', (select responsavel_nome from public.familias where id = v_familia),
    'ingressos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'sessao', s.nome, 'numero', a.numero, 'fila', a.rotulo_fila, 'setor', st.nome,
        'tipo', i.tipo, 'pedido', p.codigo, 'entregue_em', i.entregue_em) order by s.ordem, a.numero)
      from public.ingressos i
      join public.pedidos p on p.id = i.pedido_id
      join public.assentos a on a.id = i.assento_id
      join public.sessoes s on s.id = i.sessao_id
      join public.setores st on st.id = a.setor_id
      where i.status = 'ativo'
        and ((v_familia is not null and p.familia_id = v_familia) or (v_pedido is not null and p.id = v_pedido))), '[]'::jsonb)
  );
end;
$$;

create or replace function public.marcar_entregues(p_ingressos uuid[], p_entregue boolean default true)
returns int language plpgsql security definer
set search_path = public
as $$
declare v_n int;
begin
  perform public._exigir_equipe();
  update public.ingressos
     set entregue_em = case when p_entregue then now() end,
         entregue_por = case when p_entregue then auth.uid() end
   where id = any (p_ingressos) and status = 'ativo';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Caixa do dia (fuso de Belém) por forma de pagamento. Admin vê todos; atendente vê o próprio.
create or replace function public.caixa_do_dia(p_evento uuid, p_data date, p_atendente uuid default null)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare v_atendente uuid;
begin
  perform public._exigir_equipe();
  v_atendente := case when public.is_admin() then p_atendente else auth.uid() end;
  return coalesce((
    select jsonb_object_agg(forma, jsonb_build_object('pedidos', n, 'total_centavos', total))
    from (
      select coalesce(p.forma_pagamento, 'sem_forma') as forma, count(*) as n, sum(p.valor_total_centavos) as total
      from public.pedidos p
      where p.evento_id = p_evento and p.canal = 'presencial' and p.status = 'pago'
        and (p.pago_em at time zone 'America/Belem')::date = p_data
        and (v_atendente is null or p.atendente_id = v_atendente)
      group by 1
    ) x), '{}'::jsonb);
end;
$$;

-- =====================================================================
-- SERVIDOR (família, público, Pagar.me, webhook, agendamentos)
-- =====================================================================

-- Tudo o que a página da família precisa, a partir do código do link.
create or replace function public.familia_painel(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_f public.familias%rowtype;
  v_e public.eventos%rowtype;
begin
  perform public._exigir_servidor();
  select f.* into v_f from public.familia_links l join public.familias f on f.id = l.familia_id
  where l.token = p_token and f.ativa;
  if v_f.id is null then
    return null;
  end if;
  select * into v_e from public.eventos where id = v_f.evento_id;

  return jsonb_build_object(
    'familia', jsonb_build_object('id', v_f.id, 'responsavel', v_f.responsavel_nome),
    'evento', jsonb_build_object('id', v_e.id, 'nome', v_e.nome, 'slug', v_e.slug, 'status', v_e.status, 'tema', v_e.tema,
                                 'imagem_capa', v_e.imagem_capa, 'meia_categorias', v_e.meia_categorias,
                                 'parcelamento_min_ingressos', v_e.parcelamento_min_ingressos, 'parcelas_max', v_e.parcelas_max,
                                 'modo_preco', public._modo_preco(v_e.id)),
    'bailarinas', coalesce((
      select jsonb_agg(jsonb_build_object('nome', public.primeiro_nome(b.nome),
        'sessoes', coalesce((select jsonb_agg(es.sessao_id) from public.escalacao es where es.bailarina_id = b.id), '[]'::jsonb))
        order by b.nome)
      from public.bailarinas b where b.familia_id = v_f.id and b.ativa), '[]'::jsonb),
    'sessoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'data_hora', s.data_hora,
        'abertura_portas', s.abertura_portas, 'saldo', public.saldo_familia(v_f.id, s.id),
        'dancam', (select count(*) from public.escalacao es join public.bailarinas b on b.id = es.bailarina_id
                   where es.sessao_id = s.id and b.familia_id = v_f.id and b.ativa)) order by s.ordem)
      from public.sessoes s where s.evento_id = v_e.id and s.ativa), '[]'::jsonb),
    'janelas', coalesce((select jsonb_agg(jsonb_build_object('tipo', j.tipo, 'inicio', j.inicio, 'fim', j.fim))
                         from public.janelas j where j.evento_id = v_e.id), '[]'::jsonb),
    'pode_comprar_agora', v_e.status = 'em_venda'
      and (public._janela_aberta(v_e.id, 'online_familias') or public._janela_aberta(v_e.id, 'publico')),
    'ingressos', coalesce((
      select jsonb_agg(jsonb_build_object('sessao_id', i.sessao_id, 'sessao', s.nome, 'numero', a.numero,
        'fila', a.rotulo_fila, 'setor', st.nome, 'tipo', i.tipo, 'qr', i.qr_token, 'entregue_em', i.entregue_em,
        'pedido', p.codigo) order by s.ordem, a.numero)
      from public.ingressos i
      join public.pedidos p on p.id = i.pedido_id
      join public.assentos a on a.id = i.assento_id
      join public.sessoes s on s.id = i.sessao_id
      join public.setores st on st.id = a.setor_id
      where p.familia_id = v_f.id and i.status = 'ativo'), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'acesso', p.acesso_token, 'canal', p.canal, 'status', p.status,
        'valor_total_centavos', p.valor_total_centavos, 'criado_em', p.criado_em, 'pago_em', p.pago_em,
        'expira_em', p.expira_em,
        'desistencia', (select jsonb_build_object('solicitada_em', d.solicitada_em, 'estornada_em', d.estornada_em)
                        from public.desistencias d where d.pedido_id = p.id),
        'desistir_ate', case when p.canal in ('online', 'publico') and p.status = 'pago'
                               and not exists (select 1 from public.desistencias d where d.pedido_id = p.id)
                             then p.pago_em + interval '7 days' end) order by p.criado_em desc)
      from public.pedidos p where p.familia_id = v_f.id and p.status not in ('cancelado', 'expirado')), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'nome', pr.nome, 'descricao', pr.descricao, 'foto_url', pr.foto_url,
        'preco_centavos', pr.preco_antecipado_centavos, 'entrega', pr.entrega,
        'disponivel', (select coalesce(min(public.estoque_disponivel(pe.estoque_id) / pe.quantidade), 999999)
                       from public.produto_estoque pe where pe.produto_id = pr.id),
        'lote', (select min(l.numero) from public.lotes l join public.produto_estoque pe on pe.estoque_id = l.estoque_id
                 where pe.produto_id = pr.id and l.aberto),
        'datas', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'data', d.data, 'vagas', public.vagas_disponiveis(d.id)) order by d.data nulls last)
                           from public.produto_datas d where d.produto_id = pr.id and d.ativa), '[]'::jsonb)) order by pr.ordem)
      from public.produtos pr
      where pr.evento_id = v_e.id and pr.ativo and (pr.venda_online_ate is null or now() < pr.venda_online_ate)), '[]'::jsonb),
    'conteudos', coalesce((select jsonb_object_agg(c.chave, c.texto) from public.conteudos c where c.evento_id = v_e.id), '{}'::jsonb),
    'configuracoes', coalesce((select jsonb_object_agg(cf.chave, cf.valor) from public.configuracoes cf
                               where cf.chave in ('whatsapp_recepcao', 'hora_inicio_atendimento', 'hora_fim_atendimento')), '{}'::jsonb),
    'termos', (select jsonb_build_object('id', t.id, 'versao', t.versao) from public.termos_versoes t
               where t.evento_id = v_e.id and t.tipo = 'termos' order by t.versao desc limit 1)
  );
end;
$$;

-- Reserva online. Com p_token_familia: link da família (janela das famílias e saldo,
-- ou regras do público depois da abertura). Sem token: compra pública.
create or replace function public.reservar_online(p_sessao uuid, p_numeros int[], p_token_familia text default null, p_acesso_pedido text default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_evento public.eventos%rowtype;
  v_familia uuid;
  v_pedido uuid;
  v_saldo int;
  v_ja_reservados int := 0;
  v_qtd int := coalesce(cardinality(p_numeros), 0);
  v_res jsonb;
begin
  perform public._exigir_servidor();
  select e.* into v_evento from public.eventos e join public.sessoes s on s.evento_id = e.id where s.id = p_sessao;
  if v_evento.id is null or v_evento.status <> 'em_venda' then
    raise exception 'A venda deste espetáculo não está aberta.';
  end if;

  if p_token_familia is not null then
    select f.id into v_familia from public.familia_links l join public.familias f on f.id = l.familia_id
    where l.token = p_token_familia and f.ativa and f.evento_id = v_evento.id;
    if v_familia is null then
      raise exception 'Este link não vale mais. Fale com a recepção.';
    end if;
  end if;

  if p_acesso_pedido is not null then
    select id into v_pedido from public.pedidos
    where acesso_token = p_acesso_pedido and status in ('reservado', 'aguardando_pagamento')
      and familia_id is not distinct from v_familia;
    if v_pedido is null then
      raise exception 'Este pedido não aceita mais lugares. Comece uma nova escolha.';
    end if;
    select count(*) into v_ja_reservados from public._lugares_do_pedido(v_pedido) l where l.sessao_id = p_sessao;
  end if;

  if v_familia is not null and public._janela_aberta(v_evento.id, 'online_familias') then
    v_saldo := public.saldo_familia(v_familia, p_sessao);
    if v_saldo is not null and v_qtd > v_saldo + v_ja_reservados then
      raise exception 'A família tem % lugar(es) disponível(is) nesta sessão.', v_saldo + v_ja_reservados;
    end if;
  elsif public._janela_aberta(v_evento.id, 'publico') then
    if v_qtd > v_evento.limite_por_pedido then
      raise exception 'Cada pedido pode ter até % ingressos.', v_evento.limite_por_pedido;
    end if;
  else
    raise exception 'A venda online ainda não está aberta.';
  end if;

  v_res := public._reservar(p_sessao, p_numeros, case when v_familia is null then 'publico' else 'online' end,
                           v_familia, v_pedido, null);

  -- A nova escolha substitui a anterior desta sessão no mesmo pedido.
  if (v_res ->> 'ok')::boolean and v_pedido is not null then
    update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null
     where reserva_id = v_pedido and sessao_id = p_sessao and status = 'reservado'
       and not (numero = any (p_numeros));
  end if;
  return v_res;
end;
$$;

create or replace function public._liberar_lugares_da_sessao(p_pedido uuid, p_sessao uuid)
returns void language sql security definer
set search_path = public
as $$
  update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null
   where reserva_id = p_pedido and sessao_id = p_sessao and status = 'reservado'
$$;

create or replace function public._pedido_por_acesso(p_acesso text)
returns uuid language sql stable security definer
set search_path = public
as $$
  select id from public.pedidos where acesso_token = p_acesso
$$;

-- Fecha o pedido online antes de ir à Pagar.me: compõe, grava pagador e aceite.
-- p_pagador: { "nome": "...", "cpf": "...", "email": "...", "celular": "..." }
create or replace function public.fechar_pedido_online(
  p_acesso text, p_ingressos jsonb, p_adicionais jsonb, p_pagador jsonb, p_forma text, p_parcelas int,
  p_termos_versao uuid, p_ip text default null
) returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_pedido uuid := public._pedido_por_acesso(p_acesso);
  v_comp jsonb;
  v_cpf text := regexp_replace(coalesce(p_pagador ->> 'cpf', ''), '\D', '', 'g');
  v_cel text := public.normalizar_whatsapp(p_pagador ->> 'celular');
  v_p public.pedidos%rowtype;
begin
  perform public._exigir_servidor();
  if v_pedido is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if p_forma not in ('pix', 'cartao') then
    raise exception 'Escolha PIX ou cartão.';
  end if;
  if coalesce(trim(p_pagador ->> 'nome'), '') = '' or length(v_cpf) <> 11 or coalesce(p_pagador ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_cel is null then
    raise exception 'Confira nome, CPF, e-mail e celular de quem paga.';
  end if;
  select * into v_p from public.pedidos where id = v_pedido;
  if p_termos_versao is null or not exists (
    select 1 from public.termos_versoes t where t.id = p_termos_versao and t.evento_id = v_p.evento_id and t.tipo = 'termos') then
    raise exception 'Aceite os termos de compra para continuar.';
  end if;

  v_comp := public._compor(v_pedido, p_ingressos, p_adicionais, false);
  perform public._validar_parcelas(v_pedido, p_forma, p_parcelas);

  update public.pedidos
     set pagador_nome = trim(p_pagador ->> 'nome'), pagador_cpf = v_cpf,
         pagador_email = lower(trim(p_pagador ->> 'email')), pagador_celular = v_cel,
         forma_pagamento = p_forma, parcelas = coalesce(p_parcelas, 1),
         termos_versao_id = p_termos_versao, aceite_em = now(), aceite_ip = nullif(p_ip, '')::inet,
         status = 'aguardando_pagamento'
   where id = v_pedido
  returning * into v_p;

  return v_comp || jsonb_build_object(
    'codigo', v_p.codigo,
    'expira_em', v_p.expira_em,
    'segundos_restantes', greatest(0, floor(extract(epoch from (v_p.expira_em - now()))))::int,
    'itens_pagarme', (
      select jsonb_agg(item) from (
        select jsonb_build_object('code', 'ING-' || (x ->> 'numero'), 'amount', (x ->> 'valor')::int, 'quantity', 1,
               'description', 'Ingresso, ' || s.nome || ', lugar ' || (x ->> 'numero')) as item
        from jsonb_array_elements(v_p.ingressos_previstos) x join public.sessoes s on s.id = (x ->> 'sessao_id')::uuid
        union all
        select jsonb_build_object('code', 'ADI-' || left(pi.produto_id::text, 8), 'amount', pi.valor_unitario_centavos,
               'quantity', pi.quantidade, 'description', pr.nome)
        from public.pedido_itens pi join public.produtos pr on pr.id = pi.produto_id where pi.pedido_id = v_pedido
      ) q)
  );
end;
$$;

create or replace function public.registrar_pagarme(p_acesso text, p_order_id text, p_charge_id text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._exigir_servidor();
  update public.pedidos
     set pagarme_order_id = p_order_id, pagarme_charge_id = p_charge_id,
         pagarme_pedidos = case when pagarme_pedidos ? p_order_id then pagarme_pedidos
                                else pagarme_pedidos || to_jsonb(p_order_id) end
   where acesso_token = p_acesso;
end;
$$;

-- Chamada só depois que o servidor reconsultou a Pagar.me e viu o pedido pago.
create or replace function public.finalizar_pedido_pago(p_pagarme_order_id text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare v_pedido uuid;
begin
  perform public._exigir_servidor();
  select id into v_pedido from public.pedidos
  where pagarme_order_id = p_pagarme_order_id or pagarme_pedidos ? p_pagarme_order_id
  limit 1;
  if v_pedido is null then
    raise exception 'Pedido da Pagar.me não encontrado: %', p_pagarme_order_id;
  end if;
  return public._finalizar(v_pedido);
end;
$$;

-- Pagamento recusado ou expirado na Pagar.me: o pedido volta a aceitar nova tentativa enquanto a reserva valer.
create or replace function public.marcar_pagamento_falhou(p_pagarme_order_id text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._exigir_servidor();
  update public.pedidos
     set status = case when expira_em > now() then 'reservado' else 'expirado' end,
         pagarme_order_id = null, pagarme_charge_id = null
   where pagarme_order_id = p_pagarme_order_id and status = 'aguardando_pagamento';
end;
$$;

-- Registra o evento do webhook. Devolve false se já foi recebido (idempotência).
create or replace function public.registrar_evento_pagamento(p_evento_id text, p_tipo text, p_payload jsonb)
returns boolean language plpgsql security definer
set search_path = public
as $$
begin
  perform public._exigir_servidor();
  insert into public.eventos_pagamento (evento_gateway_id, tipo, payload) values (p_evento_id, p_tipo, p_payload);
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.resultado_evento_pagamento(p_evento_id text, p_resultado text)
returns void language sql security definer
set search_path = public
as $$
  update public.eventos_pagamento set resultado = p_resultado where evento_gateway_id = p_evento_id
$$;

create or replace function public.liberar_reserva_online(p_acesso text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._exigir_servidor();
  perform public._liberar(public._pedido_por_acesso(p_acesso), 'cancelado');
end;
$$;

-- Pedido público (sem família), pelo código de acesso.
create or replace function public.pedido_publico(p_acesso text)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare v_p public.pedidos%rowtype;
begin
  perform public._exigir_servidor();
  select * into v_p from public.pedidos where acesso_token = p_acesso;
  if v_p.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'codigo', v_p.codigo, 'status', v_p.status, 'canal', v_p.canal, 'valor_total_centavos', v_p.valor_total_centavos,
    'forma_pagamento', v_p.forma_pagamento, 'parcelas', v_p.parcelas, 'expira_em', v_p.expira_em, 'pago_em', v_p.pago_em,
    'pagarme_order_id', v_p.pagarme_order_id, 'evento_id', v_p.evento_id, 'familia_id', v_p.familia_id,
    'previstos', v_p.ingressos_previstos,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('produto', pr.nome, 'quantidade', pi.quantidade,
                         'valor_unitario_centavos', pi.valor_unitario_centavos))
                       from public.pedido_itens pi join public.produtos pr on pr.id = pi.produto_id where pi.pedido_id = v_p.id), '[]'::jsonb),
    'ingressos', coalesce((
      select jsonb_agg(jsonb_build_object('sessao', s.nome, 'numero', a.numero, 'fila', a.rotulo_fila, 'setor', st.nome,
        'tipo', i.tipo, 'qr', i.qr_token, 'entregue_em', i.entregue_em) order by s.ordem, a.numero)
      from public.ingressos i join public.assentos a on a.id = i.assento_id
      join public.sessoes s on s.id = i.sessao_id join public.setores st on st.id = a.setor_id
      where i.pedido_id = v_p.id and i.status = 'ativo'), '[]'::jsonb),
    'desistir_ate', case when v_p.canal in ('online', 'publico') and v_p.status = 'pago'
                           and not exists (select 1 from public.desistencias d where d.pedido_id = v_p.id)
                         then v_p.pago_em + interval '7 days' end
  );
end;
$$;

-- Desistência (compra online, até 7 dias depois do pagamento).
create or replace function public.solicitar_desistencia(p_acesso text, p_motivo text default null)
returns void language plpgsql security definer
set search_path = public
as $$
declare v_p public.pedidos%rowtype;
begin
  perform public._exigir_servidor();
  select * into v_p from public.pedidos where acesso_token = p_acesso;
  if v_p.id is null or v_p.canal not in ('online', 'publico') or v_p.status <> 'pago' then
    raise exception 'Esta compra não pode ser desfeita por aqui. Fale com a recepção.';
  end if;
  if v_p.pago_em + interval '7 days' < now() then
    raise exception 'O prazo de 7 dias para desistir terminou.';
  end if;
  insert into public.desistencias (pedido_id, motivo) values (v_p.id, nullif(trim(p_motivo), ''))
    on conflict (pedido_id) do nothing;
end;
$$;

-- Admin aprova: devolve o que o servidor precisa para pedir o estorno à Pagar.me.
create or replace function public.aprovar_desistencia(p_pedido uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare v_p public.pedidos%rowtype;
begin
  if not (public.is_admin() or public._eh_servidor()) then
    raise exception 'Sem permissão.';
  end if;
  select * into v_p from public.pedidos where id = p_pedido;
  if v_p.id is null or v_p.pagarme_charge_id is null then
    raise exception 'Este pedido não tem pagamento online para estornar.';
  end if;
  if v_p.status = 'pago_sem_lugar' then
    insert into public.desistencias (pedido_id, motivo) values (p_pedido, 'Pago sem lugar')
      on conflict (pedido_id) do nothing;
  elsif v_p.status <> 'pago' or not exists (select 1 from public.desistencias where pedido_id = p_pedido and estornada_em is null) then
    raise exception 'Não há desistência pendente neste pedido.';
  end if;
  update public.desistencias set aprovada_por = coalesce(auth.uid(), aprovada_por), aprovada_em = now() where pedido_id = p_pedido;
  return jsonb_build_object('pagarme_charge_id', v_p.pagarme_charge_id, 'valor_total_centavos', v_p.valor_total_centavos);
end;
$$;

-- Só depois que a Pagar.me confirmou o estorno.
create or replace function public.concluir_estorno(p_pedido uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._exigir_servidor();
  update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null
   where id in (select assento_id from public.ingressos where pedido_id = p_pedido and status = 'ativo');
  update public.ingressos set status = 'cancelado' where pedido_id = p_pedido and status = 'ativo';
  update public.pedidos set status = 'estornado' where id = p_pedido and status in ('pago', 'pago_sem_lugar');
  update public.desistencias set estornada_em = now() where pedido_id = p_pedido;
end;
$$;

-- Expira reservas vencidas (com 2 minutos de folga para PIX pago no último segundo).
create or replace function public.expirar_reservas()
returns int language plpgsql security definer
set search_path = public
as $$
declare v_n int;
begin
  if not (public._eh_servidor() or current_user in ('postgres', 'supabase_admin')) then
    raise exception 'Sem permissão.';
  end if;
  with vencidos as (
    update public.pedidos set status = 'expirado'
     where status in ('reservado', 'aguardando_pagamento') and expira_em < now() - interval '2 minutes'
    returning id
  )
  update public.assentos set status = 'livre', reserva_id = null, reservado_ate = null
   where status = 'reservado' and reserva_id in (select id from vencidos);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Apaga contatos de famílias 30 dias (configurável) depois da última sessão do evento.
create or replace function public.apagar_contatos()
returns int language plpgsql security definer
set search_path = public
as $$
declare
  v_dias int := coalesce((select (valor #>> '{}')::int from public.configuracoes where chave = 'dias_apagar_contatos'), 30);
  v_n int;
begin
  if not (public._eh_servidor() or current_user in ('postgres', 'supabase_admin')) then
    raise exception 'Sem permissão.';
  end if;
  with alvo as (
    select e.id from public.eventos e
    where (select max(s.data_hora) from public.sessoes s where s.evento_id = e.id) + make_interval(days => v_dias) < now()
  )
  delete from public.familias f using alvo where f.evento_id = alvo.id;
  get diagnostics v_n = row_count;
  update public.pedidos p set pagador_email = null, pagador_celular = null
   from public.eventos e
   where p.evento_id = e.id
     and (select max(s.data_hora) from public.sessoes s where s.evento_id = e.id) + make_interval(days => v_dias) < now()
     and (p.pagador_email is not null or p.pagador_celular is not null);
  return v_n;
end;
$$;

-- O comprovante da recepção não leva o link: a atendente nunca vê o código da família.
update public.conteudos
   set texto = $t${{responsavel}}, os lugares de vocês em O Quebra-Nozes:
{{lista_ingressos}}
Os ingressos com QR também ficam no link da família que vocês receberam no WhatsApp.$t$
 where chave = 'comprovante_presencial' and texto like '%{{link}}%';

-- =====================================================================
-- Tempo real e agendamentos
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'assentos') then
    execute 'alter publication supabase_realtime add table public.assentos';
  end if;
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname in ('bilheteria-expirar-reservas', 'bilheteria-apagar-contatos');
  perform cron.schedule('bilheteria-expirar-reservas', '* * * * *', 'select public.expirar_reservas()');
  perform cron.schedule('bilheteria-apagar-contatos', '15 3 * * *', 'select public.apagar_contatos()');
exception when others then
  raise notice 'Agendamento indisponível (%). As reservas vencidas continuam sendo tratadas como livres na hora da compra.', sqlerrm;
end $$;

-- =====================================================================
-- Permissões de execução
-- =====================================================================

revoke execute on function
  public._eh_servidor(), public._exigir_equipe(), public._exigir_servidor(), public._janela_aberta(uuid, text),
  public._preco(uuid, uuid, text, timestamptz), public._modo_preco(uuid, timestamptz),
  public._reservar(uuid, int[], text, uuid, uuid, uuid), public._lugares_do_pedido(uuid), public._liberar(uuid, text),
  public._compor(uuid, jsonb, jsonb, boolean), public._validar_parcelas(uuid, text, int), public._finalizar(uuid),
  public._liberar_lugares_da_sessao(uuid, uuid), public._pedido_por_acesso(text),
  public.familia_painel(text), public.reservar_online(uuid, int[], text, text),
  public.fechar_pedido_online(text, jsonb, jsonb, jsonb, text, int, uuid, text),
  public.registrar_pagarme(text, text, text), public.finalizar_pedido_pago(text), public.marcar_pagamento_falhou(text),
  public.registrar_evento_pagamento(text, text, jsonb), public.resultado_evento_pagamento(text, text),
  public.liberar_reserva_online(text), public.pedido_publico(text), public.solicitar_desistencia(text, text),
  public.concluir_estorno(uuid), public.expirar_reservas(), public.apagar_contatos(),
  public.reservar_presencial(uuid, int[], uuid, uuid), public.registrar_venda_presencial(uuid, jsonb, jsonb, text, int, int),
  public.previa_pedido(uuid, jsonb, jsonb), public.liberar_reserva(uuid), public.cancelar_venda(uuid, text),
  public.trocar_lugar(uuid, int, text), public.emitir_cortesia(uuid, int[], text, uuid),
  public.buscar_para_retirada(text), public.marcar_entregues(uuid[], boolean), public.caixa_do_dia(uuid, date, uuid),
  public.aprovar_desistencia(uuid), public.mapa_da_sessao(uuid), public.meias_disponiveis(uuid), public.primeiro_nome(text)
from public, anon, authenticated;

-- Leitura pública sem dado pessoal.
grant execute on function public.mapa_da_sessao(uuid), public.meias_disponiveis(uuid) to anon, authenticated;

-- Equipe (as funções conferem o papel por dentro).
grant execute on function
  public.reservar_presencial(uuid, int[], uuid, uuid), public.registrar_venda_presencial(uuid, jsonb, jsonb, text, int, int),
  public.previa_pedido(uuid, jsonb, jsonb), public.liberar_reserva(uuid), public.cancelar_venda(uuid, text),
  public.trocar_lugar(uuid, int, text), public.emitir_cortesia(uuid, int[], text, uuid),
  public.buscar_para_retirada(text), public.marcar_entregues(uuid[], boolean), public.caixa_do_dia(uuid, date, uuid),
  public.aprovar_desistencia(uuid), public.primeiro_nome(text)
to authenticated;

-- Servidor (chave de serviço).
grant execute on all functions in schema public to service_role;
