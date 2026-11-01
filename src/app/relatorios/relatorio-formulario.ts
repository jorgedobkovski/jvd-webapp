import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Equipamento, EquipamentosApi } from '../cadastros/equipamentos/equipamentos-api';
import { CatalogoApi, Servico } from '../cadastros/catalogo/catalogo-api';
import { UsuarioDoSistema, UsuariosApi } from '../cadastros/usuarios/usuarios-api';
import { formatarData, hoje } from '../compartilhado/datas';
import { formatarReais, lerPreco } from '../compartilhado/formatadores';
import { ClienteEscolhido, SeletorDeCliente } from '../compartilhado/seletor-de-cliente';
import { lerErro } from '../core/erros';
import { Sessao } from '../core/sessao';
import { DadosDoRascunho, RelatoriosApi, TIPOS_DE_SERVICO, TipoServico } from './relatorios-api';

interface SugestaoDeVerificacao {
  numero: string;
  data: string;
  certificado: string;
}

/**
 * Preenchimento do relatório (rascunho): uma tela só, em seções. Salvar leva ao detalhe, onde se emite. Cliente, balança
 * e serviço têm autopreenchimento; tudo continua editável. Regras: IA/Specs/RELATORIO_SERVICO.md.
 */
@Component({
  selector: 'jvd-relatorio-formulario',
  imports: [FormField, RouterLink, SeletorDeCliente],
  templateUrl: './relatorio-formulario.html',
})
export class RelatorioFormulario {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(RelatoriosApi);
  private readonly equipamentosApi = inject(EquipamentosApi);
  private readonly catalogoApi = inject(CatalogoApi);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly id = this.rota.snapshot.paramMap.get('id');
  protected readonly edicao = this.id !== null;
  protected readonly tipos = TIPOS_DE_SERVICO;
  protected readonly reais = formatarReais;
  protected readonly data = formatarData;

  protected readonly modelo = signal({
    equipamentoId: '',
    tipoServico: '' as TipoServico | '',
    dataServico: hoje(),
    catalogoServicoId: '',
    servicoExecutado: '',
    observacoes: '',
    verificacaoData: '',
    verificacaoCertificado: '',
    selo: '',
    garantiaDias: '0',
    total: '',
    desconto: '',
    tecnicoId: '',
  });

  protected readonly formulario = form(this.modelo, (f) => {
    required(f.equipamentoId, { message: 'Escolha o equipamento.' });
    required(f.tipoServico, { message: 'Escolha o tipo de serviço.' });
    required(f.dataServico, { message: 'Informe a data do serviço.' });
    maxLength(f.servicoExecutado, 4000, { message: 'Use no máximo 4.000 caracteres.' });
    maxLength(f.observacoes, 2000, { message: 'Use no máximo 2.000 caracteres.' });
    maxLength(f.verificacaoCertificado, 60, { message: 'Use no máximo 60 caracteres.' });
    maxLength(f.selo, 60, { message: 'Use no máximo 60 caracteres.' });
    pattern(f.garantiaDias, /^\d{1,4}$/, { message: 'Informe os dias de garantia (0 a 9.999).' });
    validate(f.total, ({ value }) => (lerPreco(value()) === undefined ? { kind: 'valor', message: 'Use um valor como 150 ou 150,50.' } : undefined));
    validate(f.desconto, ({ value }) => (lerPreco(value()) === undefined ? { kind: 'valor', message: 'Use um valor como 10 ou 10,50.' } : undefined));
    validate(f.desconto, ({ value, valueOf }) => {
      const desconto = lerPreco(value());
      const total = lerPreco(valueOf(f.total)) ?? 0; // total em branco vale 0: desconto sem total também é recusado
      return typeof desconto === 'number' && desconto > total
        ? { kind: 'maior', message: 'O desconto não pode ser maior que o total.' }
        : undefined;
    });
  });

  // Cliente e listas de apoio
  protected readonly cliente = signal<ClienteEscolhido | null>(null);
  protected readonly equipamentos = signal<Equipamento[]>([]);
  protected readonly catalogo = signal<Servico[]>([]);
  protected readonly usuarios = signal<UsuarioDoSistema[]>([]);
  protected readonly carregandoEquipamentos = signal(false);
  protected readonly semCliente = signal(false);
  protected readonly sugestao = signal<SugestaoDeVerificacao | null>(null);

  private readonly versao = signal('');
  protected readonly carregando = signal(this.edicao);
  /** Edição de algo que não pode ser editado aqui (não é rascunho, não existe, não é do técnico). */
  protected readonly indisponivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);
  protected readonly conflito = signal(false);
  protected readonly titulo = computed(() => (this.edicao ? 'Editar rascunho' : 'Novo relatório'));

  protected readonly totalGeral = computed(() => {
    const total = lerPreco(this.modelo().total);
    const desconto = lerPreco(this.modelo().desconto);
    if (typeof total !== 'number' && total !== null) return null;
    if (typeof desconto !== 'number' && desconto !== null) return null;
    const geral = (total ?? 0) - (desconto ?? 0);
    return geral < 0 ? null : geral; // negativo é inconsistência (a validação do desconto já avisa)
  });

  /** Valores carregados do servidor: só uma escolha NOVA do usuário dispara sugestão/autopreenchimento. */
  private equipamentoInicial: string | null = null;
  private catalogoInicial: string | null = null;
  /** O que a SUGESTÃO preencheu sozinha (para desfazer se a pessoa trocar de balança sem ter mexido nisso). */
  private preenchidoPelaSugestao: { data: string; certificado: string } | null = null;
  /** Última balança escolhida (vazia = nenhuma ainda); serve para saber quando houve TROCA de uma balança por outra. */
  private ultimaBalanca = '';
  /** Avisa que a verificação anterior preenchida pode ser da balança anterior. */
  protected readonly conferirVerificacao = signal(false);

  // `computed` só muda quando o VALOR muda; ler `modelo()` direto no effect o refaria a cada tecla em qualquer campo.
  private readonly equipamentoEscolhido = computed(() => this.modelo().equipamentoId);
  private readonly servicoEscolhido = computed(() => this.modelo().catalogoServicoId);

  constructor() {
    void this.carregarApoios();
    if (this.id) void this.carregar(this.id);

    effect(() => {
      const equipamentoId = this.equipamentoEscolhido();
      untracked(() => {
        this.aoTrocarDeBalanca(equipamentoId);
        if (equipamentoId && equipamentoId !== this.equipamentoInicial) void this.sugerirVerificacao(equipamentoId);
      });
    });

    effect(() => {
      const servicoId = this.servicoEscolhido();
      untracked(() => {
        if (servicoId && servicoId !== this.catalogoInicial) this.aplicarServicoDoCatalogo(servicoId);
      });
    });
  }

  private async carregarApoios(): Promise<void> {
    try {
      this.catalogo.set(await this.catalogoApi.listarAtivos());
    } catch {
      // sem catálogo o serviço continua podendo ser digitado
    }
    if (this.sessao.ehGestor()) {
      try {
        this.usuarios.set(await this.usuariosApi.listarAtivos());
      } catch {
        // sem a lista, o executor fica sendo o próprio gestor
      }
    }
  }

  protected async carregar(id: string): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    this.conflito.set(false);
    try {
      const r = await this.api.obter(id);
      if (r.status !== 'Rascunho') {
        this.indisponivel.set(true);
        this.erros.set(['Este relatório já foi emitido e não pode ser editado como rascunho.']);
        return;
      }
      this.versao.set(r.versao);
      this.cliente.set({ id: r.clienteId, nome: r.clienteNome });
      await this.carregarEquipamentosDoCliente(r.clienteId);
      this.equipamentoInicial = r.equipamentoId;
      this.ultimaBalanca = r.equipamentoId;
      this.catalogoInicial = r.catalogoServicoId ?? '';
      this.modelo.set({
        equipamentoId: r.equipamentoId,
        tipoServico: r.tipoServico,
        dataServico: r.dataServico,
        catalogoServicoId: r.catalogoServicoId ?? '',
        servicoExecutado: r.servicoExecutado,
        observacoes: r.observacoes ?? '',
        verificacaoData: r.verificacaoAnteriorData ?? '',
        verificacaoCertificado: r.verificacaoAnteriorCertificado ?? '',
        selo: r.numeroSeloReparador ?? '',
        garantiaDias: String(r.garantiaDias),
        total: r.total === 0 ? '' : String(r.total).replace('.', ','),
        desconto: r.desconto === 0 ? '' : String(r.desconto).replace('.', ','),
        tecnicoId: r.tecnicoId,
      });
      this.indisponivel.set(false);
    } catch (falha) {
      this.indisponivel.set(true);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  /** Chamado quando a pessoa escolhe outro cliente: a balança escolhida deixa de valer. */
  protected async aoEscolherCliente(c: ClienteEscolhido): Promise<void> {
    this.semCliente.set(false);
    this.modelo.update((m) => ({ ...m, equipamentoId: '' }));
    this.sugestao.set(null);
    await this.carregarEquipamentosDoCliente(c.id);
  }

  private async carregarEquipamentosDoCliente(clienteId: string): Promise<void> {
    this.carregandoEquipamentos.set(true);
    try {
      const lista = await this.equipamentosApi.listarDoCliente(clienteId);
      // Resposta atrasada de um cliente que já foi trocado não vale (senão as balanças ficariam de outro cliente).
      if (this.cliente()?.id === clienteId) this.equipamentos.set(lista);
    } catch (falha) {
      if (this.cliente()?.id !== clienteId) return;
      this.equipamentos.set([]);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      if (this.cliente()?.id === clienteId) this.carregandoEquipamentos.set(false);
    }
  }

  /**
   * Trocar de balança desfaz o que a sugestão tinha preenchido para a anterior (data e certificado são da balança, não
   * do relatório); o que a pessoa digitou fica, com um aviso para conferir.
   */
  private aoTrocarDeBalanca(equipamentoId: string): void {
    this.sugestao.set(null);
    this.conferirVerificacao.set(false);
    const automatico = this.preenchidoPelaSugestao;
    this.preenchidoPelaSugestao = null;
    const anterior = this.ultimaBalanca;
    if (equipamentoId !== '') this.ultimaBalanca = equipamentoId;

    const atual = this.modelo();
    // 1) O que a sugestão preencheu sozinha sai SEMPRE que a balança muda (inclusive ao voltar para a original).
    if (automatico && atual.verificacaoData === automatico.data && atual.verificacaoCertificado === automatico.certificado) {
      this.modelo.update((m) => ({ ...m, verificacaoData: '', verificacaoCertificado: '' }));
      return;
    }
    // 2) O que a pessoa digitou (ou alterou) fica, mas ela é avisada de que pode ser da balança anterior.
    const trocou = equipamentoId !== '' && anterior !== '' && equipamentoId !== anterior && equipamentoId !== this.equipamentoInicial;
    if (trocou && (atual.verificacaoData !== '' || atual.verificacaoCertificado !== '')) this.conferirVerificacao.set(true);
  }

  /** Sugere a verificação anterior a partir do último relatório emitido da balança (editável; só preenche se vazio). */
  private async sugerirVerificacao(equipamentoId: string): Promise<void> {
    try {
      const ultimo = await this.api.ultimoEmitidoDoEquipamento(equipamentoId);
      if (!ultimo || this.modelo().equipamentoId !== equipamentoId) return;
      if (!ultimo.verificacaoAnteriorData && !ultimo.verificacaoAnteriorCertificado) return;

      this.sugestao.set({
        numero: ultimo.numeroFormatado ?? '',
        data: ultimo.verificacaoAnteriorData ?? '',
        certificado: ultimo.verificacaoAnteriorCertificado ?? '',
      });
      const atual = this.modelo();
      if (atual.verificacaoData === '' && atual.verificacaoCertificado === '') {
        const data = ultimo.verificacaoAnteriorData ?? '';
        const certificado = ultimo.verificacaoAnteriorCertificado ?? '';
        this.preenchidoPelaSugestao = { data, certificado };
        this.modelo.update((m) => ({ ...m, verificacaoData: data, verificacaoCertificado: certificado }));
      }
    } catch {
      // sugestão é só ajuda: se falhar, a pessoa digita
    }
  }

  /** Escolher um item do catálogo preenche o texto do serviço e o total quando ainda estão vazios (tudo editável). */
  private aplicarServicoDoCatalogo(servicoId: string): void {
    const item = this.catalogo().find((s) => s.id === servicoId);
    if (!item) return;
    this.modelo.update((m) => ({
      ...m,
      servicoExecutado: m.servicoExecutado.trim() === '' ? item.descricao : m.servicoExecutado,
      total: m.total.trim() === '' && item.precoSugerido !== null ? String(item.precoSugerido).replace('.', ',') : m.total,
    }));
  }

  protected usarSugestao(): void {
    const s = this.sugestao();
    if (!s) return;
    this.preenchidoPelaSugestao = { data: s.data, certificado: s.certificado };
    this.conferirVerificacao.set(false);
    this.modelo.update((m) => ({ ...m, verificacaoData: s.data, verificacaoCertificado: s.certificado }));
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.erros.set([]);
    this.conflito.set(false);
    this.semCliente.set(this.cliente() === null);

    void submit(this.formulario, async () => {
      const escolhido = this.cliente();
      if (!escolhido) return;

      this.enviando.set(true);
      try {
        const dados = this.montarDados(escolhido.id);
        const salvo = this.id ? await this.api.atualizar(this.id, dados, this.versao()) : await this.api.criar(dados);
        await this.router.navigate(['/relatorios', salvo.id]);
      } catch (falha) {
        const erro = lerErro(falha);
        if (erro.status === 409 && erro.codigo === 'conflito') this.conflito.set(true);
        else this.erros.set(erro.mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }

  private montarDados(clienteId: string): DadosDoRascunho {
    const m = this.modelo();
    return {
      clienteId,
      equipamentoId: m.equipamentoId,
      tecnicoId: this.sessao.ehGestor() && m.tecnicoId !== '' ? m.tecnicoId : null,
      tipoServico: m.tipoServico as TipoServico,
      dataServico: m.dataServico,
      servicoExecutado: m.servicoExecutado,
      observacoes: m.observacoes,
      verificacaoAnteriorData: m.verificacaoData === '' ? null : m.verificacaoData,
      verificacaoAnteriorCertificado: m.verificacaoCertificado,
      numeroSeloReparador: m.selo,
      garantiaDias: Number.parseInt(m.garantiaDias || '0', 10),
      total: lerPreco(m.total) ?? 0,
      desconto: lerPreco(m.desconto) ?? 0,
      catalogoServicoId: m.catalogoServicoId === '' ? null : m.catalogoServicoId,
    };
  }
}
