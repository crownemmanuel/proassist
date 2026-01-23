/**
 * Configure Transformers.js ONNX Runtime WASM paths for production builds
 * 
 * In production builds, the WASM files need to be explicitly configured
 * with their bundled paths. This ensures they're accessible when transformers.js
 * tries to load them, fixing the "no available backend found" error.
 * 
 * The transformers.js library expects wasmPaths to be either:
 * - A string (directory path where WASM files are located)
 * - An object mapping filenames to URLs
 * 
 * We extract the directory from the bundled WASM file URLs to provide
 * the base path where all WASM files will be located after bundling.
 */

import { env } from '@huggingface/transformers';

// Import WASM files so Vite bundles them - the URLs are used to determine the directory path
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ortWasm from 'onnxruntime-web/dist/ort-wasm.wasm?url';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ortWasmSimd from 'onnxruntime-web/dist/ort-wasm-simd.wasm?url';
import ortWasmSimdThreaded from 'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import ortWasmSimdThreadedWorker from 'onnxruntime-web/dist/ort-wasm-simd-threaded.worker.js?url';

let configured = false;

export function configureTransformersEnv(): void {
  if (configured) return;

  // Ensure ONNX backend is initialized
  if (!env.backends?.onnx?.wasm) {
    console.warn('ONNX WASM backend not available, skipping configuration');
    return;
  }

  // Extract directory path from the WASM file URL
  // Vite bundles these files and we need to tell transformers.js where to find them
  // The URL will be something like "/assets/ort-wasm-simd-threaded-abc123.wasm"
  // We extract the directory portion: "/assets/"
  const extractDirectory = (url: string): string => {
    // Handle both absolute URLs and relative paths
    let baseUrl: string;
    if (typeof window !== 'undefined' && window.location) {
      baseUrl = window.location.href;
    } else if (typeof self !== 'undefined' && (self as any).location) {
      baseUrl = (self as any).location.href;
    } else {
      // Fallback: assume relative path
      baseUrl = '/';
    }
    
    try {
      const urlObj = new URL(url, baseUrl);
      const pathname = urlObj.pathname;
      const lastSlash = pathname.lastIndexOf('/');
      return lastSlash >= 0 ? pathname.substring(0, lastSlash + 1) : '/';
    } catch {
      // If URL parsing fails, try simple string manipulation
      const lastSlash = url.lastIndexOf('/');
      return lastSlash >= 0 ? url.substring(0, lastSlash + 1) : '/';
    }
  };

  const wasmDir = extractDirectory(ortWasmSimdThreaded);
  const workerDir = extractDirectory(ortWasmSimdThreadedWorker);

  // Configure WASM paths - transformers.js expects a directory path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (env.backends.onnx.wasm as any).wasmPaths = wasmDir;

  // Configure worker paths if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wasmConfig = env.backends.onnx.wasm as any;
  if ('workerPaths' in wasmConfig) {
    wasmConfig.workerPaths = workerDir;
  }

  configured = true;
}
