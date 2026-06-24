# HaloSense

HaloSense is a Windows desktop app I built because I got tired of checking five different places just to understand what my PC was doing.

Task Manager tells part of the story. Windows Settings tells another part. Security, storage, power, display, uptime, background apps — they all live in different corners of Windows.

HaloSense puts the important stuff in one place.

It is not supposed to be some fake “one click fixes everything” optimizer. I wanted it to feel more like a clean little control room for your PC: open it, look around, and quickly know if your computer is chilling or struggling.

---

## The idea

The main question behind HaloSense was:

**What if checking your PC health felt simple instead of annoying?**

Most PC tools either look too technical, too old, or too scary. Some optimizer apps also act like they are going to magically fix your computer, but they can be risky or confusing.

I wanted HaloSense to be different:

- simple enough for normal users
- useful enough for people who care about performance
- careful enough to not break things
- clean enough to feel like an actual desktop app

---

## What HaloSense shows

HaloSense gives you a live dashboard with:

- CPU usage
- GPU usage
- Memory usage
- Storage usage
- Temperature info when Windows can provide it
- Network status
- Power info
- Display info
- Windows Security status
- Uptime
- Top memory apps
- Overall PC health score

The goal is not just to throw numbers on the screen. The goal is to help you understand what those numbers mean.

---

## Why this exists

I built HaloSense because I wanted a faster way to answer questions like:

- Why does my PC feel slow?
- What is eating my memory?
- Is my storage getting too full?
- Is my system under pressure?
- Is something running in the background?
- Does my PC look ready before I game or work?

Windows already has answers to most of these questions, but they are scattered everywhere. HaloSense tries to make the first check faster.

---

## My favorite part: the “PC slowdown detective” idea

One thing I want HaloSense to grow into is something I call **HaloSense Replay**.

Most system monitor apps only show what is happening right now.

But when your PC starts lagging, the real question is usually:

**What changed a few minutes ago?**

HaloSense Replay is the idea of keeping a short local history of recent system activity so the app can help explain the story of a slowdown.

For example, instead of only saying:

**Memory is high**

HaloSense could eventually say something more useful, like:

**Your PC started slowing down around 8:42 PM. Chrome and Discord increased memory usage, CPU spiked, and your health score dropped shortly after.**

That is the direction I want HaloSense to move toward: not just monitoring numbers, but helping users understand what caused the problem.

---

## Current features

### PC health score

HaloSense gives the system a quick health score based on the data it can read.

It is meant to be a fast first impression. You can open the app and immediately get a rough idea of whether your PC looks healthy or under pressure.

### Live dashboard

The dashboard brings together the system information I usually find myself checking in different places.

Instead of jumping between Task Manager, Settings, Security, Display, and Power menus, HaloSense shows the main things together.

### Performance graphs

HaloSense includes live performance graphs so you can see trends, not just single numbers.

A number tells you what is happening right now. A graph helps you see if your PC is spiking, slowly climbing, or staying under pressure.

### Top memory apps

HaloSense shows which apps are using memory so you can quickly spot heavy background apps.

This is helpful when the PC feels slow but you do not know what is causing it.

### Safe optimizer

HaloSense includes a conservative optimizer.

I did not want it to be reckless. It does not delete personal files, uninstall apps, edit the registry, or make dangerous system changes.

The goal is to reduce unnecessary background activity without touching important system processes.

### RGB and device app protection

A lot of people care about their RGB lighting, mouse software, keyboard software, fan software, and device-control apps.

So HaloSense tries to avoid closing apps like:

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

I added this because an optimizer should not accidentally turn off someone’s setup just to look like it “cleaned” something.

### Health report export

HaloSense can export a health report so you can save or share a quick snapshot of your PC status.

### Windows shortcuts

HaloSense also includes shortcuts to useful Windows tools so you can jump to the right place faster when you actually need the deeper settings.

---

## Download and install

You do not need to clone the code to use HaloSense.

To install the app:

1. Go to the latest release page:

   https://github.com/aran-b-colani-neb/HaloSense/releases/latest

2. Scroll down to the **Assets** section.

3. Download the `.exe` installer.

   The file should look something like:

   `HaloSense Setup 1.0.2.exe`

4. Double-click the downloaded `.exe` file.

5. Follow the installer steps.

6. Open HaloSense from the desktop shortcut or from the Windows Start Menu.

---

## Windows warning

Windows may show an **Unknown Publisher** warning because I have not code-signed the app yet.

If you downloaded HaloSense from the official GitHub release page, you can continue by clicking:

- More info
- Run anyway

---

## Built with

HaloSense was built with:

- Electron
- Node.js
- HTML
- CSS
- JavaScript
- PowerShell system queries
- electron-builder
- GitHub Releases

---

## Development note

I spent multiple days building, testing, fixing, packaging, and shipping HaloSense.

One important note: I did not have the project properly connected to the Hackatime servers during most of the work, so the tracked time may not fully show how much time I actually spent on the project.

A lot of time went into testing system data, fixing weird Windows readings, improving the UI, making the installer, writing the release, and making sure the app felt usable.

---

## Version history

### v1.0.0

First working version.

Added:

- Main PC health dashboard
- Live system monitoring
- Health score
- Top memory apps
- Safe optimizer
- Health report export
- Windows installer
- First GitHub release

### v1.0.1

Polish update.

Added:

- Custom HaloSense title bar
- Custom minimize button
- Custom maximize / restore button
- Custom close button
- Removed the default Electron menu

### v1.0.2

Graphs and optimizer update.

Added:

- Taller performance graphs
- Better graph layout
- Clearer 0–100% usage scale
- Smarter optimizer behavior
- Protection for RGB and lighting apps

---

## What I learned

This project taught me a lot about building real desktop apps with Electron.

I learned more about:

- reading Windows system data
- using PowerShell from Node.js
- building a custom desktop UI
- making a frameless Electron window
- creating custom window controls
- packaging a Windows installer
- managing GitHub releases
- designing safer system tools

The biggest thing I learned is that PC tools need trust. It is easy to make an app that shows a lot of numbers, but harder to make one that feels useful, safe, and understandable.

That is what I am trying to do with HaloSense.

---

## Status

HaloSense is still being improved.

I want to keep making it cleaner, smarter, and more useful without turning it into an overcomplicated optimizer.

The long-term idea is for HaloSense to become more like a PC health assistant — something that does not just show what is happening, but helps explain why it is happening.

---

## License

MIT License
