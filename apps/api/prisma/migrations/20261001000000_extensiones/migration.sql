-- Extensiones de PostgreSQL que usa el esquema. Van en su propia migración,
-- antes que las tablas, porque los tipos e índices dependen de ellas.

-- Emails insensibles a mayúsculas.
CREATE EXTENSION IF NOT EXISTS citext;
-- Índices de trigramas para búsqueda por texto parcial.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Quitar acentos del texto de búsqueda.
CREATE EXTENSION IF NOT EXISTS unaccent;
-- Combinar igualdad y rangos en la restricción de superposición de canchas.
CREATE EXTENSION IF NOT EXISTS btree_gist;
