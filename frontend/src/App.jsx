import { useState } from "react";
import { buscarEmpresaPorCnpj } from "./api";

import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import HomeSelecao from "./components/HomeSelecao";
import BuscaEmpresa from "./components/BuscaEmpresa";
import BuscaSocio from "./components/BuscaSocio";
import ResultadoEmpresa from "./components/ResultadoEmpresa";
import ResultadoSocio from "./components/ResultadoSocio";
import GrafoRede from "./components/GrafoRede";

// Registra cliques em perfis no localStorage (não digitações de busca).
function addRecenteEmpresa(empresa) {
  if (!empresa) return;
  const cnpj  = empresa.cnpj_completo || empresa.cnpj_basico;
  if (!cnpj) return;
  const termo = empresa.razao_social || empresa.nome_fantasia || cnpj;
  try {
    const lista = JSON.parse(localStorage.getItem("ci_recentes_empresa") || "[]");
    const novo  = [
      { tipo: "empresa", icone: "domain", termo, cnpj },
      ...lista.filter(r => r.cnpj !== cnpj && r.termo !== termo),
    ].slice(0, 10);
    localStorage.setItem("ci_recentes_empresa", JSON.stringify(novo));
  } catch {}
}

function addRecenteSocio(item) {
  if (!item) return;
  const nome = item.nome_socio || item.nome || item.info?.nome;
  const cpf  = item.cpf_cnpj_socio || item.cpf || item.info?.cpf;
  if (!nome) return;
  try {
    const lista = JSON.parse(localStorage.getItem("ci_recentes_socio") || "[]");
    const chave = `${cpf || ""}|${nome}`;
    const novo  = [
      { tipo: "socio", icone: "person_search", termo: nome, cpf, nome },
      ...lista.filter(r => `${r.cpf || ""}|${r.nome || r.termo}` !== chave),
    ].slice(0, 10);
    localStorage.setItem("ci_recentes_socio", JSON.stringify(novo));
  } catch {}
}

export default function App() {
  const [tela, setTela] = useState("home");
  const [telaAnterior, setTelaAnterior] = useState(null);
  const [empresaDetalhe, setEmpresaDetalhe] = useState(null);
  const [socioInicial, setSocioInicial] = useState(null);
  const [grafoRaiz, setGrafoRaiz] = useState(null);
  const [loadingNav, setLoadingNav] = useState(false);

  function irPara(proxTela) {
    setTelaAnterior(tela);
    setTela(proxTela);
  }

  async function abrirEmpresa(cnpjOuDados) {
    if (typeof cnpjOuDados === "object" && cnpjOuDados !== null) {
      addRecenteEmpresa(cnpjOuDados);
      setEmpresaDetalhe(cnpjOuDados);
      setTelaAnterior(tela);
      setTela("resultado-empresa");
      return;
    }
    setLoadingNav(true);
    try {
      const dados = await buscarEmpresaPorCnpj(String(cnpjOuDados));
      if (dados) {
        addRecenteEmpresa(dados);
        setEmpresaDetalhe(dados);
        setTelaAnterior(tela);
        setTela("resultado-empresa");
      }
    } catch (err) {
      console.error("Erro ao carregar empresa:", err);
    } finally {
      setLoadingNav(false);
    }
  }

  function abrirSocio(item) {
    addRecenteSocio(item);
    setSocioInicial(item);
    setTelaAnterior(tela);
    setTela("resultado-socio");
  }

  function abrirGrafo(raiz) {
    setGrafoRaiz(raiz);
    setTelaAnterior(tela);
    setTela("grafo-rede");
  }

  const mostrarSidebar = tela !== "login";

  return (
    <div className="flex min-h-screen bg-background">
      {mostrarSidebar && (
        <Sidebar
          tela={tela}
          irPara={irPara}
          onAbrirEmpresa={abrirEmpresa}
          onAbrirSocio={abrirSocio}
        />
      )}

      <div className="flex-1 flex flex-col">
        {loadingNav && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-xl px-8 py-6 shadow-dropdown flex items-center gap-4">
              <span className="material-symbols-outlined text-primary text-[28px] animate-spin">progress_activity</span>
              <span className="text-body-md text-on-surface">Carregando...</span>
            </div>
          </div>
        )}

        {tela === "login" && (
          <Login onLogin={() => irPara("home")} />
        )}

        {tela === "home" && (
          <HomeSelecao
            irParaEmpresa={() => irPara("empresa")}
            irParaSocio={() => irPara("socio")}
          />
        )}

        {tela === "empresa" && (
          <BuscaEmpresa
            onSelecionarEmpresa={abrirEmpresa}
            onVoltar={() => irPara("home")}
          />
        )}

        {tela === "socio" && (
          <BuscaSocio
            onSelecionarSocio={abrirSocio}
            onVoltar={() => irPara("home")}
          />
        )}

        {tela === "resultado-empresa" && (
          <ResultadoEmpresa
            key={empresaDetalhe?.cnpj_basico || empresaDetalhe?.cnpj_completo}
            dados={empresaDetalhe}
            onVoltar={() => irPara(telaAnterior || "empresa")}
            onVerSocio={abrirSocio}
            onVerEmpresa={abrirEmpresa}
            onAbrirGrafo={abrirGrafo}
          />
        )}

        {tela === "resultado-socio" && (
          <ResultadoSocio
            key={`${socioInicial?.cpf_cnpj_socio || ""}|${socioInicial?.nome_socio || ""}`}
            socioInicial={socioInicial}
            onVoltar={() => irPara(telaAnterior || "socio")}
            onVerEmpresa={abrirEmpresa}
            onVerSocio={abrirSocio}
            onAbrirGrafo={abrirGrafo}
          />
        )}

        {tela === "grafo-rede" && grafoRaiz && (
          <GrafoRede
            raiz={grafoRaiz}
            onVoltar={() => irPara(telaAnterior || "home")}
            onVerEmpresa={abrirEmpresa}
            onVerSocio={abrirSocio}
          />
        )}
      </div>
    </div>
  );
}
