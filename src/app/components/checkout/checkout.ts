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

    // 🍬 1. Intentamos recuperar del localStorage el carrito temporal del Candy Bar
    const storedCandy = localStorage.getItem('carritoCandyTemp');
    if (storedCandy) {
      try {
        const parsed = JSON.parse(storedCandy);
        this.itemsCandySeleccionados = parsed.map((item: any) => ({
          ...item,
          precio: Number(item.precio || item.precio_dinero || 0),
          cantidad: Number(item.cantidad || item.cantidadDeseada || 1)
        }));
      } catch (e) {
        this.itemsCandySeleccionados = [];
      }
    }

    // 🍬 2. Si no hay nada en localStorage, probamos el servicio
    if (this.itemsCandySeleccionados.length === 0) {
      const serviceItems = this.productosService.obtenerCarritoTemp();
      this.itemsCandySeleccionados = serviceItems.map((item: any) => ({
        ...item,
        precio: Number(item.precio || item.precio_dinero || 0),
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

    // 🎟️ 3. También respaldamos/recuperamos los asientos seleccionados si no vinieron por parámetro de ruta pero están en localStorage
    if (!this.funcionId || this.funcionId === 'solo-candy-placeholder-id') {
      const asientosLocal = localStorage.getItem('asientosSeleccionados');
      if (asientosLocal) {
        try {
          const parsedAsientos = JSON.parse(asientosLocal);
          if (parsedAsientos.length > 0) {
            this.misAsientos = parsedAsientos;
            this.funcionId = parsedAsientos[0].funcion_id;
          }
        } catch (e) {}
      }
    }

    await this.cargarDatosCheckout();
  }

  async cargarDatosCheckout(): Promise<void> {
    try {
      this.cargando = true;

      if (!this.funcionId || this.funcionId === 'solo-candy-placeholder-id') {
        // Si realmente es solo candy bar sin asientos
        if (this.misAsientos.length === 0) {
          this.cargando = false;
          this.cdr.detectChanges();
          return;
        }
      }

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
    if (!this.funcionId) return;
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
    // Si ya los tenemos cargados por localStorage desde la pantalla anterior, los validamos directamente
    if (this.misAsientos && this.misAsientos.length > 0) {
      return;
    }

    if (!this.funcionId) return;

    const todasLasEntradas = await this.entradasService.getEntradasPorFuncion(this.funcionId);
    
    if (!todasLasEntradas) {
      this.misAsientos = [];
      return;
    }

    if (this.usuarioId) {
      this.misAsientos = todasLasEntradas.filter(
        e => e.usuario_id === this.usuarioId && (e.estado === 'seleccionado' || e.estado === 'ocupado')
      );
    } else {
      this.misAsientos = todasLasEntradas.filter(
        e => this.idsAsientosAnonimo.includes(e.id) && (e.estado === 'seleccionado' || e.estado === 'ocupado')
      );
    }
  }

  // 🧮 CÁLCULOS DE TOTALES UNIFICADOS
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
      const precio = Number(item.precio || item.precio_dinero || 0);
      const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
      return acc + (precio * cantidad);
    }, 0);
  }

  get totalCandyPuntos(): number {
    if (!this.itemsCandySeleccionados || this.itemsCandySeleccionados.length === 0) {
      return 0;
    }
    return this.itemsCandySeleccionados.reduce((acc, item) => {
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
      if (this.misAsientos.length === 0 && this.itemsCandySeleccionados.length === 0) {
        alert('Tu carrito está vacío.');
        return;
      }

      const itemsConIdsFisicos = this.productosService.obtenerItemsSeleccionadosParaCheckout(this.itemsCandySeleccionados);
      const itemsCandyParaJson = this.itemsCandySeleccionados.map(item => ({
        id: item.id || item.producto_id,
        nombre: item.nombre,
        precio: Number(item.precio || item.precio_dinero || 0),
        cantidad: Number(item.cantidad || item.cantidadDeseada || 0)
      }));

      // Pasamos el total calculado global (Asientos + Candy Bar)
      const totalGeneral = this.totalPagar;

      // --- FLUJO ANÓNIMO ---
      if (!this.usuarioId) {
        if (Number(this.montoIngresadoAnonimo) !== Number(totalGeneral)) {
          alert(`El monto ingresado ($${this.montoIngresadoAnonimo}) debe ser exacto al total a pagar ($${totalGeneral}).`);
          return;
        }

        const codigoUnico = await this.entradasService.confirmarCompraConCandy(
          null, 
          this.misAsientos, 
          'efectivo',
          itemsCandyParaJson,
          itemsConIdsFisicos,
          totalGeneral
        );

        localStorage.removeItem('carritoCandyTemp');
        localStorage.removeItem('asientosSeleccionados');

        alert(`¡Pago exitoso! Tu código de retiro único es: ${codigoUnico}`);
        this.router.navigate(['/cartelera']);
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
      let dineroADescontar = 0;

      if (this.metodoPago === 'efectivo') {
        if (dineroActual < totalGeneral) {
          alert(`Saldo insuficiente. Tienes $${dineroActual} y necesitas $${totalGeneral}.`);
          return;
        }
        dineroADescontar = totalGeneral;

        const nuevoDinero = dineroActual - dineroADescontar;
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ dinero: nuevoDinero })
          .eq('id', this.usuarioId);

        if (updateError) throw updateError;
      }

      // 🛒 Confirmamos compra general unificada pasando el total correcto
      const codigoUnico = await this.entradasService.confirmarCompraConCandy(
        this.usuarioId, 
        this.misAsientos, 
        this.metodoPago,
        itemsCandyParaJson,
        itemsConIdsFisicos,
        totalGeneral
      );

      localStorage.removeItem('carritoCandyTemp');
      localStorage.removeItem('asientosSeleccionados');

      alert(`¡Pago exitoso! Tu código de retiro único es: ${codigoUnico}`);
      this.router.navigate(['/cartelera']);

    } catch (error: any) {
      alert(`Error al procesar el pago: ${error.message}`);
    }
  }

  volverSeleccion(): void {
    if (this.funcionId && this.funcionId !== 'solo-candy-placeholder-id') {
      this.router.navigate(['/seleccionar-asientos', this.funcionId]); 
    } else {
      this.router.navigate(['/candybar']); 
    }
  }
}