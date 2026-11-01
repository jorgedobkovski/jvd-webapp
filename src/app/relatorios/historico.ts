import { formatarData } from '../compartilhado/datas';
import { formatarCep, formatarDocumento, formatarReais } from '../compartilhado/formatadores';
import { rotuloDoTipo } from './relatorios-api';

export interface Mudanca {
  campo: string;
  antes: string;
  depois: string;
}

type Valores = Record<string, unknown>;

const ROTULOS: Readonly<Record<string, string>> = {
  tipoServico: 'Tipo de serviço',
  dataServico: 'Data do serviço',
  servicoExecutado: 'Serviço executado',
  observacoes: 'Observações',
  verificacaoAnteriorData: 'Data da verificação anterior',
  verificacaoAnteriorCertificado: 'Certificado da verificação anterior',
  numeroSeloReparador: 'Selo reparador',
  garantiaDias: 'Garantia (dias)',
  total: 'Total',
  desconto: 'Desconto',
  totalGeral: 'Total geral',
  catalogoServicoId: 'Serviço do catálogo',
};

const ROTULOS_DO_CLIENTE: Readonly<Record<string, string>> = {
  nome: 'Nome',
  nomeFantasia: 'Nome fantasia',
  documento: 'CPF/CNPJ',
  inscricaoEstadualRg: 'Inscrição estadual/RG',
  logradouro: 'Logradouro',
  numero: 'Número',
  bairro: 'Bairro',
  cep: 'CEP',
  cidade: 'Cidade',
  uf: 'UF',
  telefone: 'Telefone',
};

const ROTULOS_DO_EQUIPAMENTO: Readonly<Record<string, string>> = {
  descricao: 'Descrição',
  numeroSerie: 'Nº de série',
  numeroInmetro: 'Nº INMETRO',
};

const SEM_VALOR = '—';

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return SEM_VALOR;
  return String(valor);
}

/** Valor de um campo do relatório, no formato que a pessoa lê (data, reais, tipo de serviço…). */
function formatar(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return SEM_VALOR;
  switch (campo) {
    case 'dataServico':
    case 'verificacaoAnteriorData':
      return formatarData(String(valor));
    case 'total':
    case 'desconto':
    case 'totalGeral':
      return typeof valor === 'number' ? formatarReais(valor) : texto(valor);
    case 'tipoServico':
      return rotuloDoTipo(String(valor));
    case 'catalogoServicoId':
      return 'Item do catálogo';
    default:
      return texto(valor);
  }
}

function eRegistro(valor: unknown): valor is Valores {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

/** Diferenças dentro de uma cópia de cliente ou de equipamento (só os subcampos que mudaram). */
function mudancasDeCopia(prefixo: string, rotulos: Readonly<Record<string, string>>, antes: unknown, depois: unknown): Mudanca[] {
  const a = eRegistro(antes) ? antes : {};
  const d = eRegistro(depois) ? depois : {};
  return Object.keys({ ...a, ...d })
    .filter((chave) => chave in rotulos && a[chave] !== d[chave])
    .map((chave) => ({
      campo: `${prefixo}: ${rotulos[chave]}`,
      antes: formatarCopia(chave, a[chave]),
      depois: formatarCopia(chave, d[chave]),
    }));
}

function formatarCopia(chave: string, valor: unknown): string {
  if (chave === 'documento') return valor ? formatarDocumento(String(valor)) : SEM_VALOR;
  if (chave === 'cep') return valor ? formatarCep(String(valor)) : SEM_VALOR;
  return texto(valor);
}

/**
 * Transforma os dois JSON de uma revisão (só os campos alterados, antes e depois) em linhas legíveis. Campos
 * desconhecidos são ignorados (nunca mostra chave crua nem valor que o app não sabe formatar).
 */
export function mudancasDaRevisao(antes: unknown, depois: unknown): Mudanca[] {
  const a = eRegistro(antes) ? antes : {};
  const d = eRegistro(depois) ? depois : {};
  const resultado: Mudanca[] = [];

  for (const campo of Object.keys(ROTULOS)) {
    if (!(campo in a) && !(campo in d)) continue;
    let antes = formatar(campo, a[campo]);
    let depois = formatar(campo, d[campo]);
    // Trocar um item do catálogo por outro: o identificador não é mostrado, então diz que foi trocado.
    if (campo === 'catalogoServicoId' && antes !== SEM_VALOR && depois !== SEM_VALOR) {
      antes = 'Item do catálogo anterior';
      depois = 'Outro item do catálogo';
    }
    if (antes === depois) continue; // sem diferença visível (ex.: nulo e vazio): não vira linha
    resultado.push({ campo: ROTULOS[campo], antes, depois });
  }
  if ('cliente' in a || 'cliente' in d) resultado.push(...mudancasDeCopia('Cliente', ROTULOS_DO_CLIENTE, a['cliente'], d['cliente']));
  if ('equipamento' in a || 'equipamento' in d) resultado.push(...mudancasDeCopia('Equipamento', ROTULOS_DO_EQUIPAMENTO, a['equipamento'], d['equipamento']));
  return resultado;
}
