"""
PhantomShield X — Device Agent
Run this on any device you want to monitor.
It collects real system data and reports to the central PhantomShield backend.

Usage:
    pip install psutil httpx
    python agent.py --server http://YOUR_BACKEND_URL:8000
"""

import asyncio
import psutil
import platform
import socket
import os
import sys
import uuid
import json
import time
import argparse
import subprocess
import threading
import tkinter as tk
import webbrowser
from datetime import datetime

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    print("[!] pystray/Pillow not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pystray", "pillow"])
    import pystray
    from PIL import Image, ImageDraw

try:
    import httpx
except ImportError:
    print("[!] httpx not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "psutil"])
    import httpx

# ─── Configuration ────────────────────────────────────────────────────────────
DEFAULT_SERVER = "https://phantomshield-x.onrender.com"
HEARTBEAT_INTERVAL = 5  # seconds
DEVICE_ID_FILE = os.path.join(os.path.expanduser("~"), ".phantomshield_device_id")

# ─── Device Identity ──────────────────────────────────────────────────────────
def get_or_create_device_id() -> str:
    """Persistent device ID stored in home directory."""
    if os.path.exists(DEVICE_ID_FILE):
        with open(DEVICE_ID_FILE, "r") as f:
            return f.read().strip()
    device_id = str(uuid.uuid4())
    with open(DEVICE_ID_FILE, "w") as f:
        f.write(device_id)
    return device_id


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_installed_apps():
    """Get installed apps — Windows registry or Linux dpkg."""
    apps = []
    if platform.system() == "Windows":
        try:
            import winreg
            for reg_path in [
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            ]:
                try:
                    key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_path)
                    for i in range(winreg.QueryInfoKey(key)[0]):
                        try:
                            subkey = winreg.OpenKey(key, winreg.EnumKey(key, i))
                            name = winreg.QueryValueEx(subkey, "DisplayName")[0]
                            try:
                                version = winreg.QueryValueEx(subkey, "DisplayVersion")[0]
                            except Exception:
                                version = ""
                            try:
                                publisher = winreg.QueryValueEx(subkey, "Publisher")[0]
                            except Exception:
                                publisher = ""
                            if name and name.strip():
                                apps.append({"name": name.strip(), "version": version, "publisher": publisher})
                        except Exception:
                            continue
                    winreg.CloseKey(key)
                except Exception:
                    continue
        except Exception:
            pass
    elif platform.system() == "Linux":
        try:
            result = subprocess.run(["dpkg", "--get-selections"], capture_output=True, text=True, timeout=5)
            for line in result.stdout.splitlines()[:50]:
                parts = line.split()
                if parts and parts[-1] == "install":
                    apps.append({"name": parts[0], "version": "", "publisher": ""})
        except Exception:
            pass
    elif platform.system() == "Darwin":
        try:
            result = subprocess.run(["ls", "/Applications"], capture_output=True, text=True, timeout=5)
            for app in result.stdout.splitlines()[:50]:
                if app.endswith(".app"):
                    apps.append({"name": app.replace(".app", ""), "version": "", "publisher": "Apple Mac"})
        except Exception:
            pass
    # Deduplicate
    seen = set()
    unique = []
    for app in apps:
        if app["name"] not in seen:
            seen.add(app["name"])
            unique.append(app)
    return sorted(unique, key=lambda x: x["name"].lower())


def get_running_processes():
    """Top 20 most CPU-intensive processes."""
    procs = []
    for p in sorted(psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']),
                    key=lambda p: p.info.get('cpu_percent') or 0, reverse=True)[:20]:
        try:
            procs.append({
                "pid": p.info["pid"],
                "name": p.info["name"],
                "cpu": round(p.info.get("cpu_percent") or 0, 1),
                "ram": round(p.info.get("memory_percent") or 0, 1),
                "status": p.info.get("status", ""),
            })
        except Exception:
            continue
    return procs


def get_network_connections():
    """Active established network connections."""
    conns = []
    try:
        for c in psutil.net_connections(kind="inet"):
            if c.status == "ESTABLISHED" and c.raddr:
                conns.append({
                    "local": f"{c.laddr.ip}:{c.laddr.port}",
                    "remote": f"{c.raddr.ip}:{c.raddr.port}",
                    "status": c.status,
                })
    except Exception:
        pass
    return conns[:30]


def collect_telemetry(device_id: str) -> dict:
    """Collect complete system snapshot."""
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/") if platform.system() != "Windows" else psutil.disk_usage("C:\\")
    net = psutil.net_io_counters()
    boot_time = psutil.boot_time()

    return {
        "device_id": device_id,
        "timestamp": time.time(),
        "datetime": datetime.now().isoformat(),
        "cpu": {
            "percent": cpu,
            "cores": psutil.cpu_count(),
            "freq_mhz": round(psutil.cpu_freq().current, 1) if psutil.cpu_freq() else 0,
        },
        "memory": {
            "total_gb": round(mem.total / (1024**3), 2),
            "used_gb": round(mem.used / (1024**3), 2),
            "percent": mem.percent,
        },
        "disk": {
            "total_gb": round(disk.total / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2),
            "percent": disk.percent,
        },
        "network": {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv,
        },
        "boot_time": boot_time,
        "active_connections": get_network_connections(),
        "processes": get_running_processes(),
        "process_count": len(psutil.pids()),
    }


async def register_device(client: httpx.AsyncClient, server: str, device_id: str):
    """Register this device with the central server."""
    info = {
        "device_id": device_id,
        "hostname": socket.gethostname(),
        "ip": get_local_ip(),
        "os": f"{platform.system()} {platform.release()}",
        "os_version": platform.version(),
        "username": os.getlogin() if hasattr(os, 'getlogin') else os.environ.get("USER", "unknown"),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "registered_at": datetime.now().isoformat(),
    }
    try:
        response = await client.post(f"{server}/agent/register", json=info, timeout=10)
        if response.status_code == 200:
            print(f"[+] Registered with PhantomShield server: {server}")
            print(f"    Device ID: {device_id}")
            print(f"    Hostname:  {info['hostname']}")
            print(f"    IP:        {info['ip']}")
            print(f"    OS:        {info['os']}")
        else:
            print(f"[!] Registration failed: {response.status_code}")
    except Exception as e:
        print(f"[!] Could not reach server: {e}")


async def send_heartbeat(client: httpx.AsyncClient, server: str, device_id: str):
    """Send live telemetry snapshot."""
    telemetry = collect_telemetry(device_id)
    try:
        await client.post(f"{server}/agent/heartbeat", json=telemetry, timeout=5)
    except Exception:
        pass  # Silently retry on next tick


async def send_apps(client: httpx.AsyncClient, server: str, device_id: str):
    """Send installed apps list (expensive, do once on startup)."""
    print("[~] Scanning installed applications...")
    apps = get_installed_apps()
    print(f"[+] Found {len(apps)} installed applications.")
    try:
        await client.post(
            f"{server}/agent/apps",
            json={"device_id": device_id, "apps": apps},
            timeout=30,
        )
    except Exception as e:
        print(f"[!] Could not send apps: {e}")

def _show_scan_notification(title: str, message: str, color: str = "#4D8AF0"):
    """Shows a small Tkinter popup notification for the agent tray."""
    def _show():
        try:
            popup = tk.Tk()
            popup.title("PhantomShield X")
            popup.geometry("380x120+50+50")
            popup.configure(bg="#0a0a0b")
            popup.resizable(False, False)
            popup.overrideredirect(True)  # Frameless window
            popup.attributes('-topmost', True)
            
            # Position at bottom-right of screen
            screen_w = popup.winfo_screenwidth()
            screen_h = popup.winfo_screenheight()
            popup.geometry(f"380x120+{screen_w - 400}+{screen_h - 170}")
            
            frame = tk.Frame(popup, bg="#111", bd=2, relief="solid", highlightbackground=color, highlightthickness=2)
            frame.pack(fill="both", expand=True)
            
            tk.Label(frame, text=title, font=("Segoe UI", 12, "bold"), fg=color, bg="#111").pack(pady=(12, 2))
            tk.Label(frame, text=message, font=("Segoe UI", 9), fg="#ccc", bg="#111", wraplength=340).pack(pady=(0, 5))
            
            popup.after(5000, popup.destroy)  # Auto-close after 5 seconds
            popup.mainloop()
        except Exception:
            pass
    threading.Thread(target=_show, daemon=True).start()

async def run_remote_scan(client: httpx.AsyncClient, server: str, device_id: str):
    """Executes a targeted file scan on the user's system triggered by the Admin."""
    print("[!] REMOTE SCAN TRIGGERED BY ADMIN")
    
    # Show notification to user that scan is starting
    _show_scan_notification(
        "⚠ Security Scan In Progress",
        "PhantomShield X is performing a full system scan triggered by your admin.",
        "#f59e0b"
    )
    
    threats = []
    scanned_count = 0
    
    # Target important directories
    target_dirs = [
        os.path.join(os.path.expanduser("~"), "Desktop"),
        os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop"),
        os.path.join(os.path.expanduser("~"), "Downloads"),
        os.path.join(os.path.expanduser("~"), "Documents"),
    ]
    
    # Full heuristic keyword list — same as active_protection_monitor
    malicious_keywords = ["virus", "malware", "ransomware", "trojan", "mimikatz", 
                          "hack", "exploit", "payload", "keylogger", "backdoor"]
    
    # Also flag suspicious extensions in user directories
    suspicious_extensions = [".exe", ".bat", ".ps1", ".vbs", ".cmd", ".scr"]
    
    for target in target_dirs:
        if not os.path.exists(target): continue
        for root, _, files in os.walk(target):
            for file in files:
                scanned_count += 1
                file_lower = file.lower()
                filepath = os.path.join(root, file)
                
                is_threat = False
                threat_desc = ""
                
                # Check for malicious keywords in filename
                for kw in malicious_keywords:
                    if kw in file_lower:
                        is_threat = True
                        threat_desc = f"Malicious keyword '{kw}' detected in filename during remote scan."
                        break
                
                # Check for suspicious executables in user folders (Desktop/Downloads only)
                if not is_threat and any(file_lower.endswith(ext) for ext in suspicious_extensions):
                    # Only flag .exe etc in Desktop/Downloads, not system dirs
                    if "Desktop" in root or "Downloads" in root:
                        is_threat = True
                        threat_desc = f"Suspicious executable found in user directory: {file}"
                
                if is_threat:
                    threats.append({
                        "name": file,
                        "file_path": filepath,
                        "severity": "critical",
                        "description": threat_desc
                    })
                    print(f"  [X] FOUND THREAT: {file} → {filepath}")
                    
    if threats:
        try:
            await client.post(
                f"{server}/agent/threats",
                json={"device_id": device_id, "threats": threats},
                timeout=10
            )
            print(f"[+] Reported {len(threats)} threats to central server")
        except Exception as e:
            print(f"[!] Failed to report threats: {e}")
        
        # Show threat notification
        _show_scan_notification(
            f"🚨 {len(threats)} Threat(s) Found!",
            f"Scanned {scanned_count} files. {len(threats)} malicious file(s) detected and reported to admin.",
            "#ef4444"
        )
    else:
        print(f"[+] Scan complete. {scanned_count} files scanned. No threats found.")
        _show_scan_notification(
            "✅ Scan Complete — System Clean",
            f"Scanned {scanned_count} files across your system. No threats detected.",
            "#10b981"
        )

async def poll_commands(client: httpx.AsyncClient, server: str, device_id: str):
    """Continuously poll for C2 commands from the admin dashboard."""
    while True:
        try:
            res = await client.get(f"{server}/agent/commands", params={"device_id": device_id}, timeout=5)
            if res.status_code == 200:
                data = res.json()
                for cmd in data.get("commands", []):
                    if cmd == "scan":
                        asyncio.create_task(run_remote_scan(client, server, device_id))
        except Exception:
            pass
        await asyncio.sleep(3) # Fast polling for demo purposes


async def active_protection_monitor(client: httpx.AsyncClient, server: str, device_id: str):
    """Background scanner that actively deletes malware immediately upon creation."""
    print("[+] Active Protection Module Online. Watching file system...")
    
    desktop_dirs = [
        os.path.join(os.path.expanduser("~"), "Desktop"),
        os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
    ]
    
    malicious_keywords = ["virus", "malware", "ransomware", "trojan", "mimikatz"]
    
    seen_files = {} # dict mapping dir to set of files
    for d in desktop_dirs:
        if os.path.exists(d):
            try:
                seen_files[d] = set(os.listdir(d))
            except Exception:
                seen_files[d] = set()
    
    while True:
        try:
            for d in list(seen_files.keys()):
                if not os.path.exists(d): continue
                current_files = set()
                try:
                    current_files = set(os.listdir(d))
                except Exception:
                    continue
                    
                new_files = current_files - seen_files[d]
                
                for file in new_files:
                    file_lower = file.lower()
                    if any(word in file_lower for word in malicious_keywords):
                        filepath = os.path.join(d, file)
                        try:
                            # INSTANTLY DELETE
                            if os.path.isfile(filepath):
                                os.remove(filepath) 
                                print(f"  [!!!] ACTIVE PROTECTION: DELETED {file} from {d}")
                                # Report to dashboard
                                threats = [{
                                    "name": file,
                                    "file_path": filepath,
                                    "severity": "critical",
                                    "status": "deleted",
                                    "description": "Malware automatically neutralized by Active Protection Engine."
                                }]
                                await client.post(
                                    f"{server}/agent/threats",
                                    json={"device_id": device_id, "threats": threats},
                                    timeout=5
                                )
                                current_files.remove(file)
                        except Exception as e:
                            print(f"  [!] Failed to delete {file}: {e}")
                seen_files[d] = current_files
        except Exception:
            pass
        await asyncio.sleep(2) # Near real-time monitoring

async def usb_monitor(client: httpx.AsyncClient, server: str, device_id: str):
    """Watches for new USB drives and automatically scans them."""
    print("[+] USB Monitor Online. Watching for removable drives...")
    known_drives = set()
    
    # Init known drives
    try:
        for ptr in psutil.disk_partitions():
            known_drives.add(ptr.device)
    except Exception:
        pass
        
    malicious_keywords = ["virus", "malware", "ransomware", "trojan", "mimikatz"]

    while True:
        try:
            current_drives = set()
            for ptr in psutil.disk_partitions():
                current_drives.add(ptr.device)
                
            new_drives = current_drives - known_drives
            for drive in new_drives:
                print(f"[!] New Drive Detected: {drive}")
                # Instantly scan the drive
                threats = []
                for root, _, files in os.walk(drive):
                    for file in files:
                        if any(kw in file.lower() for kw in malicious_keywords):
                            filepath = os.path.join(root, file)
                            try:
                                if os.path.isfile(filepath):
                                    os.remove(filepath)
                                    threats.append({
                                        "name": file,
                                        "file_path": filepath,
                                        "severity": "critical",
                                        "status": "deleted",
                                        "description": f"USB malware neutralized upon insertion onto {drive}"
                                    })
                                    print(f"  [X] USB THREAT DELETED: {file}")
                            except Exception:
                                pass
                if threats:
                    try:
                        await client.post(
                            f"{server}/agent/threats",
                            json={"device_id": device_id, "threats": threats},
                            timeout=10
                        )
                    except Exception:
                        pass
                        
            known_drives = current_drives
        except Exception:
            pass
        await asyncio.sleep(5)

async def main(server: str):
    device_id = get_or_create_device_id()
    psutil.cpu_percent(interval=None)  # Prime the CPU meter

    print("=" * 55)
    print("  PhantomShield X — Device Agent")
    print("=" * 55)

    async with httpx.AsyncClient() as client:
        # Register with server
        await register_device(client, server, device_id)

        # Send apps list in background
        asyncio.create_task(send_apps(client, server, device_id))

        # Start C2 command polling
        asyncio.create_task(poll_commands(client, server, device_id))
        
        # Start Active Protection Real-time Watcher
        asyncio.create_task(active_protection_monitor(client, server, device_id))
        
        # Start USB Monitor
        asyncio.create_task(usb_monitor(client, server, device_id))

        # Heartbeat loop
        print(f"[~] Sending telemetry every {HEARTBEAT_INTERVAL}s. Press Ctrl+C to stop.\n")
        while True:
            await send_heartbeat(client, server, device_id)
            await asyncio.sleep(HEARTBEAT_INTERVAL)


def create_image():
    """Generates a simple tray icon (shield)."""
    width = 64
    height = 64
    color = (20, 20, 20)
    image = Image.new('RGB', (width, height), color)
    draw = ImageDraw.Draw(image)
    # Draw simple shield outline
    draw.polygon([(32, 5), (55, 15), (55, 45), (32, 60), (9, 45), (9, 15)], fill=(77, 138, 240))
    return image

def set_autorun():
    """Adds the agent to Windows registry so it auto-starts on login."""
    if platform.system() == "Windows":
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
            # Find exact path if running as pyinstaller executable, else python path
            if getattr(sys, 'frozen', False):
                exe_path = sys.executable
            else:
                exe_path = f'"{sys.executable}" "{os.path.abspath(__file__)}"'
            winreg.SetValueEx(key, "PhantomShieldAgent", 0, winreg.REG_SZ, exe_path)
            winreg.CloseKey(key)
        except Exception as e:
            print(f"[!] Failed to set autorun: {e}")

def run_background_loop(server):
    try:
        asyncio.run(main(server))
    except Exception as e:
        print(f"Background network loop crashed: {e}")

def open_ui():
    """Builds a local Tkinter UI for the background agent."""
    device_id = get_or_create_device_id()
    root = tk.Tk()
    root.title("PhantomShield X Agent")
    root.geometry("400x500")
    root.configure(bg="#0a0a0b")
    root.resizable(False, False)
    
    # Try putting the window above others
    try:
        root.attributes('-topmost', 1)
        root.after(1000, lambda: root.attributes('-topmost', 0))
    except: pass
    
    label = tk.Label(root, text="🛡 PhantomShield X", font=("Segoe UI", 20, "bold"), fg="#4D8AF0", bg="#0a0a0b")
    label.pack(pady=30)
    
    status_frame = tk.Frame(root, bg="#111", bd=1, relief="solid")
    status_frame.pack(fill="x", padx=20, pady=10)
    
    tk.Label(status_frame, text="AGENT STATUS", font=("Segoe UI", 10), fg="#888", bg="#111").pack(pady=5)
    tk.Label(status_frame, text="✅ PROTECTED", font=("Segoe UI", 16, "bold"), fg="#10b981", bg="#111").pack(pady=5)
    
    info_frame = tk.Frame(root, bg="#111", bd=1, relief="solid")
    info_frame.pack(fill="x", padx=20, pady=10)
    
    tk.Label(info_frame, text=f"Device ID: {device_id[:12]}...", font=("Consolas", 10), fg="#ccc", bg="#111").pack(pady=5)
    tk.Label(info_frame, text=f"Hostname: {socket.gethostname()}", font=("Consolas", 10), fg="#ccc", bg="#111").pack(pady=5)
    tk.Label(info_frame, text=f"Engine: Active", font=("Consolas", 10), fg="#ccc", bg="#111").pack(pady=5)
    
    def open_dash():
        webbrowser.open("https://phantom-shield-x.vercel.app/admin")
        
    btn = tk.Button(root, text="Open Web Dashboard", bg="#4D8AF0", fg="white", font=("Segoe UI", 12, "bold"), 
                    activebackground="#3b72c9", activeforeground="white", command=open_dash, relief="flat", cursor="hand2")
    btn.pack(pady=30, ipadx=10, ipady=5)
    
    # Prevent multiple windows by running mainloop
    root.mainloop()

def on_ui_click(icon, item):
    """Spawns the UI securely without blocking the primary tray icon."""
    threading.Thread(target=open_ui, daemon=True).start()

def setup_tray(server):
    """Sets up the invisible system tray icon and branches network loop."""
    print("[+] Initializing PhantomShield Agent in stealth tray mode...")
    set_autorun()
    
    # Fire up the networking loop in a background thread so the UI loop isn't blocked
    bg_thread = threading.Thread(target=run_background_loop, args=(server,), daemon=True)
    bg_thread.start()
    
    # Setup icon
    image = create_image()
    
    def on_quit(icon, item):
        icon.stop()
        os._exit(0) # hard exit to kill background threads
        
    menu = pystray.Menu(
        pystray.MenuItem('Open PhantomShield Dashboard', on_ui_click, default=True),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('Exit Endpoint Agent', on_quit)
    )
    
    icon = pystray.Icon("PhantomShield", image, "PhantomShield-X Agent", menu)
    icon.run()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PhantomShield X Device Agent")
    parser.add_argument(
        "--server",
        default=os.environ.get("PHANTOMSHIELD_SERVER", DEFAULT_SERVER),
        help="Central PhantomShield backend URL (default: http://localhost:8000)",
    )
    args = parser.parse_args()

    try:
        setup_tray(args.server)
    except KeyboardInterrupt:
        print("\n[+] Agent stopped.")
