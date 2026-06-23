# HaloSense

HaloSense is a premium Windows PC health dashboard built with Electron.

It gives users a clean overview of their system health, including CPU, GPU, memory, storage, temperatures, network status, power, display, security, and top memory apps.

## Features

* Live system health score
* CPU usage and processor details
* GPU usage, temperature, and VRAM when available
* RAM usage and top memory apps
* C: drive storage overview
* Temperature monitoring when supported
* Network connection status
* Windows version, uptime, startup count, and device details
* Power and display information
* Windows Security status
* Safe optimizer that does not delete personal files
* One-click shortcuts to Windows tools
* Health report export

## Safety

HaloSense is designed to be safe. It does not delete personal files, remove apps, edit the registry, or make risky system changes automatically.

## Tech Stack

* Electron
* Node.js
* HTML
* CSS
* JavaScript
* PowerShell system queries

## Run Locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

## Build Windows Installer

```bash
npm run dist
```

The installer will be created in the `dist` folder.

## Status

HaloSense 1.0.0 is the initial release.
