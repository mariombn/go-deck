# Traduções / Translations

> **EN (TL;DR):** To add a language, copy `frontend/src/locales/en.json` to
> `frontend/src/locales/<code>.json` (e.g. `es.json`, `fr.json`, `de.json`),
> translate the **values** (not the keys), set `_meta.nativeName`, run
> `npm run check:locales` inside `frontend/`, and open a PR. The language shows
> up in the in-app selector automatically. Partial translations are welcome —
> missing keys fall back to English.

O go-deck tem suporte a múltiplos idiomas. O idioma base é o **inglês**
(`en.json`) e há uma tradução de **português do Brasil** (`pt-BR.json`).
Contribuições de novos idiomas são muito bem-vindas.

## Como adicionar um idioma

1. **Copie** `frontend/src/locales/en.json` para
   `frontend/src/locales/<código>.json`. O código vira o nome do arquivo —
   use o padrão BCP-47: `es` (espanhol), `fr` (francês), `de` (alemão),
   `pt-PT` (português de Portugal), `es-419` (espanhol da América Latina) etc.
2. **Traduza os _valores_**, nunca as chaves. As chaves (`buttonEditor.save`,
   `errors.action.keypressNoKeys`, …) são identificadores estáveis e devem
   ficar idênticas ao `en.json`.
3. **Ajuste o `_meta`** no topo do arquivo:
   ```json
   "_meta": { "nativeName": "Español", "englishName": "Spanish" }
   ```
   `nativeName` é o nome exibido no seletor de idiomas (escreva no próprio
   idioma). `englishName` é opcional e só ajuda na revisão do PR.
4. **Valide** rodando, dentro de `frontend/`:
   ```sh
   npm run check:locales
   ```
   Ele aponta JSON inválido, `_meta.nativeName` faltando, chaves divergentes do
   inglês e placeholders quebrados.
5. **Abra o PR.** O idioma aparece sozinho no seletor (descoberta automática) —
   não há nenhum registro para editar.

## Regras importantes

- **Placeholders `{{var}}` são literais.** Em `"step {{n}}: {{detail}}"`, o
  `{{n}}` e o `{{detail}}` precisam aparecer **iguais** na sua tradução (a
  ordem pode mudar conforme a gramática do idioma). Não traduza o nome dentro
  das chaves.
- **Não traduza marcações `<1>…</1>`.** Em textos como o do Discord/OBS, o
  `<1>…</1>` marca trechos com formatação (negrito/itálico). Mantenha o par e
  traduza só o texto entre eles.
- **Plurais.** O inglês usa as chaves `..._one` e `..._other` (ex.:
  `actions.summary.steps_one` / `_other`). Seu idioma pode precisar de outras
  formas (`_few`, `_many`, `_zero`) — adicione conforme as regras de plural do
  idioma (veja a [referência de plurais do CLDR](https://cldr.unicode.org/index/cldr-spec/plural-rules)).
  O validador compara a chave **base**, então formas de plural diferentes não
  são reportadas como erro.
- **Tradução parcial é OK.** Qualquer chave ausente cai para o inglês
  automaticamente, então um PR incompleto já é útil e pode ser completado
  depois. O `en.json` é o único que mantemos 100%.
- **Idiomas RTL** (árabe, hebraico, persa): a tradução do texto é bem-vinda,
  mas o **espelhamento de layout (RTL) ainda não é suportado** — abra uma issue
  se quiser ajudar com isso.

## Onde os textos aparecem

Os mesmos arquivos JSON são usados pelo app React (UI do desktop e do celular)
**e** pelo backend Go (mensagens de erro). Ou seja: um único arquivo por idioma
cobre tudo. As chaves de erro ficam sob o namespace `errors.*`.

O idioma é global: o dono escolhe no painel de configurações do desktop
(engrenagem → **Idioma**), e a escolha vale para o editor desktop, para os
celulares conectados e para as mensagens de erro do backend.
