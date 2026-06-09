import { useState, useEffect } from "react";
import { fetchInfo } from "../api";

const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function fmtMes(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${MESES[parseInt(m, 10) - 1]}/${y}`;
}

function lerRecentes() {
  const parse = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { return []; }
  };
  // Até 5 de cada tipo — garante que ambos apareçam mesmo com cliques desbalanceados.
  const empresa = parse("ci_recentes_empresa").slice(0, 5).map(r => ({ ...r, tipo: "empresa" }));
  const socio   = parse("ci_recentes_socio").slice(0, 5).map(r => ({ ...r, tipo: "socio" }));
  return [...empresa, ...socio];
}

const NAV = [
  { icon: "domain",        label: "Busca Empresa", tela: "empresa", telas: ["empresa", "resultado-empresa"] },
  { icon: "person_search", label: "Busca Sócio",   tela: "socio",   telas: ["socio",   "resultado-socio"]   },
];

const S = {
  sidebar:      { background: "#0a1f3d" },
  divider:      { borderColor: "rgba(255,255,255,0.07)" },
  brandMark:    { background: "#0085ca", fontFamily: "'Inter Tight', Inter, sans-serif" },
  brandName:    { fontFamily: "'Inter Tight', Inter, sans-serif" },
  sectionLabel: { color: "#475569", letterSpacing: "0.12em" },
  navActive:    { background: "rgba(0,133,202,0.14)", color: "#dee7f0", borderLeft: "3px solid #0085ca" },
  navIdle:      { color: "#64748b", borderLeft: "3px solid transparent" },
  recentText:   { color: "#64748b" },
  footerVal:    { color: "#4a5d7a", fontFamily: "'JetBrains Mono', monospace" },
};

export default function Sidebar({ tela, irPara, onAbrirEmpresa, onAbrirSocio }) {
  const [info, setInfo]       = useState(null);
  const [recentes, setRecentes] = useState([]);

  useEffect(() => {
    setRecentes(lerRecentes());
    fetchInfo().then(d => d && setInfo(d));
  }, [tela]);

  function clicarRecente(r) {
    if (r.tipo === "empresa" && r.cnpj && onAbrirEmpresa) {
      onAbrirEmpresa(r.cnpj);
    } else if (r.tipo === "socio" && (r.nome || r.termo) && onAbrirSocio) {
      onAbrirSocio({ nome_socio: r.nome || r.termo, cpf_cnpj_socio: r.cpf });
    } else {
      // Entrada antiga sem cnpj/cpf — só leva pra tela de busca correspondente.
      irPara(r.tipo);
    }
  }

  return (
    <aside
      style={S.sidebar}
      className="fixed left-0 top-0 h-screen w-52 flex flex-col z-40 hidden md:flex select-none"
    >
      {/* Brand */}
      <button
        type="button"
        onClick={() => irPara("home")}
        aria-label="Voltar para a página inicial"
        className="flex items-center gap-1.5 px-4 py-[14px] border-b shrink-0 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={S.divider}
      >
        <img
          src="/Logo-Pytha.png"
          alt="Pythagoras"
          className="w-16 h-16 shrink-0 object-contain"
        />
        <div>
          <div className="text-white font-semibold text-[15px] leading-tight" style={S.brandName}>
            Pythagoras
          </div>
          <div className="text-[10.5px] font-medium uppercase tracking-widest mt-px" style={S.sectionLabel}>
            CNPJ Intelligence
          </div>
        </div>
      </button>

      {/* Nav */}
      <nav className="px-3 pt-4 pb-2 shrink-0 space-y-0.5">
        {NAV.map(item => {
          const active = item.telas.includes(tela);
          return (
            <button
              key={item.label}
              onClick={() => irPara(item.tela)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium text-left rounded-lg transition-colors"
              style={active ? S.navActive : S.navIdle}
            >
              <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Buscas recentes — flex-1 garante que o footer sempre fica no fundo */}
      <div className="flex-1 overflow-y-auto">
      {recentes.length > 0 && (
        <div className="px-3 pt-8 mt-6 border-t sidebar-scroll" style={S.divider}>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase" style={S.sectionLabel}>
              Buscas recentes
            </span>
            <span className="text-[9.5px]" style={S.sectionLabel}>{recentes.length}</span>
          </div>
          {recentes.map((r, i) => (
            <button
              key={i}
              onClick={() => clicarRecente(r)}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-left transition-colors hover:bg-white/5"
            >
              <span
                className="material-symbols-outlined text-[15px] shrink-0"
                style={S.recentText}
              >
                {r.icone}
              </span>
              <span className="text-[12px] truncate" style={S.recentText}>{r.termo}</span>
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Footer — métricas da base */}
      <div className="px-5 py-4 border-t shrink-0" style={S.divider}>
        <div className="text-[9.5px] font-semibold uppercase mb-1" style={S.sectionLabel}>
          Base RFB
        </div>
        <div className="text-[12px]" style={S.footerVal}>
          {info?.mes_atual ? fmtMes(info.mes_atual) : "—"}
        </div>
      </div>
    </aside>
  );
}
