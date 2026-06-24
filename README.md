# 🌌 HaloSense

**HaloSense** is a premium Windows PC health dashboard built with **Electron**. It gives users a clean command center for monitoring PC health, live performance, storage, temperatures, security, background apps, and system status in one place.

Instead of making users jump between Task Manager, Windows Settings, Storage, Windows Security, Display Settings, and Power Settings, HaloSense brings the most important system information into one polished desktop app.

---

## ✨ Overview

HaloSense was built to make PC health easier to understand.

Windows already has useful system information, but it is spread across many different tools and menus. HaloSense solves this by giving users one dashboard with live system stats, performance graphs, safe optimizer tools, health scoring, and quick access to useful Windows settings.

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
- 📁 Top memory apps view
- 📊 Task Manager-style performance graphs
- 🧹 Smart safe optimizer
- 📝 Health report export
- 🔗 Shortcuts to useful Windows tools
- 🪟 Custom frameless desktop title bar
- ➖ Custom minimize button
- ⬜ Custom maximize / restore button
- ❌ Custom close button
- 📦 Windows installer support

---

## 🎯 Quality-of-Life Improvements

### ✅ 1. One dashboard instead of many Windows menus

HaloSense combines useful system information into one clean screen.

Users can quickly check CPU, GPU, memory, storage, temperatures, network, security, power, display, uptime, and top background apps without opening multiple Windows tools.

This makes PC health easier to understand, especially for users who do not want to dig through Task Manager and Settings.

---

### 📊 2. Task Manager-style performance graphs

HaloSense includes live performance graphs with a clear **0–100% usage scale**.

The graphs help users see performance trends over time instead of only seeing one number at a time. This makes it easier to notice spikes, heavy usage, system pressure, and performance changes.

Graphs currently focus on:

- CPU usage
- GPU usage
- Memory usage
- Storage usage
- Temperature history

---

### 🧹 3. Smarter safe optimizer

HaloSense includes a smarter optimizer designed to help users reduce unnecessary background activity without being reckless.

The optimizer is conservative and avoids important system processes. It also protects RGB, lighting, peripheral, and device-control apps so the user’s PC lights and hardware utilities do not turn off unexpectedly.

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

This helps prevent the optimizer from accidentally closing lighting or device-control software.

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

## 📦 How to Download and Install HaloSense

You do **not** need to clone the repository to use HaloSense.

To download and install the app:

1. Go to the latest release page:

   https://github.com/aran-b-colani-neb/HaloSense/releases/latest

2. Scroll down to the **Assets** section.

3. Download the installer file named something like:

   HaloSense Setup 1.0.2.exe

4. After the download finishes, double-click the `.exe` file.

5. Follow the installer steps.

6. Launch HaloSense from the desktop shortcut or the Windows Start Menu.

### Windows warning note

Windows may show an **Unknown Publisher** warning because the installer is not code-signed yet.

If you downloaded HaloSense from the official GitHub release page, you can continue by clicking:

- More info
- Run anyway

---

## 📌 Version History

### v1.0.0 — First Release

- Built the first working HaloSense dashboard
- Added live system monitoring
- Added PC health score
- Added CPU, GPU, memory, storage, network, security, display, power, and uptime panels
- Added top memory apps view
- Added safe optimizer
- Added health report export
- Created the first Windows installer
- Published the project to GitHub

### v1.0.1 — Custom Title Bar Update

- Removed the default Electron title bar
- Removed the File / Edit / View / Window menu
- Added a custom HaloSense title bar
- Added custom minimize, maximize, and close buttons
- Improved the premium desktop app feel

### v1.0.2 — Graphs and Smart Optimizer

- Added taller performance graphs
- Improved Task Manager-style graph layout
- Added a clearer 0–100% usage scale
- Improved CPU, GPU, memory, storage, and temperature tracking
- Added smarter background process optimization
- Protected RGB and lighting apps from being closed

---

## 🧪 Project Status

HaloSense is actively being improved.

Current focus areas include:

- Better performance graphs
- Safer optimization tools
- More helpful system insights
- Cleaner desktop experience
- Improved Windows installer releases
- More polished quality-of-life features

---

## 🤖 AI Usage

AI was used only for debugging support.

The concept, project direction, design decisions, coding, testing, and final implementation were completed by me. AI helped identify issues faster and explain errors during development.

---

## 📄 License

This project is released under the MIT License.
