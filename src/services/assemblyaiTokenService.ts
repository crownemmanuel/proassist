/**
 * AssemblyAI token helper
 *
 * In Electron, token generation is done on the backend (IPC).
 * In Tauri, we do the same via a Rust `invoke` command to avoid WebView CORS issues.
 *
 * We keep a fetch() fallback for non-Tauri contexts (e.g., web preview),
 * but production Tauri should use the invoke path.
 */

export async function getAssemblyAITemporaryToken(
  apiKey: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  // Prefer Tauri backend (bypasses WebView CORS)
  try {
    const mod = await import("@tauri-apps/api/core");
    const token = await mod.invoke<string>("assemblyai_create_realtime_token", {
      apiKey,
      expiresIn: expiresInSeconds,
    });
    if (!token) throw new Error("Empty token returned from backend");
    return token;
  } catch (err) {
    // Fall back to browser fetch (may fail in Tauri due to CORS)
    try {
      const response = await fetch("https://api.assemblyai.com/v2/realtime/token", {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expires_in: expiresInSeconds }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(
          `Token request failed: ${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ""}`
        );
      }

      const data = JSON.parse(bodyText) as { token?: string };
      if (!data.token) throw new Error("Token response missing `token`");
      return data.token;
    } catch (fetchErr) {
      const invokeMsg =
        err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
      const fetchMsg =
        fetchErr instanceof Error
          ? fetchErr.message
          : typeof fetchErr === "string"
            ? fetchErr
            : JSON.stringify(fetchErr);
      throw new Error(`AssemblyAI token failed (invoke -> fetch). invoke=${invokeMsg}; fetch=${fetchMsg}`);
    }
  }
}

