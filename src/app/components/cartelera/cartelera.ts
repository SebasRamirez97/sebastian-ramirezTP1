import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cartelera.html',
  styleUrls: ['./cartelera.css'],
})
export class CarteleraComponent implements OnInit {
  private peliculasService = inject(PeliculasService);
  private router = inject(Router);

  // Estados principales
  peliculasOriginales = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);

  // 🌟 Estados del buscador y filtros
  filtroTexto = signal<string>('');
  generoSeleccionado = signal<string>('TODOS');

  // 🌟 Películas válidas para cartelera (estrenadas o en preventa activa)
  peliculasEnCartelera = computed<Pelicula[]>(() =>
    this.peliculasOriginales().filter((p) => this.peliculasService.esVisibleEnCartelera(p)),
  );

  // 🌟 Géneros extraídos reactivamente de las películas en cartelera
  generosDisponibles = computed<string[]>(() => {
    const generosSet = new Set<string>();
    this.peliculasEnCartelera().forEach((p) => {
      if (p.genero) {
        const generosArray = Array.isArray(p.genero)
          ? p.genero
          : p.genero.split(',').map((g) => g.trim());

        generosArray.forEach((g) => {
          if (g) generosSet.add(g);
        });
      }
    });
    return ['TODOS', ...Array.from(generosSet)];
  });

  async ngOnInit() {
    try {
      this.cargando.set(true);
      const data = await this.peliculasService.getPeliculas();
      this.peliculasOriginales.set(data || []);
    } catch (error) {
      console.error('Error al cargar cartelera:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  esPeliculaEnPreventa(pelicula: Pelicula): boolean {
    return this.peliculasService.estaEnPreventaActiva(pelicula);
  }

  // 🌟 Computed Signal para filtrar dinámicamente por título y género sobre las películas en cartelera
  peliculasFiltradas = computed(() => {
    const texto = this.filtroTexto().toLowerCase().trim();
    const generoGen = this.generoSeleccionado();

    return this.peliculasEnCartelera().filter((pelicula) => {
      const coincideTexto = (pelicula.nombre || '').toLowerCase().includes(texto);

      if (generoGen === 'TODOS') {
        return coincideTexto;
      }

      const generosPelicula = Array.isArray(pelicula.genero)
        ? pelicula.genero
        : (pelicula.genero || '').split(',').map((g) => g.trim());

      const coincideGenero = generosPelicula.includes(generoGen);

      return coincideTexto && coincideGenero;
    });
  });

  seleccionarGenero(genero: string) {
    this.generoSeleccionado.set(genero);
  }

  trackByPelicula(index: number, pelicula: Pelicula): string | undefined {
    return pelicula.id;
  }

  verDetalle(id?: string) {
    if (id) {
      this.router.navigate(['/peliculas', id]);
    }
  }
}