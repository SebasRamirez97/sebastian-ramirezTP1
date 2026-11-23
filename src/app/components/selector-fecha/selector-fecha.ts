import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { formatearFechaLocal } from '../../utils/fechas.util';

export type ModoRestriccionFecha = 'ninguna' | 'no-futura' | 'no-pasada';

@Component({
  selector: 'app-selector-fecha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selector-fecha.html',
  styleUrls: ['./selector-fecha.css']
})
export class SelectorFechaComponent implements OnInit, OnChanges {
  @Input() modoRestriccion: ModoRestriccionFecha = 'ninguna';
  @Output() fechaSeleccionada = new EventEmitter<string>();

  dia: number | null = null;
  mes: number | null = null;
  anio: number | null = null;

  diasDisponibles: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
  maxDias: number = 31;

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

  aniosDisponibles: number[] = [];

  ngOnInit() {
    this.configurarRangoAnios();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['modoRestriccion']) {
      this.configurarRangoAnios();
      this.validarYEmitir();
    }
  }

  private configurarRangoAnios() {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();

    let anioInicio = anioActual + 5; // Permite fechas futuras por defecto si no hay restricción
    let anioFin = anioActual - 120;

    if (this.modoRestriccion === 'no-futura') {
      // Sin fechas futuras: hasta el año actual
      anioInicio = anioActual;
      anioFin = anioActual - 120;
    } else if (this.modoRestriccion === 'no-pasada') {
      // Sin fechas pasadas: desde el año actual hacia adelante
      anioInicio = anioActual + 5;
      anioFin = anioActual;
    }

    const lista: number[] = [];
    for (let i = anioInicio; i >= anioFin; i--) {
      lista.push(i);
    }
    this.aniosDisponibles = lista;

    if (this.anio !== null && !this.aniosDisponibles.includes(Number(this.anio))) {
      this.anio = null;
    }
  }

  onDiaChange() {
    this.validarYEmitir();
  }

  onMesChange() {
    this.calcularMaxDias();
    if (this.dia !== null && Number(this.dia) > this.maxDias) {
      this.dia = null;
    }
    this.validarYEmitir();
  }

  onAnioChange() {
    this.calcularMaxDias();
    if (this.dia !== null && Number(this.dia) > this.maxDias) {
      this.dia = null;
    }
    this.validarYEmitir();
  }

  calcularMaxDias() {
    if (!this.mes) {
      this.maxDias = 31;
      return;
    }

    const mesNum = Number(this.mes);

    if ([4, 6, 9, 11].includes(mesNum)) {
      this.maxDias = 30;
    } else if (mesNum === 2) {
      if (this.anio && this.esBisiesto(Number(this.anio))) {
        this.maxDias = 29;
      } else {
        this.maxDias = 28;
      }
    } else {
      this.maxDias = 31;
    }
  }

  esBisiesto(anio: number): boolean {
    return (anio % 4 === 0 && anio % 100 !== 0) || (anio % 400 === 0);
  }

  private obtenerHoyISO(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private forzarFechaHoy(): string {
    const ahora = new Date();
    const anioHoy = ahora.getFullYear();
    const mesHoy = ahora.getMonth() + 1;
    const diaHoy = ahora.getDate();

    this.anio = anioHoy;
    this.mes = mesHoy;
    this.calcularMaxDias();
    this.dia = diaHoy;

    setTimeout(() => {
      this.anio = anioHoy;
      this.mes = mesHoy;
      this.calcularMaxDias();
      this.dia = diaHoy;
    }, 0);

    return `${anioHoy}-${String(mesHoy).padStart(2, '0')}-${String(diaHoy).padStart(2, '0')}`;
  }

  private validarYEmitir() {
    if (!this.dia || !this.mes || !this.anio) return;

    const dNum = Number(this.dia);
    const mNum = Number(this.mes);
    const aNum = Number(this.anio);

    let fechaCruda = `${aNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    const hoyISO = this.obtenerHoyISO();

    if (this.modoRestriccion === 'no-futura' && fechaCruda > hoyISO) {
      fechaCruda = this.forzarFechaHoy();
    } else if (this.modoRestriccion === 'no-pasada' && fechaCruda < hoyISO) {
      fechaCruda = this.forzarFechaHoy();
    }

    const fechaLimpia = formatearFechaLocal(fechaCruda);
    this.fechaSeleccionada.emit(fechaLimpia);
  }

  aplicarModoDesdeDirectiva(modo: ModoRestriccionFecha) {
    this.modoRestriccion = modo;
    this.configurarRangoAnios();
    this.validarYEmitir();
  }

  emitirFecha() {
    this.validarYEmitir();
  }
}