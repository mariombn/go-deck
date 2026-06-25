package server

import (
	"net"
	"testing"
)

// TestDetectLANIPsSmoke: roda sem panic e todo IP devolvido é IPv4 privado.
// O conjunto depende da máquina; em CI sem rede privada pode vir vazio/nil
// (a função devolve nil quando não há candidatos — não asserimos não-nil para
// não ficar flaky; ver nota no resultado final).
func TestDetectLANIPsSmoke(t *testing.T) {
	ips := DetectLANIPs()
	for _, ip := range ips {
		parsed := net.ParseIP(ip)
		if parsed == nil || parsed.To4() == nil || !parsed.IsPrivate() {
			t.Fatalf("IP candidato %q não é IPv4 privado", ip)
		}
	}
}

func TestIsVirtualAdapter(t *testing.T) {
	casos := []struct {
		nome    string
		virtual bool
	}{
		{"Ethernet", false},
		{"Wi-Fi", false},
		{"vEthernet (WSL)", true},
		{"VirtualBox Host-Only Network", true},
		{"VMware Network Adapter VMnet8", true},
		{"Docker Desktop", true},
		{"Tailscale", true},
		{"Loopback Pseudo-Interface 1", true},
		{"Bluetooth Network Connection", true},
	}
	for _, tc := range casos {
		t.Run(tc.nome, func(t *testing.T) {
			if got := isVirtualAdapter(tc.nome); got != tc.virtual {
				t.Fatalf("isVirtualAdapter(%q) = %v, quero %v", tc.nome, got, tc.virtual)
			}
		})
	}
}

func TestRankIP(t *testing.T) {
	// 192.168 deve vir antes de 10, que vem antes do resto (172.16-31).
	if rankIP("192.168.0.1") >= rankIP("10.0.0.1") {
		t.Fatal("192.168 deveria ter rank menor (maior prioridade) que 10.x")
	}
	if rankIP("10.0.0.1") >= rankIP("172.16.0.1") {
		t.Fatal("10.x deveria ter rank menor que 172.x")
	}
}
