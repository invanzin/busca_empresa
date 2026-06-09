import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { buscarGrafoEmpresa, buscarGrafoSocio } from "../api";

// Cores por índice de categoria (mesma ordem do backend GRAFO_CATEGORIAS)
const CAT_COLORS = [
  "#16a34a", // 0 Empresa Ativa
  "#d97706", // 1 Empresa Suspensa
  "#dc2626", // 2 Empresa Inapta
  "#64748b", // 3 Empresa Baixada/Nula
  "#0085ca", // 4 Sócio atual
  "#cbd5e1", // 5 Ex-sócio
];

// Profundidade máxima absoluta — o backend devolve `nivel_alcancado` baseado
// nos caps globais; só mostramos botões até esse valor.
const PROFUNDIDADE_TETO = 10;

// Heurística: se o grafo atual já chegou nesses tamanhos, o próximo N é
// previsivelmente pior — não oferecemos o botão.
const MAX_PREVIEW_NODES = 2000;
const MAX_PREVIEW_LINKS = 3500;

// Acima desses limites, desligamos efeitos visuais caros (hover de adjacência,
// hideOverlap O(n²), thumbnail, animação) — mantemos o force layout intacto
// para que o grafo se espalhe igual, só com menos sobrecarga por frame.
const LIGHT_NODE_THRESHOLD = 1000;
const LIGHT_LINK_THRESHOLD = 2000;

function isModoLeve(data) {
  return !!(data && (
    data.nodes.length > LIGHT_NODE_THRESHOLD ||
    data.links.length > LIGHT_LINK_THRESHOLD
  ));
}

// Conjunto de nós destacados: selecionados ∪ vizinhos diretos dos selecionados.
function computeHighlight(selectedIds, links) {
  const result = new Set(selectedIds);
  if (selectedIds.size === 0) return result;
  for (const l of links) {
    if (selectedIds.has(l.source)) result.add(l.target);
    if (selectedIds.has(l.target)) result.add(l.source);
  }
  return result;
}

// BFS no grafo (não-direcionado) para achar o caminho mínimo de `startId`
// até `rootId`. Retorna array de ids do start ao root, ou null se desconectado.
function caminhoMinimoAteRaiz(startId, rootId, links) {
  if (startId === rootId) return [startId];
  const adj = new Map();
  for (const l of links) {
    if (!adj.has(l.source)) adj.set(l.source, []);
    if (!adj.has(l.target)) adj.set(l.target, []);
    adj.get(l.source).push(l.target);
    adj.get(l.target).push(l.source);
  }
  const parent = new Map();
  parent.set(startId, null);
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === rootId) {
      const path = [];
      let n = rootId;
      while (n !== null) {
        path.unshift(n);
        n = parent.get(n);
      }
      return path;
    }
    for (const v of (adj.get(cur) || [])) {
      if (!parent.has(v)) {
        parent.set(v, cur);
        queue.push(v);
      }
    }
  }
  return null;
}

function montarOption(data, selectedIds, idsBuscados, mostrarInativos, categoriasVisiveis) {
  const small = data.nodes.length <= 55;
  const leve  = isModoLeve(data);
  const noSelection = selectedIds.size === 0;
  const highlightSet = noSelection ? null : computeHighlight(selectedIds, data.links);
  const buscando = idsBuscados && idsBuscados.size > 0;

  // BFS a partir da raiz usando só links/nós VISÍVEIS (após filtros). Nós que
  // só se conectavam à raiz via algo filtrado (ex-vínculos OU categoria oculta)
  // somem junto.
  const catName = (n) => data.categories[n.category]?.name;
  const idsOcultosCat = new Set();
  let temCategoriaOculta = false;
  if (categoriasVisiveis) {
    for (const n of data.nodes) {
      if (categoriasVisiveis[catName(n)] === false) {
        idsOcultosCat.add(n.id);
        temCategoriaOculta = true;
      }
    }
  }
  const algumFiltro = !mostrarInativos || temCategoriaOculta;

  let nosVisiveisIds = null;
  if (algumFiltro) {
    nosVisiveisIds = new Set();
    const root = data.nodes.find(n => n.is_root);
    if (root && !idsOcultosCat.has(root.id)) {
      const adj = new Map();
      for (const l of data.links) {
        if (!mostrarInativos && !l.ativo) continue;
        if (idsOcultosCat.has(l.source) || idsOcultosCat.has(l.target)) continue;
        if (!adj.has(l.source)) adj.set(l.source, []);
        if (!adj.has(l.target)) adj.set(l.target, []);
        adj.get(l.source).push(l.target);
        adj.get(l.target).push(l.source);
      }
      nosVisiveisIds.add(root.id);
      const queue = [root.id];
      while (queue.length) {
        const cur = queue.shift();
        for (const v of (adj.get(cur) || [])) {
          if (!nosVisiveisIds.has(v)) {
            nosVisiveisIds.add(v);
            queue.push(v);
          }
        }
      }
    }
  }


  const nodes = data.nodes
    .filter(n => !nosVisiveisIds || nosVisiveisIds.has(n.id))
    .map((n) => {
    const isInSelectionHighlight = noSelection || highlightSet.has(n.id);
    const isSelected = selectedIds.has(n.id);
    const isBuscado = buscando && idsBuscados.has(n.id);
    // Quando busca está ativa, dim quem não bateu. Senão usa a regra de seleção.
    const isHighlight = buscando ? isBuscado : isInSelectionHighlight;
    const baseBorder = n.is_root ? { borderColor: "#0a1f3d", borderWidth: 3 } : {};
    const searchedBorder = isBuscado
      ? { borderColor: "#f59e0b", borderWidth: 3, shadowBlur: 14, shadowColor: "rgba(245,158,11,0.6)" }
      : {};
    const selectedBorder = isSelected
      ? {
          borderColor: "#1e3a8a",                       // azul-marinho escuro, contrasta com sócio
          borderWidth: 4,
          shadowBlur: 22,
          shadowColor: "rgba(59,130,246,0.9)",          // glow azul vivo em volta
        }
      : {};
    return {
      id: n.id,
      name: n.name,
      category: n.category,
      symbol: n.tipo === "empresa" ? "roundRect" : "circle",
      symbolSize: n.is_root ? 30 : n.tipo === "empresa" ? 17 : 12,
      value: n.tipo === "empresa" ? n.situacao : (n.category === 4 ? "Sócio atual" : "Ex-sócio"),
      label: { show: n.is_root || small || isSelected || isBuscado },
      itemStyle: {
        ...baseBorder,
        ...searchedBorder,
        ...selectedBorder,
        opacity: isHighlight ? 1 : 0.15,
      },
      _tipo: n.tipo,
      _cnpj: n.cnpj_completo,
      _cpf: n.cpf,
      _nome: n.name,
    };
  });

  const links = data.links
    .filter(l => mostrarInativos || l.ativo)  // toggle ex-vínculos
    .map((l) => {
      // Quando busca está ativa, só destaca links que tocam um nó encontrado.
      // Senão, usa a regra de seleção/caminho.
      const isHighlight = buscando
        ? (idsBuscados.has(l.source) || idsBuscados.has(l.target))
        : (noSelection || (highlightSet.has(l.source) && highlightSet.has(l.target)));
      const base = l.ativo
        ? { width: 1.2, opacity: 0.55 }
        : { width: 1, opacity: 0.3, type: "dashed" };
      return {
        source: l.source,
        target: l.target,
        lineStyle: isHighlight ? base : { ...base, opacity: 0.05 },
        // Cursor "grab" sinaliza que a linha pode ser usada pra arrastar a tela.
        cursor: "grab",
      };
    });

  const categories = data.categories.map((c, i) => ({
    name: c.name,
    itemStyle: { color: CAT_COLORS[i] },
  }));

  return {
    tooltip: {
      trigger: "item",
      formatter: (p) =>
        p.dataType === "node"
          ? `<b>${p.data.name}</b>${p.data.value ? `<br/><span style="color:#64748b">${p.data.value}</span>` : ""}`
          : "",
    },
    legend: [
      {
        data: categories.map((c) => c.name),
        bottom: 8,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 11, color: "#64748b" },
      },
    ],
    animationDuration: leve ? 0 : 900,
    animationDurationUpdate: leve ? 0 : 300,
    animationEasingUpdate: "quinticInOut",
    series: [
      {
        type: "graph",
        layout: "force",
        // Área de display = área onde o roam (pan/zoom) captura eventos.
        // Defaults são ~15% de margem, criando uma "caixa interativa" pequena no centro.
        // Zeramos os 4 lados para o roam funcionar em todo o canvas — a legenda
        // renderiza por cima sem subtrair a área interativa.
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // roam built-in do ECharts é limitado ao bbox dos nós — implementamos
        // pan/zoom manualmente abaixo via zrender + dispatchAction.
        roam: false,
        draggable: true,
        data: nodes,
        links,
        categories,
        // Force config INTACTO — o grafo se espalha exatamente igual ao modo normal.
        force: {
          repulsion: small ? 220 : 90,
          edgeLength: small ? [60, 160] : [30, 110],
          gravity: 0.08,
          friction: 0.18,
        },
        // Hover de nó destaca adjacência (links + vizinhos) em ambos os modos;
        // em modo leve omitimos só o label do nó para evitar relayout pesado.
        emphasis: {
          focus: "adjacency",
          label: { show: !leve },
        },
        label: {
          position: "right",
          fontSize: 11,
          color: "#334155",
          formatter: "{b}",
        },
        // hideOverlap faz colisão O(n²) entre TODOS os labels por frame — desliga em leve.
        labelLayout: { hideOverlap: !leve },
        // Range amplo de zoom — permite afastar muito (n=4 grande caber em tela) e aproximar bem.
        scaleLimit: { min: 0.02, max: 20 },
        // Curvas em links são caras com milhares de arestas — usa retas em leve.
        lineStyle: { color: "source", curveness: leve ? 0 : 0.12 },
        // Sem cintilação de seleção em leve (animação repetitiva por frame).
        selectedMode: false,
      },
    ],
    // Thumbnail (mini-mapa) re-renderiza o grafo inteiro a cada frame — pesado em leve.
    thumbnail: leve ? { show: false } : {
      show: true,
      right: 12,
      bottom: 36,
      width: "16%",
      height: "16%",
      windowStyle: { color: "rgba(0,133,202,0.12)", borderColor: "#0085ca", borderWidth: 1 },
    },
  };
}

export default function GrafoRede({ raiz, onVoltar, onVerEmpresa, onVerSocio }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const mainRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [profundidade, setProfundidade] = useState(2);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // Teto descoberto pela exploração — se uma fetch truncou em N=X, sabemos que
  // N>X também trunca (mesmo resultado). Esconde botões de N que sabidamente
  // não acrescentam nada. `null` = ainda não descobrimos teto.
  const [nivelTeto, setNivelTeto] = useState(null);
  // Categorias atualmente visíveis na legenda (objeto { "Empresa Ativa": true, ... }).
  // `null` = todas visíveis (estado inicial, antes de qualquer toggle).
  const [categoriasVisiveis, setCategoriasVisiveis] = useState(null);
  // Texto da busca dentro do grafo (case-insensitive sobre nome do nó).
  const [busca, setBusca] = useState("");
  // Toggle de exibição de ex-vínculos (linhas pontilhadas).
  const [mostrarInativos, setMostrarInativos] = useState(true);
  // Maior N já acessado COM ex-vínculos visíveis — se o usuário voltar pra
  // um N <= esse, pode reativar o toggle (ele já viu esse tamanho funcionar).
  const [nMaxAcessadoComEx, setNMaxAcessadoComEx] = useState(0);

  // Ref com links atualizados para o handler de clique (que é registrado uma vez por init).
  const linksRef = useRef([]);
  useEffect(() => { linksRef.current = data?.links || []; }, [data]);

  // Fullscreen: alterna via Fullscreen API; também escuta ESC/outros saídas externas.
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && mainRef.current) {
      mainRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  // Quando entra/sai de fullscreen, redimensiona o ECharts pra preencher.
  useEffect(() => {
    chartRef.current?.resize();
  }, [fullscreen]);

  // Busca o grafo na profundidade atual (refetch ao trocar de raiz ou N).
  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        const d =
          raiz.tipo === "empresa"
            ? await buscarGrafoEmpresa(raiz.cnpj, profundidade)
            : await buscarGrafoSocio(raiz.cpf, raiz.nome, profundidade);
        if (!cancel) {
          if (!d) setErro("Rede não encontrada.");
          else setData(d);
        }
      } catch (e) {
        if (!cancel) setErro(e.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [raiz, profundidade]);

  // Reset do teto, seleção e contador de N-com-ex quando a raiz muda
  useEffect(() => {
    setNivelTeto(null);
    setNMaxAcessadoComEx(0);
    setSelectedIds(prev => prev.size === 0 ? prev : new Set());
  }, [raiz]);

  // Sempre que chegam dados COM ex-vínculos ligado, registra esse N como
  // "já visto com ex-vínculos" — libera retornar ao toggle ON nesse N.
  useEffect(() => {
    if (data && mostrarInativos) {
      setNMaxAcessadoComEx(prev => Math.max(prev, profundidade));
    }
  }, [data, mostrarInativos, profundidade]);

  // Reset dos filtros de categoria toda vez que chega novo dataset (raiz OU N)
  useEffect(() => {
    if (data) setCategoriasVisiveis(null);
  }, [data]);

  // Contadores ajustados pelos filtros (categoria da legenda + ex-vínculos).
  // BFS partindo da raiz só por links/nós visíveis — órfãos somem dos contadores.
  // Declarado ANTES do useEffect abaixo porque ele depende destes valores.
  const { totalNos, totalLinks } = useMemo(() => {
    if (!data) return { totalNos: 0, totalLinks: 0 };
    if (!categoriasVisiveis && mostrarInativos) {
      return { totalNos: data.nodes.length, totalLinks: data.links.length };
    }
    const catName = (n) => data.categories[n.category]?.name;
    const idsOcultosCat = new Set();
    let temCategoriaOculta = false;
    if (categoriasVisiveis) {
      for (const n of data.nodes) {
        if (categoriasVisiveis[catName(n)] === false) {
          idsOcultosCat.add(n.id);
          temCategoriaOculta = true;
        }
      }
    }
    const algumFiltro = !mostrarInativos || temCategoriaOculta;

    let alcancaveis = null;
    if (algumFiltro) {
      alcancaveis = new Set();
      const root = data.nodes.find(n => n.is_root);
      if (root && !idsOcultosCat.has(root.id)) {
        const adj = new Map();
        for (const l of data.links) {
          if (!mostrarInativos && !l.ativo) continue;
          if (idsOcultosCat.has(l.source) || idsOcultosCat.has(l.target)) continue;
          if (!adj.has(l.source)) adj.set(l.source, []);
          if (!adj.has(l.target)) adj.set(l.target, []);
          adj.get(l.source).push(l.target);
          adj.get(l.target).push(l.source);
        }
        alcancaveis.add(root.id);
        const queue = [root.id];
        while (queue.length) {
          const cur = queue.shift();
          for (const v of (adj.get(cur) || [])) {
            if (!alcancaveis.has(v)) { alcancaveis.add(v); queue.push(v); }
          }
        }
      }
    }
    const idsVisiveis = alcancaveis || new Set(data.nodes.map(n => n.id));
    let nLinks = 0;
    for (const l of data.links) {
      if (!mostrarInativos && !l.ativo) continue;
      if (idsVisiveis.has(l.source) && idsVisiveis.has(l.target)) nLinks++;
    }
    return { totalNos: idsVisiveis.size, totalLinks: nLinks };
  }, [data, categoriasVisiveis, mostrarInativos]);

  // Depois de cada fetch ou mudança de filtro: descobre o teto considerando
  // o grafo VISÍVEL (após filtros). Com ex-vínculos ocultos a rede fica
  // menor, podendo liberar um N maior do que estaria disponível com o bruto.
  useEffect(() => {
    if (!data) return;
    const alcancado = data.nivel_alcancado ?? profundidade;

    if (alcancado < profundidade) {
      setNivelTeto(alcancado);
      if (profundidade > alcancado) setProfundidade(alcancado);
      return;
    }
    if (data.pode_aprofundar === false) {
      setNivelTeto(alcancado);
      return;
    }
    if (totalNos > MAX_PREVIEW_NODES || totalLinks > MAX_PREVIEW_LINKS) {
      setNivelTeto(profundidade);
      return;
    }
    // Nada limita aqui — libera otimisticamente o próximo N.
    setNivelTeto(null);
  }, [data, totalNos, totalLinks]);  // eslint-disable-line react-hooks/exhaustive-deps

  // IDs dos nós que batem com a busca (substring case-insensitive no nome).
  // Só ativa a partir de 2 caracteres — evita poluir o grafo com 1 letra.
  const idsBuscados = useMemo(() => {
    if (!data) return new Set();
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return new Set();
    return new Set(
      data.nodes
        .filter(n => (n.name || "").toLowerCase().includes(q))
        .map(n => n.id)
    );
  }, [data, busca]);

  // Reset busca quando o dataset muda (raiz ou N).
  useEffect(() => { if (data) setBusca(""); }, [data]);

  // Calcula caminho mínimo do último nó selecionado até a raiz e substitui
  // a seleção com esse caminho. Respeita o filtro atual: se ex-vínculos estão
  // ocultos, busca caminho só por links ativos (mantém o grafo independente).
  const conectarAteRaiz = () => {
    if (!data || selectedIds.size === 0) return;
    const rootNode = data.nodes.find(n => n.is_root);
    if (!rootNode) return;
    const ultimo = Array.from(selectedIds).pop();
    if (ultimo === rootNode.id) return;
    const linksUsados = mostrarInativos
      ? data.links
      : data.links.filter(l => l.ativo);
    const path = caminhoMinimoAteRaiz(ultimo, rootNode.id, linksUsados);
    if (!path) return;  // sem caminho viável com os filtros atuais
    setSelectedIds(new Set(path));
  };

  // Profundidades disponíveis: 1..nivelTeto (se descoberto) ou 1..(atual+1) (otimista).
  const profundidadesDisponiveis = useMemo(() => {
    const limite = nivelTeto != null
      ? nivelTeto
      : Math.min(PROFUNDIDADE_TETO, profundidade + 1);
    const max = Math.max(1, Math.min(PROFUNDIDADE_TETO, limite));
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [nivelTeto, profundidade]);

  // Re-inicializa o gráfico quando os dados mudam (fetch novo).
  useEffect(() => {
    if (!ref.current || !data) return;
    chartRef.current?.dispose();
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    chart.setOption(montarOption(data, selectedIds, idsBuscados, mostrarInativos, categoriasVisiveis));

    // Click único: marca/encadeia
    chart.on("click", (p) => {
      if (p.dataType !== "node") return;
      const id = p.data.id;
      setSelectedIds(prev => {
        if (prev.size === 0) return new Set([id]);
        if (prev.has(id)) return prev;
        const hl = computeHighlight(prev, linksRef.current);
        if (!hl.has(id)) return prev; // só permite encadear pelos vizinhos visíveis
        return new Set([...prev, id]);
      });
    });

    // Toggle de categoria na legenda — atualiza contadores filtrados.
    chart.on("legendselectchanged", (e) => {
      setCategoriasVisiveis({ ...e.selected });
    });

    // Rastreia tipo do item sob o cursor (node/edge/null) — usado pelo
    // handler de pan para diferenciar "sobre nó" (não panar, ECharts arrasta)
    // de "sobre linha ou vazio" (pode panar).
    let hoverType = null;

    // Hover em linha não deve focar/destacar nada. ECharts não tem como
    // desligar emphasis só para edges, então cancelamos o destaque assim
    // que detectamos mouseover numa aresta.
    chart.on("mouseover", (p) => {
      hoverType = p.dataType || null;
      if (p.dataType === "edge") {
        chart.dispatchAction({ type: "downplay" });
      }
    });
    chart.on("mouseout", () => {
      hoverType = null;
    });

    // Dblclick: abre a página da empresa/sócio
    chart.on("dblclick", (p) => {
      if (p.dataType !== "node") return;
      if (p.data._tipo === "empresa" && p.data._cnpj) {
        onVerEmpresa && onVerEmpresa(p.data._cnpj);
      } else if (p.data._tipo === "socio") {
        onVerSocio && onVerSocio({ nome_socio: p.data._nome, cpf_cnpj_socio: p.data._cpf });
      }
    });

    // ── Pan/zoom customizado (substitui roam built-in) ──────────────────────
    // Usamos zrender + dispatchAction porque o roam built-in do ECharts só
    // captura eventos perto dos nós, criando "zona morta" no resto do canvas.
    const zr = chart.getZr();
    let panning = false;
    let lastX = 0, lastY = 0;

    const onPanStart = (e) => {
      // Só nós bloqueiam o pan (têm drag próprio). Linhas e área vazia panam.
      if (hoverType === "node") return;
      panning = true;
      lastX = e.offsetX;
      lastY = e.offsetY;
    };
    const onPanMove = (e) => {
      if (!panning) return;
      const dx = e.offsetX - lastX;
      const dy = e.offsetY - lastY;
      lastX = e.offsetX;
      lastY = e.offsetY;
      chart.dispatchAction({ type: "graphRoam", dx, dy });
    };
    const onPanEnd = () => { panning = false; };

    const onWheel = (e) => {
      const native = e.event;
      if (native && native.preventDefault) native.preventDefault();
      const delta = native ? (native.deltaY ?? -native.wheelDelta ?? 0) : 0;
      if (delta === 0) return;
      const zoom = delta < 0 ? 1.15 : 0.87;
      chart.dispatchAction({
        type: "graphRoam",
        zoom,
        originX: e.offsetX,
        originY: e.offsetY,
      });
    };

    zr.on("mousedown",  onPanStart);
    zr.on("mousemove",  onPanMove);
    zr.on("mouseup",    onPanEnd);
    zr.on("mousewheel", onWheel);
    // Fallback: se soltar o mouse fora do canvas, encerra o pan.
    const onDocMouseUp = () => { panning = false; };
    document.addEventListener("mouseup", onDocMouseUp);

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mouseup", onDocMouseUp);
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  // selectedIds inicial é considerado apenas na primeira render; mudanças propagam pelo effect abaixo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, onVerEmpresa, onVerSocio]);

  // Atualiza estilos quando seleção, busca, toggle ex-vínculos OU filtros de categoria mudam
  useEffect(() => {
    if (!chartRef.current || !data) return;
    chartRef.current.setOption(montarOption(data, selectedIds, idsBuscados, mostrarInativos, categoriasVisiveis));
  }, [selectedIds, idsBuscados, mostrarInativos, categoriasVisiveis, data]);

  // Trava ATIVAR ex-vínculos quando o usuário está num N que SÓ foi possível
  // por estar com o filtro ligado (ou seja, profundidade maior que a maior já
  // explorada com ex-vínculos). Se ele já passou por esse N com ex-vínculos
  // ligado antes, deixa reativar livremente.
  const toggleBloqueado = !mostrarInativos && !!data &&
    profundidade > nMaxAcessadoComEx && (
      (data.nodes?.length ?? 0) > MAX_PREVIEW_NODES ||
      (data.links?.length ?? 0) > MAX_PREVIEW_LINKS
    );

  return (
    <main
      ref={mainRef}
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-[#f7f9fc] h-screen w-screen flex flex-col overflow-hidden"
          : "md:ml-52 md:w-[calc(100%-13rem)] bg-[#f7f9fc] h-screen flex flex-col overflow-hidden"
      }
    >
      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-8 h-14 bg-white/90 backdrop-blur-md border-b"
        style={{ borderColor: "#e2e8f0" }}
      >
        <button
          onClick={onVoltar}
          className="flex items-center gap-2 text-[13px] font-medium transition-colors"
          style={{ color: "#64748b" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#0085ca")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
        >
          <span className="material-symbols-outlined text-[17px]">arrow_back</span>
          Voltar
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
            style={{ color: "#64748b" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0085ca")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            title={fullscreen ? "Sair de tela cheia (ESC)" : "Ver em tela cheia"}
          >
            <span className="material-symbols-outlined text-[17px]">
              {fullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
            <span className="hidden sm:inline">
              {fullscreen ? "Sair de tela cheia" : "Tela cheia"}
            </span>
          </button>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "#94a3b8" }}>
            <span className="material-symbols-outlined text-[15px]">hub</span>
            <span className="hidden sm:inline">Rede societária</span>
          </div>
        </div>
      </header>

      {/* Barra de controles */}
      <div
        className="flex items-center justify-between gap-4 flex-wrap px-8 py-3 bg-white border-b"
        style={{ borderColor: "#e2e8f0" }}
      >
        <div className="min-w-0">
          <h1
            className="text-[18px] font-semibold leading-tight truncate"
            style={{ fontFamily: "'Inter Tight', Inter, sans-serif", color: "#0f172a" }}
          >
            {raiz.label || "Rede"}
          </h1>
          <p className="text-[12px]" style={{ color: "#94a3b8" }}>
            {loading
              ? "Montando rede..."
              : `${totalNos} nós · ${totalLinks} conexões${(totalNos > LIGHT_NODE_THRESHOLD || totalLinks > LIGHT_LINK_THRESHOLD) ? " · modo leve" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleBloqueado ? undefined : () => setMostrarInativos(v => !v)}
            disabled={toggleBloqueado}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: mostrarInativos ? "#eef4f9" : "#f1f5f9",
              color:      mostrarInativos ? "#0a5494" : "#94a3b8",
              border: `1px solid ${mostrarInativos ? "#bfdbfe" : "#e2e8f0"}`,
            }}
            title={
              toggleBloqueado
                ? "Indisponível: o grafo completo (com ex-vínculos) excede o limite neste N. Reduza o N pra reativar."
                : mostrarInativos
                  ? "Ocultar ex-vínculos (linhas pontilhadas)"
                  : "Mostrar ex-vínculos"
            }
          >
            <span className="material-symbols-outlined text-[14px]">
              {mostrarInativos ? "visibility" : "visibility_off"}
            </span>
            Ex-vínculos
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={conectarAteRaiz}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{ background: "#ecfdf5", color: "#15803d", border: "1px solid #bbf7d0" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#d1fae5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#ecfdf5")}
              title="Marca o menor caminho do último nó selecionado até a raiz"
            >
              <span className="material-symbols-outlined text-[14px]">route</span>
              Caminho até a raiz
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fef2f2")}
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Limpar seleção ({selectedIds.size})
            </button>
          )}
          <span className="text-[12px] font-medium" style={{ color: "#64748b" }}>
            Conexões (saltos)
          </span>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
            {profundidadesDisponiveis.map((p) => {
              const ativo = p === profundidade;
              return (
                <button
                  key={p}
                  onClick={() => setProfundidade(p)}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50"
                  style={{
                    background: ativo ? "#0085ca" : "#fff",
                    color: ativo ? "#fff" : "#64748b",
                    borderLeft: p === profundidadesDisponiveis[0] ? "none" : "1px solid #e2e8f0",
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Canvas do grafo */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 text-[13px]" style={{ color: "#94a3b8", background: "rgba(247,249,252,0.6)" }}>
            <span className="material-symbols-outlined animate-spin text-[22px]" style={{ color: "#0085ca" }}>progress_activity</span>
            Montando rede societária...
          </div>
        )}
        {erro && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-[14px]" style={{ color: "#b91c1c" }}>
            {erro}
          </div>
        )}
        <div ref={ref} style={{ width: "100%", height: "100%", minHeight: 500 }} />

        {/* Dica */}
        {!loading && !erro && data && (
          <div
            className="absolute top-3 left-3 px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 pointer-events-none"
            style={{ background: "rgba(255,255,255,0.9)", border: "1px solid #e2e8f0", color: "#94a3b8" }}
          >
            <span className="material-symbols-outlined text-[13px]">touch_app</span>
            Clique para marcar caminho · duplo-clique abre · arraste para mover
          </div>
        )}

        {/* Campo de busca no grafo */}
        {!loading && !erro && data && (
          <div
            className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0" }}
          >
            <span className="material-symbols-outlined text-[15px]" style={{ color: "#94a3b8" }}>search</span>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no grafo..."
              className="text-[12px] w-44 outline-none bg-transparent"
              style={{ color: "#0f172a" }}
            />
            {busca && (
              <>
                {busca.trim().length < 2 ? (
                  <span className="text-[11px] whitespace-nowrap" style={{ color: "#94a3b8" }}>
                    digite +1
                  </span>
                ) : (
                  <span className="text-[11px] whitespace-nowrap" style={{ color: idsBuscados.size > 0 ? "#0f172a" : "#b91c1c" }}>
                    {idsBuscados.size > 0 ? `${idsBuscados.size} encontrado${idsBuscados.size === 1 ? "" : "s"}` : "nada"}
                  </span>
                )}
                <button
                  onClick={() => setBusca("")}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100"
                  style={{ color: "#94a3b8" }}
                  title="Limpar busca"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
