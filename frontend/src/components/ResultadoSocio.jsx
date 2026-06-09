import { useState, useEffect } from "react";
import { buscarPerfilSocio } from "../api";
import { RedeSocio } from "./RedeTree";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDateBR(s) {
  if (!s) return 0;
  const [d, m, y] = s.split("/");
  return new Date(+y, +m - 1, +d).getTime();
}

const CARGO_RANK = [
  "presidente",
  "vice-presidente",
  "diretor",
  "administrador",
  "sócio-administrador",
  "conselheiro",
  "procurador",
  "sócio",
];

function rankCargo(qualificacoes = []) {
  const qs = qualificacoes.map(q => q.toLowerCase());
  for (let i = 0; i < CARGO_RANK.length; i++) {
    if (qs.some(q => q.includes(CARGO_RANK[i]))) return i;
  }
  return CARGO_RANK.length;
}

function sortSocios(a, b) {
  const rankDiff = rankCargo(a.qualificacoes) - rankCargo(b.qualificacoes);
  if (rankDiff !== 0) return rankDiff;
  return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
}

// ── Chips ─────────────────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const map = {
    Ativa:    "bg-green-50 text-green-700 border-green-200",
    Baixada:  "bg-red-50 text-red-700 border-red-200",
    Suspensa: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Inapta:   "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border ${map[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status || "—"}
    </span>
  );
}

function QualChip({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
      {label}
    </span>
  );
}

// ── Seção colapsável ──────────────────────────────────────────────────────────

function Section({ icon, title, badge, children, defaultOpen = true, iconColor = "text-primary" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-surface-variant overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-surface-bright hover:bg-surface-container-low transition-colors text-left"
      >
        <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
          <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
          {title}
          {badge != null && (
            <span className="text-body-sm text-on-surface-variant font-normal">({badge})</span>
          )}
        </h2>
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── Tabela de empresas ────────────────────────────────────────────────────────

function EmpresaTable({ empresas, onVerEmpresa, showSaiu = false }) {
  if (!empresas.length) return (
    <p className="px-6 py-4 text-body-sm text-on-surface-variant">Nenhuma empresa encontrada.</p>
  );

  const sorted = [...empresas].sort(
    (a, b) => parseDateBR(a.data_entrada) - parseDateBR(b.data_entrada)
  );

  const scrollStyle = sorted.length > 10
    ? { maxHeight: 520, overflowY: "auto", overflowX: "hidden" }
    : {};

  return (
    <div style={scrollStyle}>
      <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "35%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-container-low border-b border-surface-variant">
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider">Empresa</th>
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider">Qualificação</th>
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider">Porte</th>
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider">{showSaiu ? "Período" : "Entrada"}</th>
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant text-body-sm">
          {sorted.map((e) => (
            <tr key={e.cnpj_basico} className="hover:bg-surface-container-lowest/60 group">
              <td className="py-3 px-4 align-top">
                <div className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                  {e.razao_social || e.cnpj_basico}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-on-surface-variant text-[12px]">
                  <span className="font-mono">{e.cnpj_completo_formatado || e.cnpj_basico}</span>
                  {e.situacao_cadastral && <StatusChip status={e.situacao_cadastral} />}
                  {e.uf && <span>{e.uf}</span>}
                </div>
              </td>
              <td className="py-3 px-4 align-top">
                <div className="flex flex-wrap gap-1">
                  {(e.qualificacoes || []).slice(0, 2).map((q, i) => (
                    <QualChip key={i} label={q} />
                  ))}
                  {(e.qualificacoes || []).length > 2 && (
                    <span className="text-[11px] text-on-surface-variant">+{e.qualificacoes.length - 2}</span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 align-top text-on-surface-variant text-[12px]">{e.porte}</td>
              <td className="py-3 px-4 align-top text-[12px]">
                {showSaiu ? (
                  <div className="flex flex-col gap-0.5">
                    {e.data_entrada && (
                      <span className="flex items-center gap-1 text-green-700">
                        <span className="material-symbols-outlined text-[13px]">login</span>
                        {e.data_entrada}
                      </span>
                    )}
                    {e.saiu_em && (
                      <span className="flex items-center gap-1 text-red-500">
                        <span className="material-symbols-outlined text-[13px]">logout</span>
                        {e.saiu_em}
                      </span>
                    )}
                  </div>
                ) : (
                  e.data_entrada && (
                    <span className="flex items-center gap-1 text-green-700">
                      <span className="material-symbols-outlined text-[13px]">login</span>
                      {e.data_entrada}
                    </span>
                  )
                )}
              </td>
              <td className="py-3 px-4 align-middle">
                <button
                  onClick={() => onVerEmpresa && onVerEmpresa(
                    e.cnpj_completo_formatado
                      ? e.cnpj_completo_formatado.replace(/\D/g, "")
                      : e.cnpj_basico + "000100"
                  )}
                  className="p-1.5 text-outline hover:text-primary rounded-full hover:bg-surface-container transition-colors"
                  title="Ver empresa"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tabela de sócios ──────────────────────────────────────────────────────────

function SocioTable({ socios, onVerSocio }) {
  if (!socios.length) return (
    <p className="px-6 py-4 text-body-sm text-on-surface-variant">Nenhum sócio encontrado.</p>
  );

  const sorted = [...socios].sort(sortSocios);

  const scrollStyle = socios.length > 10
    ? { maxHeight: 520, overflowY: "auto", overflowX: "hidden" }
    : {};

  return (
    <div style={scrollStyle}>
      <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "35%" }} />
          <col style={{ width: "37%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-container-low border-b border-surface-variant">
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider">Nome</th>
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider">Qualificações</th>
            <th className="py-3 px-4 text-[11px] text-on-surface-variant uppercase tracking-wider">Empresas em comum</th>
            <th className="py-3 px-4 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant text-body-sm">
          {sorted.map((s, i) => (
            <tr key={i} className="hover:bg-surface-container-lowest/60 group">
              <td className="py-3 px-4 align-top">
                <div className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                  {s.nome}
                </div>
                <div className="font-mono text-[12px] text-on-surface-variant">{s.cpf}</div>
              </td>
              <td className="py-3 px-4 align-top">
                <div className="flex flex-wrap gap-1">
                  {(s.qualificacoes || []).slice(0, 2).map((q, j) => (
                    <QualChip key={j} label={q} />
                  ))}
                  {(s.qualificacoes || []).length > 2 && (
                    <span className="text-[11px] text-on-surface-variant">+{s.qualificacoes.length - 2}</span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 align-middle">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {s.empresas_em_comum}
                </span>
              </td>
              <td className="py-3 px-4 align-middle">
                {onVerSocio && (
                  <button
                    onClick={() => onVerSocio({ nome_socio: s.nome, cpf_cnpj_socio: s.cpf })}
                    className="p-1.5 text-outline hover:text-primary rounded-full hover:bg-surface-container transition-colors"
                    title="Ver perfil"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_search</span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── CNAEs colapsáveis ─────────────────────────────────────────────────────────

const CNAE_SCROLL_LIMIT = 6;
const CNAE_ROW_HEIGHT   = 36; // px aproximado por item

function CnaeGroup({ titulo, items, cor }) {
  if (!items?.length) return null;
  const scroll = items.length > CNAE_SCROLL_LIMIT;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: cor }}>
        {titulo}
      </p>
      <div
        style={scroll ? { maxHeight: CNAE_SCROLL_LIMIT * CNAE_ROW_HEIGHT, overflowY: "auto" } : {}}
        className="flex flex-col gap-1.5"
      >
        {items.map(({ codigo, descricao, count }) => (
          <div key={codigo} className="flex items-start justify-between gap-2">
            <span className="text-[12px] text-on-surface leading-snug">{descricao || "—"}</span>
            <span className="text-[11px] text-on-surface-variant shrink-0">{count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mapa de Relacionamentos (cabeçalho com botão "Rede completa") ─────────────

function MapaRelacionamentos({ perfil, info, onAbrirGrafo, onVerEmpresa, onVerSocio }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-surface-variant overflow-hidden">
      <div className="w-full flex items-center justify-between px-6 py-4 bg-surface-bright">
        <button
          onClick={() => setAberto(v => !v)}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
        >
          <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">hub</span>
            Mapa de Relacionamentos
          </h2>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            {aberto ? "expand_less" : "expand_more"}
          </span>
        </button>
        {onAbrirGrafo && (
          <button
            onClick={() => onAbrirGrafo({ tipo: "socio", cpf: info.cpf, nome: info.nome, label: info.nome })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">account_tree</span>
            Rede completa
          </button>
        )}
      </div>
      {aberto && (
        <div className="p-2">
          <RedeSocio
            perfil={perfil}
            onVerEmpresa={onVerEmpresa}
            onVerSocio={onVerSocio}
          />
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ResultadoSocio({ socioInicial, onVoltar, onVerEmpresa, onVerSocio, onAbrirGrafo }) {
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState(null);

  const cpf  = socioInicial?.cpf_cnpj_socio || "";
  const nome = socioInicial?.nome_socio || "";

  // Novo perfil → rola pro topo. App.jsx remonta este componente via `key`
  // a cada sócio, então o effect roda uma vez no mount.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function carregar() {
      setLoading(true);
      setErro(null);
      try {
        const res = await buscarPerfilSocio(cpf || null, nome || null);
        if (cancelled) return;
        if (!res) { setErro("Perfil não encontrado."); return; }
        setPerfil(res);
      } catch (err) {
        if (cancelled) return;
        setErro(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    carregar();
    return () => { cancelled = true; };
  }, [cpf, nome]);

  const info    = perfil?.info || {};
  const porte   = perfil?.porte_acumulado || {};
  const nAtivo  = perfil?.empresas_ativas?.length || 0;
  const nInativo = perfil?.empresas_inativas?.length || 0;

  const fmtCapital = (v) =>
    v > 0
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
      : "—";

  // Qualificações: separa atuais (aparecem em ativas) das anteriores
  const qualsNasAtivas = new Set(
    (perfil?.empresas_ativas || []).flatMap(e => e.qualificacoes || [])
  );
  const qualsAtuais    = (perfil?.qualificacoes_proprias || []).filter(q => qualsNasAtivas.has(q.descricao));
  const qualsAnteriores = (perfil?.qualificacoes_proprias || []).filter(q => !qualsNasAtivas.has(q.descricao));

  return (
    <main className="flex-1 md:ml-52 flex flex-col min-h-screen bg-background">
      {/* Header mobile */}
      <header className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <button onClick={onVoltar} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="text-xl font-bold text-slate-900">CorpIntel</span>
        <div className="w-10" />
      </header>

      <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-10 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-on-surface-variant text-body-sm">
          <button onClick={onVoltar} className="hover:text-primary transition-colors">Pesquisa</button>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-on-surface font-medium">Perfil do Sócio</span>
        </nav>

        {/* Título */}
        <div>
          <h1 className="text-display-lg text-on-surface">{info.nome || nome || "—"}</h1>
          <p className="text-body-lg text-on-surface-variant mt-1">Análise de Vínculos Societários</p>
        </div>

        {loading && (
          <p className="text-center text-on-surface-variant py-20 text-body-md">Carregando perfil...</p>
        )}
        {erro && (
          <p className="text-center text-error py-10">{erro}</p>
        )}

        {perfil && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* ── Coluna esquerda ── */}
            <div className="lg:col-span-4 flex flex-col gap-4">

              {/* Identificação */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-6">
                <h2 className="text-headline-sm text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">badge</span>
                  Identificação
                </h2>
                <div className="space-y-3 text-body-sm">
                  {[
                    { label: "Nome",                  value: info.nome },
                    { label: "CPF/CNPJ (mascarado)",  value: info.cpf, mono: true },
                    { label: "Tipo",                   value: info.tipo },
                    { label: "Faixa Etária",           value: info.faixa_etaria },
                  ].filter(f => f.value).map(({ label, value, mono }) => (
                    <div key={label}>
                      <span className="text-[10px] uppercase tracking-wider text-on-surface-variant block mb-0.5">{label}</span>
                      <span className={mono ? "font-mono text-on-surface" : "text-on-surface"}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo numérico */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-6">
                <h2 className="text-headline-sm text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Resumo
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Empresas ativas",    value: nAtivo,                              color: "text-green-600" },
                    { label: "Ex-vínculos",        value: nInativo,                            color: "text-slate-400" },
                    { label: "Sócios comuns",      value: perfil.socios_comuns?.length || 0,   color: "text-primary" },
                    { label: "Ex-sócios comuns",   value: perfil.ex_socios_comuns?.length || 0, color: "text-slate-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <span className={`text-3xl font-bold tracking-tight block ${color}`}>{value}</span>
                      <span className="text-[11px] text-on-surface-variant">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capital acumulado */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-6">
                <h2 className="text-headline-sm text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">account_balance</span>
                  Capital Acumulado
                </h2>
                <div className="text-2xl font-bold text-on-surface mb-3">
                  {fmtCapital(porte.capital_total)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-2">Por porte</div>
                <div className="flex flex-col gap-1">
                  {Object.entries(porte.por_porte || {}).map(([p, n]) => (
                    <div key={p} className="flex items-center justify-between text-body-sm">
                      <span className="text-on-surface-variant">{p}</span>
                      <span className="font-medium text-on-surface">{n} empresa{n !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Qualificações exercidas */}
              {(qualsAtuais.length > 0 || qualsAnteriores.length > 0) && (
                <div className="bg-surface-container-lowest rounded-xl border border-surface-variant p-6">
                  <h2 className="text-headline-sm text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">military_tech</span>
                    Qualificações Exercidas
                  </h2>

                  {qualsAtuais.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-green-700">Atuais</p>
                      {qualsAtuais.map(({ descricao, count }) => (
                        <div key={descricao} className="flex items-center justify-between">
                          <QualChip label={descricao} />
                          <span className="text-[11px] text-on-surface-variant">{count}×</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {qualsAtuais.length > 0 && qualsAnteriores.length > 0 && (
                    <div className="border-t my-3" style={{ borderColor: "#e2e8f0" }} />
                  )}

                  {qualsAnteriores.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Anteriores</p>
                      {qualsAnteriores.map(({ descricao, count }) => (
                        <div key={descricao} className="flex items-center justify-between">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-medium">
                            {descricao}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">{count}×</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CNAEs */}
              {(perfil.cnaes_principais?.length > 0 || perfil.cnaes_secundarios?.length > 0) && (
                <Section icon="category" title="CNAEs" defaultOpen={true}>
                  <div className="p-6 space-y-4">
                    <CnaeGroup
                      titulo="Principais"
                      items={perfil.cnaes_principais}
                      cor="#15803d"
                    />
                    {perfil.cnaes_principais?.length > 0 && perfil.cnaes_secundarios?.length > 0 && (
                      <div className="border-t" style={{ borderColor: "#e2e8f0" }} />
                    )}
                    <CnaeGroup
                      titulo="Secundários"
                      items={perfil.cnaes_secundarios}
                      cor="#64748b"
                    />
                  </div>
                </Section>
              )}
            </div>

            {/* ── Coluna direita ── */}
            <div className="lg:col-span-8 flex flex-col gap-4">

              {/* Empresas ativas */}
              <Section icon="verified" title="Empresas Ativas" badge={nAtivo} iconColor="text-green-600">
                <EmpresaTable empresas={perfil.empresas_ativas || []} onVerEmpresa={onVerEmpresa} />
              </Section>

              {/* Sócios em comum */}
              <Section
                icon="group"
                title="Sócios em Comum"
                badge={perfil.socios_comuns?.length || 0}
                defaultOpen={true}
                iconColor="text-primary"
              >
                <SocioTable socios={perfil.socios_comuns || []} onVerSocio={onVerSocio} />
              </Section>

              {/* Ex-empresas */}
              {nInativo > 0 && (
                <Section icon="history" title="Ex-Empresas" badge={nInativo} defaultOpen={false} iconColor="text-slate-400">
                  <EmpresaTable empresas={perfil.empresas_inativas || []} onVerEmpresa={onVerEmpresa} showSaiu />
                </Section>
              )}

              {/* Ex-sócios comuns */}
              {(perfil.ex_socios_comuns?.length || 0) > 0 && (
                <Section
                  icon="group_off"
                  title="Ex-Sócios em Comum"
                  badge={perfil.ex_socios_comuns.length}
                  defaultOpen={false}
                  iconColor="text-slate-400"
                >
                  <SocioTable socios={perfil.ex_socios_comuns} onVerSocio={onVerSocio} />
                </Section>
              )}

              {/* Mapa de Relacionamentos */}
              <MapaRelacionamentos
                perfil={perfil}
                info={info}
                onAbrirGrafo={onAbrirGrafo}
                onVerEmpresa={onVerEmpresa}
                onVerSocio={onVerSocio}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
