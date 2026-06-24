# 🌌 HaloSense

**HaloSense** is a premium Windows PC health dashboard built with **Electron**. It gives users a clean command center for monitoring PC health, live performance, storage, temperatures, security, and background app activity.

Instead of making users jump between Task Manager, Windows Settings, Storage, Security, Display, and Power menus, HaloSense brings the most important system information into one polished desktop app.

---

## ✨ Overview

HaloSense was built to make PC health easier to understand.

Windows already has a lot of useful system information, but it is scattered across different tools and menus. HaloSense solves that by giving users a single dashboard with live system stats, helpful performance graphs, safe optimizer tools, and a clean desktop experience.

The goal is simple:

**Help users understand what their PC is doing without confusion.**

---

## 🚀 Features

- 🧠 Live PC health score
- ⚙️ CPU usage monitoring
- 🎮 GPU usage monitoring
- 🧩 Memory usage monitoring
- 💾 Storage usage overview
- 🌡️ Temperature tracking when supported
- 🌐 Network status
- 🔋 Power information
- 🖥️ Display information
- 🛡️ Windows Security status
- ⏱️ Uptime tracking
- 📊 Task Manager-style performance graphs
- 🧹 Smart safe optimizer
- 📁 Top memory apps view
- 📝 Health report export
- 🔗 Windows tool shortcuts
- 🪟 Custom frameless title bar
- ➖ Custom minimize button
- ⬜ Custom maximize / restore button
- ❌ Custom close button
- 📦 Windows installer support

---

## 🎯 Quality-of-Life Improvements

### ✅ 1. One dashboard instead of many Windows menus

HaloSense combines useful system information into one clean screen.

Users can quickly check CPU, GPU, memory, storage, network, security, power, display, uptime, and top background apps without opening multiple Windows tools.

This makes PC health easier to understand, especially for users who do not want to dig through Task Manager and Settings.

---

### 📊 2. Task Manager-style performance graphs

HaloSense includes live performance graphs with a clear **0–100% usage scale**.

The graphs help users see performance trends over time instead of only seeing one number at a time. This makes it easier to notice spikes, heavy usage, and system pressure.

Graphs currently focus on:

- CPU usage
- GPU usage
- Memory usage
- Storage usage
- Temperature history

---

### 🧹 3. Smarter safe optimizer

HaloSense includes a smarter optimizer designed to help users reduce unnecessary background activity without being reckless.

The optimizer is conservative and avoids important system processes. It also protects RGB and lighting software so the user’s PC lights do not turn off unexpectedly.

---

## 🛡️ Safety

HaloSense is designed to be safe and conservative.

The optimizer does **not** delete personal files, remove important apps, edit the registry, or make risky system changes automatically.

Protected app categories include RGB, lighting, peripheral, and device-control apps such as:

- SignalRGB
- OpenRGB
- iCUE
- Razer apps
- Armoury Crate
- MSI lighting apps
- Gigabyte lighting apps
- Logitech apps
- SteelSeries apps
- NZXT CAM

This prevents the optimizer from accidentally closing lighting or device-control software.

---

## 🧰 Tech Stack

HaloSense was built using:

- Electron
- Node.js
- HTML
- CSS
- JavaScript
- PowerShell system queries
- GitHub
- electron-builder

---

## 📦 Installation

Download the latest installer from the Releases page:

https://github.com/aran-b-colani-neb/HaloSense/releases/latest

Run the installer and launch HaloSense from the desktop shortcut or Start Menu.

---

## 🖥️ Run Locally

Clone the repository:

```bash
git clone https://github.com/aran-b-colani-neb/HaloSense.git
