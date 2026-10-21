import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartelera.html',
  styleUrls: ['./cartelera.css']
})
export class CarteleraComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private peliculasService = inject(PeliculasService);
  private router = inject(Router);

  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  peliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);

  async ngOnInit() {
    try {
      this.cargando.set(true);
      const data = await this.peliculasService.getPeliculas();
      this.peliculas.set(data);
    } catch (error) {
      console.error('Error al cargar cartelera:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  // 🔹 Función trackBy requerida para *ngFor
  trackByPelicula(index: number, pelicula: Pelicula): string | undefined {
    return pelicula.id;
  }

  verDetalle(id?: string) {
    if (id) {
      this.router.navigate(['/peliculas', id]);
    }
  }
}