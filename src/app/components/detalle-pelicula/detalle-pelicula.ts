import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { AuthService } from '../../services/auth.service'; // 👈 Ajusta la ruta de tu servicio de auth

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detalle-pelicula.html',
  styleUrls: ['./detalle-pelicula.css'],
})
export class DetallePeliculaComponent implements OnInit, OnDestroy {
  pelicula: Pelicula | null = null;
  peliculaEditada: Partial<Pelicula> = {};
  cargando: boolean = true;
  modoEdicion: boolean = false;

  rol: string = ''; // 👈 Variable para almacenar el rol actual
  private rolSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peliculasService: PeliculasService,
    private authService: AuthService, // 👈 Inyectamos AuthService
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    // 🔹 Suscribirse a los cambios de rol en tiempo real
    this.rolSub = this.authService.rol$.subscribe((nuevoRol) => {
      this.rol = nuevoRol;
      this.cdr.detectChanges();
    });

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.cargando = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      this.pelicula = await this.peliculasService.getPeliculaPorId(id);
    } catch (error) {
      console.error('❌ Error al cargar el detalle de la película:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    // 🔹 Limpiar la suscripción para evitar fugas de memoria
    if (this.rolSub) {
      this.rolSub.unsubscribe();
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
      this.router.navigate(['/peliculas', this.pelicula.id, 'funciones']);
    }
  }

  volver() {
    this.router.navigate(['/cartelera']);
  }
}
