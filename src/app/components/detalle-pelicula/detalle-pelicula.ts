import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { AuthService } from '../../services/auth.service';
import { ResenasService } from '../../services/resenas.service';
import { SelectorFechaComponent } from '../selector-fecha/selector-fecha';
import { DateFormatPipe } from '../../pipes/date-format-pipe';
import { supabase } from '../../services/supabaseClient';
import { formatearFechaLocal, obtenerHoyLocal } from '../../utils/fechas.util';

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorFechaComponent, DateFormatPipe],
  templateUrl: './detalle-pelicula.html',
  styleUrls: ['./detalle-pelicula.css'],
})
export class DetallePeliculaComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private peliculasService = inject(PeliculasService);
  private authService = inject(AuthService);
  private resenasService = inject(ResenasService);

  rol = toSignal(this.authService.rol$, { initialValue: '' });

  pelicula = signal<Pelicula | null>(null);
  peliculaEditada = signal<Partial<Pelicula>>({});
  cargando = signal<boolean>(true);
  modoEdicion = signal<boolean>(false);
  guardandoCambios = signal<boolean>(false);
  errorEdicion = signal<string | null>(null);

  // 🖼️ Archivo nuevo de póster y vista previa
  posterArchivoEdicion = signal<File | null>(null);
  posterPreviewUrl = signal<string | null>(null);

  // 🌟 Estados para el manejo de Reseñas
  resenas = signal<any[]>([]);
  usuarioLogueadoId = signal<string | null>(null);
  mostrarFormResena = signal<boolean>(false);
  puntajeSeleccionado = signal<number>(5);
  comentarioInput = signal<string>('');
  resenaExistenteId = signal<string | null>(null);

  generosEditables = signal<string[]>([]);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.cargando.set(false);
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uId = authData?.user?.id || null;
      this.usuarioLogueadoId.set(uId);

      const [peliculaData, resenasData] = await Promise.all([
        this.peliculasService.getPeliculaPorId(id),
        this.resenasService.getResenasPorPelicula(id),
      ]);

      this.pelicula.set(peliculaData);
      this.resenas.set(resenasData);

      if (uId) {
        const miResena = resenasData.find((r: any) => r.cliente_id === uId);
        if (miResena) {
          this.puntajeSeleccionado.set(miResena.puntaje);
          this.comentarioInput.set(miResena.comentario);
          this.resenaExistenteId.set(miResena.id);
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar los datos de la película y reseñas:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.limpiarPreviewPoster();
  }

  private limpiarPreviewPoster(): void {
    const urlActual = this.posterPreviewUrl();
    if (urlActual) {
      URL.revokeObjectURL(urlActual);
      this.posterPreviewUrl.set(null);
    }
    this.posterArchivoEdicion.set(null);
  }

  esFechaEstrenoFutura(fecha?: string | Date | null): boolean {
    if (!fecha) return false;
    const fechaFormateada = formatearFechaLocal(fecha);
    if (!fechaFormateada) return false;
    return fechaFormateada > obtenerHoyLocal();
  }

  seleccionarPuntaje(estrellas: number) {
    this.puntajeSeleccionado.set(estrellas);
  }

  async publicarResena(): Promise<void> {
    const p = this.pelicula();
    const uId = this.usuarioLogueadoId();

    if (!uId) {
      alert('Debes iniciar sesión como cliente para dejar una reseña.');
      return;
    }

    if (!this.comentarioInput().trim()) {
      alert('El comentario no puede estar vacío.');
      return;
    }

    try {
      await this.resenasService.guardarResena(
        p!.id,
        uId,
        this.puntajeSeleccionado(),
        this.comentarioInput().trim(),
      );

      const [nuevasResenas, peliculaActualizada] = await Promise.all([
        this.resenasService.getResenasPorPelicula(p!.id),
        this.peliculasService.getPeliculaPorId(p!.id),
      ]);

      this.resenas.set(nuevasResenas);
      this.pelicula.set(peliculaActualizada);
      this.mostrarFormResena.set(false);
      alert('¡Reseña publicada con éxito!');
    } catch (error: any) {
      console.error('Error al guardar la reseña:', error);
      alert('No se pudo publicar la reseña.');
    }
  }

  activarEdicion() {
    const p = this.pelicula();
    if (!p) return;

    this.limpiarPreviewPoster();
    this.errorEdicion.set(null);
    this.modoEdicion.set(true);

    let generosArray: string[] = [];
    if (Array.isArray(p.genero)) {
      generosArray = [...p.genero];
    } else if (typeof p.genero === 'string') {
      generosArray = p.genero
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g);
    }
    if (generosArray.length === 0) generosArray = ['General'];

    const fechaNormalizada = formatearFechaLocal(p.fecha_estreno);
    const puedeTenerPreventa = this.esFechaEstrenoFutura(fechaNormalizada);

    this.generosEditables.set(generosArray);
    this.peliculaEditada.set({
      ...p,
      fecha_estreno: fechaNormalizada,
      genero: generosArray as any,
      preventa_activa: puedeTenerPreventa ? Boolean(p.preventa_activa) : false,
      dias_preventa: p.dias_preventa ?? 7,
      porcentaje_preventa: p.porcentaje_preventa ?? 50,
    });
  }

  agregarGenero() {
    this.generosEditables.update((lista) => {
      const nuevaLista = [...lista, 'Nuevo género'];
      this.peliculaEditada.update((e) => ({ ...e, genero: nuevaLista as any }));
      return nuevaLista;
    });
  }

  eliminarGenero(index: number) {
    this.generosEditables.update((lista) => {
      let nuevaLista = [...lista];
      nuevaLista.splice(index, 1);
      if (nuevaLista.length === 0) nuevaLista = ['General'];
      this.peliculaEditada.update((e) => ({ ...e, genero: nuevaLista as any }));
      return nuevaLista;
    });
  }

  cancelarEdicion() {
    this.limpiarPreviewPoster();
    this.errorEdicion.set(null);
    this.modoEdicion.set(false);
    this.peliculaEditada.set({});
  }

  actualizarCampo(campo: keyof Pelicula, event: any) {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    let valor: any = target.value;

    if (campo === 'duracion') {
      valor = Number(valor);
    } else if (campo === 'dias_preventa') {
      valor = Number(valor);
    } else if (campo === 'porcentaje_preventa') {
      valor = Number(valor);
    }

    this.peliculaEditada.update((editada) => ({ ...editada, [campo]: valor }));
  }

  onPosterFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (!file) return;

    const urlPrevia = this.posterPreviewUrl();
    if (urlPrevia) {
      URL.revokeObjectURL(urlPrevia);
    }

    this.posterArchivoEdicion.set(file);
    this.posterPreviewUrl.set(URL.createObjectURL(file));
  }

  onFechaEstrenoSeleccionada(fechaFormateada: string) {
    const fechaLimpia = formatearFechaLocal(fechaFormateada);
    const esFutura = this.esFechaEstrenoFutura(fechaLimpia);

    this.peliculaEditada.update((editada) => ({
      ...editada,
      fecha_estreno: fechaLimpia,
      preventa_activa: esFutura ? Boolean(editada.preventa_activa) : false,
    }));
  }

  onTogglePreventaEdicion(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const fechaActual = this.peliculaEditada().fecha_estreno;

    if (checked && !this.esFechaEstrenoFutura(fechaActual)) {
      this.peliculaEditada.update((editada) => ({ ...editada, preventa_activa: false }));
      this.errorEdicion.set(
        'No se puede activar la preventa si la fecha de estreno ya pasó o es hoy.',
      );
      return;
    }

    this.errorEdicion.set(null);
    this.peliculaEditada.update((editada) => ({ ...editada, preventa_activa: checked }));
  }

  async guardarCambios() {
    const p = this.pelicula();
    const editada = this.peliculaEditada();
    if (!p?.id) return;

    this.errorEdicion.set(null);
    this.guardandoCambios.set(true);

    try {
      let imagenFinal = editada.imagen ?? p.imagen;
      const archivoNuevo = this.posterArchivoEdicion();

      if (archivoNuevo) {
        imagenFinal = await this.peliculasService.subirImagen(archivoNuevo);
      }

      const fechaFormateada = formatearFechaLocal(editada.fecha_estreno || p.fecha_estreno);
      const fechaEsFutura = this.esFechaEstrenoFutura(fechaFormateada);
      const preventaActivaFinal = fechaEsFutura ? Boolean(editada.preventa_activa) : false;

      const diasPreventaFinal = preventaActivaFinal
        ? Math.max(1, Math.min(60, Number(editada.dias_preventa ?? p.dias_preventa ?? 7)))
        : (p.dias_preventa ?? 7);

      const porcentajePreventaFinal = preventaActivaFinal
        ? Math.max(
            0,
            Math.min(500, Number(editada.porcentaje_preventa ?? p.porcentaje_preventa ?? 50)),
          )
        : (p.porcentaje_preventa ?? 50);

      const generosLimpios = this.generosEditables()
        .map((g) => g.trim())
        .filter(Boolean);

      const cambios: Partial<Pelicula> = {
        nombre: (editada.nombre ?? p.nombre).trim(),
        imagen: imagenFinal,
        genero: generosLimpios.length > 0 ? generosLimpios : ['General'],
        limite_edad: editada.limite_edad ?? p.limite_edad,
        duracion: Number(editada.duracion ?? p.duracion),
        fecha_estreno: fechaFormateada,
        sinopsis: editada.sinopsis ?? p.sinopsis,
        preventa_activa: preventaActivaFinal,
        dias_preventa: diasPreventaFinal,
        porcentaje_preventa: porcentajePreventaFinal,
      };

      const actualizada = await this.peliculasService.actualizarPelicula(p.id, cambios);
      this.pelicula.set(actualizada);
      this.limpiarPreviewPoster();
      this.modoEdicion.set(false);
      alert('¡Película actualizada correctamente!');
    } catch (error: any) {
      console.error('Error al actualizar película:', error);
      this.errorEdicion.set(error?.message || 'Error al guardar los cambios.');
      alert('Error al guardar los cambios.');
    } finally {
      this.guardandoCambios.set(false);
    }
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  actualizarNombreGeneroDirecto(index: number, event: any) {
    const nuevoValor = event.target.value;
    this.generosEditables.update((lista) => {
      const nuevaLista = [...lista];
      nuevaLista[index] = nuevoValor;
      this.peliculaEditada.update((e) => ({ ...e, genero: nuevaLista as any }));
      return nuevaLista;
    });
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