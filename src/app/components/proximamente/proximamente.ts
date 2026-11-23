import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProximamenteService } from '../../services/proximamente.service';
import { PreventaService } from '../../services/preventa.service';
import { Pelicula } from '../../models/pelicula.model';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-proximamente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './proximamente.html',
  styleUrls: ['./proximamente.css'],
})
export class ProximamenteComponent implements OnInit {
  proximamenteService = inject(ProximamenteService);
  private preventaService = inject(PreventaService);
  private router = inject(Router);

  peliculasOriginales = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);
  usuarioId = signal<string | null>(null);

  // 🌟 Buscador y filtros por género iguales a Cartelera
  filtroTexto = signal<string>('');
  generoSeleccionado = signal<string>('TODOS');
  generosDisponibles = signal<string[]>([]);

  peliculasFiltradas = computed(() => {
    const texto = this.filtroTexto().toLowerCase().trim();
    const generoGen = this.generoSeleccionado();

    return this.peliculasOriginales().filter((pelicula) => {
      const coincideTexto = (pelicula.nombre || '').toLowerCase().includes(texto);

      if (generoGen === 'TODOS') {
        return coincideTexto;
      }

      const generosPelicula = this.obtenerListaGeneros(pelicula.genero);
      return coincideTexto && generosPelicula.includes(generoGen);
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      this.cargando.set(true);

      const { data } = await supabase.auth.getUser();
      const uId = data?.user?.id || null;
      this.usuarioId.set(uId);

      if (uId) {
        await this.proximamenteService.cargarAlertasUsuario(uId);
        await this.proximamenteService.verificarEntradasDisponibles(uId);
      }

      const lista = await this.proximamenteService.obtenerPeliculasProximamente();
      this.peliculasOriginales.set(lista);
      this.extraerGenerosUnicos(lista);
    } catch (error) {
      console.error('Error al cargar próximamente:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  private obtenerListaGeneros(genero: Pelicula['genero']): string[] {
    if (!genero) return [];
    if (Array.isArray(genero)) {
      return genero.map((g) => String(g).trim()).filter(Boolean);
    }
    return String(genero)
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
  }

  formatearGeneros(genero: Pelicula['genero']): string {
    const lista = this.obtenerListaGeneros(genero);
    return lista.length > 0 ? lista.join(', ') : 'General';
  }

  private extraerGenerosUnicos(lista: Pelicula[]): void {
    const generosSet = new Set<string>();
    lista.forEach((p) => {
      this.obtenerListaGeneros(p.genero).forEach((g) => generosSet.add(g));
    });
    this.generosDisponibles.set(['TODOS', ...Array.from(generosSet)]);
  }

  seleccionarGenero(genero: string): void {
    this.generoSeleccionado.set(genero);
  }

  trackByPelicula(index: number, pelicula: Pelicula): string | undefined {
    return pelicula.id;
  }

  verDetalle(id?: string): void {
    if (id) {
      this.router.navigate(['/peliculas', id]);
    }
  }

  tieneAlerta(peliculaId: string): boolean {
    return this.proximamenteService.alertasActivasIds().has(peliculaId);
  }

  estadoPreventa(pelicula: Pelicula) {
    return this.preventaService.evaluarPeliculaYFuncion(pelicula, null);
  }

  async alternarAlerta(event: Event, pelicula: Pelicula): Promise<void> {
    event.stopPropagation();

    const uId = this.usuarioId();
    if (!uId) {
      alert('Inicia sesión para activar alertas de estreno.');
      return;
    }

    await this.proximamenteService.toggleAlertaEstreno(uId, pelicula);
  }
}