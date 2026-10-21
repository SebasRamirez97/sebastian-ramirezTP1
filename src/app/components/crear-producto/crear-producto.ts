import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-crear-producto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-producto.html',
  styleUrls: ['./crear-producto.css']
})
export class CrearProductoComponent {
  // 🔹 Inyección moderna con inject()
  private productosService = inject(ProductosService);
  private router = inject(Router);

  // 🔹 Definición de estados con Signals
  submitted = signal<boolean>(false);
  subiendoImagen = signal<boolean>(false);
  selectedFile = signal<File | null>(null);

  categorias = signal<string[]>(['comida', 'bebida', 'juguete', 'ropa']);

  formProducto = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    categoria: new FormControl('', [Validators.required]),
    precio_dinero: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    precio_puntos: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    stock_inicial: new FormControl<number>(1, [Validators.required, Validators.min(1)])
  });

  trackByCategoria(index: number, cat: string): string {
    return cat;
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
    }
  }

  async guardarProducto(): Promise<void> {
    this.submitted.set(true);

    if (this.formProducto.invalid) {
      this.formProducto.markAllAsTouched();
      return;
    }

    try {
      this.subiendoImagen.set(true);
      let urlImagen = '';

      const file = this.selectedFile();
      if (file) {
        urlImagen = await this.productosService.subirImagenProducto(file);
      }

      const datos = this.formProducto.value;
      const cantidadStock = datos.stock_inicial || 1;

      // 1. Creamos el producto base
      const productoCreado = await this.productosService.agregarProducto({
        nombre: datos.nombre!,
        categoria: datos.categoria!,
        precio_dinero: datos.precio_dinero!,
        precio_puntos: datos.precio_puntos!,
        imagen: urlImagen
      });

      // 2. Si el stock inicial es mayor a 1, clonamos las unidades restantes
      if (cantidadStock > 1) {
        await this.productosService.agregarStockMasivo(productoCreado, cantidadStock - 1);
      }

      this.router.navigate(['/admin/productos']);
    } catch (error: any) {
      console.error('Error al agregar producto:', error);
      alert('Ocurrió un error al guardar el producto: ' + (error.message || ''));
    } finally {
      this.subiendoImagen.set(false);
    }
  }

  cancelar(): void {
    this.submitted.set(false);
    this.selectedFile.set(null);
    this.formProducto.reset();
    this.router.navigate(['/prodcutos']);
  }
}