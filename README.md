# Switch SD Card Manager (v7.2.0)

<p align="center">
  <img src="./icons/icon.png" width="128" height="128" alt="Switch SD Manager icon" />
</p>

> A premium, fully portable desktop Switch SD card, Boot Bin output, and SSH environment manager built for **Windows**, **macOS**, and **Linux** systems.

Created by: **Roy Dawson IV**  
GitHub: [https://github.com/imyourboyroy](https://github.com/imyourboyroy)  

---

## 🎮 What is Switch SD Manager?

**Switch SD Manager** is a visual desktop application that takes the headache out of managing your Nintendo Switch custom environment. Whether you plug your SD card directly into your computer, stage your files locally in a folder, or push upgrades wirelessly over Wi-Fi using SSH directly onto your console, this tool gives you absolute, safe control.

No code, no complicated folder structures, and no accidental black screens—just a beautiful, intuitive visual control center.

---

## 📸 App Interface Tour

Here is a visual walkthrough of the main panels inside the app. 

*(Screenshots can be captured and added here to see the interface in action!)*

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Switch SD Manager                                             [ _ 🗖 ✕ ] │
├──────────────────────────────────────────────────────────────────────────┤
│ ☰ Dashboard      │  🚀 WELCOME TO SWITCH SD MANAGER                      │
│ ⬇ Updates        │  Active Workspace: C:\MySwitchSetup                   │
│ 📁 Configs       │                                                       │
│ 🛠 Utilities      │  ┌───────────────────────┐ ┌────────────────────────┐ │
│ 🖳 Firmware      │  │ 💾 SD Card Target:    │ │ ⏻ Boot Bin Target:     │ │
│ 🔗 SSH Remote    │  │ D:\                   │ │ RCMLoader\PAYLOAD\     │ │
│ 🗪 Logs          │  └───────────────────────┘ └────────────────────────┘ │
│                  │                                                       │
│                  │  [ ⚡ One-Click Upgrade ]  [ 🔍 Fast Scan Queue ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1. The Dashboard (Home Screen)
*Your central command center.* Instantly view whether your SD card is connected, customize your path directories with a single click, and view key action cards showing if updates are queued and ready to install.

### 2. Denser Updates Queue
*No more guesswork.* The app lists all your custom homebrew sources and automatically plans the install. It categorizes files into **Installed**, **Updates Available**, and **Not Installed**, grouping them in a clean, easy-to-read installation queue.

### 3. Config Doctor & Live Previews
*The ultimate safety check.* Audits your Switch configuration files in real-time. If a config is missing, the app offers guided templates to create them. You can view structured visual previews, check raw changes side-by-side with interactive diff highlights, and restore automatically generated safety backups if you make a mistake.

### 4. Smart Firmware Downloader
*Upgrade with confidence.* Syncs directly with online firmware repositories to retrieve safe catalog packages. Select a target version, let the downloader extract files seamlessly, and read our interactive step-by-step Daybreak checklist to upgrade your console.

### 5. Premium Utilities Panel
*An elite diagnostics laboratory.* Access 5 offline customizers and tests:
- **Bootlogo Canvas Customizer**: Centered cover cropping of any image to Hekate's `720x1280` format.
- **Security Shield (Telemetry Sinkhole Tester)**: Scans default Atmosphere hosts files and runs live DNS checks.
- **Authenticity Guard**: A standard read-write speed benchmarker and counterfeit detection engine.
- **Emulation Doctor**: High-speed MD5 verification of RetroArch system BIOS files.
- **RCM Payload Guide**: An interactive visual reference manual for entering recovery mode safely.

---

## 🎒 The 13-Year-Old Switch Owner's Guide
*A beginner-friendly guide to customizing your Switch SD card with confidence!*

Hey there! If you are configuring a custom Switch setup, it is easy to feel overwhelmed by folders like `Atmosphere`, `Hekate`, `bootloader`, and `nintendo`. One wrong drag-and-drop can cause a scary black screen of death.

Think of your Switch SD card like a **backpack** for school. If you shove your homework, heavy textbooks, and pencils in randomly, they'll rip, get lost, or make the backpack impossible to zip up. **Switch SD Manager** is your ultimate backpack organizer—placing everything in its perfect pocket safely.

Here is how to use it confidently, step-by-step!

---

### Step 1: Tell the App Where Your Backpack Is 📍

When you first open the app, you will see two primary cards on your **Dashboard**:
1. **SD Card Target**: This is the root folder of your SD card (for example, drive `D:\` on Windows, or `/Volumes/Untitled` on Mac). Click the **Folder Icon** to choose it.
2. **Boot Bin Target**: This is where you want to output Hekate payload files (like your RCM injector dongle). If you don't use a hardware dongle, you can turn this off in Settings!

---

### Step 2: Choose Your Onboarding Pack 🚀

If your SD card is completely blank, the app will pop up a friendly **Starter Source Modal** asking how you want to start:
- **🌟 Restore Bundled Defaults (Highly Recommended!)**: The app will automatically seed a curated list of active Switch updates (like Atmosphere, Hekate, homebrew stores, and safety tools). Select this to set up your card instantly!
- **📂 Import Custom JSON**: If a friend shared a `.json` configuration file containing their custom sources list, select this to import it in one go.
- **➕ Start Empty**: Select this if you are a veteran power-user who wants to add custom homebrew URLs manually.

---

### Step 3: Run the Queue Scan (The Safe Organizer) 🔍

Once your sources are loaded, click the **Fast Scan Queue** button or head to the **Updates** tab.

The app will analyze your card and categorize all homebrew packages into:
- **✅ Installed**: The files match the newest version. You are fully up to date!
- **⚡ Updates Available**: A newer version is available online. You should queue this!
- **💤 Not Installed**: Safe, cool tools in your catalog that aren't on your card yet.

#### 🛡️ The Atmosphere-First Safety Rule
If you choose to **Install All**, the app's smart planner automatically sequences the queue:
1. **Core CFW (Atmosphere)** first.
2. **Bootloader (Hekate)** second.
3. **Homebrew / Utilities** last.

**Why?** Because if you install basic homebrew apps before upgrading your primary Atmosphere system files, your console can crash when rebooting. The organizer acts as a shield, ensuring your operating system is secure before adding apps!

---

### Step 4: Customize Your Boot Logo (Canvas Magic!) 🎨

Want your Switch to display your favorite anime character, video game logo, or custom artwork when it boots up?
1. Open the **Utilities** tab and click on the **Bootlogo Customizer** tab.
2. Grab any photo from your computer (`.png`, `.jpg`, or `.webp`) and drag-and-drop it into the visual panel.
3. **Canvas Magic**: The app uses a built-in canvas engine to automatically center, scale, and crop your photo to exactly `720x1280` pixels—preventing stretching or squishing.
4. Click **Inject Bootlogo**! The backend converts it into a 32-bit BMP and saves it securely to `/bootloader/bootlogo.bmp`. Hekate will load it automatically next time you boot!

---

### Step 5: Activate Your Security Shield (No Ban Zone!) 🛡️

Playing homebrew online without blocking Nintendo's servers can get your console banned from online play. Let's make sure you are secure:
1. Go to the **Utilities** tab and click **Security Shield**.
2. Click **Run Security Audit**.
3. **The Static Audit**: The app inspects your card for Atmosphere `/hosts/default.txt` and `/hosts/emummc.txt` overrides.
4. **The Live DNS Test**: The app simulates a connection to Nintendo servers. If the servers resolve successfully, it means you are vulnerable. If they fail (because they sinkhole to `127.0.0.1`), it means you are **Extremely Secure**!
5. View the color-coded safety badge. If it's orange or red, the app offers to instantly write a starter hosts file to block tracking servers!

---

### Step 6: Test for "Fake" SD Cards (The Lie Detector!) 🤥

Have you ever bought a cheap 512GB SD card online, only to find out it breaks when you fill it halfway? Cheap counterfeit cards modify internal tables to *claim* they are large, but they actually overwrite old files when you exceed their true capacity (e.g. 16GB).
1. Click the **Storage Benchmark** inside Utilities.
2. Select your SD card drive and click **Benchmark Drive**.
3. The app writes a 20MB block of special diagnostic data, measures your write speed, reads it back, and checks its SHA256 cryptographic signature.
4. If the signatures match, your card is **100% Genuine**! If the signatures mismatch, the app immediately alerts you that the card is counterfeit so you can replace it before losing your save files!

---

## 🛠 Compilation and Developer Tools

Want to build, compile, or tweak the application yourself? We have made it extremely simple. Refer to our detailed developer companion document:

👉 **[Standalone Compilation & Developer Operations Guide (build.md)](./build.md)**

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/imyourboyroy/switch-sd-mgr/issues).

---

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
