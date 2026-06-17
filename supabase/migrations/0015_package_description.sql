-- Add an optional free-text description to packages.
-- Shown on the package create/edit form and as a subtitle in the packages list.
-- Nullable: existing rows and packages created without a description stay NULL.
-- The existing `tenant_isolation` RLS policy on packages (FOR ALL) already covers
-- this column, so no policy change is required.
alter table public.packages add column description text;
