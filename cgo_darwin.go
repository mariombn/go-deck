//go:build darwin

package main

// O SDK do macOS 15 (Xcode 16) deixou de fazer auto-link do framework
// UniformTypeIdentifiers. O frontend darwin do Wails referencia a classe
// `UTType` desse framework, então um `go build`/`go test` puro do binário não
// resolve o símbolo `_OBJC_CLASS_$_UTType` e a etapa de link falha. Linkamos o
// framework explicitamente aqui (as LDFLAGS de cgo de qualquer pacote do build
// vão para o link final). É um arquivo só-de-link: não usa nada de C.
//
// `wails build` continua sendo a via oficial de empacotamento; isto apenas
// mantém o `go build ./...` da CI (e dev local) fechando o binário no SDK novo.

/*
#cgo LDFLAGS: -framework UniformTypeIdentifiers
*/
import "C"
