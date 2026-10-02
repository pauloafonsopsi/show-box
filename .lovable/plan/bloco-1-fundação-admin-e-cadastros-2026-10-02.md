# Bloco 1: fundação, admin e cadastros

Executar o PROMPT_BLOCO_1 exatamente na ordem pedida, aplicando os arquivos do Claude sem alteração.

## Ordem
1. Ativar o Lovable Cloud.
2. Migration 1: `bilheteria_fundacao.sql`, idêntica ao anexo.
3. Migration 2: `carga_quebra_nozes_2026.sql`, idêntica ao anexo.
4. Gravar arquivos do Claude: `AGENTS.md` (raiz, mantendo o bloco LOVABLE), `src/styles.css`, `src/design/grade.ts`, `src/design/palco.tsx`, `src/design/editor-de-grade.tsx`. Dependências deles já existem no projeto (`Button`, `cn`, `lucide-react`).
5. `__root.tsx`: `lang="pt-BR"`, título "Bilheteria", descrição, fontes via `<link>`, 404 e erro em português com tokens, `Toaster` do sonner.
6. `/entrar` (entrar, recuperar senha, ativar administrador, mensagem sem acesso) e `/bilheteria` provisória. Proteção das rotas `/admin/**` com checagem de papel no carregamento, `ssr: false`.
7. Estrutura do admin (menu lateral recolhível, trilha) e Painel.
8. Eventos: lista, novo evento e as 7 abas como rotas filhas (visão geral, sessões com congelar e bloqueios, preços e calendário, elenco com importação xlsx/csv via `read-excel-file`, envio com WhatsApp, adicionais com foto WebP no bucket `produtos`, conteúdos e termos).
9. Locais e mapas com `EditorDeGrade` carregado sob demanda; no celular só visualização.
10. Edge function `equipe` + tela Equipe (listar, convidar, trocar papel, remover).
11. Configurações (campo por tipo, quem mudou, política de privacidade) e Auditoria (paginada, filtros na URL).
12. Página `/` estática no modo Palco com Proscênio e link "Entrar".
13. Teste no navegador em 360 px e 1280 px dos 10 critérios de aceite (o item da planilha depende do arquivo real enviado por você).

## Pontos de atenção (paro e explico se ocorrerem)
- Se qualquer migration ou arquivo do Claude falhar ao aplicar ou compilar, paro antes de mexer.
- A edge function `equipe` é pedida explicitamente; o padrão desta plataforma prefere funções de servidor do próprio app, mas sigo a especificação.
- Nenhuma tabela, coluna ou política nova. Necessidades extras vão na lista final.

## Detalhes técnicos
- Leituras pelo cliente do Cloud com colunas explícitas e paginação; escritas sensíveis só pelas RPCs da seção 5.
- Estado de aba, busca, filtro e página em search params validados com Zod.
- Rascunho da edição de bailarina persistido em `sessionStorage` (critério 9).
- Fechamento no formato exigido: "Editável no painel em" / "Ficou no código porque", o que não fiz e riscos.
