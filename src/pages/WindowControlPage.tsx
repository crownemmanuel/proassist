import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import "../App.css";

interface MonitorInfo {
    name: string;
    position: [number, number];
    size: [number, number];
    scale_factor: number;
}

export default function WindowControlPage() {
    const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
    const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);
    const [numberInput, setNumberInput] = useState<string>("");

    useEffect(() => {
        async function fetchMonitors() {
            try {
                const monitorsData = await invoke<MonitorInfo[]>("get_monitors");
                setMonitors(monitorsData);
                // Set first monitor as default selection
                if (monitorsData.length > 0) {
                    setSelectedMonitor(0);
                }
            } catch (error) {
                console.error("Failed to fetch monitors:", error);
            }
        }
        fetchMonitors();
    }, []);

    async function openWindow() {
        try {
            alert("Attempting to open audience display...");
            await invoke("open_dialog", {
                dialogWindow: "second-screen",
                monitorIndex: selectedMonitor,
            });
            alert("Audience display launched successfully!");
        } catch (e) {
            console.error(e);
            alert("Error opening display: " + JSON.stringify(e));
        }
    }

    return (
        <main className="container">
            <h1>Audience Display Control</h1>

            <div className="row" style={{marginBottom: "1rem"}}>
                <label htmlFor="monitor-select" style={{marginRight: "0.5rem"}}>
                    Select Monitor:
                </label>
                <select
                    id="monitor-select"
                    value={selectedMonitor ?? ""}
                    onChange={(e) => setSelectedMonitor(Number(e.target.value))}
                    style={{
                        padding: "0.5rem",
                        fontSize: "1rem",
                        minWidth: "200px",
                        color: "black"
                    }}
                >
                    {monitors.map((monitor, index) => (
                        <option key={index} value={index}>
                            {monitor.name} ({monitor.size[0]}x{monitor.size[1]})
                        </option>
                    ))}
                </select>
            </div>

            <form
                className="row"
                onSubmit={async (e) => {
                    e.preventDefault();
                    await openWindow();
                }}
                style={{marginBottom: "2rem"}}
            >
                <button type="submit">Open Audience Display</button>
            </form>
        </main>
    );
}
