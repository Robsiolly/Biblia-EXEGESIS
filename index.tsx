
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Elemento raiz não encontrado no DOM.");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Erro fatal na renderização do App:", error);
  rootElement.innerHTML = `
    <div style="color: white; padding: 20px; font-family: sans-serif; text-align: center;">
      <h2>Erro de Carregamento</h2>
      <p>Ocorreu um problema ao iniciar o aplicativo. Verifique o console do navegador para detalhes.</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #10b981; border: none; border-radius: 5px; color: #0f172a; font-weight: bold; cursor: pointer;">
        Recarregar Página
      </button>
    </div>
  `;
}
