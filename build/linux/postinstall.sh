#!/bin/sh
# A instalação não falha em chroots/containers sem udev ou kernel uinput.
set -eu
if [ -d /run/udev ]; then
  if command -v modprobe >/dev/null 2>&1; then
    modprobe uinput 2>/dev/null || true
  fi
  if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules || true
    udevadm trigger --subsystem-match=misc --sysname-match=uinput || true
    udevadm trigger --subsystem-match=hidraw || true
  fi
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
