import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { FormatoSala } from '../../models/funcion.model';
import { SelectorFechaComponent } from '../selector-fecha/selector-fecha'; // 👈 Importamos el selector de fecha

@Component({
  selector: 'app-crear-funcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectorFechaComponent], // 👈 Agregado a los imports
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

    this.cargando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    try {
      const formValue = this.funcionForm.value;

      // Unimos la fecha seleccionada por el componente con la hora ingresada (ej: "2026-10-15" + "T" + "18:00")
      const fechaHoraCompleta = `${this.fechaSeleccionadaStr}T${formValue.hora_inicio}:00`;

      const dto = {
        pelicula_id: formValue.pelicula_id,
        formato: formValue.formato,
        idioma: formValue.idioma, // 👈 Enviamos el idioma
        fecha_inicio: new Date(fechaHoraCompleta).toISOString(),
        precio_pesos: formValue.precio_pesos,
        precio_puntos: formValue.precio_puntos,
      };

      const nuevaFuncion = await this.funcionesService.crearFuncion(dto);

      this.mensajeExito.set(`¡Función creada con éxito! Se le asignó automáticamente la sala ID: ${nuevaFuncion.sala_id}.`);
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