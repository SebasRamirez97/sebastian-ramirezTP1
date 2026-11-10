import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradasService } from '../../services/entradas.services';
import { ProductosService } from '../../services/productos.service';
import { supabase } from '../../services/supabaseClient';
import { PdfService } from '../../services/pdf.service';
import { AdminCuponesService } from '../../services/admin-cupones.service';
import { ComponenteConAsientosPendientes } from '../../guards/liberar-asientos.guard';

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
  });

  metodoPago = signal<string>('efectivo');
  creditosAUsar = signal<number>(0);

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

  private idsAsientosAnonimo: string[] = [];

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.misAsientos().length > 0 && !this.mostrarModalExito()) {
      $event.returnValue = 'Si sales ahora, tu proceso de compra se cancelará y perderás tus asientos.';
    }
  }

  // 🛡️ Métodos requeridos por el CanDeactivate Guard
  puedeSalir(): boolean {
    // 🌟 Permitimos salir libremente si el modal de éxito ya se mostró o si ya no hay asientos pendientes
    return this.mostrarModalExito() || this.misAsientos().length === 0;
  }

  async liberarAsientosTemporales(): Promise<void> {
    try {
      // Si la compra ya fue exitosa, no liberamos nada
      if (this.mostrarModalExito()) return;

      const asientos = this.misAsientos();
      for (const asiento of asientos) {
        await this.entradasService.liberarAsiento(asiento.id);
      }
      this.misAsientos.set([]);
      localStorage.removeItem('asientosSeleccionados');
      localStorage.removeItem('carritoCandyTemp');
    } catch (err) {
      console.error('Error al liberar asientos desde el checkout:', err);
    }
  }

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('funcionId') || '';
    this.funcionId.set(idParam);

    let candyTemp: any[] = [];
    const storedCandy = localStorage.getItem('carritoCandyTemp');
    if (storedCandy) {
      try {
        const parsed = JSON.parse(storedCandy);
        candyTemp = parsed.map((item: any) => ({
          ...item,
          precio: Number(item.precio || item.precio_dinero || 0),
          cantidad: Number(item.cantidad || item.cantidadDeseada || 1),
        }));
      } catch (e) {
        candyTemp = [];
      }
    }

    if (candyTemp.length === 0) {
      const serviceItems = this.productosService.obtenerCarritoTemp();
      candyTemp = serviceItems.map((item: any) => ({
        ...item,
        precio: Number(item.precio || item.precio_dinero || 0),
        cantidad: Number(item.cantidad || item.cantidadDeseada || 1),
      }));
    }
    this.itemsCandySeleccionados.set(candyTemp);

    const { data: authData } = await supabase.auth.getUser();

    if (authData?.user) {
      this.usuarioId.set(authData.user.id);
      await this.cargarCuponesDelCliente(authData.user.id);
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

  async cargarCuponesDelCliente(userId: string): Promise<void> {
    const { data, error } = await this.adminCuponesService.obtenerCuponesDelCliente(userId);
    if (!error && data) {
      this.cuponesDisponiblesCliente.set(data);
    }
  }

  async seleccionarCuponRapido(code: string): Promise<void> {
    this.mensajeCupon.set('');
    this.esErrorCupon.set(false);

    const cuponEncontrado = this.cuponesDisponiblesCliente().find(c => c.code.toUpperCase() === code.toUpperCase());
    
    if (!cuponEncontrado) {
      this.codigoCuponInput.set(code);
      await this.aplicarCupon();
      return;
    }

    const actuales = this.cuponesAplicados();
    const yaAplicado = actuales.find(c => c.code.toUpperCase() === code.toUpperCase());

    if (yaAplicado) {
      const filtrados = actuales.filter(c => c.code.toUpperCase() !== code.toUpperCase());
      this.cuponesAplicados.set(filtrados);
      this.mensajeCupon.set(`Cupón "${code}" desactivado.`);
      return;
    }

    const resultado = await this.adminCuponesService.validarCuponParaUsuario(
      code, 
      this.usuarioId(), 
      actuales.filter(c => c.is_welcome || c.tipo === 'bienvenida')
    );

    if (!resultado.valido) {
      this.esErrorCupon.set(true);
      this.mensajeCupon.set(resultado.mensaje);
      return;
    }

    const nuevoCupón = resultado.cupon;
    const esNuevoBienvenida = nuevoCupón.is_welcome || nuevoCupón.tipo === 'bienvenida';

    let nuevaLista = [...actuales];

    if (esNuevoBienvenida) {
      if (nuevaLista.some(c => c.is_welcome || c.tipo === 'bienvenida')) {
        this.esErrorCupon.set(true);
        this.mensajeCupon.set('Ya has aplicado el cupón de bienvenida.');
        return;
      }
      nuevaLista.push(nuevoCupón);
    } else {
      nuevaLista = nuevaLista.filter(c => c.is_welcome || c.tipo === 'bienvenida');
      nuevaLista.push(nuevoCupón);
    }

    if (nuevaLista.length > 2) {
      this.esErrorCupon.set(true);
      this.mensajeCupon.set('Solo puedes aplicar un máximo de dos cupones.');
      return;
    }

    this.cuponesAplicados.set(nuevaLista);
    this.codigoCuponInput.set('');
    this.mensajeCupon.set(`¡Cupón "${nuevoCupón.code}" aplicado con éxito! (${nuevoCupón.discount_percentage}% desc)`);
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
      .select('precio_pesos, precio_puntos')
      .eq('id', fId)
      .single();

    if (!error && data) {
      this.funcionData.set(data);
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
        (e) =>
          this.idsAsientosAnonimo.includes(e.id) &&
          e.estado === 'seleccionado',
      );
      this.misAsientos.set(filtrados);
    }
  }

  get totalEntradasPesos(): number {
    const precio = Number(this.funcionData()?.precio_pesos || 0);
    return Number(this.misAsientos()?.length || 0) * precio;
  }

  get totalEntradasPuntos(): number {
    const precioPts = Number(this.funcionData()?.precio_puntos || 0);
    return Number(this.misAsientos()?.length || 0) * precioPts;
  }

  get totalCandyPesos(): number {
    const items = this.itemsCandySeleccionados();
    if (!items || items.length === 0) return 0;
    return items.reduce((acc, item) => {
      const precio = Number(item.precio || item.precio_dinero || 0);
      const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
      return acc + precio * cantidad;
    }, 0);
  }

  get totalCandyPuntos(): number {
    const items = this.itemsCandySeleccionados();
    if (!items || items.length === 0) return 0;
    return items.reduce((acc, item) => {
      const puntos = Number(item.precio_puntos || 0);
      const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
      return acc + puntos * cantidad;
    }, 0);
  }

  get totalPagar(): number {
    const subtotalEntradas = this.totalEntradasPesos;
    const subtotalCandy = this.totalCandyPesos;
    const subtotalBruto = subtotalEntradas + subtotalCandy;

    const cupones = this.cuponesAplicados();
    if (cupones.length === 0) return subtotalBruto;

    const porcentajeTotalDescuento = cupones.reduce(
      (acc, c) => acc + Number(c.discount_percentage || 0),
      0
    );

    const montoDescuento = (subtotalEntradas * porcentajeTotalDescuento) / 100;
    return Math.max(0, subtotalBruto - montoDescuento);
  }

  get totalPuntos(): number {
    const subtotalEntradasPts = this.totalEntradasPuntos;
    const subtotalCandyPts = this.totalCandyPuntos;
    const subtotalBrutoPts = subtotalEntradasPts + subtotalCandyPts;

    const cupones = this.cuponesAplicados();
    if (cupones.length === 0) return subtotalBrutoPts;

    const porcentajeTotalDescuento = cupones.reduce(
      (acc, c) => acc + Number(c.discount_percentage || 0),
      0
    );

    const descuentoPuntos = (subtotalEntradasPts * porcentajeTotalDescuento) / 100;
    return Math.max(0, subtotalBrutoPts - descuentoPuntos);
  }

  trackByItemCandy(index: number, item: any): any {
    return item.id || item.producto_id || item.nombre;
  }

  // 🌟 CONFIRMACIÓN DE PAGO CON VERIFICACIÓN DE SALDO EN CLIENTES
  async confirmarPagoFinal(): Promise<void> {
    try {
      if (this.misAsientos().length === 0 && this.itemsCandySeleccionados().length === 0) {
        console.warn('Tu carrito está vacío.');
        return;
      }

      const totalGeneral = this.totalPagar;
      const totalGeneralPuntos = this.totalPuntos;
      const uId = this.usuarioId();
      const metodo = this.metodoPago(); // 'efectivo' (dinero) o 'puntos'

      // Si es anónimo, se mantiene el flujo de monto ingresado manual
      if (!uId) {
        const montoIngresado = Number(this.montoIngresadoAnonimo());
        if (montoIngresado !== Number(totalGeneral)) {
          console.warn(`El monto ingresado debe ser exacto ($${totalGeneral}).`);
          return;
        }

        const itemsConIdsFisicos = this.productosService.obtenerItemsSeleccionadosParaCheckout(this.itemsCandySeleccionados());
        const itemsCandyParaJson = this.itemsCandySeleccionados().map((item) => ({
          id: item.id || item.producto_id,
          nombre: item.nombre,
          precio: Number(item.precio || item.precio_dinero || 0),
          cantidad: Number(item.cantidad || item.cantidadDeseada || 0),
        }));

        const codigoUnico = await this.entradasService.confirmarCompraConCandy(
          null, this.misAsientos(), 'efectivo', itemsCandyParaJson, itemsConIdsFisicos, totalGeneral,
        );

        localStorage.removeItem('carritoCandyTemp');
        localStorage.removeItem('asientosSeleccionados');
        
        // 🌟 Marcamos el éxito y vaciamos los asientos locales para permitir la salida
        this.codigoRetiroExitoso.set(codigoUnico);
        this.mostrarModalExito.set(true);
        this.misAsientos.set([]); 
        return;
      }

      // 1. Consultar saldo actual del cliente en Supabase
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('dinero, puntos, creditos')
        .eq('id', uId)
        .single();

      if (clienteError || !clienteData) {
        throw new Error('No se pudo verificar el saldo de tu cuenta.');
      }

      // 2. Verificar si alcanza el saldo según el método de pago seleccionado
      if (metodo === 'efectivo') {
        const dineroActual = Number(clienteData.dinero || 0);
        if (dineroActual < totalGeneral) {
          // 🛑 Saldo insuficiente en dinero: Abrimos el modal
          this.saldoActualCliente.set(dineroActual);
          this.montoFaltante.set(Number((totalGeneral - dineroActual).toFixed(2)));
          this.montoACargarInput.set(Number((totalGeneral - dineroActual).toFixed(2))); // Sugerencia inicial justa
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

      // 3. Si tiene saldo suficiente, procesamos la compra directamente
      await this.ejecutarTransaccionCompra(uId, totalGeneral, totalGeneralPuntos, metodo);

    } catch (error: any) {
      console.error(`Error al procesar el pago: ${error.message}`);
    }
  }

  // 🌟 Método auxiliar para ejecutar la transacción una vez verificado el saldo
  private async ejecutarTransaccionCompra(uId: string, totalGeneral: number, totalGeneralPuntos: number, metodo: string): Promise<void> {
    const itemsConIdsFisicos = this.productosService.obtenerItemsSeleccionadosParaCheckout(this.itemsCandySeleccionados());
    const itemsCandyParaJson = this.itemsCandySeleccionados().map((item) => ({
      id: item.id || item.producto_id,
      nombre: item.nombre,
      precio: Number(item.precio || item.precio_dinero || 0),
      cantidad: Number(item.cantidad || item.cantidadDeseada || 0),
    }));

    if (metodo === 'efectivo') {
      const { data: clienteData } = await supabase.from('clientes').select('dinero, puntos').eq('id', uId).single();
      const dineroActual = Number(clienteData?.dinero || 0);
      const nuevoDinero = Number((dineroActual - totalGeneral).toFixed(2));
      const nuevosPuntos = Number(clienteData?.puntos || 0) + Math.floor(totalGeneral);

      await supabase.from('clientes').update({ dinero: nuevoDinero, puntos: nuevosPuntos }).eq('id', uId);
    } else if (metodo === 'puntos') {
      const { data: clienteData } = await supabase.from('clientes').select('puntos').eq('id', uId).single();
      const puntosActuales = Number(clienteData?.puntos || 0);
      const nuevosPuntos = puntosActuales - totalGeneralPuntos;

      await supabase.from('clientes').update({ puntos: nuevosPuntos }).eq('id', uId);
    }

    const codigoUnico = await this.entradasService.confirmarCompraConCandy(
      uId, this.misAsientos(), metodo, itemsCandyParaJson, itemsConIdsFisicos, totalGeneral,
    );

    // Marcar cupones como usados
    for (const cupon of this.cuponesAplicados()) {
      if (cupon.userCouponId) {
        await this.adminCuponesService.marcarCuponComoUsado(cupon.userCouponId);
      }
    }

    localStorage.removeItem('carritoCandyTemp');
    localStorage.removeItem('asientosSeleccionados');

    await this.pdfService.generarComprobanteEntrada({
      codigoUnico, asientos: this.misAsientos(), total: totalGeneral, metodoPago: metodo,
    });

    this.codigoRetiroExitoso.set(codigoUnico);
    this.mostrarModalExito.set(true);
    
    // 🌟 Vaciamos los asientos locales para permitir la salida inmediata del guard
    this.misAsientos.set([]);
  }

  // 🌟 Cargar saldo desde el modal de saldo insuficiente
  async cargarSaldoYContinuar(): Promise<void> {
    const uId = this.usuarioId();
    if (!uId) return;

    const montoACargar = Number(this.montoACargarInput());
    const totalGeneral = this.totalPagar;
    const dineroActual = this.saldoActualCliente();
    const faltanteMinimo = totalGeneral - dineroActual;

    if (montoACargar < faltanteMinimo) {
      this.mensajeErrorCarga.set(`El monto a cargar debe ser al menos de $${faltanteMinimo.toFixed(2)} para cubrir la compra.`);
      return;
    }

    try {
      this.mensajeErrorCarga.set('');
      // Actualizamos sumando el saldo cargado en la tabla clientes
      const nuevoDineroTotal = Number((dineroActual + montoACargar).toFixed(2));
      
      const { error } = await supabase
        .from('clientes')
        .update({ dinero: nuevoDineroTotal })
        .eq('id', uId);

      if (error) throw error;

      // Cerramos el modal de saldo insuficiente
      this.mostrarModalSaldoInsuficiente.set(false);

      // Procedemos a ejecutar la compra exitosamente
      await this.ejecutarTransaccionCompra(uId, totalGeneral, this.totalPuntos, this.metodoPago());

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

  finalizarYRedirigir(): void {
    this.mostrarModalExito.set(false);
    this.router.navigate(['/home']);
  }

  volverSeleccion(): void {
    this.location.back();
  }
}