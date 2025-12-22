
import React, { useState } from 'react';
import Logo from './Logo.tsx';
import { User } from '../types.ts';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('exegesis_users') || '[]');
    
    if (isRegistering) {
      if (users.find((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
        alert("Este nome de usuário já está em uso.");
        return;
      }
      const newUser = { 
        id: Math.random().toString(36).substr(2, 9), 
        username, 
        password, 
        name: name || username 
      };
      users.push(newUser);
      localStorage.setItem('exegesis_users', JSON.stringify(users));
      onLogin({ id: newUser.id, username: newUser.username, name: newUser.name });
    } else {
      const user = users.find((u: any) => 
        u.username.toLowerCase() === username.toLowerCase() && u.password === password
      );
      if (user) {
        onLogin({ id: user.id, username: user.username, name: user.name });
      } else {
        alert("Usuário ou senha inválidos.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a1a] relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse"></div>

      <div className="w-full max-w-md glass p-10 md:p-14 rounded-[3rem] border border-white/10 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-1000">
        <div className="flex flex-col items-center mb-10">
          <Logo className="w-24 h-24 mb-6" />
          <h1 className="text-3xl font-bold tracking-tight text-white serif">EXEGESIS</h1>
          <p className="text-emerald-400/50 text-[10px] uppercase tracking-[0.4em] mt-3 font-medium">Laboratório Teológico</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegistering && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/30 ml-4 font-bold">Nome de Exibição</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-white/10"
                placeholder="Ex: Prof. Silva"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30 ml-4 font-bold">Identidade de Usuário</label>
            <input
              required
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-white/10"
              placeholder="Seu_usuario_unico"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30 ml-4 font-bold">Palavra-Chave</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-white/10"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-indigo-950 font-black py-4.5 rounded-2xl shadow-[0_15px_35px_rgba(16,185,129,0.2)] transition-all active:scale-[0.98] uppercase tracking-[0.2em] text-xs mt-4"
          >
            {isRegistering ? 'Criar Identidade' : 'Entrar na Biblioteca'}
          </button>
        </form>

        <div className="mt-10 text-center border-t border-white/5 pt-6">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-white/30 hover:text-emerald-400 text-[10px] transition-colors uppercase tracking-[0.2em] font-bold"
          >
            {isRegistering ? 'Já possui acesso? Conectar' : 'Primeiro acesso? Cadastrar-se'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
