
import React from 'react';

const VoiceInteraction: React.FC = () => {
  // A funcionalidade de interação em tempo real (Live API) requer um Webhook Relay específico
  // para manter a segurança do backend solicitada pelo usuário.
  // No momento, as buscas principais de exegese já estão seguras no backend.
  return (
    <div className="fixed bottom-8 right-8 z-50">
      <div className="glass bg-indigo-500/10 border-white/5 p-4 rounded-full text-[9px] text-white/20 uppercase tracking-[0.3em] font-medium">
        <i className="fas fa-shield-halved mr-2 text-emerald-500/40"></i> Backend Seguro Ativado
      </div>
    </div>
  );
};

export default VoiceInteraction;
