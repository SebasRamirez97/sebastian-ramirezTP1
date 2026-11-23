import { Directive, ElementRef, HostListener, OnInit, inject } from '@angular/core';
import { SelectorFechaComponent } from '../components/selector-fecha/selector-fecha'; // ajustá la ruta

@Directive({
  selector: '[appNoFechaPasada]',
  standalone: true,
})
export class NoFechaPasadaDirective implements OnInit {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private selectorFecha = inject(SelectorFechaComponent, { optional: true, host: true });

  ngOnInit() {
    if (this.selectorFecha) {
      this.selectorFecha.aplicarModoDesdeDirectiva('no-pasada');
      return;
    }

    const native = this.el.nativeElement as HTMLInputElement;
    if ('min' in native) {
      native.min = this.obtenerFechaHoyLocal();
    }
  }

  @HostListener('change')
  @HostListener('input')
  validarFecha() {
    if (this.selectorFecha) {
      this.selectorFecha.aplicarModoDesdeDirectiva('no-pasada');
      return;
    }

    const hoy = this.obtenerFechaHoyLocal();
    const input = this.el.nativeElement as HTMLInputElement;

    if (input.value && input.value < hoy) {
      input.value = hoy;
      input.dispatchEvent(new Event('input', { bubbles: true }));
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