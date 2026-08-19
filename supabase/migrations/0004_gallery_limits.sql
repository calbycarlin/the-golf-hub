-- The gallery bucket had no file size or type limits, so anyone with the
-- join code (no restriction on photo upload, by design) could upload
-- arbitrarily large or non-image files. This is enforced at the Storage
-- API level — unlike a client-side check, it can't be bypassed by calling
-- the upload endpoint directly.

update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB, comfortably above a typical phone photo
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
where id = 'gallery';
