import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { formatearFechaLocal } from '../../utils/fechas.util';

@Component({
  selector: 'app-selector-fecha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selector-fecha.html',
  styleUrls: ['./selector-fecha.css']
})
export class SelectorFechaComponent {
  @Output() fechaSeleccionada = new EventEmitter<string>();

  dia: number | null = null;
  mes: number | null = null;
  anio: number | null = null;

  // Días del 1 al 31
  diasDisponibles: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
  maxDias: number = 31;

  // Meses en números (del 1 al 12)
  meses = [
    { id: 1, nombre: '1 - Enero' },
    { id: 2, nombre: '2 - Febrero' },
    { id: 3, nombre: '3 - Marzo' },
    { id: 4, nombre: '4 - Abril' },
    { id: 5, nombre: '5 - Mayo' },
    { id: 6, nombre: '6 - Junio' },
    { id: 7, nombre: '7 - Julio' },
    { id: 8, nombre: '8 - Agosto' },
    { id: 9, nombre: '9 - Septiembre' },
    { id: 10, nombre: '10 - Octubre' },
    { id: 11, nombre: '11 - Noviembre' },
    { id: 12, nombre: '12 - Diciembre' }
  ];

  // Años: Desde el año siguiente hasta 121 años atrás
  aniosDisponibles: number[] = (() => {
    const anioActual = new Date().getFullYear();
    const anioInicio = anioActual + 1; // Año siguiente
    const anioFin = anioActual - 120;   // 121 años atrás
    const lista = [];
    for (let i = anioInicio; i >= anioFin; i--) {
      lista.push(i);
    }
    return lista;
  })();

  onMesChange() {
    this.calcularMaxDias();
    if (this.dia && this.dia > this.maxDias) {
      this.dia = null; // Reinicia el día si excede el nuevo límite del mes
    }
    this.emitirFecha();
  }

  onAnioChange() {
    this.calcularMaxDias();
    if (this.dia && this.dia > this.maxDias) {
      this.dia = null;
    }
    this.emitirFecha();
  }

  calcularMaxDias() {
    if (!this.mes) {
      this.maxDias = 31;
      return;
    }

    const mesNum = Number(this.mes);

    // Meses con 30 días
    if ([4, 6, 9, 11].includes(mesNum)) {
      this.maxDias = 30;
    } 
    // Febrero (Mes 2) -> Lógica de Año Bisiesto
    else if (mesNum === 2) {
      if (this.anio && this.esBisiesto(Number(this.anio))) {
        this.maxDias = 29; // Habilita hasta el 29
      } else {
        this.maxDias = 28; // Bloquea 29, 30 y 31 automáticamente
      }
    } 
    // Meses con 31 días
    else {
      this.maxDias = 31;
    }
  }

  esBisiesto(anio: number): boolean {
    return (anio % 4 === 0 && anio % 100 !== 0) || (anio % 400 === 0);
  }

  emitirFecha() {
    if (this.dia && this.mes && this.anio) {
      const d = String(this.dia).padStart(2, '0');
      const m = String(this.mes).padStart(2, '0');
      const a = this.anio;

      const fechaCruda = `${a}-${m}-${d}`;

      const fechaLimpia = formatearFechaLocal(fechaCruda);

      this.fechaSeleccionada.emit(fechaLimpia);
    }
  }
}