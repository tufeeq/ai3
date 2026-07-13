# Nexus AI Workspace

A private browser-based AI workspace with:

- Clean white responsive interface
- Multiple projects
- Separate chats inside each project
- Local project file library
- Editable project memory
- Automatic context linking across chats
- Free local WebLLM models
- Word, PowerPoint, PDF, Markdown and text export
- Runaway-generation and repetition protection

## Run on Windows

Double-click `start-windows.bat`, then open `http://localhost:8080`.

## Run on macOS or Linux

Open Terminal in the folder and run:

```bash
chmod +x start-mac-linux.command
./start-mac-linux.command
```

## Important

Do not open `index.html` directly. Use the local server or deploy the folder to GitHub Pages.

All project data, chats, memory and files are stored locally in the browser using IndexedDB. Clearing browser site data removes them. Files are limited to supported text-based formats and 2 MB each.
