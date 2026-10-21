import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private peliculasService = inject(PeliculasService);
  private router = inject(Router);

  // 🔹 Declaración de estados usando Signals (adiós a ChangeDetectorRef)
  topPeliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);

  async ngOnInit() {
    try {
      this.cargando.set(true);
      const data = await this.peliculasService.getTopPeliculas(3);
      this.topPeliculas.set(data);
    } catch (error) {
      console.error('Error al cargar top películas:', error);
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

  verCarteleraCompleta() {
    this.router.navigate(['/cartelera']);
  }
}