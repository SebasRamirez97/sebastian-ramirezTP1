import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradasService } from '../../services/entradas.services';
import { FuncionesService } from '../../services/funciones';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-seleccionar-asientos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seleccionar-asientos.html',
  styleUrls: ['./seleccionar-asientos.css'],
})
export class SeleccionarAsientosComponent implements OnInit, OnDestroy {
  funcionId: string = '';
  funcion: any = null;

  filas: string[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J-K',
    'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  ];

  obtenerBloquesFila(fila: string): { izquierda: number[]; centro: number[]; derecha: number[] } {
    if (fila === 'J-K') {
      return {
        izquierda: [1, 2],
        centro: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        derecha: [13, 14],
      };
    } else {
      return {
        izquierda: [1, 2, 3, 4],
        centro: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        derecha: [25, 26, 27, 28],
      };
    }
  }

  asientosOcupados: Map<string, any> = new Map();
  misAsientosSeleccionados: any[] = [];

  // IDs de asientos guardados localmente si es anónimo
  private idsAsientosAnonimo: string[] = [];

  // 🛡️ Control para evitar doble clic o llamadas concurrentes en el mismo asiento
  private asientosEnProceso: Set<string> = new Set();

  usuarioId: string | null = null;
  cargando: boolean = true;
  errorMensaje: string | null = null;
  private realtimeChannel: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private entradasService: EntradasService,
    private funcionesService: FuncionesService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.funcionId = this.route.snapshot.paramMap.get('funcionId') || '';

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      this.usuarioId = user.id;
    } else {
      const anonimoStr = localStorage.getItem('clienteAnonimo');
      if (anonimoStr) {
        this.usuarioId = null;
        const anonimo = JSON.parse(anonimoStr);
        this.idsAsientosAnonimo = anonimo.asientosSeleccionados || [];
      } else {
        this.usuarioId = null;
      }
    }

    if (this.funcionId) {
      await this.cargarDatosFuncion();
      await this.cargarAsientosActuales();
      this.suscripcionRealtime();
    }
  }

  ngOnDestroy(): void {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
    }
  }

  async cargarDatosFuncion(): Promise<void> {
    try {
      this.funcion = await this.funcionesService.getFuncionPorId(this.funcionId);
    } catch (error: any) {
      this.errorMensaje = 'No se pudo cargar la información de la función.';
    }
  }

  async cargarAsientosActuales(): Promise<void> {
    try {
      this.cargando = true;
      const entradas = await this.entradasService.getEntradasPorFuncion(this.funcionId);

      this.asientosOcupados.clear();
      this.misAsientosSeleccionados = [];

      entradas.forEach((e) => {
        const key = `${e.fila}-${e.numero_asiento}`;
        this.asientosOcupados.set(key, e);

        // Permitimos que reconozca como propio si es el usuario ID, sin importar si está seleccionado o ya comprado
        const esMio = this.usuarioId 
          ? (e.usuario_id === this.usuarioId && (e.estado === 'seleccionado' || e.estado === 'comprado'))
          : (this.idsAsientosAnonimo.includes(e.id) && (e.estado === 'seleccionado' || e.estado === 'comprado'));

        if (esMio && e.estado === 'seleccionado') {
          // Solo los ponemos en el carrito de pago si siguen en estado 'seleccionado'
          this.misAsientosSeleccionados.push(e);
        }
      });
    } catch (error: any) {
      this.errorMensaje = error.message;
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private suscripcionRealtime(): void {
    this.realtimeChannel = supabase
      .channel(`public:entradas:funcion_id=eq.${this.funcionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entradas',
          filter: `funcion_id=eq.${this.funcionId}`,
        },
        (payload) => {
          const newData: any = payload.new;
          const oldData: any = payload.old;

          if (payload.eventType === 'INSERT') {
            const key = `${newData.fila}-${newData.numero_asiento}`;
            this.asientosOcupados.set(key, newData);
          } else if (payload.eventType === 'DELETE') {
            for (let [key, value] of this.asientosOcupados.entries()) {
              if (value.id === oldData.id) {
                this.asientosOcupados.delete(key);
                break;
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const key = `${newData.fila}-${newData.numero_asiento}`;
            this.asientosOcupados.set(key, newData);
          }
          this.cdr.detectChanges();
        },
      )
      .subscribe();
  }

  cantidadPermitida: number = 1;

  cambiarCantidad(delta: number): void {
    const nuevaCantidad = this.cantidadPermitida + delta;
    if (nuevaCantidad >= 1) {
      this.cantidadPermitida = nuevaCantidad;

      if (this.misAsientosSeleccionados.length > this.cantidadPermitida) {
        alert(
          `Has reducido el límite a ${this.cantidadPermitida} entradas. Por favor deselecciona los sobrantes.`,
        );
      }
    }
  }

  async seleccionarAsiento(fila: string, numero: number): Promise<void> {
    const key = `${fila}-${numero}`;

    if (this.asientosEnProceso.has(key)) return;
    this.asientosEnProceso.add(key);

    const asientoExistente = this.asientosOcupados.get(key);

    try {
      const esMioExistente = this.usuarioId 
        ? (asientoExistente?.usuario_id === this.usuarioId)
        : (this.idsAsientosAnonimo.includes(asientoExistente?.id));

      if (asientoExistente) {
        if (esMioExistente && asientoExistente.estado === 'seleccionado') {
          await this.entradasService.liberarAsiento(asientoExistente.id);
          this.asientosOcupados.delete(key);
          this.misAsientosSeleccionados = this.misAsientosSeleccionados.filter(
            (a) => a.id !== asientoExistente.id,
          );

          // Si es anónimo, lo removemos del localStorage
          if (!this.usuarioId) {
            this.idsAsientosAnonimo = this.idsAsientosAnonimo.filter(id => id !== asientoExistente.id);
            this.actualizarLocalStorageAnonimo();
          }
        } else {
          alert('Este asiento ya no está disponible.');
        }
      } else {
        if (this.misAsientosSeleccionados.length >= this.cantidadPermitida) {
          alert(
            `Solo puedes seleccionar un máximo de ${this.cantidadPermitida} entrada(s) según tu selección actual.`,
          );
          this.asientosEnProceso.delete(key);
          return;
        }

        const nuevaEntrada = await this.entradasService.bloquearAsiento(
          this.funcionId,
          this.usuarioId,
          fila,
          numero,
        );

        this.asientosOcupados.set(key, nuevaEntrada);
        this.misAsientosSeleccionados.push(nuevaEntrada);

        // Si es anónimo, guardamos el ID en su localStorage
        if (!this.usuarioId) {
          this.idsAsientosAnonimo.push(nuevaEntrada.id);
          this.actualizarLocalStorageAnonimo();
        }
      }

      this.cdr.markForCheck();
      this.cdr.detectChanges();
    } catch (error: any) {
      alert(error.message);
      await this.cargarAsientosActuales();
    } finally {
      this.asientosEnProceso.delete(key);
      this.cdr.detectChanges(); // Forzamos la actualización visual de inmediato al terminar
    }
  }

  private actualizarLocalStorageAnonimo(): void {
    const anonimoStr = localStorage.getItem('clienteAnonimo');
    if (anonimoStr) {
      const anonimo = JSON.parse(anonimoStr);
      anonimo.asientosSeleccionados = this.idsAsientosAnonimo;
      localStorage.setItem('clienteAnonimo', JSON.stringify(anonimo));
    }
  }

  obtenerObjetoClases(fila: string, numero: number): { [key: string]: boolean } {
    const key = `${fila}-${numero}`;
    const asiento = this.asientosOcupados.get(key);

    if (!asiento) {
      return {
        'asiento-libre': true,
        'asiento-mio': false,
        'asiento-mio-comprado': false,
        'asiento-ocupado': false
      };
    }

    const esMio = this.usuarioId 
      ? (asiento.usuario_id === this.usuarioId)
      : (this.idsAsientosAnonimo.includes(asiento.id));

    // 1. Seleccionado actualmente por ti (en verde)
    const esMioSeleccionado = esMio && asiento.estado === 'seleccionado';

    // 2. Comprado por ti previamente (cuarto estado - azul)
    const esMioComprado = esMio && asiento.estado === 'comprado';

    // 3. Ocupado por otra persona (comprado o seleccionado por otro)
    const ocupadoPorOtro = !esMio && (asiento.estado === 'comprado' || asiento.estado === 'seleccionado');

    const esLibre = !esMioSeleccionado && !esMioComprado && !ocupadoPorOtro;

    return {
      'asiento-libre': esLibre,
      'asiento-mio': esMioSeleccionado,
      'asiento-mio-comprado': esMioComprado,
      'asiento-ocupado': ocupadoPorOtro,
    };
  }

  isAsientoDeshabilitado(fila: string, numero: number): boolean {
    const key = `${fila}-${numero}`;
    const asiento = this.asientosOcupados.get(key);
    if (!asiento) return false;

    const esMio = this.usuarioId 
      ? (asiento.usuario_id === this.usuarioId)
      : (this.idsAsientosAnonimo.includes(asiento.id));

    // Se deshabilita si ya está comprado, o si está seleccionado por otra persona
    return asiento.estado === 'comprado' || (!esMio && asiento.estado === 'seleccionado');
  }

  async procederAlPago(): Promise<void> {
    if (this.misAsientosSeleccionados.length === 0) {
      alert('No tienes asientos seleccionados.');
      return;
    }

    this.router.navigate(['/checkout', this.funcionId]);
  }

  volverAFunciones(): void {
    const peliculaId = this.funcion?.pelicula_id;
    if (peliculaId) {
      this.router.navigate(['/peliculas', peliculaId, 'funciones']);
    } else {
      this.router.navigate(['/cartelera']);
    }
  }
}