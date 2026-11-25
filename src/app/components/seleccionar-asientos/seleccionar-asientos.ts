import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradasService } from '../../services/entradas.services';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';
import { supabase } from '../../services/supabaseClient';
import { ComponenteConAsientosPendientes } from '../../guards/liberar-asientos.guard';
import { formatearFechaLocal, obtenerHoyLocal } from '../../utils/fechas.util';

@Component({
  selector: 'app-seleccionar-asientos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seleccionar-asientos.html',
  styleUrls: ['./seleccionar-asientos.css'],
})
export class SeleccionarAsientosComponent
  implements OnInit, OnDestroy, ComponenteConAsientosPendientes
{
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entradasService = inject(EntradasService);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);

  funcionId = signal<string>('');
  funcion = signal<any>(null);
  pelicula = signal<Pelicula | null>(null);

  filas = signal<string[]>([
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J-K',
    'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  ]);

  asientosOcupados = signal(new Map<string, any>());
  misAsientosSeleccionados = signal<any[]>([]);

  private idsAsientosAnonimo: string[] = [];
  private asientosEnProceso: Set<string> = new Set();

  usuarioId = signal<string | null>(null);
  cargando = signal<boolean>(true);
  errorMensaje = signal<string | null>(null);
  cantidadPermitida = signal<number>(1);

  private realtimeChannel: any;

  // 🎟️ Indica si hoy está dentro de la ventana válida de preventa de la película
  enPreventaActiva = computed<boolean>(() => {
    const p = this.pelicula() || this.funcion()?.peliculas;
    if (!p?.fecha_estreno) return false;

    const hoy = obtenerHoyLocal();
    const estreno = formatearFechaLocal(p.fecha_estreno);
    if (!estreno || hoy >= estreno) return false;

    if (!p.preventa_activa) return false;

    const diasPreventa = Number(p.dias_preventa ?? 7);
    const [anio, mes, dia] = estreno.split('-').map(Number);
    const fechaInicioPreventa = formatearFechaLocal(
      new Date(anio, mes - 1, dia - diasPreventa)
    );

    return hoy >= fechaInicioPreventa && hoy < estreno;
  });

  porcentajePreventa = computed<number>(() => {
    if (!this.enPreventaActiva()) return 0;
    const p = this.pelicula() || this.funcion()?.peliculas;
    return Number(p?.porcentaje_preventa ?? 50);
  });

  multiplicadorPreventa = computed<number>(() => {
    return this.enPreventaActiva() ? 1 + this.porcentajePreventa() / 100 : 1;
  });

  private aplicarRecargo(monto: number): number {
    return Math.round(monto * this.multiplicadorPreventa());
  }

  // 💰 Precios unitarios calculados (General vs VIP + recargo preventa si aplica)
  precioGeneralPesos = computed(() =>
    this.aplicarRecargo(this.entradasService.calcularPrecioGeneralPesos(this.funcion()))
  );

  precioVipPesos = computed(() =>
    this.aplicarRecargo(this.entradasService.calcularPrecioVipPesos(this.funcion()))
  );

  precioGeneralPuntos = computed(() =>
    this.aplicarRecargo(this.entradasService.calcularPrecioGeneralPuntos(this.funcion()))
  );

  precioVipPuntos = computed(() =>
    this.aplicarRecargo(this.entradasService.calcularPrecioVipPuntos(this.funcion()))
  );

  // 🧮 Subtotales estimados de los asientos seleccionados actualmente
  subtotalPesosSeleccionados = computed(() => {
    const func = this.funcion();
    if (!func) return 0;
    return this.misAsientosSeleccionados().reduce(
      (acc, asiento) =>
        acc +
        this.aplicarRecargo(
          this.entradasService.obtenerPrecioAsiento(func, asiento.fila, 'efectivo')
        ),
      0
    );
  });

  subtotalPuntosSeleccionados = computed(() => {
    const func = this.funcion();
    if (!func) return 0;
    return this.misAsientosSeleccionados().reduce(
      (acc, asiento) =>
        acc +
        this.aplicarRecargo(
          this.entradasService.obtenerPrecioAsiento(func, asiento.fila, 'puntos')
        ),
      0
    );
  });

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.misAsientosSeleccionados().length > 0) {
      $event.returnValue = 'Perderás los asientos seleccionados si sales.';
    }
  }

  puedeSalir(): boolean {
    return this.misAsientosSeleccionados().length === 0;
  }

  async liberarAsientosTemporales(): Promise<void> {
    try {
      const asientos = this.misAsientosSeleccionados();
      for (const asiento of asientos) {
        await this.entradasService.liberarAsiento(asiento.id);
      }
      this.misAsientosSeleccionados.set([]);
    } catch (err) {
      console.error('Error al liberar asientos al salir:', err);
    }
  }

  async ngOnInit(): Promise<void> {
    const fId = this.route.snapshot.paramMap.get('funcionId') || '';
    this.funcionId.set(fId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      this.usuarioId.set(user.id);
    } else {
      const anonimoStr = localStorage.getItem('clienteAnonimo');
      if (anonimoStr) {
        this.usuarioId.set(null);
        const anonimo = JSON.parse(anonimoStr);
        this.idsAsientosAnonimo = anonimo.asientosSeleccionados || [];
      } else {
        this.usuarioId.set(null);
      }
    }

    if (this.funcionId()) {
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

  esVip(fila: string): boolean {
    return this.entradasService.esFilaVip(fila);
  }

  obtenerPrecioUnitarioAsientoPesos(fila: string): number {
    const base = this.entradasService.obtenerPrecioAsiento(this.funcion(), fila, 'efectivo');
    return this.aplicarRecargo(base);
  }

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

  async cargarDatosFuncion(): Promise<void> {
    try {
      const data = await this.funcionesService.getFuncionPorId(this.funcionId());
      this.funcion.set(data);

      const peliculaId = data?.pelicula_id || data?.peliculas?.id;
      if (peliculaId) {
        const peliData = await this.peliculasService.getPeliculaPorId(peliculaId);
        this.pelicula.set(peliData);
      }
    } catch (error: any) {
      this.errorMensaje.set('No se pudo cargar la información de la función.');
    }
  }

  async cargarAsientosActuales(): Promise<void> {
    try {
      this.cargando.set(true);
      const entradas = await this.entradasService.getEntradasPorFuncion(this.funcionId());

      const mapaOcupados = new Map<string, any>();
      const misSeleccionadosTemp: any[] = [];
      const uId = this.usuarioId();

      entradas.forEach((e) => {
        const key = `${e.fila}-${e.numero_asiento}`;
        mapaOcupados.set(key, e);

        const esMio = uId
          ? e.usuario_id === uId
          : this.idsAsientosAnonimo.includes(e.id);

        if (esMio && e.estado === 'seleccionado') {
          misSeleccionadosTemp.push(e);
        }
      });

      this.asientosOcupados.set(mapaOcupados);
      this.misAsientosSeleccionados.set(misSeleccionadosTemp);
    } catch (error: any) {
      this.errorMensaje.set(error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  private suscripcionRealtime(): void {
    this.realtimeChannel = supabase
      .channel(`public:entradas:funcion_id=eq.${this.funcionId()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entradas',
          filter: `funcion_id=eq.${this.funcionId()}`,
        },
        (payload) => {
          const newData: any = payload.new;
          const oldData: any = payload.old;
          const mapaActual = new Map(this.asientosOcupados());

          if (payload.eventType === 'INSERT') {
            const key = `${newData.fila}-${newData.numero_asiento}`;
            mapaActual.set(key, newData);
          } else if (payload.eventType === 'DELETE') {
            for (let [key, value] of mapaActual.entries()) {
              if (value.id === oldData.id) {
                mapaActual.delete(key);
                break;
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const key = `${newData.fila}-${newData.numero_asiento}`;
            mapaActual.set(key, newData);
          }
          this.asientosOcupados.set(mapaActual);
        }
      )
      .subscribe();
  }

  cambiarCantidad(delta: number): void {
    const nuevaCantidad = this.cantidadPermitida() + delta;
    if (nuevaCantidad >= 1) {
      this.cantidadPermitida.set(nuevaCantidad);

      if (this.misAsientosSeleccionados().length > this.cantidadPermitida()) {
        alert(
          `Has reducido el límite a ${this.cantidadPermitida()} entradas. Por favor deselecciona los sobrantes.`
        );
      }
    }
  }

  async seleccionarAsiento(fila: string, numero: number): Promise<void> {
    const key = `${fila}-${numero}`;

    if (this.asientosEnProceso.has(key)) return;
    this.asientosEnProceso.add(key);

    const asientoExistente = this.asientosOcupados().get(key);
    const uId = this.usuarioId();

    try {
      const esMioExistente = uId
        ? asientoExistente?.usuario_id === uId
        : this.idsAsientosAnonimo.includes(asientoExistente?.id);

      const mapaActual = new Map(this.asientosOcupados());
      const misSelActual = [...this.misAsientosSeleccionados()];

      if (asientoExistente) {
        if (esMioExistente && asientoExistente.estado === 'seleccionado') {
          await this.entradasService.liberarAsiento(asientoExistente.id);
          mapaActual.delete(key);
          const filtrados = misSelActual.filter((a) => a.id !== asientoExistente.id);
          this.misAsientosSeleccionados.set(filtrados);

          if (filtrados.length === 0) {
            localStorage.removeItem('asientosSeleccionados');
          }

          if (!uId) {
            this.idsAsientosAnonimo = this.idsAsientosAnonimo.filter(
              (id) => id !== asientoExistente.id
            );
            this.actualizarLocalStorageAnonimo();
          }
        } else {
          alert('Este asiento ya no está disponible.');
        }
      } else {
        if (misSelActual.length >= this.cantidadPermitida()) {
          alert(
            `Solo puedes seleccionar un máximo de ${this.cantidadPermitida()} entrada(s) según tu selección actual.`
          );
          this.asientosEnProceso.delete(key);
          return;
        }

        const nuevaEntrada = await this.entradasService.bloquearAsiento(
          this.funcionId(),
          uId,
          fila,
          numero
        );

        mapaActual.set(key, nuevaEntrada);
        misSelActual.push(nuevaEntrada);
        this.misAsientosSeleccionados.set(misSelActual);

        if (!uId) {
          this.idsAsientosAnonimo.push(nuevaEntrada.id);
          this.actualizarLocalStorageAnonimo();
        }
      }

      this.asientosOcupados.set(mapaActual);
    } catch (error: any) {
      alert(error.message);
      await this.cargarAsientosActuales();
    } finally {
      this.asientosEnProceso.delete(key);
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
    const asiento = this.asientosOcupados().get(key);
    const uId = this.usuarioId();
    const esAsientoVip = this.esVip(fila);

    if (!asiento) {
      return {
        'asiento-libre': true,
        'asiento-vip': esAsientoVip,
        'asiento-mio': false,
        'asiento-mio-comprado': false,
        'asiento-ocupado': false,
      };
    }

    const esMio = uId
      ? asiento.usuario_id === uId
      : this.idsAsientosAnonimo.includes(asiento.id);

    const esMioSeleccionado = esMio && asiento.estado === 'seleccionado';
    const esCompradoGeneral = this.esCompradoORetirado(asiento);

    const esMioComprado = esMio && esCompradoGeneral;
    const ocupadoPorOtro = !esMio && (asiento.estado === 'seleccionado' || esCompradoGeneral);

    return {
      'asiento-libre': false,
      'asiento-vip': esAsientoVip,
      'asiento-mio': esMioSeleccionado,
      'asiento-mio-comprado': esMioComprado,
      'asiento-ocupado': ocupadoPorOtro,
    };
  }

  private esCompradoORetirado(asiento: any): boolean {
    return asiento && (asiento.estado === 'comprado' || asiento.estado === 'retirado');
  }

  isAsientoDeshabilitado(fila: string, numero: number): boolean {
    const key = `${fila}-${numero}`;
    const asiento = this.asientosOcupados().get(key);
    if (!asiento) return false;

    const uId = this.usuarioId();
    const esMio = uId
      ? asiento.usuario_id === uId
      : this.idsAsientosAnonimo.includes(asiento.id);

    return this.esCompradoORetirado(asiento) || (!esMio && asiento.estado === 'seleccionado');
  }

  trackByFila(index: number, fila: string): string {
    return fila;
  }

  trackByNum(index: number, num: number): number {
    return num;
  }

  trackByAsiento(index: number, asiento: any): string {
    return asiento.id;
  }

  async procederAlPago(): Promise<void> {
    if (this.misAsientosSeleccionados().length === 0) {
      alert('No tienes asientos seleccionados.');
      return;
    }

    this.router.navigate(['/checkout', this.funcionId()]);
  }

  volverAFunciones(): void {
    const peliculaId = this.funcion()?.pelicula_id;
    if (peliculaId) {
      this.router.navigate(['/peliculas', peliculaId, 'funciones']);
    } else {
      this.router.navigate(['/cartelera']);
    }
  }

  irAlCandyBar(): void {
    if (this.misAsientosSeleccionados().length === 0) {
      alert('Por favor, selecciona al menos un asiento antes de ir al Candy Bar.');
      return;
    }

    localStorage.setItem(
      'asientosSeleccionados',
      JSON.stringify(this.misAsientosSeleccionados())
    );
    this.router.navigate(['/candybar']);
  }
}