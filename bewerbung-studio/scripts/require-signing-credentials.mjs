const certificate = process.env.WIN_CSC_LINK || process.env.CSC_LINK;
const password =
  process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD;

if (!certificate) {
  throw new Error(
    "WIN_CSC_LINK fehlt. Pfad oder sichere Referenz auf das Code-Signing-Zertifikat setzen.",
  );
}

if (!password) {
  throw new Error(
    "WIN_CSC_KEY_PASSWORD fehlt. Zertifikatspasswort nur als Umgebungsvariable setzen.",
  );
}

console.log("Code-Signing-Zugangsdaten sind für diesen Prozess konfiguriert.");
