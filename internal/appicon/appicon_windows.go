//go:build windows

package appicon

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"syscall"
	"unsafe"

	"go-deck/internal/i18n"

	"golang.org/x/sys/windows"
)

// winProvider extrai ícones via Win32 puro (syscall, sem CGO) — coerente com
// sendinput_windows.go e launcher_windows.go.
type winProvider struct{}

func newProvider() Provider { return winProvider{} }

var (
	modshell32 = windows.NewLazySystemDLL("shell32.dll")
	moduser32  = windows.NewLazySystemDLL("user32.dll")
	modgdi32   = windows.NewLazySystemDLL("gdi32.dll")
	modole32   = windows.NewLazySystemDLL("ole32.dll")

	procSHGetFileInfoW = modshell32.NewProc("SHGetFileInfoW")
	procSHGetImageList = modshell32.NewProc("SHGetImageList")
	procDestroyIcon    = moduser32.NewProc("DestroyIcon")
	procGetIconInfo    = moduser32.NewProc("GetIconInfo")
	procGetDC          = moduser32.NewProc("GetDC")
	procReleaseDC      = moduser32.NewProc("ReleaseDC")
	procGetObjectW     = modgdi32.NewProc("GetObjectW")
	procGetDIBits      = modgdi32.NewProc("GetDIBits")
	procDeleteObject   = modgdi32.NewProc("DeleteObject")
	procCoInitializeEx = modole32.NewProc("CoInitializeEx")
	procCoUninitialize = modole32.NewProc("CoUninitialize")
)

const (
	shgfiIcon         = 0x00000100
	shgfiSysIconIndex = 0x00004000
	shilJumbo         = 0x4 // lista de imagens 256×256
	ildTransparent    = 0x1
	dibRGBColors      = 0
)

// IID_IImageList — necessário para SHGetImageList devolver a lista jumbo.
var iidImageList = windows.GUID{
	Data1: 0x46EB5926, Data2: 0x582E, Data3: 0x4017,
	Data4: [8]byte{0x9F, 0xDF, 0xE8, 0x99, 0x8D, 0xAA, 0x09, 0x50},
}

type shFileInfo struct {
	hIcon         uintptr
	iIcon         int32
	dwAttributes  uint32
	szDisplayName [260]uint16
	szTypeName    [80]uint16
}

type iconInfo struct {
	fIcon    int32
	xHotspot uint32
	yHotspot uint32
	hbmMask  uintptr
	hbmColor uintptr
}

type bitmapStruct struct {
	bmType       int32
	bmWidth      int32
	bmHeight     int32
	bmWidthBytes int32
	bmPlanes     uint16
	bmBitsPixel  uint16
	bmBits       uintptr
}

type bitmapInfoHeader struct {
	biSize          uint32
	biWidth         int32
	biHeight        int32
	biPlanes        uint16
	biBitCount      uint16
	biCompression   uint32
	biSizeImage     uint32
	biXPelsPerMeter int32
	biYPelsPerMeter int32
	biClrUsed       uint32
	biClrImportant  uint32
}

// withCOM trava a goroutine numa thread do SO e inicializa o COM para a
// duração de fn. SHGetImageList/IImageList são COM e o agendador do Go troca
// goroutines de thread livremente; sem isso o ícone jumbo pode falhar
// intermitentemente.
func withCOM(fn func()) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	// COINIT_APARTMENTTHREADED = 0x2. S_OK(0)/S_FALSE(1) ⇒ ok; só damos
	// CoUninitialize se nós é que inicializamos (hr >= 0).
	hr, _, _ := procCoInitializeEx.Call(0, 0x2)
	if int32(hr) >= 0 {
		defer procCoUninitialize.Call()
	}
	fn()
}

func (winProvider) Extract(path string) (string, error) {
	var out string
	var err error
	withCOM(func() { out, err = extractIconLocked(path) })
	return out, err
}

func (winProvider) List() ([]AppEntry, error) {
	entries := []AppEntry{}
	seen := map[string]bool{}
	withCOM(func() {
		for _, dir := range startMenuDirs() {
			_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
				if err != nil || d.IsDir() {
					return nil
				}
				if !strings.EqualFold(filepath.Ext(path), ".lnk") {
					return nil
				}
				name := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
				low := strings.ToLower(name)
				// Atalhos de manutenção poluem a lista e raramente são úteis
				// como ícone de botão.
				if strings.Contains(low, "uninstall") || strings.Contains(low, "desinstal") {
					return nil
				}
				if seen[low] {
					return nil
				}
				seen[low] = true
				icon, _ := extractIconLocked(path) // erro ⇒ ícone vazio, app ainda listado
				entries = append(entries, AppEntry{Name: name, Path: path, Icon: icon})
				return nil
			})
		}
	})
	sort.Slice(entries, func(i, j int) bool {
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return entries, nil
}

func startMenuDirs() []string {
	var dirs []string
	if pd := os.Getenv("ProgramData"); pd != "" {
		dirs = append(dirs, filepath.Join(pd, `Microsoft\Windows\Start Menu\Programs`))
	}
	if ad := os.Getenv("AppData"); ad != "" {
		dirs = append(dirs, filepath.Join(ad, `Microsoft\Windows\Start Menu\Programs`))
	}
	return dirs
}

// extractIconLocked faz o trabalho de extração assumindo que o COM já está
// inicializado na thread atual (ver withCOM).
func extractIconLocked(path string) (string, error) {
	hicon, err := jumboIcon(path)
	if err != nil || hicon == 0 {
		// Sem jumbo (ou COM indisponível) caímos no ícone padrão de 32px.
		hicon, err = largeIcon(path)
		if err != nil || hicon == 0 {
			return "", i18n.New("errors.appicon.iconUnavailable", map[string]any{"path": path})
		}
	}
	defer procDestroyIcon.Call(hicon)

	img, err := iconToImage(hicon)
	if err != nil {
		return "", err
	}
	img = trimTransparent(img)
	img = scaleToFit(img, 128)
	return encodePNGDataURL(img)
}

// jumboIcon pega o índice do ícone no system image list e extrai a variante
// jumbo (256px) via IImageList::GetIcon.
func jumboIcon(path string) (uintptr, error) {
	p16, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	var sfi shFileInfo
	r, _, _ := procSHGetFileInfoW.Call(
		uintptr(unsafe.Pointer(p16)), 0,
		uintptr(unsafe.Pointer(&sfi)), unsafe.Sizeof(sfi), shgfiSysIconIndex)
	if r == 0 {
		return 0, fmt.Errorf("SHGetFileInfo(SYSICONINDEX) falhou")
	}

	var himl unsafe.Pointer
	hr, _, _ := procSHGetImageList.Call(
		uintptr(shilJumbo), uintptr(unsafe.Pointer(&iidImageList)),
		uintptr(unsafe.Pointer(&himl)))
	if int32(hr) < 0 || himl == nil {
		return 0, fmt.Errorf("SHGetImageList falhou")
	}
	// himl aponta para a interface COM; o 1º campo é o ponteiro da vtable.
	// IImageList::GetIcon é o índice 10 (após os 3 métodos de IUnknown +
	// Add, ReplaceIcon, SetOverlayImage, Replace, AddMasked, Draw, Remove).
	// A lista é compartilhada pelo sistema — não chamamos Release. Lemos a
	// vtable como ponteiro tipado (sem aritmética de uintptr) p/ não disparar
	// o go vet unsafeptr.
	vtbl := *(**[16]uintptr)(himl)
	getIcon := vtbl[10]

	var hicon uintptr
	hr2, _, _ := syscall.SyscallN(getIcon, uintptr(himl), uintptr(sfi.iIcon), ildTransparent, uintptr(unsafe.Pointer(&hicon)))
	if int32(hr2) < 0 || hicon == 0 {
		return 0, fmt.Errorf("IImageList::GetIcon falhou")
	}
	return hicon, nil
}

// largeIcon é o caminho simples e robusto: SHGetFileInfo devolve direto um
// HICON de ~32px. Usado como fallback do jumbo.
func largeIcon(path string) (uintptr, error) {
	p16, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	var sfi shFileInfo
	r, _, _ := procSHGetFileInfoW.Call(
		uintptr(unsafe.Pointer(p16)), 0,
		uintptr(unsafe.Pointer(&sfi)), unsafe.Sizeof(sfi), shgfiIcon)
	if r == 0 || sfi.hIcon == 0 {
		return 0, fmt.Errorf("SHGetFileInfo(ICON) falhou")
	}
	return sfi.hIcon, nil
}

// iconToImage rasteriza um HICON para image.RGBA lendo o bitmap de cor via
// GetDIBits. Ícones modernos trazem canal alfa; nos antigos (alfa todo zero)
// caímos para a máscara monocromática.
func iconToImage(hicon uintptr) (*image.RGBA, error) {
	var ii iconInfo
	if r, _, _ := procGetIconInfo.Call(hicon, uintptr(unsafe.Pointer(&ii))); r == 0 {
		return nil, fmt.Errorf("GetIconInfo falhou")
	}
	if ii.hbmColor != 0 {
		defer procDeleteObject.Call(ii.hbmColor)
	}
	if ii.hbmMask != 0 {
		defer procDeleteObject.Call(ii.hbmMask)
	}

	var bm bitmapStruct
	if r, _, _ := procGetObjectW.Call(ii.hbmColor, unsafe.Sizeof(bm), uintptr(unsafe.Pointer(&bm))); r == 0 {
		return nil, fmt.Errorf("GetObject falhou")
	}
	w, h := int(bm.bmWidth), int(bm.bmHeight)
	if w <= 0 || h <= 0 {
		return nil, fmt.Errorf("dimensões de ícone inválidas (%dx%d)", w, h)
	}

	hdc, _, _ := procGetDC.Call(0)
	defer procReleaseDC.Call(0, hdc)

	color, err := dibBGRA(hdc, ii.hbmColor, w, h)
	if err != nil {
		return nil, err
	}

	img := image.NewRGBA(image.Rect(0, 0, w, h))
	hasAlpha := false
	for i := 0; i < w*h; i++ {
		b, g, r, a := color[i*4+0], color[i*4+1], color[i*4+2], color[i*4+3]
		img.Pix[i*4+0] = r
		img.Pix[i*4+1] = g
		img.Pix[i*4+2] = b
		img.Pix[i*4+3] = a
		if a != 0 {
			hasAlpha = true
		}
	}
	if !hasAlpha {
		applyMask(img, hdc, ii.hbmMask, w, h)
	}
	return img, nil
}

// dibBGRA lê os pixels de um HBITMAP como BGRA top-down (32bpp, sem
// compressão).
func dibBGRA(hdc, hbm uintptr, w, h int) ([]byte, error) {
	bi := bitmapInfoHeader{
		biSize:        uint32(unsafe.Sizeof(bitmapInfoHeader{})),
		biWidth:       int32(w),
		biHeight:      -int32(h), // negativo ⇒ top-down (primeira linha no topo)
		biPlanes:      1,
		biBitCount:    32,
		biCompression: 0, // BI_RGB
	}
	buf := make([]byte, w*h*4)
	r, _, _ := procGetDIBits.Call(hdc, hbm, 0, uintptr(h),
		uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&bi)), dibRGBColors)
	if r == 0 {
		return nil, fmt.Errorf("GetDIBits falhou")
	}
	return buf, nil
}

// applyMask define o alfa a partir da máscara AND do ícone (pixel "branco" =
// transparente). Usado só quando o bitmap de cor não tem canal alfa.
func applyMask(img *image.RGBA, hdc, hbmMask uintptr, w, h int) {
	if hbmMask == 0 {
		for i := 0; i < w*h; i++ {
			img.Pix[i*4+3] = 255
		}
		return
	}
	mask, err := dibBGRA(hdc, hbmMask, w, h)
	if err != nil {
		for i := 0; i < w*h; i++ {
			img.Pix[i*4+3] = 255
		}
		return
	}
	for i := 0; i < w*h; i++ {
		if mask[i*4] == 0 { // preto na máscara ⇒ opaco
			img.Pix[i*4+3] = 255
		} else {
			img.Pix[i*4+3] = 0
		}
	}
}

// trimTransparent recorta a borda totalmente transparente. O slot jumbo tem
// 256px e ícones menores ficam centralizados com muito padding — sem o corte,
// o ícone apareceria minúsculo no botão.
func trimTransparent(src *image.RGBA) *image.RGBA {
	b := src.Bounds()
	minX, minY, maxX, maxY := b.Max.X, b.Max.Y, b.Min.X-1, b.Min.Y-1
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			if src.Pix[src.PixOffset(x, y)+3] > 0 {
				if x < minX {
					minX = x
				}
				if y < minY {
					minY = y
				}
				if x > maxX {
					maxX = x
				}
				if y > maxY {
					maxY = y
				}
			}
		}
	}
	if maxX < minX || maxY < minY { // totalmente transparente
		return src
	}
	w, h := maxX-minX+1, maxY-minY+1
	if w == b.Dx() && h == b.Dy() {
		return src
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			si := src.PixOffset(minX+x, minY+y)
			di := dst.PixOffset(x, y)
			copy(dst.Pix[di:di+4], src.Pix[si:si+4])
		}
	}
	return dst
}

// scaleToFit reduz (bilinear) para caber em max×max mantendo a proporção. Só
// reduz — nunca amplia. Mantém o config.json enxuto, igual ao resize de 128px
// do upload manual no frontend.
func scaleToFit(src *image.RGBA, max int) *image.RGBA {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	if w <= max && h <= max {
		return src
	}
	scale := float64(max) / float64(w)
	if float64(h)*scale > float64(max) {
		scale = float64(max) / float64(h)
	}
	nw, nh := int(float64(w)*scale+0.5), int(float64(h)*scale+0.5)
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	for y := 0; y < nh; y++ {
		sy := (float64(y)+0.5)/scale - 0.5
		for x := 0; x < nw; x++ {
			sx := (float64(x)+0.5)/scale - 0.5
			r, g, b, a := bilinear(src, sx, sy)
			i := dst.PixOffset(x, y)
			dst.Pix[i], dst.Pix[i+1], dst.Pix[i+2], dst.Pix[i+3] = r, g, b, a
		}
	}
	return dst
}

func bilinear(src *image.RGBA, fx, fy float64) (uint8, uint8, uint8, uint8) {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	x0, y0 := int(math.Floor(fx)), int(math.Floor(fy))
	dx, dy := fx-float64(x0), fy-float64(y0)
	at := func(xx, yy int) (float64, float64, float64, float64) {
		if xx < 0 {
			xx = 0
		}
		if yy < 0 {
			yy = 0
		}
		if xx >= w {
			xx = w - 1
		}
		if yy >= h {
			yy = h - 1
		}
		i := src.PixOffset(xx, yy)
		return float64(src.Pix[i]), float64(src.Pix[i+1]), float64(src.Pix[i+2]), float64(src.Pix[i+3])
	}
	lerp := func(a, b, t float64) float64 { return a + (b-a)*t }
	mix := func(c00, c10, c01, c11 float64) uint8 {
		return clamp8(lerp(lerp(c00, c10, dx), lerp(c01, c11, dx), dy))
	}
	r00, g00, b00, a00 := at(x0, y0)
	r10, g10, b10, a10 := at(x0+1, y0)
	r01, g01, b01, a01 := at(x0, y0+1)
	r11, g11, b11, a11 := at(x0+1, y0+1)
	return mix(r00, r10, r01, r11), mix(g00, g10, g01, g11), mix(b00, b10, b01, b11), mix(a00, a10, a01, a11)
}

func clamp8(v float64) uint8 {
	if v <= 0 {
		return 0
	}
	if v >= 255 {
		return 255
	}
	return uint8(v + 0.5)
}

func encodePNGDataURL(img image.Image) (string, error) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", fmt.Errorf("png.Encode: %w", err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}
