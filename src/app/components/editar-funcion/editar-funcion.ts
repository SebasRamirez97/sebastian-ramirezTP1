import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  funcionForm!: FormGroup;
  peliculas: Pelicula[] = [];
  formatos: FormatoSala[] = ['2D', '3D', '4D', '5D'];
  
  funcionId!: string;
  cargando: boolean = true;
  guardando: boolean = false;
  mensajeExito: string | null = null;
  mensajeError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private funcionesService: FuncionesService,
    private peliculasService: PeliculasService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.inicializarFormulario();
    this.funcionId = this.route.snapshot.paramMap.get('id') || '';

    await this.cargarPeliculas();
    if (this.funcionId) {
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
      this.peliculas = await this.peliculasService.getPeliculas();
      this.cdr.detectChanges();
    } catch (error) {
      this.mensajeError = 'Error al cargar el catálogo de películas.';
      this.cdr.detectChanges();
    }
  }

  async cargarDatosFuncion(): Promise<void> {
    try {
      this.cargando = true;
      this.cdr.detectChanges();

      const funcion = await this.funcionesService.getFuncionPorId(this.funcionId);
      
      // Adaptar la fecha al formato que acepta el input type="datetime-local" (YYYY-MM-DDTHH:mm)
      let fechaLocal = '';
      if (funcion.fecha_inicio) {
        fechaLocal = new Date(funcion.fecha_inicio).toISOString().slice(0, 16);
      }

      // Parcheamos el formulario con los datos actuales
      this.funcionForm.patchValue({
        pelicula_id: funcion.pelicula_id,
        formato: funcion.formato,
        fecha_inicio: fechaLocal,
        precio_pesos: funcion.precio_pesos,
        precio_puntos: funcion.precio_puntos,
      });

    } catch (error: any) {
      this.mensajeError = error.message || 'Error al obtener los datos de la función.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async onSubmit(): Promise<void> {
    if (this.funcionForm.invalid) {
      this.funcionForm.markAllAsTouched();
      return;
    }

    this.guardando = true;
    this.mensajeExito = null;
    this.mensajeError = null;
    this.cdr.detectChanges();

    try {
      const formValue = this.funcionForm.value;

      const dto = {
        ...formValue,
        fecha_inicio: new Date(formValue.fecha_inicio).toISOString(),
      };

      await this.funcionesService.actualizarFuncion(this.funcionId, dto);

      this.mensajeExito = '¡Función actualizada con éxito!';
      this.cdr.detectChanges();

      // Opcional: Redirigir a la lista de funciones después de 1.5 segundos
      setTimeout(() => {
        this.router.navigate(['/lista-funciones']);
      }, 1500);

    } catch (err: any) {
      this.mensajeError = err.message || 'Ocurrió un error al intentar actualizar la función.';
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }
}