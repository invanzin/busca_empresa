import { useState, useEffect, useCallback } from "react";
import { buscarEmpresaRede } from "../api";
import { RedeEmpresa } from "./RedeTree";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function fmtMes(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${MESES[parseInt(m, 10) - 1]}/${y}`;
}

function fmtBRL(v) {
  const n = parseFloat(String(v).replace(",", "."));
  if (!v || isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function iniciais(nome) {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Ativa:    { bg: "#ecfdf5", color: "#15803d", border: "#bbf7d0" },
    Baixada:  { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    Suspensa: { bg: "#fef3c7", color: "#b45309", border: "#fde68a" },
    Inapta:   { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  };
  const s = map[status] || { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
  return (
    <span
      className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {status || "—"}
    </span>
  );
}

// ─── Campo (KV simples) ───────────────────────────────────────────────────────
function Campo({ label, valor, mono }) {
  if (!valor) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>
        {label}
      </p>
      <p
        className="text-[14px] font-medium"
        style={{ color: "#0f172a", fontFamily: mono ? "'JetBrains Mono', monospace" : undefined }}
      >
        {valor}
      </p>
    </div>
  );
}

// ─── Secao (card container) ──────────────────────────────────────────────────
function Secao({ titulo, icone, children, acao, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-3.5 flex justify-between items-center border-b transition-colors text-left"
        style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}
        onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
        onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}
      >
        <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "#0f172a" }}>
          <span className="material-symbols-outlined text-[17px]" style={{ color: "#0085ca" }}>{icone}</span>
          {titulo}
        </h3>
        <div className="flex items-center gap-2">
          {acao}
          <span className="material-symbols-outlined text-[17px]" style={{ color: "#94a3b8" }}>
            {open ? "expand_less" : "expand_more"}
          </span>
        </div>
      </button>
      {open && children}
    </div>
  );
}

// ─── SocioRow ─────────────────────────────────────────────────────────────────
const AVATAR_CORES = [
  { bg: "#eef4f9", color: "#0a5494" },
  { bg: "#f1f5f9", color: "#475569" },
  { bg: "#eff6ff", color: "#1d4ed8" },
  { bg: "#f0fdf4", color: "#15803d" },
];

function SocioRow({ socio, idx, onVerSocio, onVerEmpresa }) {
  const [expandido, setExpandido] = useState(false);
  const temHistorico = socio.qualificacoes_anteriores?.length > 0;
  const av = AVATAR_CORES[idx % AVATAR_CORES.length];
  // Detecta sócio PJ pelo documento: 14 dígitos sem máscara (asteriscos) = CNPJ.
  // Sócio PF aparece como ***123456** (mascarado pela RF).
  const docDigits = (socio.cpf_cnpj_socio || "").replace(/\D/g, "");
  const isPJ = !socio.cpf_cnpj_socio?.includes("*") && docDigits.length === 14;
  const handleInvestigar = () => {
    if (isPJ && onVerEmpresa) {
      onVerEmpresa(docDigits);
    } else if (onVerSocio) {
      onVerSocio(socio);
    }
  };

  return (
    <>
      <tr
        className="border-b transition-colors"
        style={{ borderColor: "#f1f5f9" }}
        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
        onMouseLeave={e => e.currentTarget.style.background = ""}
      >
        <td className="p-3 pl-5 text-[13px] font-medium align-top" style={{ color: "#0f172a" }}>
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
              style={{ background: av.bg, color: av.color }}
            >
              {iniciais(socio.nome_socio)}
            </div>
            <div>
              <div>{socio.nome_socio}</div>
              {socio.faixa_etaria && socio.faixa_etaria !== "Não informada" && (
                <div className="text-[11px]" style={{ color: "#94a3b8" }}>{socio.faixa_etaria}</div>
              )}
            </div>
          </div>
        </td>
        <td className="p-3 text-[12px] align-top" style={{ color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
          {(socio.cpf_cnpj_socio || "—").replace(/\*/g, "·")}
        </td>
        <td className="p-3 text-[13px] align-top" style={{ color: "#334155" }}>
          <div>{socio.qualificacao_atual?.descricao || "—"}</div>
          {socio.qualificacao_atual?.data_entrada && (
            <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "#64748b" }}>
              <span className="material-symbols-outlined text-[11px]" style={{ color: "#15803d" }}>login</span>
              desde {socio.qualificacao_atual.data_entrada}
            </div>
          )}
          {!socio.ativo && socio.qualificacao_atual?.saiu_em && (
            <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "#64748b" }}>
              <span className="material-symbols-outlined text-[11px]" style={{ color: "#b91c1c" }}>logout</span>
              saiu em {socio.qualificacao_atual.saiu_em}
            </div>
          )}
          {temHistorico && (
            <button
              onClick={() => setExpandido(v => !v)}
              className="text-[11px] mt-1 flex items-center gap-0.5 hover:underline"
              style={{ color: "#0085ca" }}
            >
              <span className="material-symbols-outlined text-[12px]">{expandido ? "expand_less" : "expand_more"}</span>
              {expandido ? "Ocultar histórico" : `Ver histórico (${socio.qualificacoes_anteriores.length})`}
            </button>
          )}
        </td>
        <td className="p-3 pr-5 text-right whitespace-nowrap align-top">
          <button
            onClick={handleInvestigar}
            className="text-[12px] font-semibold hover:underline"
            style={{ color: "#0085ca" }}
            title={isPJ ? "Abrir perfil da empresa sócia" : "Abrir perfil do sócio"}
          >
            Investigar
          </button>
        </td>
      </tr>
      {expandido && socio.qualificacoes_anteriores.map((q, qi) => (
        <tr key={qi} className="border-b" style={{ background: "#f8fafc", borderColor: "#f1f5f9" }}>
          <td className="p-3 pl-16" colSpan={2}>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "#94a3b8" }}>
              <span className="material-symbols-outlined text-[11px]">history</span>
              Qualificação anterior
            </span>
          </td>
          <td className="p-3 text-[13px]" style={{ color: "#334155" }}>
            <div className="font-medium">{q.descricao || "—"}</div>
            {q.data_entrada && (
              <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "#64748b" }}>
                <span className="material-symbols-outlined text-[11px]" style={{ color: "#15803d" }}>login</span>
                desde {q.data_entrada}
              </div>
            )}
            {q.saiu_em && (
              <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "#64748b" }}>
                <span className="material-symbols-outlined text-[11px]" style={{ color: "#b91c1c" }}>logout</span>
                saiu em {q.saiu_em}
              </div>
            )}
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}

// ─── FilialTabela ─────────────────────────────────────────────────────────────
function FilialTabela({ filiais, onVerEmpresa }) {
  return (
    <div style={{ overflowX: "hidden", ...(filiais.length > 10 ? { maxHeight: 520, overflowY: "auto" } : {}) }}>
      <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "26%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "24%" }} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pl-5" style={{ color: "#94a3b8" }}>CNPJ</th>
            <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>NOME FANTASIA</th>
            <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>TIPO</th>
            <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>SITUAÇÃO</th>
            <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pr-5" style={{ color: "#94a3b8" }}>LOCALIZAÇÃO</th>
          </tr>
        </thead>
        <tbody>
          {filiais.map((f, i) => (
            <tr
              key={i}
              className="border-b transition-colors"
              style={{
                borderColor: "#f1f5f9",
                cursor: f.atual ? "default" : "pointer",
                background: f.atual ? "#f8fafc" : undefined,
              }}
              onMouseEnter={e => { if (!f.atual) e.currentTarget.style.background = "#f0f7ff"; }}
              onMouseLeave={e => { if (!f.atual) e.currentTarget.style.background = ""; }}
              onClick={() => !f.atual && onVerEmpresa && onVerEmpresa(f.cnpj_completo)}
            >
              <td className="p-3 pl-5 align-top">
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: f.atual ? "#0f172a" : "#0085ca",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.cnpj_completo_formatado}
                </div>
                {f.atual && (
                  <span
                    className="mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "#0085ca", color: "#fff" }}
                  >
                    ESTE
                  </span>
                )}
              </td>
              <td className="p-3 text-[13px] align-top" style={{ color: "#334155" }}>
                {f.nome_fantasia || <span style={{ color: "#94a3b8" }}>—</span>}
              </td>
              <td className="p-3 align-top">
                <span
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full"
                  style={
                    f.tipo === "Matriz"
                      ? { background: "#eef4f9", color: "#0a5494", border: "1px solid #bfdbfe" }
                      : { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }
                  }
                >
                  {f.tipo || "—"}
                </span>
              </td>
              <td className="p-3 align-top">
                <StatusBadge status={f.situacao_cadastral} />
              </td>
              <td className="p-3 pr-5 text-[13px] align-top" style={{ color: "#334155" }}>
                {[f.municipio, f.uf].filter(Boolean).join(" / ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ResultadoEmpresa ─────────────────────────────────────────────────────────
export default function ResultadoEmpresa({ dados, onVoltar, onVerSocio, onVerEmpresa, onAbrirGrafo }) {
  const [exInativos, setExInativos] = useState(false);
  const [redeAberta, setRedeAberta]   = useState(false);
  const [redeData,   setRedeData]     = useState(null);
  const [redeLoading, setRedeLoading] = useState(false);

  // Novo perfil → rola pro topo. O App.jsx remonta este componente via `key`
  // a cada CNPJ, então o effect roda uma vez no mount de cada perfil.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const carregarRede = useCallback(async () => {
    if (redeData || redeLoading) return;
    setRedeLoading(true);
    try {
      const cnpj = dados.cnpj_completo || dados.cnpj_basico + "000100";
      const d = await buscarEmpresaRede(cnpj);
      setRedeData(d);
    } finally {
      setRedeLoading(false);
    }
  }, [dados, redeData, redeLoading]);

  function toggleRede() {
    if (!redeAberta) carregarRede();
    setRedeAberta(v => !v);
  }

  if (!dados) return null;

  const telefone1 = dados.ddd1 && dados.telefone1 ? `(${dados.ddd1}) ${dados.telefone1}` : null;
  const telefone2 = dados.ddd2 && dados.telefone2 ? `(${dados.ddd2}) ${dados.telefone2}` : null;
  const telefone  = telefone1 || telefone2;

  const enderecoLinha1 = [dados.tipo_logradouro, dados.logradouro, dados.numero && `nº ${dados.numero}`].filter(Boolean).join(" ");
  const enderecoLinha2 = [dados.complemento, dados.bairro].filter(Boolean).join(", ");
  const enderecoLinha3 = [dados.municipio_descricao, dados.uf].filter(Boolean).join(" - ");

  const isPJ    = (s) => s.cpf_cnpj_socio && !s.cpf_cnpj_socio.includes("*") && s.cpf_cnpj_socio.replace(/\D/g, "").length === 14;
  const cargoRank = (s) => {
    const d = (s.qualificacao_atual?.descricao || "").toLowerCase();
    if (d.includes("administrador") || d.includes("diretor") || d.includes("presidente")) return 0;
    return 1;
  };
  const sortSocios = (a, b) => (isPJ(a) ? 1 : 0) - (isPJ(b) ? 1 : 0) || cargoRank(a) - cargoRank(b);
  const sociosAtivos   = [...(dados.socios_ativos   || [])].sort(sortSocios);
  const sociosInativos = [...(dados.socios_inativos || [])].sort(sortSocios);
  const todasFiliais    = dados.filiais || [];
  const filiaisAtivas   = todasFiliais.filter(f => f.situacao_cadastral === "Ativa");
  const filiaisInativas = todasFiliais.filter(f => f.situacao_cadastral !== "Ativa");
  const totalSocios    = sociosAtivos.length + sociosInativos.length;
  const empresaEncerrada = dados.situacao_cadastral === "Baixada" || dados.situacao_cadastral === "Nula";
  const labelAtivos = empresaEncerrada ? "Sócios até o Fechamento" : "Sócios Ativos";

  const mapsUrl = enderecoLinha1
    ? `https://www.google.com/maps?q=${encodeURIComponent([enderecoLinha1, enderecoLinha3].filter(Boolean).join(", "))}`
    : null;

  return (
    <main className="flex-1 md:ml-52 bg-[#f7f9fc] min-h-screen">

      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-8 h-14 bg-white/90 backdrop-blur-md border-b"
        style={{ borderColor: "#e2e8f0" }}
      >
        <button
          onClick={onVoltar}
          className="flex items-center gap-2 text-[13px] font-medium transition-colors"
          style={{ color: "#64748b" }}
          onMouseEnter={e => e.currentTarget.style.color = "#0085ca"}
          onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
        >
          <span className="material-symbols-outlined text-[17px]">arrow_back</span>
          Voltar à busca
        </button>
        <div className="text-[12px]" style={{ color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
          {dados.cnpj_completo_formatado || dados.cnpj_completo}
        </div>
      </header>

      <div className="p-4 md:p-10 max-w-[1400px] mx-auto space-y-6">

        {/* Banner: situação especial (Recuperação Judicial, Falência) */}
        {dados.situacao_especial && (
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-xl text-[13px] font-medium"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}
          >
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span className="font-semibold">Situação Especial:</span>
            {dados.situacao_especial}
            {dados.data_situacao_especial && (
              <span style={{ color: "#ef4444", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                · desde {dados.data_situacao_especial}
              </span>
            )}
          </div>
        )}

        {/* Hero — logo + nome + badges */}
        <div
          className="bg-white rounded-xl px-8 py-6"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}
        >
          <div className="flex items-start gap-5">
            {/* Logo quadrado navy */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xl select-none"
              style={{ background: "#0a1f3d", fontFamily: "'Inter Tight', Inter, sans-serif" }}
            >
              {iniciais(dados.nome_fantasia || dados.razao_social)}
            </div>

            {/* Nome e badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1" style={{ color: "#94a3b8", fontSize: 12 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {dados.cnpj_completo_formatado || dados.cnpj_completo}
                </span>
                <span>·</span>
                <StatusBadge status={dados.situacao_cadastral} />
                {dados.matriz_filial && (
                  <>
                    <span>·</span>
                    <span>{dados.matriz_filial}</span>
                  </>
                )}
                {dados.motivo_situacao && dados.situacao_cadastral !== "Ativa" && (
                  <>
                    <span>·</span>
                    <span style={{ color: "#64748b" }}>{dados.motivo_situacao}</span>
                  </>
                )}
              </div>

              <h1
                className="text-[26px] font-semibold leading-tight tracking-tight"
                style={{ fontFamily: "'Inter Tight', Inter, sans-serif", color: "#0f172a" }}
              >
                {dados.razao_social}
              </h1>

              {dados.nome_fantasia && (
                <p className="text-[14px] mt-0.5" style={{ color: "#64748b" }}>{dados.nome_fantasia}</p>
              )}
            </div>
          </div>

          {/* Barra temporal — 4 células */}
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-0 mt-6 pt-5 border-t"
            style={{ borderColor: "#e2e8f0" }}
          >
            {[
              { label: "Abertura",                                              val: dados.data_inicio || "—",   sub: null },
              { label: empresaEncerrada ? "Fechamento" : "Situação desde",    val: dados.data_situacao || "—", sub: null },
              { label: "Capital Social",                                       val: fmtBRL(dados.capital_social), sub: null },
            ].map((cell, i) => (
              <div
                key={i}
                className="px-5 py-3 border-l first:border-l-0"
                style={{ borderColor: "#e2e8f0" }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>
                  {cell.label}
                </div>
                <div className="text-[15px] font-semibold" style={{ color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>
                  {cell.val}
                  {cell.sub && (
                    <span className="ml-2 text-[12px] font-normal" style={{ color: "#94a3b8" }}>{cell.sub}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">

            {/* CNAEs */}
            <Secao titulo="Atividade Econômica (CNAE)" icone="work">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pl-5 w-28" style={{ color: "#94a3b8" }}>CÓDIGO</th>
                      <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>DESCRIÇÃO</th>
                      <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pr-5 w-24" style={{ color: "#94a3b8" }}>TIPO</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {dados.cnae_principal_codigo && (
                      <tr
                        className="border-b border-l-2 transition-colors"
                        style={{ borderColor: "#f1f5f9", borderLeftColor: "#0085ca" }}
                      >
                        <td className="p-3 pl-5" style={{ color: "#64748b", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {dados.cnae_principal_codigo}
                        </td>
                        <td className="p-3 font-medium" style={{ color: "#0f172a" }}>
                          {dados.cnae_principal_descricao || dados.cnae_principal_codigo}
                        </td>
                        <td className="p-3 pr-5">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full" style={{ background: "#eef4f9", color: "#0a5494", border: "1px solid #bfdbfe" }}>
                            PRIMÁRIA
                          </span>
                        </td>
                      </tr>
                    )}
                    {(dados.cnae_secundarios || []).map((cnae, i) => (
                      <tr
                        key={i}
                        className="border-b border-l-2 transition-colors"
                        style={{ borderColor: "#f1f5f9", borderLeftColor: "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}
                      >
                        <td className="p-3 pl-5" style={{ color: "#64748b", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {cnae.codigo}
                        </td>
                        <td className="p-3" style={{ color: "#334155" }}>
                          {cnae.descricao || cnae.codigo}
                        </td>
                        <td className="p-3 pr-5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                            SECUNDÁRIA
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Secao>

            {/* QSA — Sócios Ativos */}
            <Secao titulo={`${labelAtivos} (${sociosAtivos.length})`} icone="groups">
              {sociosAtivos.length === 0 ? (
                <p className="p-5 text-[13px]" style={{ color: "#94a3b8" }}>
                  {empresaEncerrada ? "Nenhum sócio registrado até o fechamento." : "Nenhum sócio ativo cadastrado."}
                </p>
              ) : (
                <div className="overflow-x-auto" style={sociosAtivos.length > 10 ? { maxHeight: 520, overflowY: "auto", overflowX: "hidden" } : {}}>
                  <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[22%]" />
                      <col className="w-[27%]" />
                      <col className="w-[13%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pl-5" style={{ color: "#94a3b8" }}>NOME</th>
                        <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>DOCUMENTO</th>
                        <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>QUALIFICAÇÃO</th>
                        <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pr-5 text-right" style={{ color: "#94a3b8" }}>AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sociosAtivos.map((s, i) => (
                        <SocioRow key={i} socio={s} idx={i} onVerSocio={onVerSocio} onVerEmpresa={onVerEmpresa} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Secao>

            {/* QSA — Ex-Sócios */}
            {sociosInativos.length > 0 && (
              <div
                className="bg-white rounded-xl overflow-hidden"
                style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}
              >
                <button
                  onClick={() => setExInativos(v => !v)}
                  className="w-full px-5 py-3.5 flex justify-between items-center border-b transition-colors"
                  style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}
                >
                  <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "#64748b" }}>
                    <span className="material-symbols-outlined text-[17px]" style={{ color: "#94a3b8" }}>person_off</span>
                    Ex-Sócios ({sociosInativos.length})
                  </h3>
                  <span className="material-symbols-outlined text-[17px]" style={{ color: "#94a3b8" }}>
                    {exInativos ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {exInativos && (
                  <div className="overflow-x-auto" style={sociosInativos.length > 10 ? { maxHeight: 520, overflowY: "auto", overflowX: "hidden" } : {}}>
                    <table className="w-full text-left border-collapse table-fixed">
                      <colgroup>
                        <col className="w-[38%]" />
                        <col className="w-[22%]" />
                        <col className="w-[27%]" />
                        <col className="w-[13%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pl-5" style={{ color: "#94a3b8" }}>NOME</th>
                          <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>DOCUMENTO</th>
                          <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3" style={{ color: "#94a3b8" }}>ÚLTIMA QUALIFICAÇÃO</th>
                          <th className="text-[10px] font-semibold uppercase tracking-[0.1em] p-3 pr-5 text-right" style={{ color: "#94a3b8" }}>AÇÃO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sociosInativos.map((s, i) => (
                          <SocioRow key={i} socio={s} idx={i} onVerSocio={onVerSocio} onVerEmpresa={onVerEmpresa} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Estabelecimentos Ativos */}
            {filiaisAtivas.length > 1 && (
              <Secao titulo={`Estabelecimentos Ativos (${filiaisAtivas.length})`} icone="account_tree" defaultOpen={false}>
                <FilialTabela filiais={filiaisAtivas} onVerEmpresa={onVerEmpresa} />
              </Secao>
            )}

            {/* Estabelecimentos Inativos */}
            {filiaisInativas.length > 1 && (
              <Secao titulo={`Estabelecimentos Inativos (${filiaisInativas.length})`} icone="account_tree" defaultOpen={false}>
                <FilialTabela filiais={filiaisInativas} onVerEmpresa={onVerEmpresa} />
              </Secao>
            )}

            {/* Mapa de Relacionamentos */}
            <div
              className="bg-white rounded-xl overflow-hidden"
              style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}
            >
              <div
                className="w-full px-5 py-3.5 flex justify-between items-center border-b"
                style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}
              >
                <button
                  onClick={toggleRede}
                  className="flex items-center gap-2 text-left transition-colors"
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "#0f172a" }}>
                    <span className="material-symbols-outlined text-[17px]" style={{ color: "#0085ca" }}>hub</span>
                    Mapa de Relacionamentos
                  </h3>
                  <span className="material-symbols-outlined text-[17px]" style={{ color: "#94a3b8" }}>
                    {redeAberta ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {onAbrirGrafo && (
                  <button
                    onClick={() => onAbrirGrafo({ tipo: "empresa", cnpj: dados.cnpj_completo || dados.cnpj_basico + "000100", label: dados.razao_social })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                    style={{ background: "#eef4f9", color: "#0a5494", border: "1px solid #bfdbfe" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#dce9f5"}
                    onMouseLeave={e => e.currentTarget.style.background = "#eef4f9"}
                  >
                    <span className="material-symbols-outlined text-[15px]">account_tree</span>
                    Rede completa
                  </button>
                )}
              </div>
              {redeAberta && (
                <div className="p-2">
                  {redeLoading && (
                    <div className="flex items-center justify-center gap-3 py-16 text-[13px]" style={{ color: "#94a3b8" }}>
                      <span className="material-symbols-outlined animate-spin text-[20px]" style={{ color: "#0085ca" }}>progress_activity</span>
                      Montando rede societária...
                    </div>
                  )}
                  {redeData && !redeLoading && (
                    <RedeEmpresa
                      data={redeData}
                      onVerEmpresa={onVerEmpresa}
                      onVerSocio={onVerSocio}
                    />
                  )}
                  {!redeLoading && !redeData && (
                    <p className="py-10 text-center text-[13px]" style={{ color: "#94a3b8" }}>Sem dados de rede.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">

            {/* Estabelecimento */}
            <Secao titulo="Estabelecimento" icone="location_on">
              <div className="p-5 space-y-4">

                {/* Tipo + Maps */}
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: "#eef4f9", color: "#0a5494", border: "1px solid #bfdbfe" }}
                  >
                    <span className="material-symbols-outlined text-[13px]">store</span>
                    {dados.matriz_filial || "Matriz"}
                  </span>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
                      style={{ color: "#0085ca" }}
                    >
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      Ver no Maps
                    </a>
                  )}
                </div>

                {/* Campos de endereço */}
                <div className="space-y-3 pt-1">
                  {enderecoLinha1 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>Logradouro</p>
                      <p className="text-[13px]" style={{ color: "#0f172a" }}>{enderecoLinha1}</p>
                    </div>
                  )}
                  {dados.complemento && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>Complemento</p>
                      <p className="text-[13px]" style={{ color: "#0f172a" }}>{dados.complemento}</p>
                    </div>
                  )}
                  {dados.bairro && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>Bairro</p>
                      <p className="text-[13px]" style={{ color: "#0f172a" }}>{dados.bairro}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {dados.municipio_descricao && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>Município</p>
                        <p className="text-[13px]" style={{ color: "#0f172a" }}>{dados.municipio_descricao}</p>
                      </div>
                    )}
                    {dados.uf && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>UF</p>
                        <p className="text-[13px]" style={{ color: "#0f172a" }}>{dados.uf}</p>
                      </div>
                    )}
                  </div>
                  {dados.cep && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: "#94a3b8" }}>CEP</p>
                      <p className="text-[13px]" style={{ color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>
                        {dados.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Contato */}
                {(telefone || dados.email) && (
                  <div className="pt-3 border-t space-y-2.5" style={{ borderColor: "#f1f5f9" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#94a3b8" }}>Contato</p>
                    {telefone1 && (
                      <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "#334155" }}>
                        <span className="material-symbols-outlined text-[15px]" style={{ color: "#94a3b8" }}>call</span>
                        {telefone1}
                      </div>
                    )}
                    {telefone2 && (
                      <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "#334155" }}>
                        <span className="material-symbols-outlined text-[15px]" style={{ color: "#94a3b8" }}>call</span>
                        {telefone2}
                      </div>
                    )}
                    {dados.email && (
                      <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "#334155" }}>
                        <span className="material-symbols-outlined text-[15px]" style={{ color: "#94a3b8" }}>mail</span>
                        <span className="truncate">{dados.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Secao>

            {/* Identificação */}
            <Secao titulo="Identificação" icone="info">
              <div className="p-5 space-y-4">
                <Campo label="Natureza Jurídica"           valor={dados.natureza_juridica_descricao} />
                <Campo label="Porte"                        valor={dados.porte} />
                <Campo label="Qualificação do Responsável"  valor={dados.qualificacao_responsavel_descricao} />
                <Campo label="Motivo da Situação"           valor={dados.motivo_situacao !== "SEM MOTIVO" ? dados.motivo_situacao : null} />
              </div>
            </Secao>

            {/* Simples / MEI */}
            <Secao titulo="Simples Nacional / MEI" icone="receipt_long">
              <div className="p-5 space-y-4">
                {/* MEI */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#94a3b8" }}>MEI</p>
                  <div className="flex items-center justify-between">
                    {dados.opcao_mei === "S"
                      ? <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full shrink-0" style={{ background: "#eef4f9", color: "#0a5494", border: "1px solid #bfdbfe" }}>MEI</span>
                      : <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full shrink-0" style={{ background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0" }}>NÃO</span>}
                    {(dados.data_opcao_mei || dados.data_exclusao_mei) && (
                      <div className="space-y-0.5 text-right">
                        {dados.data_opcao_mei && (
                          <div className="text-[11px]" style={{ color: "#94a3b8" }}>
                            Opção <span className="ml-1" style={{ color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>{dados.data_opcao_mei}</span>
                          </div>
                        )}
                        {dados.data_exclusao_mei && (
                          <div className="text-[11px]" style={{ color: "#94a3b8" }}>
                            Exclusão <span className="ml-1" style={{ color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>{dados.data_exclusao_mei}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Simples Nacional */}
                <div className="border-t pt-4 space-y-1.5" style={{ borderColor: "#f1f5f9" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#94a3b8" }}>Simples Nacional</p>
                  <div className="flex items-center justify-between">
                    {dados.opcao_simples === "S"
                      ? <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full shrink-0" style={{ background: "#ecfdf5", color: "#15803d", border: "1px solid #bbf7d0" }}>OPTANTE</span>
                      : <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full shrink-0" style={{ background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0" }}>NÃO OPTANTE</span>}
                    {(dados.data_opcao_simples || dados.data_exclusao_simples) && (
                      <div className="space-y-0.5 text-right">
                        {dados.data_opcao_simples && (
                          <div className="text-[11px]" style={{ color: "#94a3b8" }}>
                            Opção <span className="ml-1" style={{ color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>{dados.data_opcao_simples}</span>
                          </div>
                        )}
                        {dados.data_exclusao_simples && (
                          <div className="text-[11px]" style={{ color: "#94a3b8" }}>
                            Exclusão <span className="ml-1" style={{ color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>{dados.data_exclusao_simples}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Secao>

          </div>
        </div>
      </div>
    </main>
  );
}
