alter function public.normalizar_whatsapp(text) set search_path = public;
alter function public.tocar_atualizado_em() set search_path = public;
alter function public.proteger_ultimo_admin() set search_path = public;

-- Define em quais sessões a bailarina dança. Substitui a escalação inteira dela.
create or replace function public.definir_escalacao(p_bailarina uuid, p_sessoes uuid[])
returns int language plpgsql security definer
set search_path = public
as $$
declare
  v_evento uuid;
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;

  select evento_id into v_evento from public.bailarinas where id = p_bailarina;
  if v_evento is null then
    raise exception 'Bailarina não encontrada.';
  end if;
  if coalesce(cardinality(p_sessoes), 0) = 0 then
    raise exception 'Marque pelo menos um dia.';
  end if;
  if exists (
    select 1 from unnest(p_sessoes) s(id)
    where not exists (select 1 from public.sessoes ss where ss.id = s.id and ss.evento_id = v_evento)
  ) then
    raise exception 'Um dos dias não pertence a este evento.';
  end if;

  delete from public.escalacao where bailarina_id = p_bailarina;
  insert into public.escalacao (bailarina_id, sessao_id)
  select distinct p_bailarina, s.id from unnest(p_sessoes) s(id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.definir_escalacao(uuid, uuid[]) from public, anon;
grant execute on function public.definir_escalacao(uuid, uuid[]) to authenticated;