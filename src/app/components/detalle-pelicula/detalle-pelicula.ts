import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { AuthService } from '../../services/auth.service';
import { ResenasService } from '../../services/resenas.service'; // 🌟 1. Importamos el servicio de reseñas
import { SelectorFechaComponent } from '../selector-fecha/selector-fecha';
import { DateFormatPipe } from '../../pipes/date-format-pipe';
import { supabase } from '../../services/supabaseClient'; // 🌟 Importamos supabase para el usuario actual

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorFechaComponent, DateFormatPipe],
  templateUrl: './detalle-pelicula.html',
  styleUrls: ['./detalle-pelicula.css'],
})
export class DetallePeliculaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private peliculasService = inject(PeliculasService);
  private authService = inject(AuthService);
  private resenasService = inject(ResenasService); // 🌟 2. Inyectamos el servicio

  rol = toSignal(this.authService.rol$, { initialValue: '' });

  pelicula = signal<Pelicula | null>(null);
  peliculaEditada = signal<Partial<Pelicula>>({});
  cargando = signal<boolean>(true);
  modoEdicion = signal<boolean>(false);

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
      // 🌟 3. Obtenemos el usuario autenticado actual desde Supabase
      const { data: authData } = await supabase.auth.getUser();
      const uId = authData?.user?.id || null;
      this.usuarioLogueadoId.set(uId);

      // 🌟 4. Cargamos en paralelo la película y sus reseñas
      const [peliculaData, resenasData] = await Promise.all([
        this.peliculasService.getPeliculaPorId(id),
        this.resenasService.getResenasPorPelicula(id)
      ]);

      this.pelicula.set(peliculaData);
      this.resenas.set(resenasData);

      // 🌟 5. Si el usuario ya dejó una reseña anteriormente, la precargamos para editarla
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

  // 🌟 6. Método para seleccionar las estrellas interactivamente
  seleccionarPuntaje(estrellas: number) {
    this.puntajeSeleccionado.set(estrellas);
  }

  // 🌟 7. Método para publicar o actualizar la reseña del cliente
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
        this.comentarioInput().trim()
      );

      // Recargamos las reseñas y el puntaje promedio actualizado de la película
      const [nuevasResenas, peliculaActualizada] = await Promise.all([
        this.resenasService.getResenasPorPelicula(p!.id),
        this.peliculasService.getPeliculaPorId(p!.id)
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
  if (p) {
    this.modoEdicion.set(true);
    let generosArray: string[] = [];
    if (Array.isArray(p.genero)) {
      generosArray = [...p.genero];
    } else if (typeof p.genero === 'string') {
      generosArray = (p.genero as string).split(',').map(g => g.trim()).filter(g => g);
    }
    if (generosArray.length === 0) generosArray = ['General'];

    // Guardamos una copia limpia en la signal independiente
    this.generosEditables.set(generosArray);
    this.peliculaEditada.set({ ...p, genero: generosArray as any });
  }
}

  // 🌟 Método seguro para asegurar que siempre devolvemos un arreglo en la edición
  getGenerosEdicion(): string[] {
    const gen = this.peliculaEditada().genero;
    if (Array.isArray(gen)) {
      return gen;
    }
    if (typeof gen === 'string') {
      return gen.split(',').map(g => g.trim()).filter(g => g);
    }
    return ['General'];
  }
  
  // 🌟 Métodos para manipular los géneros dinámicamente en el modo edición
  agregarGenero() {
  this.generosEditables.update(lista => {
    const nuevaLista = [...lista, 'Nuevo género'];
    this.peliculaEditada.update(e => ({ ...e, genero: nuevaLista as any }));
    return nuevaLista;
  });
}

  // 🌟 Método actualizado para recibir el string directo desde ngModel
  actualizarNombreGenero(index: number, nuevoValor: string) {
  this.generosEditables.update(lista => {
    const nuevaLista = [...lista];
    nuevaLista[index] = nuevoValor;
    this.peliculaEditada.update(e => ({ ...e, genero: nuevaLista as any }));
    return nuevaLista;
  });
}

  eliminarGenero(index: number) {
  this.generosEditables.update(lista => {
    let nuevaLista = [...lista];
    nuevaLista.splice(index, 1);
    if (nuevaLista.length === 0) nuevaLista = ['General'];
    this.peliculaEditada.update(e => ({ ...e, genero: nuevaLista as any }));
    return nuevaLista;
  });
}

  cancelarEdicion() {
    this.modoEdicion.set(false);
    this.peliculaEditada.set({});
  }

  actualizarCampo(campo: keyof Pelicula, event: any) {
    const valor = event.target.value;
    this.peliculaEditada.update(editada => ({ ...editada, [campo]: valor }));
  }

  onFechaEstrenoSeleccionada(fechaFormateada: string) {
    this.peliculaEditada.update(editada => ({ ...editada, fecha_estreno: fechaFormateada }));
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

  trackByIndex(index: number, item: any): number {
    return index;
  }
  
  // 🌟 Método directo para capturar el valor del input sin conflictos
  actualizarNombreGeneroDirecto(index: number, event: any) {
    const nuevoValor = event.target.value;
    this.generosEditables.update(lista => {
      const nuevaLista = [...lista];
      nuevaLista[index] = nuevoValor;
      this.peliculaEditada.update(e => ({ ...e, genero: nuevaLista as any }));
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