import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // 👈 Importante para [(ngModel)] del buscador
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule, FormsModule], // 👈 Añadido FormsModule
  templateUrl: './cartelera.html',
  styleUrls: ['./cartelera.css']
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
  generosDisponibles = signal<string[]>([]);

  async ngOnInit() {
    try {
      this.cargando.set(true);
      const data = await this.peliculasService.getPeliculas();
      this.peliculasOriginales.set(data);
      this.extraerGenerosUnicos(data);
    } catch (error) {
      console.error('Error al cargar cartelera:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  // 🌟 Extraer dinámicamente todos los géneros únicos (soporta múltiples géneros separados por comas o arrays)
  private extraerGenerosUnicos(lista: Pelicula[]) {
    const generosSet = new Set<string>();
    lista.forEach(p => {
      if (p.genero) {
        // Soporta si viene como "Acción, Drama" o como array
        const generosArray = Array.isArray(p.genero) 
          ? p.genero 
          : p.genero.split(',').map(g => g.trim());
        
        generosArray.forEach(g => {
          if (g) generosSet.add(g);
        });
      }
    });
    this.generosDisponibles.set(['TODOS', ...Array.from(generosSet)]);
  }

  // 🌟 Computed Signal para filtrar dinámicamente por título y género de manera reactiva
  peliculasFiltradas = computed(() => {
    const texto = this.filtroTexto().toLowerCase().trim();
    const generoGen = this.generoSeleccionado();

    return this.peliculasOriginales().filter(pelicula => {
      // Filtro por título
      const coincideTexto = pelicula.nombre.toLowerCase().includes(texto);

      // Filtro por género (comprobando si la película contiene el género seleccionado)
      if (generoGen === 'TODOS') {
        return coincideTexto;
      }

      const generosPelicula = Array.isArray(pelicula.genero)
        ? pelicula.genero
        : (pelicula.genero || '').split(',').map(g => g.trim());

      const coincideGenero = generosPelicula.includes(generoGen);

      return coincideTexto && coincideGenero;
    });
  });

  // Cambiar categoría de género al hacer clic en los pulsadores
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