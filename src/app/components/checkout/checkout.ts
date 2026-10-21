import { Component, OnInit, signal, inject } from '@angular/core';
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
  // 🔹 Inyección moderna con inject()
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entradasService = inject(EntradasService);
  private productosService = inject(ProductosService);

  // 🔹 Declaración de estados con Signals (adiós a ChangeDetectorRef)
  funcionId = signal<string>('');
  usuarioId = signal<string | null>(null);
  misAsientos = signal<any[]>([]);
  cargando = signal<boolean>(true);
  montoIngresadoAnonimo = signal<number>(0);
  
  funcionData = signal<any>({
    precio_pesos: 0,
    precio_puntos: 0
  });
  
  metodoPago = signal<string>('efectivo');
  creditosAUsar = signal<number>(0);

  // 🍬 Items de Candy Bar seleccionados
  itemsCandySeleccionados = signal<any[]>([]);

  // IDs locales si es anónimo
  private idsAsientosAnonimo: string[] = [];

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('funcionId') || '';
    this.funcionId.set(idParam);

    let candyTemp: any[] = [];
    // 🍬 1. Intentamos recuperar del localStorage el carrito temporal del Candy Bar
    const storedCandy = localStorage.getItem('carritoCandyTemp');
    if (storedCandy) {
      try {
        const parsed = JSON.parse(storedCandy);
        candyTemp = parsed.map((item: any) => ({
          ...item,
          precio: Number(item.precio || item.precio_dinero || 0),
          cantidad: Number(item.cantidad || item.cantidadDeseada || 1)
        }));
      } catch (e) {
        candyTemp = [];
      }
    }

    // 🍬 2. Si no hay nada en localStorage, probamos el servicio
    if (candyTemp.length === 0) {
      const serviceItems = this.productosService.obtenerCarritoTemp();
      candyTemp = serviceItems.map((item: any) => ({
        ...item,
        precio: Number(item.precio || item.precio_dinero || 0),
        cantidad: Number(item.cantidad || item.cantidadDeseada || 1)
      }));
    }
    this.itemsCandySeleccionados.set(candyTemp);

    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user) {
      this.usuarioId.set(authData.user.id);
    } else {
      this.usuarioId.set(null);
      const anonimoStr = localStorage.getItem('clienteAnonimo');
      if (anonimoStr) {
        const anonimo = JSON.parse(anonimoStr);
        this.idsAsientosAnonimo = anonimo.asientosSeleccionados || [];
      }
    }

    // 🎟️ 3. Respaldamos/recuperamos los asientos seleccionados si no vinieron por parámetro
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
      alert('Hubo un error al cargar el resumen de compra: ' + error.message);
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
        e => e.usuario_id === uId && (e.estado === 'seleccionado' || e.estado === 'ocupado')
      );
      this.misAsientos.set(filtrados);
    } else {
      const filtrados = todasLasEntradas.filter(
        e => this.idsAsientosAnonimo.includes(e.id) && (e.estado === 'seleccionado' || e.estado === 'ocupado')
      );
      this.misAsientos.set(filtrados);
    }
  }

  // 🧮 CÁLCULOS DE TOTALES UNIFICADOS
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
    if (!items || items.length === 0) {
      return 0;
    }
    return items.reduce((acc, item) => {
      const precio = Number(item.precio || item.precio_dinero || 0);
      const cantidad = Number(item.cantidad || item.cantidadDeseada || 0);
      return acc + (precio * cantidad);
    }, 0);
  }

  get totalCandyPuntos(): number {
    const items = this.itemsCandySeleccionados();
    if (!items || items.length === 0) {
      return 0;
    }
    return items.reduce((acc, item) => {
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

  // Métodos trackBy para *ngFor
  trackByItemCandy(index: number, item: any): any {
    return item.id || item.producto_id || item.nombre;
  }

  async confirmarPagoFinal(): Promise<void> {
    try {
      if (this.misAsientos().length === 0 && this.itemsCandySeleccionados().length === 0) {
        alert('Tu carrito está vacío.');
        return;
      }

      const itemsConIdsFisicos = this.productosService.obtenerItemsSeleccionadosParaCheckout(this.itemsCandySeleccionados());
      const itemsCandyParaJson = this.itemsCandySeleccionados().map(item => ({
        id: item.id || item.producto_id,
        nombre: item.nombre,
        precio: Number(item.precio || item.precio_dinero || 0),
        cantidad: Number(item.cantidad || item.cantidadDeseada || 0)
      }));

      const totalGeneral = this.totalPagar;
      const uId = this.usuarioId();

      // --- FLUJO ANÓNIMO ---
      if (!uId) {
        const montoIngresado = Number(this.montoIngresadoAnonimo());
        if (montoIngresado !== Number(totalGeneral)) {
          alert(`El monto ingresado ($${montoIngresado}) debe ser exacto al total a pagar ($${totalGeneral}).`);
          return;
        }

        const codigoUnico = await this.entradasService.confirmarCompraConCandy(
          null, 
          this.misAsientos(), 
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
        .eq('id', uId)
        .single();

      if (clienteError || !clienteData) {
        throw new Error('No se pudo verificar el saldo de tu cuenta.');
      }

      const dineroActual = Number(clienteData.dinero || 0);
      let dineroADescontar = 0;

      const metodo = this.metodoPago();
      if (metodo === 'efectivo') {
        if (dineroActual < totalGeneral) {
          alert(`Saldo insuficiente. Tienes $${dineroActual} y necesitas $${totalGeneral}.`);
          return;
        }
        dineroADescontar = totalGeneral;

        const nuevoDinero = dineroActual - dineroADescontar;
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ dinero: nuevoDinero })
          .eq('id', uId);

        if (updateError) throw updateError;
      }

      const codigoUnico = await this.entradasService.confirmarCompraConCandy(
        uId, 
        this.misAsientos(), 
        metodo,
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
    const fId = this.funcionId();
    if (fId && fId !== 'solo-candy-placeholder-id') {
      this.router.navigate(['/seleccionar-asientos', fId]); 
    } else {
      this.router.navigate(['/candybar']); 
    }
  }
}