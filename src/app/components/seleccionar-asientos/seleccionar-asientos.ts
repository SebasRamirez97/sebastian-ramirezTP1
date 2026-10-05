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

  filas: string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J-K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

  obtenerBloquesFila(fila: string): { izquierda: number[], centro: number[], derecha: number[] } {
    if (fila === 'J-K') {
      return {
        izquierda: [1, 2],
        centro: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        derecha: [13, 14]
      };
    } else {
      return {
        izquierda: [1, 2, 3, 4],
        centro: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        derecha: [25, 26, 27, 28]
      };
    }
  }

  asientosOcupados: Map<string, any> = new Map();
  misAsientosSeleccionados: any[] = [];
  
  // 🛡️ Control para evitar doble clic o llamadas concurrentes en el mismo asiento
  private asientosEnProceso: Set<string> = new Set();

  usuarioId: string = '';
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
      this.usuarioId = 'usuario-invitado-anonimo';
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

        if (e.usuario_id === this.usuarioId && e.estado === 'seleccionado') {
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

  /**
   * Maneja la selección y deselección instantánea de un asiento al primer clic
   */
  async seleccionarAsiento(fila: string, numero: number): Promise<void> {
    const key = `${fila}-${numero}`;

    // Si este asiento ya está siendo procesado en este milisegundo, ignoramos para evitar duplicidad
    if (this.asientosEnProceso.has(key)) return;
    this.asientosEnProceso.add(key);

    const asientoExistente = this.asientosOcupados.get(key);

    try {
      if (asientoExistente) {
        // Si ya existe y es mío, lo DESELECCIONAMOS (liberamos)
        if (asientoExistente.usuario_id === this.usuarioId && asientoExistente.estado === 'seleccionado') {
          await this.entradasService.liberarAsiento(asientoExistente.id);
          this.asientosOcupados.delete(key);
          this.misAsientosSeleccionados = this.misAsientosSeleccionados.filter(a => a.id !== asientoExistente.id);
        } else {
          alert('Este asiento ya no está disponible.');
        }
      } else {
        // Validar límite de cantidad antes de seleccionar uno nuevo
        if (this.misAsientosSeleccionados.length >= this.cantidadPermitida) {
          alert(`Solo puedes seleccionar un máximo de ${this.cantidadPermitida} entrada(s) según tu selección actual. Aumenta la cantidad si deseas más.`);
          this.asientosEnProceso.delete(key);
          return;
        }

        const nuevaEntrada = await this.entradasService.bloquearAsiento(
          this.funcionId,
          this.usuarioId,
          fila,
          numero
        );
        
        this.asientosOcupados.set(key, nuevaEntrada);
        this.misAsientosSeleccionados.push(nuevaEntrada);
      }
      
      // Refresco inmediato de la vista
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      
    } catch (error: any) {
      alert(error.message);
      await this.cargarAsientosActuales();
    } finally {
      // Liberamos el semáforo del asiento
      this.asientosEnProceso.delete(key);
    }
  }

  obtenerObjetoClases(fila: string, numero: number): { [key: string]: boolean } {
    const key = `${fila}-${numero}`;
    const asiento = this.asientosOcupados.get(key);

    const esLibre = !asiento;
    const esMio = asiento && asiento.usuario_id === this.usuarioId && asiento.estado === 'seleccionado';
    const esComprado = asiento && asiento.estado === 'comprado';
    const esOcupadoPorOtro = asiento && !esMio && !esComprado;

    return {
      'asiento-libre': esLibre,
      'asiento-mio': esMio,
      'asiento-comprado': esComprado,
      'asiento-ocupado': esOcupadoPorOtro
    };
  }

  isAsientoDeshabilitado(fila: string, numero: number): boolean {
    const key = `${fila}-${numero}`;
    const asiento = this.asientosOcupados.get(key);
    if (!asiento) return false;
    return asiento.estado === 'comprado' || asiento.usuario_id !== this.usuarioId;
  }

  /**
   * Confirma la compra global de todos los asientos seleccionados bajo un único código de orden
   */
  /**
   * Redirige al usuario a la pantalla de resumen y pago (Checkout)
   */
  async procederAlPago(): Promise<void> {
    if (this.misAsientosSeleccionados.length === 0) return;

    // Navegamos al checkout pasando el ID de la función actual
    this.router.navigate(['/checkout', this.funcionId]);
  }

  volverAFunciones(): void {
  // Verificamos si ya cargó el objeto 'funcion' y tiene la propiedad de la película
  const peliculaId = this.funcion?.pelicula_id

  if (peliculaId) {
    this.router.navigate(['/peliculas', peliculaId, 'funciones']);
  } else {
    // Si por alguna razón no está disponible, lo mandamos de regreso a la cartelera general
    this.router.navigate(['/cartelera']);
  }
}
}