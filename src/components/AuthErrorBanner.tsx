import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { ParsedAuthError } from '../firebase';

interface AuthErrorBannerProps {
  error: ParsedAuthError;
  onRetryPopup: () => void;
  onRetryRedirect: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
}

export const AuthErrorBanner: React.FC<AuthErrorBannerProps> = ({
  error,
  onRetryPopup,
  onRetryRedirect,
  onDismiss,
  isRetrying = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (error.currentDomain && navigator.clipboard) {
      navigator.clipboard.writeText(error.currentDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 text-left text-slate-900 shadow-md animate-in fade-in space-y-4">
      {/* Title */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
          <ShieldAlert className="w-6 h-6 text-amber-700" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-black text-amber-950 leading-tight">
            {error.title}
          </h3>
          <p className="text-xs text-amber-900 mt-1 leading-relaxed">
            {error.message}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-amber-600 hover:text-amber-950 text-sm font-bold p-1 rounded"
          title="Fechar aviso"
        >
          ✕
        </button>
      </div>

      {/* Special Step-by-Step for Unauthorized Domain (Vercel) */}
      {error.isUnauthorizedDomain && (
        <div className="bg-white/80 border border-amber-200 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Domínio da Vercel para autorizar:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300">
              <code className="text-xs font-mono font-bold text-emerald-800">
                {error.currentDomain || 'seu-app.vercel.app'}
              </code>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-emerald-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-xs transition"
                title="Copiar domínio"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Guide */}
          <div className="space-y-1.5 pt-1 text-xs text-slate-700 border-t border-amber-100">
            <p className="font-bold text-amber-900">Como resolver em 1 minuto:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>
                Abra o <strong>Firebase Console</strong> do projeto{' '}
                <strong className="font-mono text-slate-800">{error.projectId}</strong>.
              </li>
              <li>
                Vá em <strong>Authentication</strong> ➔ aba <strong>Configurações (Settings)</strong> ➔{' '}
                <strong>Domínios autorizados (Authorized domains)</strong>.
              </li>
              <li>
                Clique em <strong>Adicionar domínio</strong> e cole o domínio acima.
              </li>
              <li>
                Clique em <strong>Salvar</strong> e teste o botão abaixo.
              </li>
            </ol>
          </div>

          {/* Direct Link to Firebase Console */}
          <a
            href={error.settingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-xs transition"
          >
            <span>Abrir Configurações do Firebase no Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Retry Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          onClick={onRetryPopup}
          disabled={isRetrying}
          className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Conectando...' : 'Tentar Novamente (Janela Normal)'}</span>
        </button>

        <button
          onClick={onRetryRedirect}
          disabled={isRetrying}
          className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-2"
          title="Útil se seu celular bloquear janelas pop-up"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-300" />
          <span>Entrar via Redirecionamento</span>
        </button>
      </div>
    </div>
  );
};
