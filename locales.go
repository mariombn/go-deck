package main

import (
	"io/fs"
	"log"

	"embed"

	"go-deck/internal/i18n"
)

// Os arquivos de tradução são compartilhados com o frontend (decisão P4): o
// React os importa via import.meta.glob e o Go os embute aqui. Como //go:embed
// não aceita "..", o embed precisa morar num pacote na raiz (como main.go faz
// com frontend/dist) e o fs.FS é injetado no pacote i18n — mesmo padrão de
// injeção do assets do servidor.
//
//go:embed frontend/src/locales/*.json
var localesFS embed.FS

// loadLocales carrega os catálogos de tradução no pacote i18n. Falha aqui é
// não-fatal: sem catálogos, i18n.Translate cai para a mensagem crua do erro.
func loadLocales() {
	sub, err := fs.Sub(localesFS, "frontend/src/locales")
	if err != nil {
		log.Printf("i18n: sub FS dos locales: %v", err)
		return
	}
	if err := i18n.Load(sub); err != nil {
		log.Printf("i18n: carregando locales: %v", err)
	}
}
