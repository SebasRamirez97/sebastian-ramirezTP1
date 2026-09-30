import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detalle-pelicula.html',
  styleUrls: ['./detalle-pelicula.css'],
})
export class DetallePeliculaComponent implements OnInit {
  pelicula: Pelicula | null = null;
  peliculaEditada: Partial<Pelicula> = {};
  cargando: boolean = true;
  esAdmin: boolean = true; // Cambiar según tu lógica de roles/autenticación
  modoEdicion: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peliculasService: PeliculasService,
    private cdr: ChangeDetectorRef, // 👈 1. Inyectamos ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // Obtener el ID desde la URL (ejemplo /peliculas/:id)
    const id = this.route.snapshot.paramMap.get('id');

    console.log('🔍 [1] Buscando película con ID:', id);

    if (!id) {
      console.error('❌ No se encontró ningún ID en la URL');
      this.cargando = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      this.pelicula = await this.peliculasService.getPeliculaPorId(id);
      console.log('✅ [2] Película obtenida:', this.pelicula);
    } catch (error) {
      console.error('❌ [3] Error al cargar el detalle de la película:', error);
    } finally {
      this.cargando = false; // 👈 2. Garantiza que cargando pase a false
      console.log('🏁 [4] Estado cargando finalizado');
      this.cdr.detectChanges(); // 👈 3. Fuerza la actualización de la plantilla
    }
  }

  activarEdicion() {
    if (this.pelicula) {
      this.modoEdicion = true;
      this.peliculaEditada = { ...this.pelicula };
    }
  }

  cancelarEdicion() {
    this.modoEdicion = false;
    this.peliculaEditada = {};
  }

  async guardarCambios() {
    if (!this.pelicula?.id) return;

    try {
      const actualizada = await this.peliculasService.actualizarPelicula(
        this.pelicula.id,
        this.peliculaEditada,
      );
      this.pelicula = actualizada;
      this.modoEdicion = false;
      alert('¡Película actualizada correctamente!');
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al actualizar película:', error);
      alert('Error al guardar los cambios.');
    }
  }

  async eliminarPelicula() {
    if (!this.pelicula?.id) return;

    const confirmar = confirm(`¿Estás seguro de que deseas eliminar "${this.pelicula.nombre}"?`);
    if (confirmar) {
      try {
        await this.peliculasService.eliminarPelicula(this.pelicula.id);
        alert('Película eliminada con éxito.');
        this.router.navigate(['/cartelera']);
      } catch (error) {
        console.error('Error al eliminar la película:', error);
        alert('No se pudo eliminar la película.');
      }
    }
  }

  irAFunciones(): void {
    if (this.pelicula && this.pelicula.id) {
      // Navega a la ruta: /peliculas/123/funciones
      this.router.navigate(['/peliculas', this.pelicula.id, 'funciones']);
    }
  }

  volver() {
    this.router.navigate(['/cartelera']); // O ['/cartelera'] según tu nombre de ruta
  }
}
