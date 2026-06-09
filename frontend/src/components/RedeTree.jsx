import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";

const COR_ROOT = "#0a1f3d";
const COR_SOCIO = "#0085ca";
const COR_EMPRESA = "#15803d";
const COR_EX = "#64748b";
const COR_INATIVA = "#94a3b8";

// Zoom inicial da árvore (referenciado em makeOption e TreeViewport pra
// alinhar o cálculo de marginLeft com a posição final da raiz no canvas).
const TREE_ZOOM = 0.1;

const FILTROS_DEF = {
  empresa: [
    { key: "socio",            label: "Sócio atual",            color: COR_SOCIO },
    { key: "ex_socio",         label: "Ex-sócio",               color: COR_EX },
    { key: "empresa_ativa",    label: "Empresa relacionada",    color: COR_EMPRESA },
    { key: "empresa_inativa",  label: "Ex-empresa relacionada", color: COR_INATIVA },
  ],
  socio: [
    { key: "empresa_ativa",   label: "Empresa atual",        color: COR_EMPRESA },
    { key: "empresa_inativa", label: "Ex-empresa",           color: COR_INATIVA },
    { key: "socio",           label: "Sócio relacionado",    color: COR_SOCIO },
    { key: "ex_socio",        label: "Ex-sócio relacionado", color: COR_EX },
  ],
};

function nodeCategory(node, depth, rootKind) {
  if (depth === 0) return "root";
  if (rootKind === "empresa") {
    if (depth === 1) return node.value === "ex_socio" ? "ex_socio" : "socio";
    return node.value === "Ativa" || node.value === "empresa" ? "empresa_ativa" : "empresa_inativa";
  }
  if (depth === 1) return node.value === "empresa" ? "empresa_ativa" : "empresa_inativa";
  return node.value === "ex_socio" ? "ex_socio" : "socio";
}

function filterTree(node, depth, rootKind, filtros) {
  if (depth > 0) {
    const cat = nodeCategory(node, depth, rootKind);
    if (filtros[cat] === false) return null;
  }
  const out = { ...node };
  if (node.children?.length) {
    const kids = node.children
      .map(c => filterTree(c, depth + 1, rootKind, filtros))
      .filter(Boolean);
    if (kids.length > 0) out.children = kids;
    else delete out.children;
  }
  return out;
}

function defaultFiltros(rootKind) {
  return Object.fromEntries((FILTROS_DEF[rootKind] || []).map(f => [f.key, true]));
}

function countNodes(node) {
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}

function maxDepth(node) {
  return 1 + Math.max(0, ...(node.children || []).map(maxDepth));
}

function treeHeight(data) {
  return Math.max(760, Math.min(7000, countNodes(data) * 82));
}

function treeWidth(data) {
  const depth = maxDepth(data);
  const total = countNodes(data);
  return Math.max(1120, Math.min(2200, 520 + depth * 360 + total * 6));
}

function nodeColor(node, depth, rootKind) {
  if (depth === 0) return COR_ROOT;

  if (rootKind === "empresa") {
    if (depth === 1) return node.value === "ex_socio" ? COR_EX : COR_SOCIO;
    return node.value === "Ativa" || node.value === "empresa" ? COR_EMPRESA : COR_INATIVA;
  }

  if (depth === 1) return node.value === "empresa" ? COR_EMPRESA : COR_INATIVA;
  return node.value === "ex_socio" ? COR_EX : COR_SOCIO;
}

function styleNode(node, depth, rootKind) {
  const isLeaf = !node.children?.length;
  const color = nodeColor(node, depth, rootKind);

  // Label dinâmico por leaf-ness:
  // - raiz (depth 0): sempre à esquerda (é o "título" da árvore)
  // - branch (tem children): à esquerda → aponta de volta pra raiz
  // - leaf (sem children): à direita → ocupa o espaço vazio do lado dos filhos
  // Quando um filtro deixa um sócio sem empresas, ele vira leaf e sai do
  // espaço horizontal da raiz — eliminando a colisão raiz↔depth-1.
  const labelOnLeft = depth === 0 || !isLeaf;

  const styled = {
    ...node,
    symbolSize: depth === 0 ? 14 : depth === 1 ? 9 : 6,
    itemStyle: { color },
    label: {
      color,
      fontWeight: depth === 0 ? "bold" : undefined,
      position: labelOnLeft ? "left" : "right",
      align: labelOnLeft ? "right" : "left",
      distance: depth <= 1 ? 10 : undefined,
    },
  };

  if (node.children?.length) {
    styled.children = node.children.map(child => styleNode(child, depth + 1, rootKind));
  }

  return styled;
}

function makeOption(styledData, initialDepth, animate = true) {
  const totalNodes = countNodes(styledData);
  const labelSize = totalNodes > 90 ? 10 : 11;

  return {
    tooltip: {
      trigger: "item",
      triggerOn: "mousemove",
      formatter: (p) => {
        const detail = p.data.detail || (
          p.data.value && !["root", "socio", "ex_socio", "empresa", "empresa_inativa"].includes(p.data.value)
            ? p.data.value
            : ""
        );
        return detail
          ? `<b>${p.data.name}</b><br/><span style="color:#64748b">${detail}</span>`
          : `<b>${p.data.name}</b>`;
      },
    },
    series: [{
      type: "tree",
      data: [styledData],

      top: 36,
      left: "24%",
      bottom: 36,
      right: "10%",

      orient: "LR",
      // Curve em vez de polyline: cada edge é um bezier independente, então
      // remoção de filho limpa o path correspondente — sem fork compartilhado
      // deixando stubs órfãos no canvas (a origem dos traços-fantasma).
      edgeShape: "curve",

      symbolSize: 7,
      roam: true,
      scaleLimit: {
        min: 0.08,
        max: 2.5,
      },

      label: {
        position: "left",
        verticalAlign: "middle",
        align: "right",
        fontSize: labelSize,
        color: "#334155",
        overflow: "truncate",
        width: 240,
      },

      leaves: {
        label: {
          position: "right",
          verticalAlign: "middle",
          align: "left",
          fontSize: labelSize,
          overflow: "truncate",
          width: 280,
        },
      },

      emphasis: { focus: "descendant" },
      expandAndCollapse: true,
      initialTreeDepth: initialDepth,
      // Zoom inicial menor: renderiza a árvore em escala reduzida dentro
      // do canvas, então o viewport revela uma área maior do mapa.
      zoom: TREE_ZOOM,
      animation: animate,
      animationDuration: 300,
      animationDurationUpdate: 450,
    }],
  };
}

function useTreeChart(ref, data, rootKind, initialDepth, onVerEmpresa, onVerSocio) {
  const chartRef = useRef(null);
  // Callbacks em ref evitam re-anexar o handler de dblclick a cada render
  // (e perder o anterior por engano, já que o init useEffect roda só 1x).
  const handlersRef = useRef({ onVerEmpresa, onVerSocio });
  handlersRef.current = { onVerEmpresa, onVerSocio };

  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;

    chart.on("dblclick", (p) => {
      if (!p?.data || p.data.value === "root") return;
      const { onVerEmpresa: verEmp, onVerSocio: verSoc } = handlersRef.current;
      const basico = p.data.cnpj_basico;
      const cpf    = p.data.cpf;
      // Empresas (depth 2) têm cnpj_basico. Backend exige CNPJ completo (14),
      // mas a rede só devolve o básico (8) — completa com "0001"+"00" da
      // matriz (backend filtra por basico+ordem, ignora DV).
      if (basico && verEmp) {
        const cnpj = basico.length === 8 ? basico + "000100" : basico;
        verEmp(cnpj);
        return;
      }
      // Sócios PJ aparecem com CNPJ completo (14 dígitos, sem máscara) no
      // campo cpf. Vão pro perfil de empresa, não de sócio.
      if (cpf) {
        const docDigits = cpf.replace(/\D/g, "");
        const isPJ = !cpf.includes("*") && docDigits.length === 14;
        if (isPJ && verEmp) verEmp(docDigits);
        else if (verSoc) verSoc({ nome_socio: p.data.name, cpf_cnpj_socio: cpf });
      }
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [ref]);

  useEffect(() => {
    if (!chartRef.current || !data) return;
    const chart = chartRef.current;

    // O container muda de tamanho entre filtros (treeWidth/treeHeight dependem
    // do nº de nós). Sem chart.resize(), o canvas interno do ECharts mantém
    // as dimensões antigas e a árvore acaba renderizada fora do viewport —
    // efeito de "sumir" depois de qualquer toggle de filtro.
    chart.resize();

    // Preserva zoom/center que o usuário ajustou via pan/zoom manual.
    // Sem isso, o setOption a cada filtro reaplica `zoom: TREE_ZOOM` (0.1)
    // e o mapa volta ao tamanho minúsculo do estado inicial.
    const prev = chart.getOption()?.series?.[0];
    const opt = makeOption(styleNode(data, 0, rootKind), initialDepth);
    if (prev?.zoom != null) opt.series[0].zoom = prev.zoom;
    if (prev?.center != null) opt.series[0].center = prev.center;

    chart.setOption(opt);
  }, [data, rootKind, initialDepth]);
}

function Legend({ rootKind, filtros, onToggle }) {
  const items = FILTROS_DEF[rootKind] || [];
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-2 text-[11px]">
      {items.map(({ key, label, color }) => {
        const ativo = filtros[key] !== false;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${
              ativo
                ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                : "bg-slate-50 border-slate-200 text-slate-400 line-through"
            }`}
            title={ativo ? "Clique para ocultar" : "Clique para mostrar"}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ativo ? color : "#cbd5e1" }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function TreeViewport({ children, width, height }) {
  const VIEW_H = 420;
  // Centra vertical: empurra canvas pra cima por metade do excesso, o que
  // alinha o miolo do canvas (onde a raiz está) com o meio do viewport.
  const offsetY = Math.max(0, (height - VIEW_H) / 2);
  // Centra horizontal: na prática a raiz não migra tanto quanto a fórmula
  // teórica do zoom previa — ECharts mant
  // ém a raiz perto da margem esquerda
  // da drawing area independente do zoom. Empurra ~12% do width pra esquerda,
  // o que mostra a raiz no canto-esquerdo do viewport.
  const offsetX = Math.max(0, width * 0.2);
  return (
    <div
      className="w-full overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ height: VIEW_H }}
    >
      <div
        style={{
          width: `${width}px`,
          maxWidth: "none",
          marginTop: -offsetY,
          marginLeft: -offsetX,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function RedeEmpresa({ data, onVerEmpresa, onVerSocio }) {
  const ref = useRef(null);
  const [filtros, setFiltros] = useState(() => defaultFiltros("empresa"));
  const toggleFiltro = useCallback(
    (key) => setFiltros((prev) => ({ ...prev, [key]: prev[key] === false })),
    [],
  );

  const treeData = useMemo(() => {
    if (!data) return null;
    const raw = { ...data, children: data.children || [] };
    return filterTree(raw, 0, "empresa", filtros);
  }, [data, filtros]);

  useTreeChart(ref, treeData, "empresa", 2, onVerEmpresa, onVerSocio);
  // Dimensões baseadas na árvore COMPLETA (raw), não na filtrada — assim o
  // canvas mantém o mesmo tamanho ao alternar filtros, e os offsets do
  // TreeViewport não fazem a árvore "pular" de posição.
  const width = data ? treeWidth(data) : 1120;
  const height = data ? treeHeight(data) : 560;

  return (
    <div>
      <Legend rootKind="empresa" filtros={filtros} onToggle={toggleFiltro} />
      <TreeViewport width={width} height={height}>
        <div ref={ref} style={{ width: `${width}px`, height }} />
      </TreeViewport>
    </div>
  );
}

export function RedeSocio({ perfil, onVerEmpresa, onVerSocio }) {
  const ref = useRef(null);
  const [filtros, setFiltros] = useState(() => defaultFiltros("socio"));
  const toggleFiltro = useCallback(
    (key) => setFiltros((prev) => ({ ...prev, [key]: prev[key] === false })),
    [],
  );

  const rawTree = useMemo(() => {
    if (!perfil) return null;

    const sociosRelacionados = [
      ...(perfil.socios_comuns || []).map(s => ({ ...s, value: "socio", detail: "Socio relacionado" })),
      ...(perfil.ex_socios_comuns || []).map(s => ({ ...s, value: "ex_socio", detail: "Ex-socio relacionado" })),
    ];

    const sociosDaEmpresa = (cnpjBasico) => sociosRelacionados
      .filter(s => (s.cnpjs || []).includes(cnpjBasico))
      .slice(0, 40)
      .map(s => ({
        name: s.nome,
        value: s.value,
        cpf: s.cpf,
        detail: (s.qualificacoes || []).join(", ") || s.detail,
      }));

    const mapEmpresa = (empresa, ativa) => ({
      name: empresa.razao_social || empresa.cnpj_basico,
      value: ativa ? "empresa" : "empresa_inativa",
      cnpj_basico: empresa.cnpj_basico,
      detail: ativa ? "Empresa" : "Ex-empresa",
      children: sociosDaEmpresa(empresa.cnpj_basico),
    });

    return {
      name: perfil.info?.nome || "Socio",
      value: "root",
      children: [
        ...(perfil.empresas_ativas || []).map(e => mapEmpresa(e, true)),
        ...(perfil.empresas_inativas || []).map(e => mapEmpresa(e, false)),
      ],
    };
  }, [perfil]);

  const treeData = useMemo(
    () => (rawTree ? filterTree(rawTree, 0, "socio", filtros) : null),
    [rawTree, filtros],
  );

  useTreeChart(ref, treeData, "socio", 2, onVerEmpresa, onVerSocio);
  // Dimensões da árvore COMPLETA (rawTree) pra manter canvas estável
  // entre filtros — evita que a árvore "pule" de posição.
  const width = rawTree ? treeWidth(rawTree) : 1120;
  const height = rawTree ? treeHeight(rawTree) : 560;

  return (
    <div>
      <Legend rootKind="socio" filtros={filtros} onToggle={toggleFiltro} />
      <TreeViewport width={width} height={height}>
        <div ref={ref} style={{ width: `${width}px`, height }} />
      </TreeViewport>
    </div>
  );
}
