export default import.meta.glob<string>(["../assets/material-icons/*.svg", "../assets/vscode-icons/*.svg"],
  { eager: true, query: "?raw", import: "default" });
