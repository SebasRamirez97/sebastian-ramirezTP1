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
  // 🔹 Inyección moderna con inject()
  private peliculasService = inject(PeliculasService);
  private router = inject(Router);

  // 🔹 Definición de estados con Signals
  submitted = signal<boolean>(false);
  subiendoImagen = signal<boolean>(false);
  selectedFile = signal<File | null>(null);

  formPelicula = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    fecha_estreno: new FormControl('', [Validators.required]),
    duracion: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    sinopsis: new FormControl('', [Validators.required, Validators.minLength(10)])
  });

  // 🔹 Captura el archivo seleccionado desde el input HTML
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
    }
  }

  async guardarPelicula(): Promise<void> {
    this.submitted.set(true);

    // Valida formulario e imagen
    if (this.formPelicula.invalid || !this.selectedFile()) {
      this.formPelicula.markAllAsTouched();
      return;
    }

    try {
      this.subiendoImagen.set(true);
      const file = this.selectedFile();

      if (!file) return;

      // 1. Subir imagen a Supabase Storage
      const urlImagen = await this.peliculasService.subirImagen(file);

      // 2. Guardar película con la URL obtenida
      const datos = this.formPelicula.value;
      await this.peliculasService.agregarPelicula({
        nombre: datos.nombre!,
        fecha_estreno: datos.fecha_estreno!,
        imagen: urlImagen,
        duracion: datos.duracion!,
        sinopsis: datos.sinopsis!
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
    this.formPelicula.reset();
    this.router.navigate(['/cartelera']);
  }
}