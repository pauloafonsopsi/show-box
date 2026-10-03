ALTER TABLE public.eventos ADD COLUMN fatura_cartao text;
ALTER TABLE public.eventos ADD CONSTRAINT eventos_fatura_cartao_formato
  CHECK (fatura_cartao IS NULL OR fatura_cartao ~ '^[A-Z0-9 ]{3,13}$');
UPDATE public.eventos SET fatura_cartao = 'QUEBRA NOZES' WHERE nome ILIKE '%quebra%nozes%';