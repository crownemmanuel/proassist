import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "../App.css";

const AudienceDisplayTestWindow: React.FC = () => {
  const [displayText, setDisplayText] = useState<string>("0");

  useEffect(() => {
    const unlisten = listen<string>("number-updated", (event) => {
      setDisplayText(event.payload);
    });

    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  return (
    <main
      className="container"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "2rem" }}>
        Second Screen
      </h1>
      <div style={{ fontSize: "5rem", fontWeight: "bold" }}>
        {displayText}
      </div>
    </main>
  );
};

export default AudienceDisplayTestWindow;
