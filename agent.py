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
from datetime import datetime

try:
    import httpx
except ImportError:
    print("[!] httpx not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "psutil"])
    import httpx

# ─── Configuration ────────────────────────────────────────────────────────────
DEFAULT_SERVER = "http://localhost:8000"
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
            print(f"[✓] Registered with PhantomShield server: {server}")
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
    print(f"[✓] Found {len(apps)} installed applications.")
    try:
        await client.post(
            f"{server}/agent/apps",
            json={"device_id": device_id, "apps": apps},
            timeout=30,
        )
    except Exception as e:
        print(f"[!] Could not send apps: {e}")


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

        # Heartbeat loop
        print(f"[~] Sending telemetry every {HEARTBEAT_INTERVAL}s. Press Ctrl+C to stop.\n")
        while True:
            await send_heartbeat(client, server, device_id)
            await asyncio.sleep(HEARTBEAT_INTERVAL)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PhantomShield X Device Agent")
    parser.add_argument(
        "--server",
        default=os.environ.get("PHANTOMSHIELD_SERVER", DEFAULT_SERVER),
        help="Central PhantomShield backend URL (default: http://localhost:8000)",
    )
    args = parser.parse_args()

    try:
        asyncio.run(main(args.server))
    except KeyboardInterrupt:
        print("\n[✓] Agent stopped.")
