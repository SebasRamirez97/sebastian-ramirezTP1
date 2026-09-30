// 1. Importar ChangeDetectorRef
import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; 
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
  funcionForm!: FormGroup;
  peliculas: Pelicula[] = [];
  formatos: FormatoSala[] = ['2D', '3D', '4D', '5D'];

  cargando: boolean = false;
  mensajeExito: string | null = null;
  mensajeError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private funcionesService: FuncionesService,
    private peliculasService: PeliculasService,
    private cdr: ChangeDetectorRef // 2. Inyectar ChangeDetectorRef
  ) {}

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
      this.peliculas = await this.peliculasService.getPeliculas();
      
      // 3. Forzar a Angular a actualizar la vista con los nuevos datos
      this.cdr.detectChanges(); 
      
    } catch (error) {
      this.mensajeError = 'Error al cargar el catálogo de películas.';
      this.cdr.detectChanges(); // También lo llamamos aquí por si hay error
    }
  }

  async onSubmit(): Promise<void> {
    if (this.funcionForm.invalid) {
      this.funcionForm.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.mensajeExito = null;
    this.mensajeError = null;
    this.cdr.detectChanges(); // Actualizar vista para mostrar el estado "cargando"

    try {
      const formValue = this.funcionForm.value;

      const dto = {
        ...formValue,
        fecha_inicio: new Date(formValue.fecha_inicio).toISOString(),
      };

      const nuevaFuncion = await this.funcionesService.crearFuncion(dto);

      this.mensajeExito = `¡Función creada con éxito! Se le asignó automáticamente la sala ID: ${nuevaFuncion.sala_id}.`;
      this.funcionForm.reset({
        formato: '2D',
        precio_pesos: 0,
        precio_puntos: 0,
      });
    } catch (err: any) {
      this.mensajeError = err.message || 'Ocurrió un error al intentar crear la función.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // Actualizar vista al terminar el proceso
    }
  }

  onCancelar(): void {
    this.funcionForm.reset();
    this.mensajeExito = '';
    this.mensajeError = '';
  }
}
