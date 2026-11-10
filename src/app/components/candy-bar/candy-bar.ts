import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductosService } from '../../services/productos.service';
import { AuthService } from '../../services/auth.service';
import { EntradasService } from '../../services/entradas.services'; // 👈 Importamos servicio de entradas
import { ComponenteConAsientosPendientes } from '../../guards/liberar-asientos.guard';

@Component({
  selector: 'app-candy-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './candy-bar.html',
  styleUrls: ['./candy-bar.css']
})
export class CandyBarComponent implements OnInit, ComponenteConAsientosPendientes {
  private productosService = inject(ProductosService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private entradasService = inject(EntradasService); // 👈 Inyectamos servicio de entradas

  rol = toSignal(this.authService.rol$, { initialValue: '' });

  productos = signal<any[]>([]);
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
    this.cargarProductos();
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
    // Si el localStorage está vacío o corrupto, reseteamos la señal
    this.tieneAsientosPendientes.set(false);
    this.funcionIdAsientos = '';
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

      // Inicializamos cada producto manteniendo su cantidadDeseada si ya la había seleccionado antes
      const productosConCantidad = data.map(p => {
        const itemEncontrado = itemsPrevios.find((item: any) => (item.id || item.producto_id) === p.id);
        const cantidadPrevia = itemEncontrado ? (itemEncontrado.cantidad || itemEncontrado.cantidadDeseada || 0) : 0;
        
        return { 
          ...p, 
          cantidadDeseada: p.cantidadDeseada || cantidadPrevia 
        };
      });

      this.productos.set(productosConCantidad);
    } catch (error: any) {
      console.error('Error al cargar productos:', error.message);
    } finally {
      this.cargando.set(false);
    }
  }
  cambiarCantidad(producto: any, delta: number): void {
    this.productos.update(lista => 
      lista.map(p => {
        if (p.id === producto.id) {
          const nuevaCantidad = Math.max(0, (p.cantidadDeseada || 0) + delta);
          return { ...p, cantidadDeseada: nuevaCantidad };
        }
        return p;
      })
    );
  }

  agregarMasStock(producto: any): void {
    // Lógica para stock
  }

  irAlCheckout(): void {
    const listaActual = this.productos();
    const itemsSeleccionados = listaActual.filter(p => (p.cantidadDeseada || p.cantidad || 0) > 0);
    const hayAsientos = this.tieneAsientosPendientes();

    if (itemsSeleccionados.length === 0 && !hayAsientos) {
      alert('Debes seleccionar al menos un producto o volver si no deseas comprar snacks.');
      return;
    }

    const itemsParaGuardar = itemsSeleccionados.map(p => ({
      ...p,
      cantidad: p.cantidadDeseada || p.cantidad || 1
    }));

    localStorage.setItem('carritoCandyTemp', JSON.stringify(itemsParaGuardar));
    this.productosService.guardarCarritoTemp(itemsParaGuardar);

    let funcionIdDestino = 'solo-candy-placeholder-id';
    if (hayAsientos && this.funcionIdAsientos) {
      funcionIdDestino = this.funcionIdAsientos;
    }

    this.router.navigate(['/checkout', funcionIdDestino]);
  }

  trackByProducto(index: number, producto: any): any {
    return producto.id || producto.nombre;
  }

  totalCarritoPrecio = computed(() => {
    return this.productos().reduce((acc, p) => acc + ((p.precio_dinero || 0) * (p.cantidadDeseada || 0)), 0);
  });
}