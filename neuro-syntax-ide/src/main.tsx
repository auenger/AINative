import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';
import './i18n';

// ---------------------------------------------------------------------------
// Clipboard polyfill for Tauri webview
// Monaco's clipboardService uses navigator.clipboard which throws
// NotAllowedError in Tauri WKWebView. Override to suppress errors.
// Copy/paste via Cmd+C/V still works through OS-level handling.
// ---------------------------------------------------------------------------
if (navigator.clipboard) {
  const origRead = navigator.clipboard.readText.bind(navigator.clipboard);
  const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
  const origWriteItems = navigator.clipboard.write?.bind(navigator.clipboard);
  navigator.clipboard.readText = async () => {
    try { return await origRead(); } catch { return ''; }
  };
  navigator.clipboard.writeText = async (text: string) => {
    try { return await origWrite(text); } catch { /* noop */ }
  };
  if (origWriteItems) {
    navigator.clipboard.write = async (...args) => {
      try { return await origWriteItems(...args); } catch { /* noop */ }
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
