import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { SelectorFechaComponent } from '../selector-fecha/selector-fecha';
import { formatearFechaLocal, obtenerHoyLocal } from '../../utils/fechas.util';

@Component({
  selector: 'app-crear-pelicula',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectorFechaComponent],
  templateUrl: './crear-pelicula.html',
  styleUrls: ['./crear-pelicula.css'],
})
export class CrearPeliculaComponent implements OnInit {
  private peliculasService = inject(PeliculasService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  submitted = signal<boolean>(false);
  subiendoImagen = signal<boolean>(false);
  selectedFile = signal<File | null>(null);

  generos = signal<string[]>([]);
  nuevoGeneroControl = new FormControl('');
  errorGenero = signal<string | null>(null);

  formPelicula = new FormGroup(
    {
      nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
      limite_edad: new FormControl('ATP', [Validators.required]),
      fecha_estreno: new FormControl('', [Validators.required]),
      duracion: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
      sinopsis: new FormControl('', [Validators.required, Validators.minLength(10)]),

      // 🎟️ Configuración de preventa por película
      preventa_activa: new FormControl<boolean>(false),
      dias_preventa: new FormControl<number>(7, [Validators.min(1), Validators.max(60)]),
      porcentaje_preventa: new FormControl<number>(50, [Validators.min(0), Validators.max(500)]),
    },
    { validators: [this.validarPreventaFechaFutura.bind(this)] },
  );

  ngOnInit(): void {
    this.autocompletarDesdePropuesta();

    this.formPelicula.get('fecha_estreno')?.valueChanges.subscribe((fecha) => {
      if (!this.esFechaEstrenoFutura(fecha) && this.formPelicula.get('preventa_activa')?.value) {
        this.formPelicula.patchValue({ preventa_activa: false }, { emitEvent: false });
        this.formPelicula.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  private autocompletarDesdePropuesta(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const statePrecargada = (history.state as any)?.peliculaPrecargada;

    const nombrePropuesto =
      queryParams.get('nombre') || statePrecargada?.nombre || '';
    const sinopsisPropuesta =
      queryParams.get('sinopsis') || statePrecargada?.sinopsis || '';

    if (nombrePropuesto || sinopsisPropuesta) {
      this.formPelicula.patchValue({
        ...(nombrePropuesto ? { nombre: nombrePropuesto.trim() } : {}),
        ...(sinopsisPropuesta ? { sinopsis: sinopsisPropuesta.trim() } : {}),
      });
    }
  }

  onFechaEstrenoSeleccionada(fecha: string): void {
    const control = this.formPelicula.get('fecha_estreno');
    control?.setValue(fecha);
    control?.markAsTouched();
    this.formPelicula.updateValueAndValidity();
  }

  esFechaEstrenoFutura(fecha?: string | Date | null): boolean {
    if (!fecha) return false;
    const fechaFormateada = formatearFechaLocal(fecha);
    if (!fechaFormateada) return false;
    return fechaFormateada > obtenerHoyLocal();
  }

  private validarPreventaFechaFutura(group: AbstractControl): ValidationErrors | null {
    const activa = Boolean(group.get('preventa_activa')?.value);
    const fechaEstreno = group.get('fecha_estreno')?.value as string | null;

    if (activa && !this.esFechaEstrenoFutura(fechaEstreno)) {
      return { preventaFechaInvalida: true };
    }
    return null;
  }

  onTogglePreventa(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const fechaEstreno = this.formPelicula.get('fecha_estreno')?.value;

    if (checked && !this.esFechaEstrenoFutura(fechaEstreno)) {
      this.formPelicula.patchValue({ preventa_activa: false });
      this.formPelicula.markAllAsTouched();
    }
  }

  agregarGenero(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    const valor = (this.nuevoGeneroControl.value || '').trim();
    if (!valor) {
      this.errorGenero.set('Escribe un género antes de agregar.');
      return;
    }

    if (valor.length < 2) {
      this.errorGenero.set('El género debe tener al menos 2 caracteres.');
      return;
    }

    const listaActual = this.generos();
    const yaExiste = listaActual.some((g) => g.toLowerCase() === valor.toLowerCase());
    if (yaExiste) {
      this.errorGenero.set('Ese género ya está en la lista.');
      return;
    }

    this.generos.set([...listaActual, valor]);
    this.nuevoGeneroControl.setValue('');
    this.errorGenero.set(null);
  }

  eliminarGenero(index: number): void {
    const actualizada = this.generos().filter((_, i) => i !== index);
    this.generos.set(actualizada);
    if (actualizada.length > 0) {
      this.errorGenero.set(null);
    }
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
    }
  }

  async guardarPelicula(): Promise<void> {
    this.submitted.set(true);

    if (this.generos().length === 0) {
      this.errorGenero.set('Debes agregar al menos un género a la lista.');
    }

    if (this.formPelicula.invalid || !this.selectedFile() || this.generos().length === 0) {
      this.formPelicula.markAllAsTouched();
      return;
    }

    try {
      this.subiendoImagen.set(true);
      const file = this.selectedFile();

      if (!file) return;

      const urlImagen = await this.peliculasService.subirImagen(file);

      const datos = this.formPelicula.value;
      const fechaEstrenoFormateada = formatearFechaLocal(datos.fecha_estreno!);
      const preventaActiva =
        Boolean(datos.preventa_activa) && this.esFechaEstrenoFutura(fechaEstrenoFormateada);

      await this.peliculasService.agregarPelicula({
        nombre: datos.nombre!,
        fecha_estreno: fechaEstrenoFormateada,
        genero: this.generos(),
        limite_edad: datos.limite_edad!,
        imagen: urlImagen,
        duracion: datos.duracion!,
        sinopsis: datos.sinopsis!,
        preventa_activa: preventaActiva,
        dias_preventa: preventaActiva ? Number(datos.dias_preventa ?? 7) : 7,
        porcentaje_preventa: preventaActiva ? Number(datos.porcentaje_preventa ?? 50) : 50,
      });

      this.router.navigate(['/cartelera']);
    } catch (error: any) {
      console.error('Error al agregar película:', error);
      alert('Ocurrió un error al guardar la película: ' + (error.message || ''));
    } finally {
      this.subiendoImagen.set(false);
    }
  }

  cancelar(): void {
    this.submitted.set(false);
    this.selectedFile.set(null);
    this.generos.set([]);
    this.nuevoGeneroControl.setValue('');
    this.errorGenero.set(null);
    this.formPelicula.reset({
      limite_edad: 'ATP',
      preventa_activa: false,
      dias_preventa: 7,
      porcentaje_preventa: 50,
    });
    this.router.navigate(['/cartelera']);
  }
}