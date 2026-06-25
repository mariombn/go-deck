package server

import (
	"encoding/json"
	"testing"
	"time"
)

// recvComTimeout lê um []byte de um canal, falhando se nada chegar a tempo.
func recvComTimeout(t *testing.T, ch <-chan []byte, dentro time.Duration) []byte {
	t.Helper()
	select {
	case msg := <-ch:
		return msg
	case <-time.After(dentro):
		t.Fatal("timeout esperando mensagem no canal send")
		return nil
	}
}

// Os testes do hub exercitam apenas a lógica de canais (register/unregister/
// broadcast) e o handlePress — nenhum deles toca o *websocket.Conn do client,
// então usamos clients com conn nil e canal send bufferizado. readPump/writePump
// NÃO são cobertos por dependerem de uma conexão real (ver resultado final).

func TestHubRegisterEnviaInitial(t *testing.T) {
	h := newHub()
	h.initial = func() []byte { return []byte(`{"type":"config"}`) }
	go h.run()

	c := &client{hub: h, send: make(chan []byte, 4)}
	h.register <- c

	msg := recvComTimeout(t, c.send, time.Second)
	if string(msg) != `{"type":"config"}` {
		t.Fatalf("initial = %q, quero a config inicial", msg)
	}
}

func TestHubBroadcastEntregaAosClientes(t *testing.T) {
	h := newHub()
	go h.run()

	c1 := &client{hub: h, send: make(chan []byte, 4)}
	c2 := &client{hub: h, send: make(chan []byte, 4)}
	h.register <- c1
	h.register <- c2

	h.broadcast <- []byte("oi")

	if got := recvComTimeout(t, c1.send, time.Second); string(got) != "oi" {
		t.Fatalf("c1 recebeu %q, quero oi", got)
	}
	if got := recvComTimeout(t, c2.send, time.Second); string(got) != "oi" {
		t.Fatalf("c2 recebeu %q, quero oi", got)
	}
}

func TestHubUnregisterRemoveEFechaSend(t *testing.T) {
	h := newHub()
	go h.run()

	c := &client{hub: h, send: make(chan []byte, 4)}
	h.register <- c
	h.unregister <- c

	// Após unregister, o canal send é fechado: uma leitura devolve ok=false.
	// Sondamos com um pequeno backoff até o run() processar o unregister.
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		select {
		case _, ok := <-c.send:
			if ok {
				continue // ainda há mensagens bufferizadas; drena
			}
			return // canal fechado: comportamento esperado
		default:
			time.Sleep(5 * time.Millisecond)
		}
	}
	t.Fatal("canal send deveria ter sido fechado após unregister")
}

// TestHubBroadcastDescartaClienteLento: se o canal send do cliente está cheio,
// o broadcast o descarta e fecha (cliente lento). Usamos um buffer 0 (sem
// espaço) para forçar o descarte na primeira mensagem.
func TestHubBroadcastDescartaClienteLento(t *testing.T) {
	h := newHub()
	go h.run()

	lento := &client{hub: h, send: make(chan []byte)} // sem buffer
	h.register <- lento

	h.broadcast <- []byte("msg")

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		select {
		case _, ok := <-lento.send:
			if !ok {
				return // descartado e fechado: esperado
			}
		default:
			time.Sleep(5 * time.Millisecond)
		}
	}
	t.Fatal("cliente lento deveria ter sido descartado (send fechado)")
}

// TestHandlePressEnviaAckOK: handlePress chama onPress e empacota um ack OK no
// canal send do cliente.
func TestHandlePressEnviaAckOK(t *testing.T) {
	h := newHub()
	var pressedID string
	h.onPress = func(id string) (bool, string) {
		pressedID = id
		return true, ""
	}
	c := &client{hub: h, send: make(chan []byte, 1)}

	c.handlePress("btn_abc")

	if pressedID != "btn_abc" {
		t.Fatalf("onPress recebeu %q, quero btn_abc", pressedID)
	}
	var ack ackMessage
	if err := json.Unmarshal(recvComTimeout(t, c.send, time.Second), &ack); err != nil {
		t.Fatalf("ack inválido: %v", err)
	}
	if ack.Type != "ack" || ack.ButtonID != "btn_abc" || !ack.OK || ack.Error != "" {
		t.Fatalf("ack = %+v, quero {ack btn_abc true \"\"}", ack)
	}
}

// TestHandlePressEnviaAckErro: quando onPress devolve erro, o ack carrega
// OK=false e a mensagem.
func TestHandlePressEnviaAckErro(t *testing.T) {
	h := newHub()
	h.onPress = func(id string) (bool, string) {
		return false, "errors.server.buttonNotFound"
	}
	c := &client{hub: h, send: make(chan []byte, 1)}

	c.handlePress("btn_x")

	var ack ackMessage
	if err := json.Unmarshal(recvComTimeout(t, c.send, time.Second), &ack); err != nil {
		t.Fatalf("ack inválido: %v", err)
	}
	if ack.OK || ack.Error != "errors.server.buttonNotFound" {
		t.Fatalf("ack = %+v, quero OK=false com a chave de erro", ack)
	}
}
