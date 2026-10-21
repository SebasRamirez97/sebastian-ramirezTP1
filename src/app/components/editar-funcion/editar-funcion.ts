import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { FormatoSala } from '../../models/funcion.model';

@Component({
  selector: 'app-editar-funcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './editar-funcion.html',
  styleUrls: ['./editar-funcion.css'],
})
export class EditarFuncionComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);

  funcionForm!: FormGroup;
  
  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  peliculas = signal<Pelicula[]>([]);
  formatos = signal<FormatoSala[]>(['2D', '3D', '4D', '5D']);
  
  funcionId = signal<string>('');
  cargando = signal<boolean>(true);
  guardando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.inicializarFormulario();
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.funcionId.set(id);

    await this.cargarPeliculas();
    if (this.funcionId()) {
      await this.cargarDatosFuncion();
    }
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

  async cargarDatosFuncion(): Promise<void> {
    try {
      this.cargando.set(true);

      const funcion = await this.funcionesService.getFuncionPorId(this.funcionId());
      
      let fechaLocal = '';
      if (funcion.fecha_inicio) {
        fechaLocal = new Date(funcion.fecha_inicio).toISOString().slice(0, 16);
      }

      this.funcionForm.patchValue({
        pelicula_id: funcion.pelicula_id,
        formato: funcion.formato,
        fecha_inicio: fechaLocal,
        precio_pesos: funcion.precio_pesos,
        precio_puntos: funcion.precio_puntos,
      });

    } catch (error: any) {
      this.mensajeError.set(error.message || 'Error al obtener los datos de la función.');
    } finally {
      this.cargando.set(false);
    }
  }

  // 🔹 Funciones trackBy para las listas en el HTML
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

    this.guardando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    try {
      const formValue = this.funcionForm.value;

      const dto = {
        ...formValue,
        fecha_inicio: new Date(formValue.fecha_inicio).toISOString(),
      };

      await this.funcionesService.actualizarFuncion(this.funcionId(), dto);

      this.mensajeExito.set('¡Función actualizada con éxito!');

      setTimeout(() => {
        this.router.navigate(['/lista-funciones']);
      }, 1500);

    } catch (err: any) {
      this.mensajeError.set(err.message || 'Ocurrió un error al intentar actualizar la función.');
    } finally {
      this.guardando.set(false);
    }
  }
}