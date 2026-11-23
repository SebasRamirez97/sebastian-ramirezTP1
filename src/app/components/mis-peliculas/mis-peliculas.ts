import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../services/supabaseClient';

export interface PeliculaVistaItem {
  pelicula_id: string;
  nombre: string;
  poster_url: string;
  genero: string[] | string;
  limite_edad?: string;
  duracion?: number;
  fecha_vista: string;
  calificacion: number | null;
}

@Component({
  selector: 'app-mis-peliculas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-peliculas.html',
  styleUrls: ['./mis-peliculas.css'],
})
export class MisPeliculasComponent implements OnInit {
  private usuarioId: string | null = null;
  historial = signal<PeliculaVistaItem[]>([]);
  cargando = signal<boolean>(true);

  // 🌟 Buscador y filtros por género (mismo formato que Cartelera)
  filtroTexto = signal<string>('');
  generoSeleccionado = signal<string>('TODOS');
  generosDisponibles = signal<string[]>([]);

  peliculasFiltradas = computed(() => {
    const texto = this.filtroTexto().toLowerCase().trim();
    const generoGen = this.generoSeleccionado();

    return this.historial().filter((item) => {
      const coincideTexto = (item.nombre || '').toLowerCase().includes(texto);

      if (generoGen === 'TODOS') {
        return coincideTexto;
      }

      const generosItem = this.obtenerListaGeneros(item.genero);
      return coincideTexto && generosItem.includes(generoGen);
    });
  });

  async ngOnInit(): Promise<void> {
    const { data } = await supabase.auth.getUser();
    this.usuarioId = data?.user?.id || null;

    if (!this.usuarioId) {
      this.cargando.set(false);
      return;
    }

    await this.cargarHistorial();
  }

  private obtenerListaGeneros(genero: string[] | string | undefined): string[] {
    if (!genero) return [];
    if (Array.isArray(genero)) {
      return genero.map((g) => String(g).trim()).filter(Boolean);
    }
    return String(genero)
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
  }

  formatearGeneros(genero: string[] | string | undefined): string {
    const lista = this.obtenerListaGeneros(genero);
    return lista.length > 0 ? lista.join(', ') : 'General';
  }

  private extraerGenerosUnicos(lista: PeliculaVistaItem[]): void {
    const generosSet = new Set<string>();
    lista.forEach((item) => {
      this.obtenerListaGeneros(item.genero).forEach((g) => generosSet.add(g));
    });
    this.generosDisponibles.set(['TODOS', ...Array.from(generosSet)]);
  }

  seleccionarGenero(genero: string): void {
    this.generoSeleccionado.set(genero);
  }

  trackByPelicula(index: number, item: PeliculaVistaItem): string {
    return item.pelicula_id;
  }

  async cargarHistorial(): Promise<void> {
    try {
      this.cargando.set(true);

      // Solo órdenes aprobadas ('aprobado') y entradas verificadas/retiradas ('retirado')
      const { data: ordenes, error } = await supabase
        .from('ordenes')
        .select(`
          created_at,
          estado,
          entradas (
            id,
            estado,
            funciones (
              fecha_hora,
              peliculas (
                id,
                nombre,
                imagen,
                poster_url,
                imagen_url,
                genero,
                limite_edad,
                duracion
              )
            )
          )
        `)
        .eq('usuario_id', this.usuarioId)
        .eq('estado', 'aprobado')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: calificaciones } = await supabase
        .from('calificaciones_peliculas')
        .select('pelicula_id, calificacion')
        .eq('usuario_id', this.usuarioId);

      const mapaCalif = new Map<string, number>();
      (calificaciones || []).forEach((c: any) => {
        mapaCalif.set(c.pelicula_id, Number(c.calificacion));
      });

      const mapaUnico = new Map<string, PeliculaVistaItem>();

      (ordenes || []).forEach((orden: any) => {
        (orden.entradas || []).forEach((entrada: any) => {
          if (entrada?.estado !== 'retirado') return;

          const peli = entrada?.funciones?.peliculas;
          if (!peli?.id) return;

          if (!mapaUnico.has(peli.id)) {
            mapaUnico.set(peli.id, {
              pelicula_id: peli.id,
              nombre: peli.nombre,
              poster_url: peli.imagen || peli.poster_url || peli.imagen_url || '',
              genero: peli.genero || 'General',
              limite_edad: peli.limite_edad || 'ATP',
              duracion: peli.duracion,
              fecha_vista: entrada?.funciones?.fecha_hora || orden.created_at,
              calificacion: mapaCalif.get(peli.id) ?? null,
            });
          }
        });
      });

      const listaFinal = Array.from(mapaUnico.values());
      this.historial.set(listaFinal);
      this.extraerGenerosUnicos(listaFinal);
    } finally {
      this.cargando.set(false);
    }
  }

  async calificar(item: PeliculaVistaItem, puntuacion: number): Promise<void> {
    if (!this.usuarioId) return;

    const { error } = await supabase
      .from('calificaciones_peliculas')
      .upsert(
        [
          {
            usuario_id: this.usuarioId,
            pelicula_id: item.pelicula_id,
            calificacion: puntuacion,
            fecha_vista: item.fecha_vista,
          },
        ],
        { onConflict: 'usuario_id,pelicula_id' },
      );

    if (!error) {
      const actualizados = this.historial().map((h) =>
        h.pelicula_id === item.pelicula_id ? { ...h, calificacion: puntuacion } : h,
      );
      this.historial.set(actualizados);
    }
  }
}