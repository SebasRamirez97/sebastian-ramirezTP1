import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { FormatoSala } from '../../models/funcion.model';

@Component({
  selector: 'app-crear-funcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-funcion.html',
  styleUrls: ['./crear-funcion.css'],
})
export class CrearFuncionComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private fb = inject(FormBuilder);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);

  funcionForm!: FormGroup;
  
  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  peliculas = signal<Pelicula[]>([]);
  formatos = signal<FormatoSala[]>(['2D', '3D', '4D', '5D']);
  cargando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarPeliculas();
  }

  private inicializarFormulario(): void {
    this.funcionForm = this.fb.group({
      pelicula_id: ['', [Validators.required]],
      formato: ['2D', [Validators.required]],
      fecha_inicio: ['', [Validators.required]],
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

  // 🔹 Función trackBy para *ngFor de películas y formatos
  trackByPelicula(index: number, pelicula: Pelicula): string | undefined {
    return pelicula.id;
  }

  trackByFormato(index: number, fmt: string): string {
    return fmt;
  }

  async onSubmit(): Promise<void> {
    if (this.funcionForm.invalid) {
      this.funcionForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    try {
      const formValue = this.funcionForm.value;

      const dto = {
        ...formValue,
        fecha_inicio: new Date(formValue.fecha_inicio).toISOString(),
      };

      const nuevaFuncion = await this.funcionesService.crearFuncion(dto);

      this.mensajeExito.set(`¡Función creada con éxito! Se le asignó automáticamente la sala ID: ${nuevaFuncion.sala_id}.`);
      this.funcionForm.reset({
        formato: '2D',
        precio_pesos: 0,
        precio_puntos: 0,
      });
    } catch (err: any) {
      this.mensajeError.set(err.message || 'Ocurrió un error al intentar crear la función.');
    } finally {
      this.cargando.set(false);
    }
  }

  onCancelar(): void {
    this.funcionForm.reset();
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }
}