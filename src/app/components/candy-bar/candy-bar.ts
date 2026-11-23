import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductosService } from '../../services/productos.service';
import { AuthService } from '../../services/auth.service';
import { EntradasService } from '../../services/entradas.services';
import {
  CombosService,
  ComboConfig,
  ComboConDisponibilidad,
} from '../../services/combos.service';
import { ComponenteConAsientosPendientes } from '../../guards/liberar-asientos.guard';
import { OcultarSiStaffDirective } from '../../directives/ocultar-si-staff.directive';

@Component({
  selector: 'app-candy-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, OcultarSiStaffDirective],
  templateUrl: './candy-bar.html',
  styleUrls: ['./candy-bar.css'],
})
export class CandyBarComponent implements OnInit, ComponenteConAsientosPendientes {
  private productosService = inject(ProductosService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private entradasService = inject(EntradasService);
  private combosService = inject(CombosService);

  rol = toSignal(this.authService.rol$, { initialValue: '' });

  esStaff = computed(() => {
    const r = (this.rol() || '').toLowerCase();
    return r === 'admin' || r === 'empleado';
  });

  productos = signal<any[]>([]);
  combosRaw = signal<ComboConfig[]>([]);
  cantidadesCombos = signal<Record<string, number>>({});
  cargando = signal<boolean>(true);

  // 🔹 Señal para saber si hay asientos seleccionados activos
  tieneAsientosPendientes = signal<boolean>(false);
  private funcionIdAsientos: string = '';

  // 🛡️ Alerta nativa si intentan cerrar pestaña o recargar con asientos pendientes
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.tieneAsientosPendientes()) {
      $event.returnValue = 'Si sales ahora, perderás los asientos que habías seleccionado.';
    }
  }

  puedeSalir(): boolean {
    this.verificarAsientosLocales();
    return !this.tieneAsientosPendientes();
  }

  async liberarAsientosTemporales(): Promise<void> {
    try {
      const asientosLocal = localStorage.getItem('asientosSeleccionados');
      if (asientosLocal) {
        const asientos = JSON.parse(asientosLocal);
        for (const asiento of asientos) {
          if (asiento.id) {
            await this.entradasService.liberarAsiento(asiento.id);
          }
        }
        localStorage.removeItem('asientosSeleccionados');
        localStorage.removeItem('carritoCandyTemp');
      }
    } catch (err) {
      console.error('Error al liberar asientos desde el Candy Bar:', err);
    }
  }

  async ngOnInit(): Promise<void> {
    this.verificarAsientosLocales();
    await Promise.all([this.cargarProductos(), this.cargarCombos()]);
  }

  ionViewWillEnter() {
    this.verificarAsientosLocales();
  }

  // 🌟 Verificación dinámica actualizada
  verificarAsientosLocales(): void {
    const asientosLocal = localStorage.getItem('asientosSeleccionados');
    if (asientosLocal) {
      try {
        const parsed = JSON.parse(asientosLocal);
        if (parsed.length > 0) {
          this.tieneAsientosPendientes.set(true);
          if (parsed[0].funcion_id) {
            this.funcionIdAsientos = parsed[0].funcion_id;
          }
          return;
        }
      } catch (e) {}
    }
    this.tieneAsientosPendientes.set(false);
    this.funcionIdAsientos = '';
  }

  private cantidadAsientosSeleccionados(): number {
    const raw = localStorage.getItem('asientosSeleccionados');
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }

  volverASeleccionAsientos(): void {
    if (this.funcionIdAsientos) {
      this.router.navigate(['/seleccionar-asientos', this.funcionIdAsientos]);
    } else {
      this.router.navigate(['/cartelera']);
    }
  }

  async cargarProductos(): Promise<void> {
    try {
      this.cargando.set(true);
      const data = await this.productosService.getProductosAgrupados();

      // 🌟 Recuperamos el carrito temporal guardado previamente en localStorage
      const carritoGuardado = localStorage.getItem('carritoCandyTemp');
      let itemsPrevios: any[] = [];
      if (carritoGuardado) {
        try {
          itemsPrevios = JSON.parse(carritoGuardado);
        } catch (e) {
          itemsPrevios = [];
        }
      }

      // Restauramos cantidades previas de productos individuales
      const productosConCantidad = data.map((p) => {
        const itemEncontrado = itemsPrevios.find(
          (item: any) => !item.esCombo && (item.id || item.producto_id) === p.id
        );
        const cantidadPrevia = itemEncontrado
          ? itemEncontrado.cantidad || itemEncontrado.cantidadDeseada || 0
          : 0;

        return {
          ...p,
          cantidadDeseada: Math.min(p.stock || 0, p.cantidadDeseada || cantidadPrevia),
        };
      });

      this.productos.set(productosConCantidad);

      // Restauramos cantidades previas de combos si existían en carritoCandyTemp
      const combosPreviosMap: Record<string, number> = {};
      for (const item of itemsPrevios) {
        if (item.esCombo && item.combo_id) {
          combosPreviosMap[item.combo_id] = item.cantidad || 0;
        }
      }
      if (Object.keys(combosPreviosMap).length > 0) {
        this.cantidadesCombos.set(combosPreviosMap);
      }
    } catch (error: any) {
      console.error('Error al cargar productos:', error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarCombos(): Promise<void> {
    try {
      const lista = await this.combosService.getCombosConItems(!this.esStaff());
      this.combosRaw.set(lista);
    } catch (error: any) {
      console.error('Error al cargar combos:', error.message);
    }
  }

  // 🔹 Combos con disponibilidad real calculada según productos disponibles
  combos = computed<ComboConDisponibilidad[]>(() => {
    return this.combosService.calcularDisponibilidadCombos(
      this.combosRaw(),
      this.productos(),
      this.cantidadesCombos(),
      this.cantidadAsientosSeleccionados()
    );
  });

  // 🔹 Unidades de un producto ya reservadas por combos seleccionados en el carrito
  private unidadesReservadasPorCombos(producto: any): number {
    return this.combos().reduce((acc, combo) => {
      const cantCombo = combo.cantidadDeseada || 0;
      if (cantCombo <= 0 || !combo.items?.length) return acc;

      const coincide = combo.items.find((it) => {
        const matchNombre = it.producto_nombre
          ? producto.nombre?.trim().toLowerCase() === it.producto_nombre.trim().toLowerCase()
          : true;
        const matchCategoria = it.categoria
          ? producto.categoria?.trim().toLowerCase() === it.categoria.trim().toLowerCase()
          : true;
        return matchNombre && matchCategoria;
      });

      return acc + (coincide ? cantCombo * (coincide.cantidad || 1) : 0);
    }, 0);
  }

  stockDisponibleIndividual(producto: any): number {
    const total = Number(producto.stock) || 0;
    const reservadoCombos = this.unidadesReservadasPorCombos(producto);
    return Math.max(0, total - reservadoCombos);
  }

  cambiarCantidad(producto: any, delta: number): void {
    const maxSuelto = this.stockDisponibleIndividual(producto);

    this.productos.update((lista) =>
      lista.map((p) => {
        if (p.id === producto.id) {
          const actual = p.cantidadDeseada || 0;
          const nuevaCantidad = Math.max(0, Math.min(maxSuelto, actual + delta));
          return { ...p, cantidadDeseada: nuevaCantidad };
        }
        return p;
      })
    );
  }

  cambiarCantidadCombo(combo: ComboConDisponibilidad, delta: number): void {
    const actual = combo.cantidadDeseada || 0;
    const siguiente = Math.max(0, Math.min(combo.stockDisponible, actual + delta));

    this.cantidadesCombos.update((prev) => ({
      ...prev,
      [combo.id]: siguiente,
    }));
  }

  async agregarMasStock(producto: any): Promise<void> {
    const cantidadAAgregar = Math.max(1, Number(producto.cantidadDeseada) || 1);

    try {
      this.cargando.set(true);
      await this.productosService.agregarStockMasivo(producto, cantidadAAgregar);

      // Limpiamos la selección temporal en esa tarjeta para no confundirla con compra
      this.productos.update((lista) =>
        lista.map((p) => (p.id === producto.id ? { ...p, cantidadDeseada: 0 } : p))
      );

      await this.cargarProductos();
    } catch (error: any) {
      console.error('Error al agregar más stock:', error);
      alert('No se pudo agregar stock: ' + (error.message || ''));
    } finally {
      this.cargando.set(false);
    }
  }
  // 🔹 Total de entradas incluidas entre todos los combos seleccionados
  entradasRequeridasPorCombos = computed(() => {
    return this.combos().reduce((acc, c) => {
      if (!c.incluye_entrada || !(c.cantidadDeseada > 0)) return acc;
      return acc + (Number(c.cantidad_entradas) || 1) * c.cantidadDeseada;
    }, 0);
  });


  irAlCheckout(): void {
    const productosSeleccionados = this.productos()
      .filter((p) => (p.cantidadDeseada || 0) > 0)
      .map((p) => ({
        ...p,
        esCombo: false,
        cantidad: p.cantidadDeseada,
      }));

    const combosSeleccionados = this.combos()
      .filter((c) => (c.cantidadDeseada || 0) > 0)
      .map((c) => ({
        id: c.id,
        combo_id: c.id,
        nombre: c.nombre,
        descripcion: c.descripcion,
        imagen: c.imagen,
        precio_dinero: c.precio_dinero,
        precio_puntos: c.precio_puntos || 0,
        incluye_entrada: c.incluye_entrada,
        cantidad_entradas: c.cantidad_entradas,
        items: c.items,
        esCombo: true,
        cantidad: c.cantidadDeseada,
      }));

    const itemsSeleccionados = [...combosSeleccionados, ...productosSeleccionados];
    const hayAsientos = this.tieneAsientosPendientes();
    const asientosActuales = this.cantidadAsientosSeleccionados();
    const entradasNecesarias = this.entradasRequeridasPorCombos();

    // 🛒 Caso 0: No eligió ni snacks/combos ni asientos
    if (itemsSeleccionados.length === 0 && !hayAsientos) {
      this.modalAviso.set({
        titulo: 'Carrito vacío',
        mensaje: 'Debes seleccionar al menos un combo, producto o volver si no deseas comprar snacks.',
        textoConfirmar: 'Entendido',
        destino: null,
      });
      return;
    }

    // Persistimos el carrito temporal antes de mostrar el modal o navegar
    localStorage.setItem('carritoCandyTemp', JSON.stringify(itemsSeleccionados));
    this.productosService.guardarCarritoTemp(itemsSeleccionados);

    // 🎟️ Caso 1: Eligió combo con entrada pero todavía no eligió función ni asientos
    if (entradasNecesarias > 0 && (!hayAsientos || !this.funcionIdAsientos)) {
      this.modalAviso.set({
        titulo: 'Combo con entrada seleccionada',
        mensaje: `Elegiste un combo que incluye ${entradasNecesarias} entrada(s). Primero seleccioná una película, función y tus asientos en la cartelera. Tu selección del Candy Bar quedará guardada.`,
        textoConfirmar: 'Ir a Cartelera',
        destino: ['/cartelera'],
      });
      return;
    }

    // 🎟️ Caso 2: Ya eligió función, pero seleccionó menos asientos que las entradas del combo
    if (entradasNecesarias > 0 && asientosActuales < entradasNecesarias) {
      const faltantes = entradasNecesarias - asientosActuales;
      this.modalAviso.set({
        titulo: 'Faltan asientos por seleccionar',
        mensaje: `Tu combo incluye ${entradasNecesarias} entrada(s), pero tenés ${asientosActuales} asiento(s) seleccionado(s). Seleccioná ${faltantes} asiento(s) más para continuar.`,
        textoConfirmar: 'Seleccionar Asientos',
        destino: ['/seleccionar-asientos', this.funcionIdAsientos],
      });
      return;
    }

    // ✅ Caso 3: Listo para ir a pagar
    const funcionIdDestino =
      hayAsientos && this.funcionIdAsientos ? this.funcionIdAsientos : 'solo-candy-placeholder-id';

    this.router.navigate(['/checkout', funcionIdDestino]);
  } 

  trackByProducto(index: number, producto: any): any {
    return producto.id || producto.nombre;
  }

  trackByCombo(index: number, combo: ComboConDisponibilidad): any {
    return combo.id;
  }

  // 🔹 Estado del modal de aviso (reemplaza alert())
  modalAviso = signal<{
    titulo: string;
    mensaje: string;
    textoConfirmar: string;
    destino: any[] | null;
  } | null>(null);

  cerrarModalAviso(): void {
    this.modalAviso.set(null);
  }

  confirmarModalAviso(): void {
    const actual = this.modalAviso();
    this.modalAviso.set(null);
    if (actual?.destino && actual.destino.length > 0) {
      this.router.navigate(actual.destino);
    }
  }

  totalCarritoPrecio = computed(() => {
    const totalProductos = this.productos().reduce(
      (acc, p) => acc + (p.precio_dinero || 0) * (p.cantidadDeseada || 0),
      0
    );
    const totalCombos = this.combos().reduce(
      (acc, c) => acc + (c.precio_dinero || 0) * (c.cantidadDeseada || 0),
      0
    );
    return totalProductos + totalCombos;
  });
}