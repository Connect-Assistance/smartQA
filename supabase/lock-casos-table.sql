-- Cierra el acceso directo con la anon key a smartqa_casos.
-- A partir de esto, la única forma de leer o escribir en esta tabla es a
-- través de la Azure Function casosApi (que usa la service role key, nunca
-- expuesta, y exige un token de Firebase válido antes de tocar nada).

drop policy if exists smartqa_casos_anon_read on smartqa_casos;
drop policy if exists smartqa_casos_anon_insert on smartqa_casos;

-- RLS se queda activado (ya lo estaba) y ahora sin ninguna política para
-- "anon" — cualquier request con la anon key va a fallar. Solo el service
-- role (que ignora RLS por diseño en Supabase) puede tocar la tabla.
