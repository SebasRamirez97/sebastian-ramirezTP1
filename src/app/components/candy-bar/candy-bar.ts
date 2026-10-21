import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductosService } from '../../services/productos.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-candy-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './candy-bar.html',
  styleUrls: ['./candy-bar.css']
})
export class CandyBarComponent implements OnInit {
  private productosService = inject(ProductosService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // 🔹 Convertimos el observable del rol en un Signal de lectura automática
  rol = toSignal(this.authService.rol$, { initialValue: '' });

  // 🔹 Declaramos los estados principales como Signals
  productos = signal<any[]>([]);
  cargando = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    await this.cargarProductos();
  }

  async cargarProductos(): Promise<void> {
    try {
      this.cargando.set(true);
      const data = await this.productosService.getProductosAgrupados();
      // Inicializamos cada producto con cantidadDeseada en 0 si no la tiene
      const productosConCantidad = data.map(p => ({ ...p, cantidadDeseada: p.cantidadDeseada || 0 }));
      this.productos.set(productosConCantidad);
    } catch (error: any) {
      console.error('Error al cargar productos:', error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarCantidad(producto: any, delta: number): void {
    // Actualizamos el array de productos de forma inmutable para que la señal detecte el cambio
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
    // Tu lógica para sumar stock masivo
  }

  irAlCheckout(): void {
    const listaActual = this.productos();
    const itemsSeleccionados = listaActual.filter(p => (p.cantidadDeseada || p.cantidad || 0) > 0);

    if (itemsSeleccionados.length === 0) {
      alert('Debes seleccionar al menos un producto.');
      return;
    }

    const itemsParaGuardar = itemsSeleccionados.map(p => ({
      ...p,
      cantidad: p.cantidadDeseada || p.cantidad || 1
    }));

    localStorage.setItem('carritoCandyTemp', JSON.stringify(itemsParaGuardar));
    this.productosService.guardarCarritoTemp(itemsParaGuardar);

    this.router.navigate(['/checkout', 'solo-candy-placeholder-id']);
  }
  // Función trackBy recomendada al usar *ngFor con objetos
  trackByProducto(index: number, producto: any): any {
    return producto.id || producto.nombre;
  }
  // 🔹 Una propiedad calculada (computed) para el total del precio del carrito
  totalCarritoPrecio = computed(() => {
    return this.productos().reduce((acc, p) => acc + ((p.precio_dinero || 0) * (p.cantidadDeseada || 0)), 0);
  });
}