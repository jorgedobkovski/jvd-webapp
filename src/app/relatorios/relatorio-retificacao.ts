import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogoApi, Servico } from '../cadastros/catalogo/catalogo-api';
import { formatarData } from '../compartilhado/datas';
import { formatarReais, lerPreco } from '../compartilhado/formatadores';
import { lerErro } from '../core/erros';
import { DadosDaRetificacao, RelatorioDetalhe, RelatoriosApi, TIPOS_DE_SERVICO, TipoServico } from './relatorios-api';

/**
 * Retificação de um relatório EMITIDO: o número fica, a revisão sobe e o histórico guarda o que mudou, quem e por quê
 * (motivo obrigatório). Cliente, balança e executor não mudam aqui; para isso cancela-se e emite-se outro.
 * Regras: IA/Specs/RELATORIO_SERVICO.md (Fase 4B).
 */
@Component({
  selector: 'jvd-relatorio-retificacao',
  imports: [FormField, RouterLink],
  templateUrl: './relatorio-retificacao.html',
})
export class RelatorioRetificacao {
  private readonly api = inject(RelatoriosApi);
  private readonly catalogoApi = inject(CatalogoApi);
  private readonly router = inject(Router);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly tipos = TIPOS_DE_SERVICO;
  protected readonly reais = formatarReais;
  protected readonly data = formatarData;

  protected readonly modelo = signal({
    tipoServico: '' as TipoServico | '',
    dataServico: '',
    catalogoServicoId: '',
    servicoExecutado: '',
    observacoes: '',
    verificacaoData: '',
    verificacaoCertificado: '',
    selo: '',
    garantiaDias: '0',
    total: '',
    desconto: '',
    motivo: '',
    atualizarCadastro: false,
  });

  protected readonly formulario = form(this.modelo, (f) => {
    required(f.motivo, { message: 'Informe o motivo da retificação.' });
    maxLength(f.motivo, 500, { message: 'Use no máximo 500 caracteres.' });
    validate(f.motivo, ({ value }) => (value() !== '' && value().trim() === '' ? { kind: 'vazio', message: 'Informe o motivo da retificação.' } : undefined));
    required(f.tipoServico, { message: 'Escolha o tipo de serviço.' });
    required(f.dataServico, { message: 'Informe a data do serviço.' });
    required(f.servicoExecutado, { message: 'Informe o serviço executado.' });
    maxLength(f.servicoExecutado, 4000, { message: 'Use no máximo 4.000 caracteres.' });
    maxLength(f.observacoes, 2000, { message: 'Use no máximo 2.000 caracteres.' });
    maxLength(f.verificacaoCertificado, 60, { message: 'Use no máximo 60 caracteres.' });
    maxLength(f.selo, 60, { message: 'Use no máximo 60 caracteres.' });
    pattern(f.garantiaDias, /^\d{1,4}$/, { message: 'Informe os dias de garantia (0 a 9.999).' });
    validate(f.total, ({ value }) => (lerPreco(value()) === undefined ? { kind: 'valor', message: 'Use um valor como 150 ou 150,50.' } : undefined));
    validate(f.desconto, ({ value }) => (lerPreco(value()) === undefined ? { kind: 'valor', message: 'Use um valor como 10 ou 10,50.' } : undefined));
    validate(f.desconto, ({ value, valueOf }) => {
      const desconto = lerPreco(value());
      const total = lerPreco(valueOf(f.total)) ?? 0;
      return typeof desconto === 'number' && desconto > total ? { kind: 'maior', message: 'O desconto não pode ser maior que o total.' } : undefined;
    });
  });

  protected readonly relatorio = signal<RelatorioDetalhe | null>(null);
  private readonly catalogo = signal<Servico[]>([]);
  private readonly versao = signal('');
  protected readonly carregando = signal(true);
  /** Não dá para retificar (inexistente, rascunho, cancelado, de outro técnico, erro de carga). */
  protected readonly indisponivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);
  protected readonly conflito = signal(false);

  /** Itens do catálogo para escolher; mantém o item atual do relatório mesmo se ele foi desativado depois. */
  protected readonly opcoesDoCatalogo = computed(() => {
    const itens = this.catalogo().map((s) => ({ id: s.id, rotulo: s.descricao }));
    const atual = this.relatorio()?.catalogoServicoId;
    return atual && !itens.some((i) => i.id === atual) ? [...itens, { id: atual, rotulo: 'Item atual do catálogo (inativo)' }] : itens;
  });

  protected readonly totalGeral = computed(() => {
    const total = lerPreco(this.modelo().total);
    const desconto = lerPreco(this.modelo().desconto);
    if (typeof total !== 'number' && total !== null) return null;
    if (typeof desconto !== 'number' && desconto !== null) return null;
    const geral = (total ?? 0) - (desconto ?? 0);
    return geral < 0 ? null : geral;
  });

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    this.conflito.set(false);
    try {
      const [r, catalogo] = await Promise.all([this.api.obter(this.id), this.catalogoApi.listarAtivos().catch(() => [] as Servico[])]);
      if (r.status !== 'Emitido') {
        this.indisponivel.set(true);
        this.erros.set([
          r.status === 'Cancelado' ? 'Este relatório foi cancelado e não pode ser retificado.' : 'Este relatório ainda é um rascunho: edite-o em vez de retificar.',
        ]);
        return;
      }
      this.catalogo.set(catalogo);
      this.relatorio.set(r);
      this.versao.set(r.versao);
      this.modelo.set({
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
        motivo: '',
        atualizarCadastro: false,
      });
      this.indisponivel.set(false);
    } catch (falha) {
      this.indisponivel.set(true);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.erros.set([]);
    this.conflito.set(false);
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        await this.api.retificar(this.id, this.montarDados(), this.versao());
        await this.router.navigate(['/relatorios', this.id]);
      } catch (falha) {
        const erro = lerErro(falha);
        if (erro.status === 409 && erro.codigo === 'conflito') this.conflito.set(true);
        else this.erros.set(erro.mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }

  private montarDados(): DadosDaRetificacao {
    const m = this.modelo();
    return {
      motivo: m.motivo.trim(),
      atualizarDadosDeCadastro: m.atualizarCadastro,
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
