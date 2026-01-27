//SecondScreen.tsx is the component for the second screen
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "../App.css";

function SecondScreen() {
    const [number, setNumber] = useState<string>("0");

    useEffect(() => {
        // Listen for number update events
        const unlisten = listen<string>("number-updated", (event) => {
            setNumber(event.payload);
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    return (
        <main className="container" style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            height: "100vh",
            textAlign: "center"
        }}>
            <h1 style={{ fontSize: "3rem", marginBottom: "2rem" }}>Second Screen</h1>
            <div style={{ fontSize: "5rem", fontWeight: "bold" }}>{number}</div>
        </main>
    );
}

export default SecondScreen;
