create policy produtos_admin_insere on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and public.is_admin());

create policy produtos_admin_altera on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.is_admin());

create policy produtos_admin_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.is_admin());
