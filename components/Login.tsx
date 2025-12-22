
import React, { useState } from 'react';
import { User } from '../types';
import Logo from './Logo';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const storageKey = 'exegesis_users_db';
    const usersStr = localStorage.getItem(storageKey);
    const users = usersStr ? JSON.parse(usersStr) : {};

    const normalizedUsername = username.toLowerCase().trim();

    if (isRegistering) {
      if (users[normalizedUsername]) {
        setError('Este usuário já existe na biblioteca.');
        return;
      }
      users[normalizedUsername] = { 
        id: normalizedUsername, 
        name: username.trim(), 
        password: password 
      };
      localStorage.setItem(storageKey, JSON.stringify(users));
      onLogin({ id: normalizedUsername, name: username.trim() });
    } else {
      const foundUser = users[normalizedUsername];
      if (foundUser && foundUser.password === password) {
        onLogin({ id: foundUser.id, name: foundUser.name });
      } else {
        setError('Credenciais inválidas. Verifique usuário e senha.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in duration-700">
      <div className="glass p-10 md:p-16 rounded-[2.5rem] w-full max-w-md flex flex-col items-center text-center space-y-8 border border-white/5 shadow-2xl relative overflow-hidden bg-gradient-to-br from-indigo-950/20 to-purple-950/20">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"></div>
        
        <Logo className="w-24 h-24 mb-2" />

        <div>
          <h1 className="text-4xl font-bold tracking-tighter text-white/90 serif">EXEGESIS</h1>
          <p className="text-xs text-white/30 uppercase tracking-[0.3em] mt-2">
            {isRegistering ? 'Criar Novo Perfil Erudito' : 'Tecnologia & Erudição'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-4">
            <div className="relative group">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuário"
                className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all text-center placeholder:text-white/20"
                required
              />
            </div>
            <div className="relative group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de Acesso"
                className="w-full glass bg-white/5 border-white/10 text-white rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all text-center placeholder:text-white/20"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-[10px] uppercase tracking-widest animate-pulse font-bold">
              <i className="fas fa-exclamation-triangle mr-1"></i> {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-emerald-500/80 hover:bg-emerald-400 text-indigo-950 font-bold py-5 rounded-2xl transition-all shadow-lg shadow-emerald-500/10 uppercase tracking-widest text-sm active:scale-95"
          >
            {isRegistering ? 'Finalizar Cadastro' : 'Acessar Biblioteca'}
          </button>
        </form>

        <div className="pt-4">
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            className="text-[10px] text-emerald-400/60 hover:text-emerald-400 uppercase tracking-widest font-bold transition-colors"
          >
            {isRegistering ? 'Já possui acesso? Entrar' : 'Não possui cadastro? Criar Conta'}
          </button>
        </div>

        <p className="text-[10px] text-white/20 uppercase tracking-widest leading-relaxed">
          Ambiente restrito e dados protegidos<br/>por criptografia local.
        </p>
      </div>
    </div>
  );
};

export default Login;