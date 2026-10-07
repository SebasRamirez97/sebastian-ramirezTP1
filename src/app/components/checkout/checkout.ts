import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradasService } from '../../services/entradas.services';
import { ProductosService } from '../../services/productos.service'; 
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css']
})
export class CheckoutComponent implements OnInit {
  funcionId: string = '';
  usuarioId: string | null = null; 
  misAsientos: any[] = [];
  cargando: boolean = true;
  montoIngresadoAnonimo: number = 0;
  
  funcionData: any = {
    precio_pesos: 0,
    precio_puntos: 0
  };
  
  metodoPago: string = 'efectivo';
  creditosAUsar: number = 0;

  // 🍬 Items de Candy Bar seleccionados
  itemsCandySeleccionados: any[] = [];

  // IDs locales si es anónimo
  private idsAsientosAnonimo: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private entradasService: EntradasService,
    private productosService: ProductosService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.funcionId = this.route.snapshot.paramMap.get('funcionId') || '';

    // 🍬 1. Intentamos recuperar del localStorage (método más seguro y persistente)
    const storedCandy = localStorage.getItem('carritoCandyTemp');
    if (storedCandy) {
      try {
        const parsed = JSON.parse(storedCandy);
        // 🔒 Forzamos conversión explícita a número para cada producto
        this.itemsCandySeleccionados = parsed.map((item: any) => ({
          ...item,
          precio: Number(item.precio || 0),
          cantidad: Number(item.cantidad || item.cantidadDeseada || 1)
        }));
      } catch (e) {
        this.itemsCandySeleccionados = [];
      }
    }

    // 🍬 2. Si no hay nada en localStorage, probamos el state del router
    if (this.itemsCandySeleccionados.length === 0) {
      const navegacion = this.router.getCurrentNavigation();
      if (navegacion?.extras.state && navegacion.extras.state['itemsCandy']) {
        const stateItems = navegacion.extras.state['itemsCandy'];
        this.itemsCandySeleccionados = stateItems.map((item: any) => ({
          ...item,
          precio: Number(item.precio || 0),
          cantidad: Number(item.cantidad || item.cantidadDeseada || 1)
        }));
      }
    }

    // 🍬 3. Si aún está vacío, probamos el servicio
    if (this.itemsCandySeleccionados.length === 0) {
      const serviceItems = this.productosService.obtenerCarritoTemp();
      this.itemsCandySeleccionados = serviceItems.map((item: any) => ({
        ...item,
        precio: Number(item.precio || 0),
        cantidad: Number(item.cantidad || item.cantidadDeseada || 1)
      }));
    }

    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user) {
      this.usuarioId = authData.user.id;
    } else {
      this.usuarioId = null;
      const anonimoStr = localStorage.getItem('clienteAnonimo');
      if (anonimoStr) {
        const anonimo = JSON.parse(anonimoStr);
        this.idsAsientosAnonimo = anonimo.asientosSeleccionados || [];
      }
    }

    await this.cargarDatosCheckout();
  }

  async cargarDatosCheckout(): Promise<void> {
    try {
      this.cargando = true;

      // 🛑 SI ES SOLO CANDY BAR: Evitamos buscar funciones ni asientos de cine
      if (!this.funcionId || this.funcionId === 'solo-candy-placeholder-id') {
        this.misAsientos = [];
        this.cargando = false;
        this.cdr.detectChanges();
        return;
      }

      // Si hay función válida, cargamos cine con normalidad
      await this.cargarDetalleFuncion();
      await this.cargarAsientosSeleccionados();

    } catch (error: any) {
      alert('Hubo un error al cargar el resumen de compra: ' + error.message);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); 
    }
  }

  async cargarDetalleFuncion(): Promise<void> {
    const { data, error } = await supabase
      .from('funciones')
      .select('precio_pesos, precio_puntos')
      .eq('id', this.funcionId)
      .single();

    if (!error && data) {
      this.funcionData = data;
    }
  }

  async cargarAsientosSeleccionados(): Promise<void> {
    const todasLasEntradas = await this.entradasService.getEntradasPorFuncion(this.funcionId);
    
    if (!todasLasEntradas) {
      this.misAsientos = [];
      return;
    }

    if (this.usuarioId) {
      this.misAsientos = todasLasEntradas.filter(
        e => e.usuario_id === this.usuarioId && e.estado === 'seleccionado'
      );
    } else {
      this.misAsientos = todasLasEntradas.filter(
        e => this.idsAsientosAnonimo.includes(e.id) && e.estado === 'seleccionado'
      );
    }

    if (this.misAsientos.length === 0) {
      alert('No tienes asientos seleccionados o tu sesión de selección expiró.');
      this.router.navigate(['/cartelera']);
    }
  }

  // 🧮 CÁLCULOS DE TOTALES (Entradas + Candy Bar) con conversiones seguras
  get totalEntradasPesos(): number {
    const precio = Number(this.funcionData?.precio_pesos || 0);
    return Number(this.misAsientos?.length || 0) * precio;
  }

  get totalEntradasPuntos(): number {
    const precioPts = Number(this.funcionData?.precio_puntos || 0);
    return Number(this.misAsientos?.length || 0) * precioPts;
  }

  get totalCandyPesos(): number {
    if (!this.itemsCandySeleccionados || this.itemsCandySeleccionados.length === 0) {
      return 0;
    }
    return this.itemsCandySeleccionados.reduce((acc, item) => {
      // 🔍 Buscamos el precio en cualquiera de las posibles propiedades que use tu BD
      const precio = Number(item.precio_dinero || 0);
      const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
      return acc + (precio * cantidad);
    }, 0);
  }

  get totalCandyPuntos(): number {
    if (!this.itemsCandySeleccionados || this.itemsCandySeleccionados.length === 0) {
      return 0;
    }
    return this.itemsCandySeleccionados.reduce((acc, item) => {
      // 🔍 Buscamos el precio en cualquiera de las posibles propiedades que use tu BD
      const puntos = Number(item.precio_puntos || 0);
      const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
      return acc + (puntos * cantidad);
    }, 0);
  }

  get totalPagar(): number {
    return this.totalEntradasPesos + this.totalCandyPesos;
  }

  get totalPuntos(): number {
    return this.totalEntradasPuntos + this.totalCandyPuntos;
  }

  async confirmarPagoFinal(): Promise<void> {
    try {
      // 🛡️ Validación estricta: Debe haber al menos entradas o snacks en el carrito
      if (this.misAsientos.length === 0 && this.itemsCandySeleccionados.length === 0) {
        alert('Tu carrito está vacío.');
        return;
      }

      const itemsConIdsFisicos = this.productosService.obtenerItemsSeleccionadosParaCheckout(this.itemsCandySeleccionados);
      const itemsCandyParaJson = this.itemsCandySeleccionados.map(item => ({
        nombre: item.nombre,
        precio: Number(item.precio || 0),
        cantidad: Number(item.cantidad || 0)
      }));

      // --- FLUJO ANÓNIMO ---
      if (!this.usuarioId) {
        if (Number(this.montoIngresadoAnonimo) !== Number(this.totalPagar)) {
          alert(`El monto ingresado ($${this.montoIngresadoAnonimo}) debe ser exacto al total a pagar ($${this.totalPagar}).`);
          return;
        }

        const codigoUnico = await this.entradasService.confirmarCompraConCandy(
          null, 
          this.misAsientos, 
          'efectivo',
          itemsCandyParaJson,
          itemsConIdsFisicos 
        );

        const anonimoStr = localStorage.getItem('clienteAnonimo');
        if (anonimoStr) {
          const anonimo = JSON.parse(anonimoStr);
          anonimo.asientosSeleccionados = [];
          localStorage.setItem('clienteAnonimo', JSON.stringify(anonimo));
        }

        // Limpiamos el carrito temporal de candy bar tras la compra exitosa
        localStorage.removeItem('carritoCandyTemp');

        alert(`¡Pago exitoso! Tu código de retiro único es: ${codigoUnico}`);
        
        if (!this.funcionId || this.funcionId === 'solo-candy-placeholder-id') {
          this.router.navigate(['/candy-bar']);
        } else {
          this.router.navigate(['/cartelera']);
        }
        return;
      }

      // --- FLUJO USUARIO REGISTRADO ---
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('dinero, puntos, creditos')
        .eq('id', this.usuarioId)
        .single();

      if (clienteError || !clienteData) {
        throw new Error('No se pudo verificar el saldo de tu cuenta.');
      }

      const dineroActual = Number(clienteData.dinero || 0);
      const puntosActuales = Number(clienteData.puntos || 0);
      const creditosActuales = Number(clienteData.creditos || 0);

      let dineroADescontar = 0;
      let creditosADescontar = 0;

      if (this.metodoPago === 'efectivo') {
        if (dineroActual < this.totalPagar) {
          alert(`Saldo insuficiente. Tienes $${dineroActual} y necesitas $${this.totalPagar}.`);
          return;
        }
        dineroADescontar = this.totalPagar;

      } else if (this.metodoPago === 'puntos') {
        if (this.totalEntradasPesos > 0 && puntosActuales < this.totalPuntos) {
          alert(`Puntos insuficientes. Tienes ${puntosActuales} Pts y necesitas ${this.totalPuntos} Pts.`);
          return;
        }
        
        if (this.misAsientos.length > 0) {
          const nuevosPuntos = puntosActuales - this.totalPuntos;
          const { error: updateError } = await supabase
            .from('clientes')
            .update({ puntos: nuevosPuntos })
            .eq('id', this.usuarioId);
          if (updateError) throw updateError;
        }

      } else if (this.metodoPago === 'mixto') {
        creditosADescontar = Number(this.creditosAUsar || 0);
        
        if (creditosADescontar < 0 || creditosADescontar > creditosActuales || creditosADescontar > this.totalPagar) {
          alert('Monto de créditos inválido.');
          return;
        }

        dineroADescontar = this.totalPagar - creditosADescontar;

        if (dineroActual < dineroADescontar) {
          alert(`Saldo insuficiente. Necesitas $${dineroADescontar} y tienes $${dineroActual}.`);
          return;
        }

        const nuevoDinero = dineroActual - dineroADescontar;
        const nuevosCreditos = creditosActuales - creditosADescontar;

        const { error: updateError } = await supabase
          .from('clientes')
          .update({ dinero: nuevoDinero, creditos: nuevosCreditos })
          .eq('id', this.usuarioId);

        if (updateError) throw updateError;
      }

      if (this.metodoPago === 'efectivo') {
        const nuevoDinero = dineroActual - dineroADescontar;
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ dinero: nuevoDinero })
          .eq('id', this.usuarioId);

        if (updateError) throw updateError;
      }

      // 🛒 Confirmamos compra general con entradas y candy bar unidos
      const codigoUnico = await this.entradasService.confirmarCompraConCandy(
        this.usuarioId, 
        this.misAsientos, 
        this.metodoPago,
        itemsCandyParaJson,
        itemsConIdsFisicos
      );

      // Limpiamos el carrito temporal de candy bar tras la compra exitosa
      localStorage.removeItem('carritoCandyTemp');

      alert(`¡Pago exitoso! Tu código de retiro único es: ${codigoUnico}`);
      
      if (!this.funcionId || this.funcionId === 'solo-candy-placeholder-id') {
        this.router.navigate(['/candy-bar']);
      } else {
        this.router.navigate(['/cartelera']);
      }

    } catch (error: any) {
      alert(`Error al procesar el pago: ${error.message}`);
    }
  }

  volverSeleccion(): void {
    if (!this.funcionId || this.funcionId === 'solo-candy-placeholder-id') {
      this.router.navigate(['/candy-bar']); 
    } else {
      this.router.navigate(['/seleccionar-asientos', this.funcionId]); 
    }
  }
}