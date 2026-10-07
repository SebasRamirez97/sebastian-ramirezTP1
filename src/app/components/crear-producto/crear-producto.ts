import { Component } from '@angular/core';
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
  submitted = false;
  subiendoImagen = false;
  selectedFile: File | null = null;

  categorias: string[] = ['comida', 'bebida', 'juguete', 'ropa'];

  formProducto = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    categoria: new FormControl('', [Validators.required]),
    precio_dinero: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    precio_puntos: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    stock_inicial: new FormControl<number>(1, [Validators.required, Validators.min(1)]) // 👈 NUEVO: Control para el stock inicial físico
  });

  constructor(
    private productosService: ProductosService,
    private router: Router
  ) {}

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  async guardarProducto() {
    this.submitted = true;

    if (this.formProducto.invalid) {
      this.formProducto.markAllAsTouched();
      return;
    }

    try {
      this.subiendoImagen = true;
      let urlImagen = '';

      if (this.selectedFile) {
        urlImagen = await this.productosService.subirImagenProducto(this.selectedFile);
      }

      const datos = this.formProducto.value;
      const cantidadStock = datos.stock_inicial || 1;

      // 1. Primero creamos el producto base (esto crea la primera unidad física)
      const productoCreado = await this.productosService.agregarProducto({
        nombre: datos.nombre!,
        categoria: datos.categoria!,
        precio_dinero: datos.precio_dinero!,
        precio_puntos: datos.precio_puntos!,
        imagen: urlImagen
      });

      // 2. Si el administrador indicó un stock inicial mayor a 1, clonamos las unidades restantes
      if (cantidadStock > 1) {
        // Restamos 1 porque 'agregarProducto' ya creó la primera unidad
        await this.productosService.agregarStockMasivo(productoCreado, cantidadStock - 1);
      }

      this.router.navigate(['/admin/productos']); // O la ruta de tu panel admin
    } catch (error: any) {
      console.error('Error al agregar producto:', error);
      alert('Ocurrió un error al guardar el producto: ' + (error.message || ''));
    } finally {
      this.subiendoImagen = false;
    }
  }

  cancelar() {
    this.submitted = false;
    this.formProducto.reset();
    this.router.navigate(['/prodcutos']);
  }
}