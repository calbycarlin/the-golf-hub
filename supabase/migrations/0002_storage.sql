-- Storage bucket for the photo gallery. Public bucket: anyone with the
-- join code can already see event photos per spec, and uploads have no
-- moderation step, so this mirrors the table-level policies in 0001.

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy "public read gallery objects"
on storage.objects for select
using (bucket_id = 'gallery');

create policy "public upload gallery objects"
on storage.objects for insert
with check (bucket_id = 'gallery');
