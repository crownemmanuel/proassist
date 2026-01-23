import { env } from '@huggingface/transformers';

import ortWasm from 'onnxruntime-web/dist/ort-wasm.wasm?url';
import ortWasmSimd from 'onnxruntime-web/dist/ort-wasm-simd.wasm?url';
import ortWasmSimdThreaded from 'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import ortWasmSimdThreadedWorker from 'onnxruntime-web/dist/ort-wasm-simd-threaded.worker.js?url';

let configured = false;

export function configureTransformersEnv(): void {
  if (configured) return;

  env.backends.onnx.wasm.wasmPaths = {
    'ort-wasm.wasm': ortWasm,
    'ort-wasm-simd.wasm': ortWasmSimd,
    'ort-wasm-simd-threaded.wasm': ortWasmSimdThreaded,
  };

  env.backends.onnx.wasm.workerPaths = {
    'ort-wasm-simd-threaded.worker.js': ortWasmSimdThreadedWorker,
  };

  configured = true;
}
