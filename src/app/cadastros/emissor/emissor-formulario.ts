import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { UFS } from '../../compartilhado/formatadores';
import { lerErro } from '../../core/erros';
import { DadosDoEmissor, Emissor, EmissorApi } from './emissor-api';

const VAZIO: DadosDoEmissor = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cep: '',
  cidade: '',
  uf: '',
  telefones: '',
  numeroAutorizacaoIpem: '',
  responsavelTecnicoNome: '',
  responsavelTecnicoCpf: '',
};

/**
 * Dados da empresa que emite o relatório e do responsável técnico (registro ÚNICO). Só o gestor altera.
 * Mudanças não alteram relatórios já emitidos (eles guardam uma cópia). Regras: IA/Specs/EMISSOR_CATALOGO.md.
 */
@Component({
  selector: 'jvd-emissor-formulario',
  imports: [FormField],
  templateUrl: './emissor-formulario.html',
})
export class EmissorFormulario {
  private readonly api = inject(EmissorApi);

  protected readonly ufs = UFS;
  protected readonly modelo = signal<DadosDoEmissor>({ ...VAZIO });
  protected readonly formulario = form(this.modelo, (e) => {
    required(e.razaoSocial, { message: 'Informe a razão social.' });
    maxLength(e.razaoSocial, 200, { message: 'Use no máximo 200 caracteres.' });
    maxLength(e.nomeFantasia, 200, { message: 'Use no máximo 200 caracteres.' });
    required(e.cnpj, { message: 'Informe o CNPJ.' });
    maxLength(e.cnpj, 40, { message: 'CNPJ longo demais.' });
    maxLength(e.inscricaoEstadual, 30, { message: 'Use no máximo 30 caracteres.' });
    maxLength(e.logradouro, 150, { message: 'Use no máximo 150 caracteres.' });
    maxLength(e.numero, 20, { message: 'Use no máximo 20 caracteres.' });
    maxLength(e.bairro, 80, { message: 'Use no máximo 80 caracteres.' });
    maxLength(e.cep, 20, { message: 'CEP longo demais.' });
    maxLength(e.cidade, 80, { message: 'Use no máximo 80 caracteres.' });
    maxLength(e.telefones, 200, { message: 'Use no máximo 200 caracteres.' });
    maxLength(e.numeroAutorizacaoIpem, 60, { message: 'Use no máximo 60 caracteres.' });
    maxLength(e.responsavelTecnicoNome, 150, { message: 'Use no máximo 150 caracteres.' });
    maxLength(e.responsavelTecnicoCpf, 20, { message: 'CPF longo demais.' });
  });

  /** `null` = nunca configurado: a primeira gravação não leva versão. */
  private readonly versao = signal<string | null>(null);
  protected readonly configurado = signal(false);
  protected readonly carregando = signal(true);
  protected readonly falhaAoCarregar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erros = signal<string[]>([]);
  protected readonly conflito = signal(false);
  protected readonly salvo = signal(false);
  protected readonly titulo = computed(() => (this.configurado() ? 'Dados da empresa' : 'Configurar a empresa'));

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erros.set([]);
    this.conflito.set(false);
    try {
      const emissor = await this.api.obter();
      if (emissor) this.aplicar(emissor);
      this.falhaAoCarregar.set(false);
    } catch (falha) {
      this.falhaAoCarregar.set(true);
      this.erros.set(lerErro(falha).mensagens);
    } finally {
      this.carregando.set(false);
    }
  }

  private aplicar(e: Emissor): void {
    this.configurado.set(true);
    this.versao.set(e.versao);
    this.modelo.set({
      razaoSocial: e.razaoSocial,
      nomeFantasia: e.nomeFantasia ?? '',
      cnpj: e.cnpj,
      inscricaoEstadual: e.inscricaoEstadual ?? '',
      logradouro: e.logradouro ?? '',
      numero: e.numero ?? '',
      bairro: e.bairro ?? '',
      cep: e.cep ?? '',
      cidade: e.cidade ?? '',
      uf: e.uf ?? '',
      telefones: e.telefones ?? '',
      numeroAutorizacaoIpem: e.numeroAutorizacaoIpem ?? '',
      responsavelTecnicoNome: e.responsavelTecnicoNome ?? '',
      responsavelTecnicoCpf: e.responsavelTecnicoCpf ?? '',
    });
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.erros.set([]);
    this.conflito.set(false);
    this.salvo.set(false);
    void submit(this.formulario, async () => {
      this.enviando.set(true);
      try {
        this.aplicar(await this.api.salvar(this.modelo(), this.versao()));
        this.salvo.set(true);
      } catch (falha) {
        const erro = lerErro(falha);
        if (erro.status === 409 && erro.codigo === 'conflito') this.conflito.set(true);
        else this.erros.set(erro.mensagens);
      } finally {
        this.enviando.set(false);
      }
    });
  }
}
