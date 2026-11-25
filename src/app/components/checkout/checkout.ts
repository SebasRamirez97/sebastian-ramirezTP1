import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradasService } from '../../services/entradas.services';
import { ProductosService } from '../../services/productos.service';
import { supabase } from '../../services/supabaseClient';
import { PdfService } from '../../services/pdf.service';
import { AdminCuponesService } from '../../services/admin-cupones.service';
import { ComponenteConAsientosPendientes } from '../../guards/liberar-asientos.guard';
import { formatearFechaLocal, obtenerHoyLocal } from '../../utils/fechas.util';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css'],
})
export class CheckoutComponent implements OnInit, ComponenteConAsientosPendientes {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private entradasService = inject(EntradasService);
  private productosService = inject(ProductosService);
  private pdfService = inject(PdfService);
  private adminCuponesService = inject(AdminCuponesService);

  funcionId = signal<string>('');
  usuarioId = signal<string | null>(null);
  misAsientos = signal<any[]>([]);
  cargando = signal<boolean>(true);
  montoIngresadoAnonimo = signal<number>(0);

  funcionData = signal<any>({
    precio_pesos: 0,
    precio_puntos: 0,
    pelicula_id: null,
    peliculas: null,
  });

  metodoPago = signal<string>('efectivo');
  creditosAUsar = signal<number>(0);
  dineroAUsar = signal<number>(0);

  dineroDisponibleCliente = signal<number>(0);
  puntosDisponiblesCliente = signal<number>(0);
  creditosDisponiblesCliente = signal<number>(0);
  usarCreditos = signal<boolean>(true);

  itemsCandySeleccionados = signal<any[]>([]);

  mostrarModalExito = signal<boolean>(false);
  codigoRetiroExitoso = signal<string>('');

  // 🌟 Estados para el modal de saldo insuficiente
  mostrarModalSaldoInsuficiente = signal<boolean>(false);
  saldoActualCliente = signal<number>(0);
  montoFaltante = signal<number>(0);
  montoACargarInput = signal<number>(0);
  mensajeErrorCarga = signal<string>('');

  codigoCuponInput = signal<string>('');
  cuponesAplicados = signal<any[]>([]);
  mensajeCupon = signal<string>('');
  esErrorCupon = signal<boolean>(false);

  cuponesDisponiblesCliente = signal<any[]>([]);

  // 🌟 Estado para el modal de restricción de edad
  mostrarModalEdadInsuficiente = signal<boolean>(false);
  mensajeEdadInsuficiente = signal<string>('');

  private idsAsientosAnonimo: string[] = [];

  // 🎟️ Ventana de preventa activa según fecha_estreno, preventa_activa y dias_preventa
  enPreventaActiva = computed<boolean>(() => {
    const func = this.funcionData();
    const peli = Array.isArray(func?.peliculas) ? func.peliculas[0] : func?.peliculas;
    if (!peli?.fecha_estreno) return false;

    const hoy = obtenerHoyLocal();
    const estreno = formatearFechaLocal(peli.fecha_estreno);
    if (!estreno || hoy >= estreno) return false;

    if (!peli.preventa_activa) return false;

    const diasPreventa = Number(peli.dias_preventa ?? 7);
    const [anio, mes, dia] = estreno.split('-').map(Number);
    const fechaInicioPreventa = formatearFechaLocal(
      new Date(anio, mes - 1, dia - diasPreventa),
    );

    return hoy >= fechaInicioPreventa && hoy < estreno;
  });

  porcentajePreventa = computed<number>(() => {
    if (!this.enPreventaActiva()) return 0;
    const func = this.funcionData();
    const peli = Array.isArray(func?.peliculas) ? func.peliculas[0] : func?.peliculas;
    return Number(peli?.porcentaje_preventa ?? 50);
  });

  multiplicadorPreventa = computed<number>(() => {
    return this.enPreventaActiva() ? 1 + this.porcentajePreventa() / 100 : 1;
  });

  private aplicarRecargoPreventa(monto: number): number {
    return Math.round(Number(monto || 0) * this.multiplicadorPreventa());
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.misAsientos().length > 0 && !this.mostrarModalExito()) {
      $event.returnValue =
        'Si sales ahora, tu proceso de compra se cancelará y perderás tus asientos.';
    }
  }

  // 🛡️ Métodos requeridos por el CanDeactivate Guard
  puedeSalir(): boolean {
    return this.mostrarModalExito() || this.misAsientos().length === 0;
  }

  async liberarAsientosTemporales(): Promise<void> {
    try {
      const asientos = this.misAsientos();
      for (const asiento of asientos) {
        await this.entradasService.liberarAsiento(asiento.id);
      }
      this.misAsientos.set([]);

      localStorage.removeItem('asientosSeleccionados');
      localStorage.removeItem('carritoCandyTemp');
      this.itemsCandySeleccionados.set([]);
      this.productosService.limpiarCarritoTemp();
    } catch (err) {
      console.error('Error al liberar asientos desde el checkout:', err);
    }
  }

  private normalizarItemCarrito(item: any): any {
    const esCombo = Boolean(
      item?.esCombo ||
        item?.es_combo ||
        item?.tipo === 'combo' ||
        (Array.isArray(item?.items) && item.items.length > 0),
    );
    const cantEntradas = Number(
      item?.cantidad_entradas ??
        item?.cantidadEntradas ??
        (item?.incluye_entrada || item?.incluyeEntrada ? 1 : 0),
    );
    const incluyeEntrada = Boolean(
      item?.incluye_entrada || item?.incluyeEntrada || cantEntradas > 0,
    );

    return {
      ...item,
      esCombo,
      incluye_entrada: incluyeEntrada,
      cantidad_entradas: incluyeEntrada ? Math.max(1, cantEntradas) : 0,
      precio: Number(item?.precio ?? item?.precio_dinero ?? 0),
      precio_puntos: Number(item?.precio_puntos ?? item?.precioPuntos ?? 0),
      cantidad: Number(item?.cantidad ?? item?.cantidadDeseada ?? 1),
    };
  }

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('funcionId') || '';
    this.funcionId.set(idParam);

    let candyTemp: any[] = [];
    const storedCandy = localStorage.getItem('carritoCandyTemp');
    if (storedCandy) {
      try {
        const parsed = JSON.parse(storedCandy);
        candyTemp = parsed.map((item: any) => this.normalizarItemCarrito(item));
      } catch (e) {
        candyTemp = [];
      }
    }

    if (candyTemp.length === 0) {
      const serviceItems = this.productosService.obtenerCarritoTemp();
      candyTemp = serviceItems.map((item: any) => this.normalizarItemCarrito(item));
    }
    this.itemsCandySeleccionados.set(candyTemp);

    const { data: authData } = await supabase.auth.getUser();

    if (authData?.user) {
      this.usuarioId.set(authData.user.id);
      await this.cargarCuponesDelCliente(authData.user.id);
      const { data: perfilCliente } = await supabase
        .from('clientes')
        .select('dinero, puntos, creditos')
        .eq('id', authData.user.id)
        .single();

      this.dineroDisponibleCliente.set(Number(perfilCliente?.dinero || 0));
      this.puntosDisponiblesCliente.set(Number(perfilCliente?.puntos || 0));
      this.creditosDisponiblesCliente.set(Number(perfilCliente?.creditos || 0));
    } else {
      this.usuarioId.set(null);
      const anonimoStr = localStorage.getItem('clienteAnonimo');
      if (anonimoStr) {
        const anonimo = JSON.parse(anonimoStr);
        this.idsAsientosAnonimo = anonimo.asientosSeleccionados || [];
      }
    }

    if (!this.funcionId() || this.funcionId() === 'solo-candy-placeholder-id') {
      const asientosLocal = localStorage.getItem('asientosSeleccionados');
      if (asientosLocal) {
        try {
          const parsedAsientos = JSON.parse(asientosLocal);
          if (parsedAsientos.length > 0) {
            this.misAsientos.set(parsedAsientos);
            this.funcionId.set(parsedAsientos[0].funcion_id);
          }
        } catch (e) {}
      }
    }

    await this.cargarDatosCheckout();
  }

  private esMetodoCredito(metodo: string): boolean {
    const m = (metodo || '').toLowerCase();
    return m === 'credito' || m === 'creditos' || m === 'mixto';
  }

  private obtenerPorcentajeCupon(cupon: any): number {
    const raw =
      cupon?.discount_percentage ??
      cupon?.descuento ??
      cupon?.porcentaje_descuento ??
      cupon?.porcentaje ??
      0;
    const num = Number(raw);
    return Number.isNaN(num) ? 0 : Math.max(0, num);
  }

  get porcentajeDescuentoCupones(): number {
    const cupones = this.cuponesAplicados();
    if (!cupones || cupones.length === 0) return 0;

    const suma = cupones.reduce((acc, c) => acc + this.obtenerPorcentajeCupon(c), 0);
    return Math.min(100, suma);
  }

  async cargarCuponesDelCliente(userId: string): Promise<void> {
    const { data, error } = await this.adminCuponesService.obtenerCuponesDelCliente(userId);
    if (!error && data) {
      this.cuponesDisponiblesCliente.set(data);
    }
  }

  async seleccionarCuponRapido(code: string): Promise<void> {
    this.mensajeCupon.set('');
    this.esErrorCupon.set(false);

    const cuponEncontrado = this.cuponesDisponiblesCliente().find(
      (c) => c.code.toUpperCase() === code.toUpperCase(),
    );

    if (!cuponEncontrado) {
      this.codigoCuponInput.set(code);
      await this.aplicarCupon();
      return;
    }

    const actuales = this.cuponesAplicados();
    const yaAplicado = actuales.find((c) => c.code.toUpperCase() === code.toUpperCase());

    if (yaAplicado) {
      const filtrados = actuales.filter((c) => c.code.toUpperCase() !== code.toUpperCase());
      this.cuponesAplicados.set(filtrados);
      this.mensajeCupon.set(`Cupón "${code}" desactivado.`);
      return;
    }

    const resultado = await this.adminCuponesService.validarCuponParaUsuario(
      code,
      this.usuarioId(),
      actuales.filter((c) => c.is_welcome || c.tipo === 'bienvenida'),
    );

    if (!resultado.valido) {
      this.esErrorCupon.set(true);
      this.mensajeCupon.set(resultado.mensaje);
      return;
    }

    const nuevoCupon = resultado.cupon;
    const porcentaje = this.obtenerPorcentajeCupon(nuevoCupon);
    const esNuevoBienvenida = nuevoCupon.is_welcome || nuevoCupon.tipo === 'bienvenida';

    let nuevaLista = [...actuales];

    if (esNuevoBienvenida) {
      if (nuevaLista.some((c) => c.is_welcome || c.tipo === 'bienvenida')) {
        this.esErrorCupon.set(true);
        this.mensajeCupon.set('Ya has aplicado el cupón de bienvenida.');
        return;
      }
      nuevaLista.push(nuevoCupon);
    } else {
      nuevaLista = nuevaLista.filter((c) => c.is_welcome || c.tipo === 'bienvenida');
      nuevaLista.push(nuevoCupon);
    }

    if (nuevaLista.length > 2) {
      this.esErrorCupon.set(true);
      this.mensajeCupon.set('Solo puedes aplicar un máximo de dos cupones.');
      return;
    }

    this.cuponesAplicados.set(nuevaLista);
    this.codigoCuponInput.set('');
    this.mensajeCupon.set(`¡Cupón "${nuevoCupon.code}" aplicado con éxito! (${porcentaje}% desc)`);
  }

  async cargarDatosCheckout(): Promise<void> {
    try {
      this.cargando.set(true);
      if (!this.funcionId() || this.funcionId() === 'solo-candy-placeholder-id') {
        if (this.misAsientos().length === 0) {
          this.cargando.set(false);
          return;
        }
      }
      await this.cargarDetalleFuncion();
      await this.cargarAsientosSeleccionados();
    } catch (error: any) {
      console.error('Hubo un error al cargar el resumen de compra: ' + error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarDetalleFuncion(): Promise<void> {
    const fId = this.funcionId();
    if (!fId) return;
    const { data, error } = await supabase
      .from('funciones')
      .select(
        `
        precio_pesos,
        precio_puntos,
        pelicula_id,
        peliculas (
          id,
          nombre,
          limite_edad,
          fecha_estreno,
          preventa_activa,
          dias_preventa,
          porcentaje_preventa
        )
      `,
      )
      .eq('id', fId)
      .single();

    if (!error && data) {
      const peliNormalizada = Array.isArray(data.peliculas) ? data.peliculas[0] : data.peliculas;
      this.funcionData.set({
        ...data,
        peliculas: peliNormalizada || null,
      });
    }
  }

  async cargarAsientosSeleccionados(): Promise<void> {
    if (this.misAsientos() && this.misAsientos().length > 0) {
      return;
    }

    const fId = this.funcionId();
    if (!fId) return;

    const todasLasEntradas = await this.entradasService.getEntradasPorFuncion(fId);

    if (!todasLasEntradas) {
      this.misAsientos.set([]);
      return;
    }

    const uId = this.usuarioId();
    if (uId) {
      const filtrados = todasLasEntradas.filter(
        (e) => e.usuario_id === uId && e.estado === 'seleccionado',
      );
      this.misAsientos.set(filtrados);
    } else {
      const filtrados = todasLasEntradas.filter(
        (e) => this.idsAsientosAnonimo.includes(e.id) && e.estado === 'seleccionado',
      );
      this.misAsientos.set(filtrados);
    }
  }

  // 🎟️ Helpers para diferenciar asientos VIP (R, S, T) y generales
  esAsientoVip(fila: string): boolean {
    return this.entradasService.esFilaVip(fila);
  }

  private obtenerPrecioBaseAsientoPesos(fila: string): number {
    return this.entradasService.obtenerPrecioAsiento(this.funcionData(), fila, 'efectivo');
  }

  private obtenerPrecioBaseAsientoPuntos(fila: string): number {
    return this.entradasService.obtenerPrecioAsiento(this.funcionData(), fila, 'puntos');
  }

  obtenerPrecioAsientoPesos(fila: string): number {
    return this.aplicarRecargoPreventa(this.obtenerPrecioBaseAsientoPesos(fila));
  }

  obtenerPrecioAsientoPuntos(fila: string): number {
    return this.aplicarRecargoPreventa(this.obtenerPrecioBaseAsientoPuntos(fila));
  }

  /**
   * Ordena los asientos dejando primero los Generales y al final los VIP.
   * Así, si el usuario tiene 1 General + 1 VIP + 1 Combo con entrada,
   * el combo cubre la entrada general y la VIP se cobra aparte.
   */
  get asientosOrdenadosParaFacturacion(): any[] {
    const asientos = [...(this.misAsientos() || [])];
    return asientos.sort((a, b) => {
      const vipA = this.esAsientoVip(a?.fila) ? 1 : 0;
      const vipB = this.esAsientoVip(b?.fila) ? 1 : 0;
      if (vipA !== vipB) return vipA - vipB;
      const filaCmp = String(a?.fila || '').localeCompare(String(b?.fila || ''));
      if (filaCmp !== 0) return filaCmp;
      return Number(a?.numero_asiento || 0) - Number(b?.numero_asiento || 0);
    });
  }

  esAsientoCubiertoPorCombo(asiento: any): boolean {
    const cuposCombo = this.entradasCubiertasPorCombos;
    if (cuposCombo <= 0) return false;
    const ordenados = this.asientosOrdenadosParaFacturacion;
    const indice = ordenados.findIndex(
      (a) =>
        (a?.id && asiento?.id && a.id === asiento.id) ||
        (a?.fila === asiento?.fila && a?.numero_asiento === asiento?.numero_asiento),
    );
    return indice !== -1 && indice < cuposCombo;
  }

  get cantidadAsientosVip(): number {
    return (this.misAsientos() || []).filter((a) => this.esAsientoVip(a?.fila)).length;
  }

  get cantidadAsientosGenerales(): number {
    return (this.misAsientos() || []).filter((a) => !this.esAsientoVip(a?.fila)).length;
  }

  get entradasCubiertasPorCombos(): number {
    const items = this.itemsCandySeleccionados();
    if (!items || items.length === 0) return 0;

    return items.reduce((acc, item) => {
      const cantEntradasPorCombo = Number(
        item?.cantidad_entradas ??
          item?.cantidadEntradas ??
          (item?.incluye_entrada || item?.incluyeEntrada ? 1 : 0),
      );
      if (cantEntradasPorCombo <= 0) return acc;
      const cantCombos = Number(item.cantidad || item.cantidadDeseada || 0);
      return acc + cantCombos * cantEntradasPorCombo;
    }, 0);
  }

  get entradasFacturablesSueltas(): number {
    const totalAsientos = Number(this.misAsientos()?.length || 0);
    return Math.max(0, totalAsientos - this.entradasCubiertasPorCombos);
  }

  // Diferencia unitaria entre entrada VIP y General (+100% de la general), con preventa si aplica
  get diferenciaVipPesos(): number {
    const func = this.funcionData();
    const baseDiff = Math.max(
      0,
      this.entradasService.calcularPrecioVipPesos(func) -
        this.entradasService.calcularPrecioGeneralPesos(func),
    );
    return Number(this.aplicarRecargoPreventa(baseDiff).toFixed(2));
  }

  get diferenciaVipPuntos(): number {
    const func = this.funcionData();
    const baseDiff = Math.max(
      0,
      this.entradasService.calcularPrecioVipPuntos(func) -
        this.entradasService.calcularPrecioGeneralPuntos(func),
    );
    return this.aplicarRecargoPreventa(baseDiff);
  }

  // Cantidad de asientos VIP que quedaron cubiertos por combos con entrada
  get cantidadAsientosVipCubiertosPorCombo(): number {
    const ordenados = this.asientosOrdenadosParaFacturacion;
    const cubiertos = ordenados.slice(0, Math.min(this.entradasCubiertasPorCombos, ordenados.length));
    return cubiertos.filter((a) => this.esAsientoVip(a?.fila)).length;
  }

  // Recargo VIP total sumado a los combos cuando absorben asientos VIP
  get recargoVipEnCombosPesos(): number {
    return Number((this.cantidadAsientosVipCubiertosPorCombo * this.diferenciaVipPesos).toFixed(2));
  }

  get recargoVipEnCombosPuntos(): number {
    return this.cantidadAsientosVipCubiertosPorCombo * this.diferenciaVipPuntos;
  }

  // Total de asientos sueltos (los que NO cubrió ningún combo)
  get totalEntradasPesos(): number {
    const ordenados = this.asientosOrdenadosParaFacturacion;
    const cubiertas = Math.min(this.entradasCubiertasPorCombos, ordenados.length);
    const asientosSueltos = ordenados.slice(cubiertas);

    const total = asientosSueltos.reduce(
      (acc, asiento) => acc + this.obtenerPrecioAsientoPesos(asiento?.fila),
      0,
    );
    return Number(total.toFixed(2));
  }

  get totalEntradasPuntos(): number {
    const ordenados = this.asientosOrdenadosParaFacturacion;
    const cubiertas = Math.min(this.entradasCubiertasPorCombos, ordenados.length);
    const asientosSueltos = ordenados.slice(cubiertas);

    return asientosSueltos.reduce(
      (acc, asiento) => acc + this.obtenerPrecioAsientoPuntos(asiento?.fila),
      0,
    );
  }

  // Recargo de preventa visible en entradas sueltas
  get recargoPreventaEntradasPesos(): number {
    if (!this.enPreventaActiva()) return 0;
    const ordenados = this.asientosOrdenadosParaFacturacion;
    const cubiertas = Math.min(this.entradasCubiertasPorCombos, ordenados.length);
    const asientosSueltos = ordenados.slice(cubiertas);
    const totalBase = asientosSueltos.reduce(
      (acc, asiento) => acc + this.obtenerPrecioBaseAsientoPesos(asiento?.fila),
      0,
    );
    return Number(Math.max(0, this.totalEntradasPesos - totalBase).toFixed(2));
  }

  get recargoPreventaEntradasPuntos(): number {
    if (!this.enPreventaActiva()) return 0;
    const ordenados = this.asientosOrdenadosParaFacturacion;
    const cubiertas = Math.min(this.entradasCubiertasPorCombos, ordenados.length);
    const asientosSueltos = ordenados.slice(cubiertas);
    const totalBase = asientosSueltos.reduce(
      (acc, asiento) => acc + this.obtenerPrecioBaseAsientoPuntos(asiento?.fila),
      0,
    );
    return Math.max(0, this.totalEntradasPuntos - totalBase);
  }

  get totalCandyPesos(): number {
    const items = this.itemsCandySeleccionados();
    const baseCandy =
      !items || items.length === 0
        ? 0
        : items.reduce((acc, item) => {
            const precio = Number(item.precio || item.precio_dinero || 0);
            const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
            return acc + precio * cantidad;
          }, 0);

    return Number((baseCandy + this.recargoVipEnCombosPesos).toFixed(2));
  }

  get totalCandyPuntos(): number {
    const items = this.itemsCandySeleccionados();
    const basePuntos =
      !items || items.length === 0
        ? 0
        : items.reduce((acc, item) => {
            const puntos = Number(item.precio_puntos || 0);
            const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
            return acc + puntos * cantidad;
          }, 0);

    return basePuntos + this.recargoVipEnCombosPuntos;
  }

  // 🔹 Método mixto: toma primero los créditos disponibles y luego completa con dinero disponible
  private esMetodoMixto(metodo: string): boolean {
    const m = (metodo || '').toLowerCase();
    return m === 'mixto' || m === 'credito' || m === 'creditos';
  }

  private calcularDesgloseMixtoCredito(
    totalGeneral: number,
    creditosDisponibles: number,
    dineroDisponible: number,
    creditosDeseados?: number,
  ) {
    const total = Math.max(0, Number(totalGeneral || 0));
    const credDisp = Math.max(0, Number(creditosDisponibles || 0));
    const dinDisp = Math.max(0, Number(dineroDisponible || 0));

    const topePorCompraYSaldo = Math.min(total, credDisp);
    const deseado =
      creditosDeseados !== undefined &&
      creditosDeseados !== null &&
      !Number.isNaN(Number(creditosDeseados))
        ? Math.max(0, Number(creditosDeseados))
        : topePorCompraYSaldo;

    const creditosAplicados = Number(Math.min(topePorCompraYSaldo, deseado).toFixed(2));
    const restanteTrasCreditos = Number(Math.max(0, total - creditosAplicados).toFixed(2));
    const dineroAplicado = Number(Math.min(restanteTrasCreditos, dinDisp).toFixed(2));
    const faltanteTotal = Number(Math.max(0, restanteTrasCreditos - dineroAplicado).toFixed(2));

    return {
      creditosAplicados,
      restanteTrasCreditos,
      dineroAplicado,
      faltanteTotal,
    };
  }

  get subtotalBrutoPesos(): number {
    return Number((this.totalEntradasPesos + this.totalCandyPesos).toFixed(2));
  }

  get montoDescuentoPesos(): number {
    const porcentaje = this.porcentajeDescuentoCupones;
    if (porcentaje <= 0) return 0;
    return Number(((this.subtotalBrutoPesos * porcentaje) / 100).toFixed(2));
  }

  get totalPagar(): number {
    return Number(Math.max(0, this.subtotalBrutoPesos - this.montoDescuentoPesos).toFixed(2));
  }

  get subtotalBrutoPuntos(): number {
    return this.totalEntradasPuntos + this.totalCandyPuntos;
  }

  get descuentoPuntos(): number {
    const porcentaje = this.porcentajeDescuentoCupones;
    if (porcentaje <= 0) return 0;
    return Math.round((this.subtotalBrutoPuntos * porcentaje) / 100);
  }

  get totalPuntos(): number {
    return Math.max(0, this.subtotalBrutoPuntos - this.descuentoPuntos);
  }

  trackByItemCandy(index: number, item: any): any {
    return item.id || item.producto_id || item.nombre;
  }

  async validarRestriccionEdad(usuarioId: string, peliculaId: string): Promise<boolean> {
    try {
      const { data: cliente, error: errCliente } = await supabase
        .from('clientes')
        .select('fecha_nacimiento')
        .eq('id', usuarioId)
        .single();

      if (errCliente || !cliente?.fecha_nacimiento) {
        return true;
      }

      const { data: funcion, error: errFuncion } = await supabase
        .from('funciones')
        .select(
          `
          id,
          peliculas (
            nombre,
            limite_edad
          )
        `,
        )
        .eq('id', this.funcionId())
        .single();

      if (errFuncion || !funcion || !funcion.peliculas) {
        console.error('Error al obtener la función o película:', errFuncion);
        return true;
      }

      const pelicula = Array.isArray(funcion.peliculas) ? funcion.peliculas[0] : (funcion.peliculas as any);
      const limiteEdadPelicula = pelicula?.limite_edad || 'ATP';
      const nombrePeli = pelicula?.nombre || 'la película';

      const edadMinimaRequerida = await this.entradasService.obtenerEdadMinima(limiteEdadPelicula);
      const edadCliente = await this.entradasService.calcularEdadUsuario(cliente.fecha_nacimiento);

      if (Number(edadCliente) < Number(edadMinimaRequerida)) {
        this.mensajeEdadInsuficiente.set(
          `Lo sentimos, "${nombrePeli}" es apta solo para mayores de ${edadMinimaRequerida} años.`,
        );
        return false;
      }

      return true;
    } catch (e) {
      console.error('Error al validar restricción de edad:', e);
      return true;
    }
  }

  private async obtenerIdsFisicosTotales(): Promise<any[]> {
    const itemsBase = this.productosService.obtenerItemsSeleccionadosParaCheckout(
      this.itemsCandySeleccionados(),
    );

    const combosSeleccionados = this.itemsCandySeleccionados().filter(
      (item) => item?.esCombo && Array.isArray(item?.items) && item.items.length > 0,
    );

    if (combosSeleccionados.length === 0) {
      return itemsBase;
    }

    const productosDisponibles = await this.productosService.getProductos();
    const idsYaUsados = new Set<string>();

    for (const itemBase of itemsBase) {
      for (const id of itemBase.idsFisicos || []) {
        idsYaUsados.add(id);
      }
    }

    const extrasCombo: any[] = [];

    for (const combo of combosSeleccionados) {
      const cantCombos = Number(combo.cantidad || combo.cantidadDeseada || 1);

      for (const comp of combo.items) {
        const cantNecesaria = (Number(comp.cantidad) || 1) * cantCombos;
        const candidatas = productosDisponibles.filter((p) => {
          if (!p.id || idsYaUsados.has(p.id) || p.estado !== 'disponible') return false;
          const matchNombre = comp.producto_nombre
            ? p.nombre.trim().toLowerCase() === comp.producto_nombre.trim().toLowerCase()
            : true;
          const matchCategoria = comp.categoria
            ? p.categoria.trim().toLowerCase() === comp.categoria.trim().toLowerCase()
            : true;
          return matchNombre && matchCategoria;
        });

        const tomados = candidatas.slice(0, cantNecesaria);
        tomados.forEach((t) => idsYaUsados.add(t.id!));

        if (tomados.length > 0) {
          extrasCombo.push({
            nombre: `${comp.producto_nombre || comp.categoria} (Combo: ${combo.nombre})`,
            precio: 0,
            cantidad: tomados.length,
            idsFisicos: tomados.map((t) => t.id!),
          });
        }
      }
    }

    return [...itemsBase, ...extrasCombo];
  }

  // 🌟 CONFIRMACIÓN DE PAGO CON VERIFICACIÓN DE SALDO EN CLIENTES
  async confirmarPagoFinal(): Promise<void> {
    const uId = this.usuarioId();
    if (uId) {
      const cumpleEdad = await this.validarRestriccionEdad(uId, this.funcionId());
      if (!cumpleEdad) {
        await this.liberarAsientosTemporales();
        this.mostrarModalEdadInsuficiente.set(true);
        return;
      }
    }

    try {
      if (this.misAsientos().length === 0 && this.itemsCandySeleccionados().length === 0) {
        console.warn('Tu carrito está vacío.');
        return;
      }

      const totalGeneral = this.totalPagar;
      const totalGeneralPuntos = this.totalPuntos;
      const metodo = this.metodoPago();

      if (!uId) {
        const montoIngresado = Number(this.montoIngresadoAnonimo());
        if (montoIngresado !== Number(totalGeneral)) {
          console.warn(`El monto ingresado debe ser exacto ($${totalGeneral}).`);
          return;
        }

        const itemsConIdsFisicos = await this.obtenerIdsFisicosTotales();
        const itemsCandyParaJson = this.itemsCandySeleccionados().map((item) => ({
          id: item.id || item.producto_id,
          nombre: item.nombre,
          precio: Number(item.precio || item.precio_dinero || 0),
          cantidad: Number(item.cantidad || item.cantidadDeseada || 0),
        }));

        const codigoUnico = await this.entradasService.confirmarCompraConCandy(
          null,
          this.misAsientos(),
          'efectivo',
          itemsCandyParaJson,
          itemsConIdsFisicos,
          totalGeneral,
        );

        await this.pdfService.generarComprobanteEntrada({
          codigoUnico,
          asientos: this.misAsientos(),
          itemsCandy: this.itemsCandySeleccionados(),
          total: totalGeneral,
          metodoPago: 'efectivo',
          funcionData: this.funcionData(),
          cupones: this.cuponesAplicados(),
          enPreventa: this.enPreventaActiva(),
          porcentajePreventa: this.porcentajePreventa(),
        });

        localStorage.removeItem('carritoCandyTemp');
        localStorage.removeItem('asientosSeleccionados');
        this.itemsCandySeleccionados.set([]);
        this.productosService.limpiarCarritoTemp();
        this.codigoRetiroExitoso.set(codigoUnico);
        this.mostrarModalExito.set(true);
        this.misAsientos.set([]);
        return;
      }

      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('dinero, puntos, creditos')
        .eq('id', uId)
        .single();

      if (clienteError || !clienteData) {
        throw new Error('No se pudo verificar el saldo de tu cuenta.');
      }

      const dineroActual = Number(clienteData.dinero || 0);
      const creditosActuales = Number(clienteData.creditos || 0);
      this.creditosDisponiblesCliente.set(creditosActuales);

      if (metodo === 'efectivo') {
        if (dineroActual < totalGeneral) {
          this.saldoActualCliente.set(dineroActual);
          this.montoFaltante.set(Number((totalGeneral - dineroActual).toFixed(2)));
          this.montoACargarInput.set(Number((totalGeneral - dineroActual).toFixed(2)));
          this.mensajeErrorCarga.set('');
          this.mostrarModalSaldoInsuficiente.set(true);
          return;
        }
      } else if (this.esMetodoCredito(metodo)) {
        const { faltanteTotal } = this.calcularDesgloseMixtoCredito(
          totalGeneral,
          creditosActuales,
          dineroActual,
        );

        if (faltanteTotal > 0) {
          const saldoCombinado = Number((dineroActual + creditosActuales).toFixed(2));
          this.saldoActualCliente.set(saldoCombinado);
          this.montoFaltante.set(faltanteTotal);
          this.montoACargarInput.set(faltanteTotal);
          this.mensajeErrorCarga.set('');
          this.mostrarModalSaldoInsuficiente.set(true);
          return;
        }
      } else if (metodo === 'puntos') {
        const puntosActuales = Number(clienteData.puntos || 0);
        if (puntosActuales < totalGeneralPuntos) {
          console.warn('No tienes suficientes puntos para realizar esta compra.');
          alert('No tienes suficientes puntos.');
          return;
        }
      }

      await this.ejecutarTransaccionCompra(uId, totalGeneral, totalGeneralPuntos, metodo);
    } catch (error: any) {
      console.error(`Error al procesar el pago: ${error.message}`);
    }
  }

  // 🌟 Método auxiliar para ejecutar la transacción una vez verificado el saldo
  private async ejecutarTransaccionCompra(
    uId: string,
    totalGeneral: number,
    totalGeneralPuntos: number,
    metodo: string,
  ): Promise<void> {
    const itemsConIdsFisicos = await this.obtenerIdsFisicosTotales();
    const itemsCandyParaJson = this.itemsCandySeleccionados().map((item) => ({
      id: item.id || item.producto_id,
      nombre: item.nombre,
      precio: Number(item.precio || item.precio_dinero || 0),
      cantidad: Number(item.cantidad || item.cantidadDeseada || 0),
    }));

    if (metodo === 'efectivo') {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('dinero, puntos')
        .eq('id', uId)
        .single();
      const dineroActual = Number(clienteData?.dinero || 0);
      const nuevoDinero = Number((dineroActual - totalGeneral).toFixed(2));
      const nuevosPuntos = Number(clienteData?.puntos || 0) + Math.floor(totalGeneral);

      this.creditosAUsar.set(0);
      this.dineroAUsar.set(totalGeneral);

      await supabase
        .from('clientes')
        .update({ dinero: nuevoDinero, puntos: nuevosPuntos })
        .eq('id', uId);
    } else if (this.esMetodoCredito(metodo)) {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('dinero, puntos, creditos')
        .eq('id', uId)
        .single();

      const dineroActual = Number(clienteData?.dinero || 0);
      const creditosActuales = Number(clienteData?.creditos || 0);

      const { creditosAplicados, dineroAplicado } = this.calcularDesgloseMixtoCredito(
        totalGeneral,
        creditosActuales,
        dineroActual,
      );

      const nuevoCredito = Number((creditosActuales - creditosAplicados).toFixed(2));
      const nuevoDinero = Number((dineroActual - dineroAplicado).toFixed(2));
      const nuevosPuntos = Number(clienteData?.puntos || 0) + Math.floor(totalGeneral);

      this.creditosAUsar.set(creditosAplicados);
      this.dineroAUsar.set(dineroAplicado);
      this.creditosDisponiblesCliente.set(nuevoCredito);

      await supabase
        .from('clientes')
        .update({
          creditos: nuevoCredito,
          dinero: nuevoDinero,
          puntos: nuevosPuntos,
        })
        .eq('id', uId);
    } else if (metodo === 'puntos') {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('puntos')
        .eq('id', uId)
        .single();
      const puntosActuales = Number(clienteData?.puntos || 0);
      const nuevosPuntos = puntosActuales - totalGeneralPuntos;

      this.creditosAUsar.set(0);
      this.dineroAUsar.set(0);

      await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', uId);
    }

    const codigoUnico = await this.entradasService.confirmarCompraConCandy(
      uId,
      this.misAsientos(),
      metodo,
      itemsCandyParaJson,
      itemsConIdsFisicos,
      totalGeneral,
    );

    for (const cupon of this.cuponesAplicados()) {
      if (cupon.userCouponId) {
        await this.adminCuponesService.marcarCuponComoUsado(cupon.userCouponId);
      }
    }

    await this.pdfService.generarComprobanteEntrada({
      codigoUnico,
      asientos: this.misAsientos(),
      itemsCandy: this.itemsCandySeleccionados(),
      total: totalGeneral,
      metodoPago: metodo,
      funcionData: this.funcionData(),
      cupones: this.cuponesAplicados(),
      enPreventa: this.enPreventaActiva(),
      porcentajePreventa: this.porcentajePreventa(),
    });

    localStorage.removeItem('carritoCandyTemp');
    localStorage.removeItem('asientosSeleccionados');
    this.itemsCandySeleccionados.set([]);
    this.productosService.limpiarCarritoTemp();

    this.codigoRetiroExitoso.set(codigoUnico);
    this.mostrarModalExito.set(true);

    this.misAsientos.set([]);
  }

  // 🌟 Cargar saldo desde el modal de saldo insuficiente
  async cargarSaldoYContinuar(): Promise<void> {
    const uId = this.usuarioId();
    if (!uId) return;

    const cumpleEdad = await this.validarRestriccionEdad(uId, this.funcionId());
    if (!cumpleEdad) {
      this.mostrarModalSaldoInsuficiente.set(false);
      await this.liberarAsientosTemporales();
      this.mostrarModalEdadInsuficiente.set(true);
      return;
    }

    const montoACargar = Number(this.montoACargarInput());
    const totalGeneral = this.totalPagar;
    const metodo = this.metodoPago();

    const { data: clienteRefrescado } = await supabase
      .from('clientes')
      .select('dinero, creditos')
      .eq('id', uId)
      .single();

    const dineroActual = Number(clienteRefrescado?.dinero || 0);
    const creditosActuales = Number(clienteRefrescado?.creditos || 0);

    const faltanteMinimo = this.esMetodoCredito(metodo)
      ? this.calcularDesgloseMixtoCredito(totalGeneral, creditosActuales, dineroActual)
          .faltanteTotal
      : Number(Math.max(0, totalGeneral - dineroActual).toFixed(2));

    if (montoACargar < faltanteMinimo) {
      this.mensajeErrorCarga.set(
        `El monto a cargar debe ser al menos de $${faltanteMinimo.toFixed(2)} para cubrir la compra.`,
      );
      return;
    }

    try {
      this.mensajeErrorCarga.set('');
      const nuevoDineroTotal = Number((dineroActual + montoACargar).toFixed(2));

      const { error } = await supabase
        .from('clientes')
        .update({ dinero: nuevoDineroTotal })
        .eq('id', uId);

      if (error) throw error;

      this.mostrarModalSaldoInsuficiente.set(false);
      await this.ejecutarTransaccionCompra(uId, totalGeneral, this.totalPuntos, metodo);
    } catch (error: any) {
      this.mensajeErrorCarga.set(`Error al cargar saldo: ${error.message}`);
    }
  }

  cerrarModalSaldo(): void {
    this.mostrarModalSaldoInsuficiente.set(false);
  }

  async aplicarCupon(): Promise<void> {
    const codigo = this.codigoCuponInput();
    if (codigo) {
      await this.seleccionarCuponRapido(codigo);
    }
  }

  cerrarModalEdadYRedirigir(): void {
    this.mostrarModalEdadInsuficiente.set(false);
    this.router.navigate(['/home']);
  }

  finalizarYRedirigir(): void {
    this.mostrarModalExito.set(false);
    this.router.navigate(['/home']);
  }

  volverSeleccion(): void {
    this.location.back();
  }
}