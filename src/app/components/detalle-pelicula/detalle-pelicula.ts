import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detalle-pelicula.html',
  styleUrls: ['./detalle-pelicula.css'],
})
export class DetallePeliculaComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private peliculasService = inject(PeliculasService);
  private authService = inject(AuthService);

  // 🔹 Convertimos el observable del rol en un Signal de lectura automática
  rol = toSignal(this.authService.rol$, { initialValue: '' });

  // 🔹 Declaración de estados con Signals (adiós a ChangeDetectorRef y subscripciones manuales)
  pelicula = signal<Pelicula | null>(null);
  peliculaEditada = signal<Partial<Pelicula>>({});
  cargando = signal<boolean>(true);
  modoEdicion = signal<boolean>(false);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.cargando.set(false);
      return;
    }

    try {
      const data = await this.peliculasService.getPeliculaPorId(id);
      this.pelicula.set(data);
    } catch (error) {
      console.error('❌ Error al cargar el detalle de la película:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  activarEdicion() {
    const p = this.pelicula();
    if (p) {
      this.modoEdicion.set(true);
      this.peliculaEditada.set({ ...p });
    }
  }

  cancelarEdicion() {
    this.modoEdicion.set(false);
    this.peliculaEditada.set({});
  }

  // Métodos auxiliares para actualizar propiedades individuales desde el HTML con ngModel en Signals
  actualizarCampo(campo: keyof Pelicula, event: any) {
    const valor = event.target.value;
    this.peliculaEditada.update(editada => ({ ...editada, [campo]: valor }));
  }

  async guardarCambios() {
    const p = this.pelicula();
    if (!p?.id) return;

    try {
      const actualizada = await this.peliculasService.actualizarPelicula(
        p.id,
        this.peliculaEditada(),
      );
      this.pelicula.set(actualizada);
      this.modoEdicion.set(false);
      alert('¡Película actualizada correctamente!');
    } catch (error) {
      console.error('Error al actualizar película:', error);
      alert('Error al guardar los cambios.');
    }
  }

  async eliminarPelicula() {
    const p = this.pelicula();
    if (!p?.id) return;

    const confirmar = confirm(`¿Estás seguro de que deseas eliminar "${p.nombre}"?`);
    if (confirmar) {
      try {
        await this.peliculasService.eliminarPelicula(p.id);
        alert('Película eliminada con éxito.');
        this.router.navigate(['/cartelera']);
      } catch (error) {
        console.error('Error al eliminar la película:', error);
        alert('No se pudo eliminar la película.');
      }
    }
  }

  irAFunciones(): void {
    const p = this.pelicula();
    if (p && p.id) {
      this.router.navigate(['/peliculas', p.id, 'funciones']);
    }
  }

  volver() {
    this.router.navigate(['/cartelera']);
  }
}