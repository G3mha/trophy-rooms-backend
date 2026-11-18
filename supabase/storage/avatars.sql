-- Profile pictures. Applied by hand in the Supabase SQL editor (Prisma only
-- manages the public schema).
--
-- Private bucket: nobody reads objects directly. The API signs short-lived
-- URLs with the service key (src/lib/supabase.ts), and deletes old files
-- itself, so signed-in users only need to insert into their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload avatars into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
