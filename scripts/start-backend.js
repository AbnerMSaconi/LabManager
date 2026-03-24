/**
 * start-backend.js
 * Inicia o backend FastAPI detectando automaticamente o sistema operacional.
 * Windows  → usa `python`
 * Linux/Mac → usa `python3`
 */

const { spawn } = require("child_process");
const os = require("os");

const isWindows = os.platform() === "win32";
const pythonCmd = isWindows ? "python" : "python3";

console.log(`[LabManager] Iniciando backend com '${pythonCmd}'...`);

const proc = spawn(
  pythonCmd,
  ["-m", "uvicorn", "backend.app.main:app", "--reload", "--port", "8000"],
  { stdio: "inherit", shell: true }
);

proc.on("error", (err) => {
  console.error(`[LabManager] Erro ao iniciar o backend: ${err.message}`);
  console.error(`[LabManager] Certifique-se de que o Python está instalado e no PATH.`);
  process.exit(1);
});

proc.on("close", (code) => {
  if (code !== 0) process.exit(code);
});
