package server

import (
	"net"
	"sort"
	"strings"
)

// virtualAdapterHints são trechos de nome de adaptadores que NÃO queremos
// oferecer como IP de acesso do celular (WSL, VMs, Docker, VPNs, etc.).
// Codificar o IP de um adaptador virtual no QR é a causa clássica de
// "escaneei e não conecta".
var virtualAdapterHints = []string{
	"vethernet", "wsl", "virtualbox", "vmware", "hyper-v",
	"default switch", "docker", "loopback", "bluetooth",
	"tailscale", "zerotier", "tap-", "tun", "npcap",
}

// DetectLANIPs devolve os IPv4 privados candidatos para acesso na LAN,
// ordenados pela probabilidade de serem o "certo" (192.168 > 10 > 172).
func DetectLANIPs() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	var out []string
	for _, ifc := range ifaces {
		if ifc.Flags&net.FlagUp == 0 || ifc.Flags&net.FlagLoopback != 0 {
			continue
		}
		if isVirtualAdapter(ifc.Name) {
			continue
		}
		addrs, err := ifc.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			var ip net.IP
			switch v := a.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.To4() == nil || !ip.IsPrivate() {
				continue
			}
			out = append(out, ip.String())
		}
	}

	sort.SliceStable(out, func(i, j int) bool {
		return rankIP(out[i]) < rankIP(out[j])
	})
	return out
}

func isVirtualAdapter(name string) bool {
	n := strings.ToLower(name)
	for _, hint := range virtualAdapterHints {
		if strings.Contains(n, hint) {
			return true
		}
	}
	return false
}

// rankIP prioriza as faixas privadas mais comuns em redes domésticas.
func rankIP(ip string) int {
	switch {
	case strings.HasPrefix(ip, "192.168."):
		return 0
	case strings.HasPrefix(ip, "10."):
		return 1
	default: // 172.16–31.x
		return 2
	}
}
