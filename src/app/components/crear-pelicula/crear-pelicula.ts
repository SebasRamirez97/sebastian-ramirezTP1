import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';

@Component({
  selector: 'app-crear-pelicula',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-pelicula.html',
  styleUrls: ['./crear-pelicula.css']
})
export class CrearPeliculaComponent {
  private peliculasService = inject(PeliculasService);
  private router = inject(Router);

  submitted = signal<boolean>(false);
  subiendoImagen = signal<boolean>(false);
  selectedFile = signal<File | null>(null);

  // 🎭 Lista de géneros y control auxiliar para agregar de a uno
  generos = signal<string[]>([]);
  nuevoGeneroControl = new FormControl('');
  errorGenero = signal<string | null>(null);

  formPelicula = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    limite_edad: new FormControl('ATP', [Validators.required]),
    fecha_estreno: new FormControl('', [Validators.required]),
    duracion: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    sinopsis: new FormControl('', [Validators.required, Validators.minLength(10)]),

    // 🎟️ Configuración de preventa por película
    preventa_activa: new FormControl<boolean>(false),
    dias_preventa: new FormControl<number>(7, [Validators.min(1), Validators.max(60)]),
    precio_preventa_pesos: new FormControl<number | null>(null, [Validators.min(0)]),
    precio_preventa_puntos: new FormControl<number | null>(null, [Validators.min(0)]),
  });

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

      // 1. Subir imagen a Supabase Storage
      const urlImagen = await this.peliculasService.subirImagen(file);

      // 2. Guardar película incluyendo la lista de géneros y preventa
      const datos = this.formPelicula.value;
      const preventaActiva = Boolean(datos.preventa_activa);

      await this.peliculasService.agregarPelicula({
        nombre: datos.nombre!,
        fecha_estreno: datos.fecha_estreno!,
        genero: this.generos(),
        limite_edad: datos.limite_edad!,
        imagen: urlImagen,
        duracion: datos.duracion!,
        sinopsis: datos.sinopsis!,
        preventa_activa: preventaActiva,
        dias_preventa: preventaActiva ? Number(datos.dias_preventa ?? 7) : 7,
        precio_preventa_pesos:
          preventaActiva && datos.precio_preventa_pesos != null
            ? Number(datos.precio_preventa_pesos)
            : null,
        precio_preventa_puntos:
          preventaActiva && datos.precio_preventa_puntos != null
            ? Number(datos.precio_preventa_puntos)
            : null,
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
    });
    this.router.navigate(['/cartelera']);
  }
}