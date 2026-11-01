import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisosDoCadastro, avisosRecebidos } from '../../compartilhado/avisos-do-cadastro';
import { formatarDocumento, formatarEndereco } from '../../compartilhado/formatadores';
import { Aviso, Pagina } from '../../compartilhado/modelos';
import { lerErro } from '../../core/erros';
import { Sessao } from '../../core/sessao';
import { Equipamento, EquipamentosApi } from '../equipamentos/equipamentos-api';
import { Cliente, ClientesApi } from './clientes-api';

@Component({
  selector: 'jvd-cliente-detalhe',
  imports: [RouterLink, AvisosDoCadastro],
  templateUrl: './cliente-detalhe.html',
})
export class ClienteDetalhe {
  protected readonly sessao = inject(Sessao);
  private readonly api = inject(ClientesApi);
  private readonly equipamentosApi = inject(EquipamentosApi);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly documento = formatarDocumento;
  protected readonly endereco = formatarEndereco;
  protected readonly avisos = signal<Aviso[]>(avisosRecebidos());

  protected readonly cliente = httpResource<Cliente>(() => `${this.api.url}/${encodeURIComponent(this.id)}`);
  protected readonly equipamentos = httpResource<Pagina<Equipamento>>(() => ({
    url: this.equipamentosApi.url,
    params: { clienteId: this.id, tamanho: 100 },
  }));

  protected readonly itensDeEquipamento = computed(() => (this.equipamentos.hasValue() ? this.equipamentos.value().itens : []));
  protected readonly naoEncontrado = computed(() => this.cliente.error() !== undefined);

  protected readonly confirmando = signal(false);
  protected readonly trabalhando = signal(false);
  protected readonly erro = signal('');

  protected async alternar(ativar: boolean): Promise<void> {
    this.trabalhando.set(true);
    this.erro.set('');
    try {
      if (ativar) await this.api.reativar(this.id);
      else await this.api.desativar(this.id);
      this.confirmando.set(false);
      this.cliente.reload();
    } catch (falha) {
      this.erro.set(lerErro(falha).mensagem);
    } finally {
      this.trabalhando.set(false);
    }
  }
}
