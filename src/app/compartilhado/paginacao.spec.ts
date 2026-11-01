import { TestBed } from '@angular/core/testing';
import { Paginacao } from './paginacao';

describe('Paginacao', () => {
  function montar(pagina: number, total: number, tamanho = 20) {
    const fixture = TestBed.createComponent(Paginacao);
    fixture.componentRef.setInput('pagina', pagina);
    fixture.componentRef.setInput('tamanho', tamanho);
    fixture.componentRef.setInput('total', total);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const botoes = () => Array.from(el.querySelectorAll('button'));
    return { fixture, el, botoes };
  }

  it('não aparece sem resultados', () => {
    const { el } = montar(1, 0);
    expect(el.querySelector('nav')).toBeNull();
  });

  it('mostra o total e a página, no singular e no plural', () => {
    expect(montar(1, 1).el.textContent).toContain('1 resultado · página 1 de 1');
    expect(montar(2, 45).el.textContent).toContain('45 resultados · página 2 de 3');
  });

  it('desabilita Anterior na primeira e Próxima na última página', () => {
    const primeira = montar(1, 45).botoes();
    expect(primeira[0].disabled).toBe(true);
    expect(primeira[1].disabled).toBe(false);

    const ultima = montar(3, 45).botoes();
    expect(ultima[0].disabled).toBe(false);
    expect(ultima[1].disabled).toBe(true);
  });

  it('emite a página pedida', () => {
    const { fixture, botoes } = montar(2, 45);
    const pedidas: number[] = [];
    fixture.componentInstance.mudar.subscribe((p) => pedidas.push(p));

    botoes()[0].click();
    botoes()[1].click();

    expect(pedidas).toEqual([1, 3]);
  });
});
