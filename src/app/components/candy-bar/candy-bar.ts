import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs'; // 👈 Importante para desuscribirse
import { ProductosService } from '../../services/productos.service';
import { AuthService } from '../../services/auth.service'; // 👈 Tu servicio de autenticación

@Component({
  selector: 'app-candy-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './candy-bar.html',
  styleUrls: ['./candy-bar.css']
})
export class CandyBarComponent implements OnInit, OnDestroy {
  productos: any[] = [];
  cargando: boolean = true;
  rol: string = ''; 
  private rolSub!: Subscription;

  constructor(
    private productosService: ProductosService,
    private authService: AuthService, // 👈 Inyectamos tu AuthService
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    // 🔹 Nos suscribimos al observable de rol de tu AuthService (igual que en el sidebar)
    this.rolSub = this.authService.rol$.subscribe((nuevoRol) => {
      this.rol = nuevoRol;
      this.cdr.detectChanges(); // Forzamos actualización visual al cambiar de rol
    });

    await this.cargarProductos();
  }

  ngOnDestroy(): void {
    // Evitamos fugas de memoria desuscribiéndonos al destruir el componente
    if (this.rolSub) {
      this.rolSub.unsubscribe();
    }
  }

  async cargarProductos(): Promise<void> {
    try {
      this.cargando = true;
      this.productos = await this.productosService.getProductosAgrupados();
    } catch (error: any) {
      console.error('Error al cargar productos:', error.message);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  cambiarCantidad(producto: any, delta: number): void {
    if (!producto.cantidadDeseada) {
      producto.cantidadDeseada = 0;
    }
    producto.cantidadDeseada += delta;
    if (producto.cantidadDeseada < 0) producto.cantidadDeseada = 0;
  }

  agregarMasStock(producto: any): void {
    // Tu lógica para sumar stock masivo
  }

  irAlCheckout(): void {
    // Filtramos los productos que tengan cantidad mayor a 0 (revisando ambas posibles propiedades de cantidad)
    const itemsSeleccionados = this.productos.filter(p => (p.cantidadDeseada || p.cantidad || 0) > 0);

    if (itemsSeleccionados.length === 0) {
      alert('Debes seleccionar al menos un producto.');
      return;
    }

    // 🛒 Guardamos una copia limpia en localStorage para garantizar que el checkout los lea sí o sí
    const itemsParaGuardar = itemsSeleccionados.map(p => ({
      ...p,
      cantidad: p.cantidadDeseada || p.cantidad || 1 // Aseguramos que la propiedad se llame 'cantidad'
    }));

    localStorage.setItem('carritoCandyTemp', JSON.stringify(itemsParaGuardar));

    // También actualizamos el servicio por si lo usa otra parte
    this.productosService.guardarCarritoTemp(itemsParaGuardar);

    this.router.navigate(['/checkout', 'solo-candy-placeholder-id']);
  }

  get totalCarritoPrecio(): number {
  return this.productos.reduce((acc, p) => acc + ((p.precio_dinero || 0) * (p.cantidadDeseada || 0)), 0);
}
}