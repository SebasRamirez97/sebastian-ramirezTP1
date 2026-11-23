import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { FormatoSala } from '../../models/funcion.model';
import { SelectorFechaComponent } from '../selector-fecha/selector-fecha'; // 👈 Importamos el selector de fecha
import { NoFechaPasadaDirective } from '../../directives/no-fecha-pasada.directive';
@Component({
  selector: 'app-crear-funcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectorFechaComponent, NoFechaPasadaDirective], // 👈 Agregado a los imports
  templateUrl: './crear-funcion.html',
  styleUrls: ['./crear-funcion.css'],
})
export class CrearFuncionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);

  funcionForm!: FormGroup;
  
  peliculas = signal<Pelicula[]>([]);
  formatos = signal<FormatoSala[]>(['2D', '3D', '4D', '5D']);
  idiomas = signal<string[]>(['Castellano', 'Subtitulada']); // 👈 Opciones de idioma
  
  cargando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  // Variable auxiliar para almacenar la fecha que emite el SelectorFechaComponent (Formato YYYY-MM-DD o similar)
  private fechaSeleccionadaStr: string = '';

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarPeliculas();

    // Cada vez que cambie la hora_inicio, verificamos si la fecha es hoy y no es pasada
    this.funcionForm.get('hora_inicio')?.valueChanges.subscribe(() => {
      this.validarHoraSiEsHoy();
    });
  }

  private inicializarFormulario(): void {
    this.funcionForm = this.fb.group({
      pelicula_id: ['', [Validators.required]],
      formato: ['2D', [Validators.required]],
      idioma: ['Castellano', [Validators.required]], // 👈 Nuevo campo idioma
      hora_inicio: ['18:00', [Validators.required]],   // 👈 Hora separada para combinar con la fecha
      precio_pesos: [0, [Validators.required, Validators.min(0)]],
      precio_puntos: [0, [Validators.required, Validators.min(0)]],
    });
  }

  async cargarPeliculas(): Promise<void> {
    try {
      const data = await this.peliculasService.getPeliculas();
      this.peliculas.set(data);
    } catch (error) {
      this.mensajeError.set('Error al cargar el catálogo de películas.');
    }
  }

  // 🌟 Captura la fecha emitida por el SelectorFechaComponent
  onFechaCambiada(fecha: string): void {
    this.fechaSeleccionadaStr = fecha;
    this.validarHoraSiEsHoy();
  }

  private validarHoraSiEsHoy(): void {
    const fechaISO = this.normalizarFechaISO(this.fechaSeleccionadaStr);
    const hoyISO = this.obtenerFechaHoyLocal();

    if (!fechaISO || fechaISO !== hoyISO) {
      return; // Si es una fecha futura, cualquier horario es válido
    }

    const horaControl = this.funcionForm.get('hora_inicio');
    const horaIngresada = horaControl?.value;
    if (!horaIngresada) return;

    const horaActual = this.obtenerHoraActualLocal(); // formato "HH:mm"
    if (horaIngresada < horaActual) {
      horaControl?.setValue(horaActual, { emitEvent: false });
    }
  }

  private obtenerFechaHoyLocal(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private obtenerHoraActualLocal(): string {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    return `${horas}:${minutos}`;
  }

  // Soporta tanto "YYYY-MM-DD" como "DD/MM/YYYY" por si formatearFechaLocal devuelve barras
  private normalizarFechaISO(fecha: string): string {
    if (!fecha) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    const partes = fecha.split('/');
    if (partes.length === 3) {
      const [dia, mes, anio] = partes;
      return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    return fecha;
  }



  trackByPelicula(index: number, pelicula: Pelicula): string | undefined {
    return pelicula.id;
  }

  trackByFormato(index: number, fmt: string): string {
    return fmt;
  }

  trackByIdioma(index: number, idioma: string): string {
    return idioma;
  }

  async onSubmit(): Promise<void> {
    if (this.funcionForm.invalid || !this.fechaSeleccionadaStr) {
      this.funcionForm.markAllAsTouched();
      if (!this.fechaSeleccionadaStr) {
        this.mensajeError.set('Debes seleccionar una fecha válida.');
      }
      return;
    }

    // Forzamos la validación del horario si la fecha elegida es hoy antes de armar el DTO
    this.validarHoraSiEsHoy();

    this.cargando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    try {
      const formValue = this.funcionForm.value;
      const fechaISO = this.normalizarFechaISO(this.fechaSeleccionadaStr);

      // Unimos la fecha normalizada (YYYY-MM-DD) con la hora ingresada (ej: "2026-11-22" + "T" + "18:00:00")
      const fechaHoraCompleta = `${fechaISO}T${formValue.hora_inicio}:00`;
      const fechaDate = new Date(fechaHoraCompleta);

      if (isNaN(fechaDate.getTime())) {
        throw new Error('La fecha u hora seleccionada no es válida.');
      }

      const dto = {
        pelicula_id: formValue.pelicula_id,
        formato: formValue.formato,
        idioma: formValue.idioma,
        fecha_inicio: fechaDate.toISOString(),
        precio_pesos: formValue.precio_pesos,
        precio_puntos: formValue.precio_puntos,
      };

      const nuevaFuncion = await this.funcionesService.crearFuncion(dto);

      this.mensajeExito.set(
        `¡Función creada con éxito! Se le asignó automáticamente la sala ID: ${nuevaFuncion.sala_id}.`
      );
      this.funcionForm.patchValue({
        formato: '2D',
        idioma: 'Castellano',
        precio_pesos: 0,
        precio_puntos: 0,
      });
      this.fechaSeleccionadaStr = '';
    } catch (err: any) {
      this.mensajeError.set(err.message || 'Ocurrió un error al intentar crear la función.');
    } finally {
      this.cargando.set(false);
    }
  }

  onCancelar(): void {
    this.funcionForm.reset({ formato: '2D', idioma: 'Castellano', hora_inicio: '18:00', precio_pesos: 0, precio_puntos: 0 });
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
    this.fechaSeleccionadaStr = '';
  }
}