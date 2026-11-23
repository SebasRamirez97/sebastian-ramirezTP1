import { Directive, ElementRef, Host, HostListener, OnInit, Optional, inject } from '@angular/core';
import { SelectorFechaComponent } from '../components/selector-fecha/selector-fecha'; // ajustá la ruta

@Directive({
  selector: '[appNoFechaFutura]',
  standalone: true,
})
export class NoFechaFuturaDirective implements OnInit {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private selectorFecha = inject(SelectorFechaComponent, { optional: true, host: true });
  private inputDate: HTMLInputElement | null = null;

  ngOnInit() {
    if (this.selectorFecha) {
      this.selectorFecha.aplicarModoDesdeDirectiva('no-futura');
      return;
    }

    const hoy = this.obtenerFechaHoyLocal();
    const host = this.el.nativeElement;
    this.inputDate = host instanceof HTMLInputElement ? host : host.querySelector('input[type="date"]');

    if (this.inputDate) {
      this.inputDate.max = hoy;
      this.inputDate.addEventListener('change', () => this.validarInput(this.inputDate!));
      this.inputDate.addEventListener('input', () => this.validarInput(this.inputDate!));
    }
  }

  @HostListener('change')
  @HostListener('input')
  validarHost() {
    if (this.selectorFecha) {
      this.selectorFecha.aplicarModoDesdeDirectiva('no-futura');
      return;
    }
    if (this.inputDate) {
      this.validarInput(this.inputDate);
    }
  }

  private validarInput(input: HTMLInputElement) {
    const hoy = this.obtenerFechaHoyLocal();
    if (input.value && input.value > hoy) {
      input.value = hoy;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  private obtenerFechaHoyLocal(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}